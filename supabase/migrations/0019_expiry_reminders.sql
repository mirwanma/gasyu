-- 0019: Pengingat voucher dan poin yang hampir kedaluwarsa.
--
-- Setiap pagi (08.05 WIB) cron menjalankan notify_expiring():
-- - voucher_expiring: satu notifikasi per voucher aktif yang kedaluwarsa dalam
--   `reminder.expiry_days` hari (awal 7). Tidak dikirim ulang untuk voucher yang sama.
-- - points_expiring: satu notifikasi per warga berisi jumlah poin yang akan
--   kedaluwarsa dalam jangka yang sama. Paling sering sekali per jangka itu.
-- Akun yang dibekukan atau dihapus tidak dikirimi pengingat.

insert into public.app_settings (key, value) values
  ('reminder.expiry_days', '7')
on conflict (key) do nothing;

create index if not exists redemptions_active_expiry_idx on public.redemptions (expires_at) where status = 'active';

create function public.notify_expiring()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := public.setting_int('reminder.expiry_days');
  v_until timestamptz := now() + make_interval(days => v_days);
  v_row record;
  v_count integer := 0;
begin
  -- Voucher aktif yang hampir kedaluwarsa
  for v_row in
    select r.id, r.user_id, r.code, r.expires_at, rw.title as reward_title, o.name as merchant_name
    from public.redemptions r
    join public.rewards rw on rw.id = r.reward_id
    join public.organizers o on o.id = rw.organizer_id
    join public.profiles p on p.id = r.user_id
    where r.status = 'active'
      and r.expires_at > now() and r.expires_at <= v_until
      and p.deleted_at is null and p.suspended_at is null
      and not exists (
        select 1 from public.notifications n
        where n.user_id = r.user_id and n.kind = 'voucher_expiring' and n.payload ->> 'redemption_id' = r.id::text
      )
  loop
    perform public.notify(v_row.user_id, 'voucher_expiring', jsonb_build_object(
      'redemption_id', v_row.id,
      'reward_title', v_row.reward_title,
      'merchant_name', v_row.merchant_name,
      'expires_at', v_row.expires_at
    ));
    v_count := v_count + 1;
  end loop;

  -- Poin yang hampir kedaluwarsa, dijumlah per warga
  for v_row in
    select c.user_id, sum(c.remaining)::integer as points, min(c.expires_at) as earliest
    from (
      select pl.user_id, pl.expires_at,
        pl.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = pl.id), 0) as remaining
      from public.point_ledger pl
      where pl.amount > 0 and pl.expires_at > now() and pl.expires_at <= v_until
    ) c
    join public.profiles p on p.id = c.user_id
    where c.remaining > 0
      and p.deleted_at is null and p.suspended_at is null
    group by c.user_id
    having not exists (
      select 1 from public.notifications n
      where n.user_id = c.user_id and n.kind = 'points_expiring'
        and n.created_at > now() - make_interval(days => v_days)
    )
  loop
    perform public.notify(v_row.user_id, 'points_expiring', jsonb_build_object(
      'points', v_row.points,
      'expires_at', v_row.earliest
    ));
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

revoke execute on function public.notify_expiring() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('notify_expiring', '5 1 * * *', $cron$select public.notify_expiring()$cron$); -- 08.05 WIB
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal pengingat dilewati: %', sqlerrm;
end;
$$;
