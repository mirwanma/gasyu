-- 0017: Foto profil warga.
--
-- - Bucket publik `avatars`, path `<user_id>/<nama-file>`, maks. 2 MB, gambar saja.
--   Warga hanya bisa menulis dan menghapus di foldernya sendiri.
-- - profiles.avatar_url tidak lagi bisa diubah langsung oleh warga; harus lewat
--   set_my_avatar, yang memastikan URL menunjuk ke folder avatars miliknya
--   (supaya tidak bisa diisi gambar dari situs lain).
-- - Foto tampil di profil dan beranda milik warga sendiri, dan di daftar tim
--   penyelenggara (v_organizer_team sudah membawa avatar_url).
-- - Perbaikan delete_my_account (0015): nickname pengganti diambil dari 14 karakter
--   terakhir id, bukan 12 karakter pertama, supaya tidak bentrok antar-akun
--   yang id-nya berawalan sama (misalnya akun dummy).

revoke update (avatar_url) on public.profiles from authenticated;

create function public.set_my_avatar(p_url text) -- null = hapus foto
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if p_url is not null
     and p_url !~ ('^https?://[^[:space:]]+/storage/v1/object/public/avatars/' || v_uid::text || '/[A-Za-z0-9._-]+$') then
    raise exception 'invalid_avatar';
  end if;
  update public.profiles set avatar_url = p_url where id = v_uid;
end;
$$;

revoke execute on function public.set_my_avatar(text) from public, anon;
grant execute on function public.set_my_avatar(text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage tidak tersedia, bucket avatars dilewati';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('avatars', 'avatars', true, 2097152, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy avatars_read_all on storage.objects
      for select to anon, authenticated using (bucket_id = 'avatars')
  $p$;
  execute $p$
    create policy avatars_insert_own on storage.objects
      for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy avatars_update_own on storage.objects
      for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
  execute $p$
    create policy avatars_delete_own on storage.objects
      for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  $p$;
end;
$$;

-- -----------------------------------------------------------------------------
-- Perbaikan: nickname pengganti akun terhapus harus unik
-- -----------------------------------------------------------------------------
create or replace function public.delete_my_account(p_confirm text)
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
  set nickname = 'hapus-' || right(replace(v_uid::text, '-', ''), 14),
      full_name = null,
      avatar_url = null,
      home_village_id = null,
      deleted_at = now()
  where id = v_uid;
end;
$$;
