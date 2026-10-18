-- 0021: perbaikan hasil review kode untuk 0020 dan fitur pembayaran.
--
-- Isi:
--   * lookup_voucher mengembalikan valid_outlet_ids, supaya kasir langsung tahu voucher tidak
--     berlaku di outletnya sebelum menekan tombol pakai.
--   * v_moderation_flags hanya membaca detail.activity_id yang berbentuk uuid, supaya satu flag
--     dengan detail tak lazim tidak membuat halaman Moderasi gagal.
--   * Bukti bayar lama yang sudah diganti boleh dihapus pemiliknya. Bukti yang sedang tercatat di
--     partisipasi tidak bisa dihapus, jadi jejak pembayaran tetap ada.

create or replace function public.lookup_voucher(p_organizer_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rd public.redemptions;
  v_r public.rewards;
  v_nick text;
begin
  perform public.active_uid();
  if not public.is_team_member(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  select rd.* into v_rd from public.redemptions rd
  join public.rewards r on r.id = rd.reward_id
  where rd.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and r.organizer_id = p_organizer_id;
  if not found then
    raise exception 'invalid_code';
  end if;
  select * into v_r from public.rewards where id = v_rd.reward_id;
  select nickname into v_nick from public.profiles where id = v_rd.user_id;
  return jsonb_build_object(
    'redemption_id', v_rd.id, 'code', v_rd.code, 'title', v_r.title, 'description', v_r.description,
    'nickname', v_nick, 'status', v_rd.status, 'expires_at', v_rd.expires_at, 'used_at', v_rd.used_at,
    'valid', v_rd.status = 'active' and v_rd.expires_at > now(),
    'valid_outlet_ids', v_r.valid_outlet_ids
  );
end;
$$;

create or replace view public.v_moderation_flags as
select
  f.id, f.user_id, f.checkin_id, f.kind, f.detail, f.status, f.created_at, f.reviewed_at,
  pr.nickname::text as nickname, pr.suspended_at, r.name as village_name,
  a.title as activity_title, cp.name as checkpoint_name, o.name as partner_name,
  f.organizer_id, fo.name as organizer_name, fo.type as organizer_type
from public.fraud_flags f
join public.profiles pr on pr.id = f.user_id
left join public.regions r on r.id = pr.home_village_id
left join public.checkins c on c.id = f.checkin_id
left join public.activities a on a.id = coalesce(c.activity_id, case when f.detail ->> 'activity_id' ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
  then (f.detail ->> 'activity_id')::uuid end)
left join public.activity_checkpoints cp on cp.id = c.checkpoint_id
left join public.organizers o on o.id = c.partner_organizer_id
left join public.organizers fo on fo.id = f.organizer_id
where f.kind <> 'out_of_radius' and (select public.is_admin());

do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage tidak tersedia, policy hapus bukti bayar dilewati';
    return;
  end if;
  execute $p$
    create policy payment_proofs_delete_replaced on storage.objects
      for delete to authenticated
      using (
        bucket_id = 'payment-proofs'
        and (storage.foldername(name))[2] = auth.uid()::text
        and not exists (select 1 from public.participations p where p.payment_proof_path = storage.objects.name)
      )
  $p$;
end;
$$;
