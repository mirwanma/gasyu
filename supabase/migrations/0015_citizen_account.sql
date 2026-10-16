-- 0015: Akun warga — ubah profil, ganti kelurahan asal, hapus akun, kontak bantuan.
--
-- Aturan (ALUR-SISTEM bagian 3):
-- - Nama panggilan unik (tanpa beda huruf besar/kecil), 3–20 karakter.
-- - Kelurahan asal bisa diganti maksimal sekali per `profile.village_change_days`
--   hari (awal 90), dicatat di home_village_changed_at. NULL = Luar Cimahi.
-- - Hapus akun: data pribadi di profiles dikosongkan dan deleted_at diisi.
--   Ledger XP/poin tetap ada demi audit, tetapi tidak lagi terhubung ke
--   identitas yang bisa dikenali. Akun ditolak jika masih menjadi satu-satunya
--   pemilik/ketua, atau masih punya pembayaran lunas/menunggu di aktivitas aktif.

insert into public.app_settings (key, value) values
  ('profile.village_change_days', '90'),
  ('support.whatsapp', '""'),
  ('support.email', '""')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Ubah nama panggilan dan nama lengkap
-- -----------------------------------------------------------------------------
create function public.update_my_profile(p_nickname text, p_full_name text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_nickname text := btrim(coalesce(p_nickname, ''));
  v_full_name text := btrim(coalesce(p_full_name, ''));
begin
  if char_length(v_nickname) not between 3 and 20 then
    raise exception 'invalid_nickname';
  end if;
  if char_length(v_full_name) not between 1 and 100 then
    raise exception 'invalid_full_name';
  end if;
  if exists (
    select 1 from public.profiles
    where nickname = v_nickname::extensions.citext and id <> v_uid
  ) then
    raise exception 'nickname_taken';
  end if;

  begin
    update public.profiles set nickname = v_nickname, full_name = v_full_name where id = v_uid;
  exception
    when unique_violation then
      raise exception 'nickname_taken';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ganti kelurahan asal (sekali per N hari)
-- -----------------------------------------------------------------------------
create function public.change_home_village(p_village_id uuid) -- null = Luar Cimahi
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_uid for update;

  if p_village_id is not distinct from v_profile.home_village_id then
    raise exception 'same_village';
  end if;

  if v_profile.home_village_changed_at is not null
     and v_profile.home_village_changed_at > now() - make_interval(days => public.setting_int('profile.village_change_days')) then
    raise exception 'village_change_too_soon';
  end if;

  -- Kelurahan harus aktif dan kotanya juga sudah dibuka (sama seperti onboarding).
  if p_village_id is not null and not exists (
    select 1
    from public.regions v
    join public.regions d on d.id = v.parent_id
    join public.regions c on c.id = d.parent_id
    where v.id = p_village_id
      and v.level = 'village'
      and v.is_active and d.is_active and c.is_active
  ) then
    raise exception 'invalid_village';
  end if;

  update public.profiles
  set home_village_id = p_village_id,
      home_village_changed_at = now()
  where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hapus akun (soft delete)
-- -----------------------------------------------------------------------------
create function public.delete_my_account(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_row record;
begin
  if upper(btrim(coalesce(p_confirm, ''))) <> 'HAPUS' then
    raise exception 'confirmation_required';
  end if;
  if (select is_admin from public.profiles where id = v_uid) then
    raise exception 'admin_account';
  end if;

  -- Satu-satunya pemilik/ketua harus menyerahkan peran dulu.
  if exists (
    select 1
    from public.organizer_members om
    where om.user_id = v_uid
      and om.role in ('owner', 'chair')
      and not exists (
        select 1 from public.organizer_members o2
        where o2.organizer_id = om.organizer_id
          and o2.user_id <> v_uid
          and o2.role in ('owner', 'chair')
      )
  ) then
    raise exception 'transfer_leadership_first';
  end if;

  -- Pembayaran lunas/menunggu di aktivitas yang belum selesai harus diurus dulu.
  if exists (
    select 1
    from public.participations p
    join public.activities a on a.id = p.activity_id
    where p.user_id = v_uid
      and p.payment_status in ('paid', 'awaiting_confirmation')
      and p.status in ('invited', 'registered', 'in_progress')
      and a.status not in ('ended', 'settled', 'cancelled')
  ) then
    raise exception 'active_paid_participation';
  end if;

  -- Batalkan pendaftaran yang belum berjalan.
  for v_row in
    select p.id from public.participations p
    where p.user_id = v_uid and p.status in ('invited', 'registered')
  loop
    perform public.cancel_participation(v_row.id);
  end loop;

  -- Keluar dari grup (peran ketua grup dipindah otomatis).
  for v_row in
    select gm.group_id from public.group_members gm
    where gm.user_id = v_uid and gm.status = 'active'
  loop
    perform public.leave_group(v_row.group_id);
  end loop;

  -- Keluar dari tim penyelenggara dan keanggotaan komunitas.
  delete from public.organizer_members where user_id = v_uid;
  update public.community_memberships
  set status = 'left', ended_at = now()
  where user_id = v_uid and status in ('active', 'pending');

  delete from public.notifications where user_id = v_uid;

  -- Kosongkan data pribadi. Nickname diganti penanda acak supaya tetap unik.
  update public.profiles
  set nickname = 'hapus-' || substr(replace(v_uid::text, '-', ''), 1, 12),
      full_name = null,
      avatar_url = null,
      home_village_id = null,
      deleted_at = now()
  where id = v_uid;
end;
$$;

revoke execute on function public.update_my_profile(text, text),
  public.change_home_village(uuid),
  public.delete_my_account(text)
  from public, anon;
grant execute on function public.update_my_profile(text, text),
  public.change_home_village(uuid),
  public.delete_my_account(text)
  to authenticated;
