-- Uji Irisan 2 (Organizer). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0002_organizers_test.sql
\o /dev/null
begin;

create function pg_temp.assert(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'UJI GAGAL: %', p_msg; end if;
end;
$$;

create function pg_temp.assert_fails(p_sql text, p_expected text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'UJI GAGAL: % (error tak terduga: %)', p_msg, sqlerrm;
    end if;
    return;
  end;
  raise exception 'UJI GAGAL: % (seharusnya ditolak)', p_msg;
end;
$$;

create function pg_temp.login(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

grant execute on all functions in schema pg_temp to anon, authenticated;

-- Akun uji: O (pemilik merchant), K (ketua komunitas), P (pengurus), W (warga), A (admin)
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 'p@uji.test'),
  ('00000000-0000-0000-0000-00000000000d', 'w@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-00000000000f', 'x@uji.test');

update public.profiles set nickname = 'owner', full_name = 'Owner Rahasia', terms_accepted_at = now(), onboarded_at = now()
  where id = '00000000-0000-0000-0000-00000000000a';
update public.profiles set nickname = 'ketua', full_name = 'Ketua Rahasia', terms_accepted_at = now(), onboarded_at = now()
  where id = '00000000-0000-0000-0000-00000000000b';
update public.profiles set nickname = 'pengurus', full_name = 'Pengurus Rahasia', terms_accepted_at = now(), onboarded_at = now()
  where id = '00000000-0000-0000-0000-00000000000c';
update public.profiles set nickname = 'warga', full_name = 'Warga Rahasia', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah')
  where id = '00000000-0000-0000-0000-00000000000d';
update public.profiles set nickname = 'admin', full_name = 'Admin', terms_accepted_at = now(), onboarded_at = now(), is_admin = true
  where id = '00000000-0000-0000-0000-00000000000e';
-- X belum onboarding

set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Registrasi merchant oleh O
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails(
  $$select public.register_organizer('merchant', '{"name":"X"}')$$,
  'account_inactive', 'akun belum onboarding tidak bisa mendaftar');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails(
  $$select public.register_organizer('merchant', '{"name":"Kopi Lereng","whatsapp":"0812345678","merchant_category":"kopi","outlets":[]}')$$,
  'outlet_required', 'merchant wajib punya outlet');
select pg_temp.assert_fails(
  $$select public.register_organizer('merchant', '{"name":"Kopi Lereng","whatsapp":"abc","merchant_category":"kopi","outlets":[{"address":"Jl. Baros 1","lat":-6.9,"lng":107.5}]}')$$,
  'invalid_whatsapp', 'nomor WhatsApp divalidasi');
select pg_temp.assert_fails(
  $$select public.register_organizer('platform', '{"name":"Gasyu"}')$$,
  'invalid_type', 'warga tidak bisa membuat organizer platform');

create temp table ids (k text primary key, v uuid);
insert into ids select 'merchant', public.register_organizer('merchant', json_build_object(
  'name', 'Kopi Lereng', 'whatsapp', '+62 812-3456-789', 'merchant_category', 'kopi', 'nib', '',
  'outlets', json_build_array(json_build_object(
    'name', 'Cabang Baros', 'address', 'Jl. Baros No. 10', 'district_id', (select id from public.regions where name = 'Cimahi Tengah'),
    'lat', -6.8906, 'lng', 107.5423, 'opening_hours', json_build_object('mon', json_build_array('08:00', '22:00'))))
)::jsonb);

select pg_temp.assert((select status from public.organizers where id = (select v from ids where k = 'merchant')) = 'pending', 'merchant baru berstatus pending');
select pg_temp.assert((select slug from public.organizers where id = (select v from ids where k = 'merchant')) = 'kopi-lereng', 'slug dibuat dari nama');
select pg_temp.assert((select whatsapp from public.merchant_profiles where organizer_id = (select v from ids where k = 'merchant')) = '08123456789', 'WhatsApp dinormalkan ke 08');
select pg_temp.assert(public.team_role((select v from ids where k = 'merchant')) = 'owner', 'pendaftar menjadi owner');
select pg_temp.assert((select count(*) from public.merchant_outlets where organizer_id = (select v from ids where k = 'merchant')) = 1, 'outlet tersimpan');

-- Pemilik bisa mengubah nama, tidak bisa mengubah status
update public.organizers set name = 'Kopi Lereng Baros' where id = (select v from ids where k = 'merchant');
select pg_temp.assert((select name from public.organizers where id = (select v from ids where k = 'merchant')) = 'Kopi Lereng Baros', 'tim bisa mengubah nama');
select pg_temp.assert_fails(
  $$update public.organizers set status = 'approved' where id = (select v from ids where k = 'merchant')$$,
  'permission denied', 'tim tidak bisa menyetujui dirinya sendiri');

-- Slug kedua bertambah angka
insert into ids select 'merchant2', public.register_organizer('merchant', json_build_object(
  'name', 'Kopi Lereng', 'whatsapp', '08129999999', 'merchant_category', 'kuliner',
  'outlets', json_build_array(json_build_object('address', 'Jl. Melong 2', 'lat', -6.9, 'lng', 107.5)))::jsonb);
select pg_temp.assert((select slug from public.organizers where id = (select v from ids where k = 'merchant2')) = 'kopi-lereng-2', 'slug bentrok diberi akhiran');

-- ---------------------------------------------------------------------------
-- 2. Registrasi komunitas oleh K
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'community', public.register_organizer('community', json_build_object(
  'name', 'Cimahi Runners', 'whatsapp', '08120000001', 'interest_category', 'olahraga',
  'activity_area_district_id', (select id from public.regions where name = 'Cimahi Tengah'),
  'social_links', json_build_object('instagram', 'cimahirunners'), 'est_members', 40, 'join_policy', 'approval')::jsonb);

select pg_temp.assert(public.team_role((select v from ids where k = 'community')) = 'chair', 'pendaftar komunitas menjadi chair');
select pg_temp.assert(
  (select count(*) from public.community_memberships where community_id = (select v from ids where k = 'community') and status = 'active') = 1,
  'ketua otomatis member aktif');
select pg_temp.assert_fails(
  $$select public.leave_community((select v from ids where k = 'community'))$$,
  'chair_cannot_leave', 'ketua tidak bisa keluar dari keanggotaan');

-- Warga lain belum melihat komunitas pending
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.organizers where type <> 'platform') = 0, 'warga tidak melihat penyelenggara pending');
select pg_temp.assert_fails(
  $$select public.request_membership((select v from ids where k = 'community'), null)$$,
  'community_unavailable', 'belum bisa gabung ke komunitas pending');

-- ---------------------------------------------------------------------------
-- 3. Admin memverifikasi
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.organizers where status = 'pending') = 3, 'admin melihat antrean');
select pg_temp.assert_fails(
  $$select public.review_organizer((select v from ids where k = 'merchant2'), false, '')$$,
  'note_required', 'penolakan wajib ada catatan');
select public.review_organizer((select v from ids where k = 'merchant2'), false, 'Foto tempat usaha belum ada');
select public.review_organizer((select v from ids where k = 'merchant'), true, null);
select public.review_organizer((select v from ids where k = 'community'), true, null);
select pg_temp.assert((select count(*) from public.admin_actions) = 3, 'tindakan admin tercatat');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails(
  $$select public.review_organizer((select v from ids where k = 'merchant'), true, null)$$,
  'not_allowed', 'warga tidak bisa memverifikasi');
select pg_temp.assert((select count(*) from public.organizers where type <> 'platform') = 2, 'warga melihat yang approved saja');

-- Pemilik yang ditolak mendapat notifikasi dan bisa mengajukan ulang
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(
  (select count(*) from public.notifications where kind = 'organizer_verified' and read_at is null) = 2,
  'pemilik mendapat notifikasi verifikasi');
select pg_temp.assert((select review_note from public.organizers where id = (select v from ids where k = 'merchant2')) is not null, 'catatan penolakan terlihat pemilik');
select public.resubmit_organizer((select v from ids where k = 'merchant2'));
select pg_temp.assert((select status from public.organizers where id = (select v from ids where k = 'merchant2')) = 'pending', 'pengajuan ulang kembali pending');
select public.mark_notifications_read();
select pg_temp.assert((select count(*) from public.notifications where read_at is null) = 0, 'notifikasi ditandai dibaca');

-- ---------------------------------------------------------------------------
-- 4. Undangan tim
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails(
  $$select public.create_organizer_invite((select v from ids where k = 'community'), 'staff')$$,
  'invalid_member_role', 'komunitas hanya mengundang officer');
create temp table tok as select public.create_organizer_invite((select v from ids where k = 'community'), 'officer') as t;

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails(
  $$select public.create_organizer_invite((select v from ids where k = 'community'), 'officer')$$,
  'not_allowed', 'warga biasa tidak bisa mengundang');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails($$select public.accept_organizer_invite('salah')$$, 'invite_invalid', 'token salah ditolak');
select pg_temp.assert(public.accept_organizer_invite((select t from tok)) = (select v from ids where k = 'community'), 'undangan diterima');
select pg_temp.assert(public.team_role((select v from ids where k = 'community')) = 'officer', 'P menjadi officer');
select pg_temp.assert(
  (select status from public.community_memberships where community_id = (select v from ids where k = 'community') and user_id = auth.uid()) = 'active',
  'officer otomatis member aktif');
select pg_temp.assert_fails($$select public.accept_organizer_invite((select t from tok))$$, 'invite_invalid', 'token sekali pakai');

-- Pengurus tidak bisa mencabut ketua; ketua terakhir tidak bisa dicabut
select pg_temp.assert_fails(
  $$select public.remove_team_member((select v from ids where k = 'community'), '00000000-0000-0000-0000-00000000000b')$$,
  'not_allowed', 'pengurus tidak bisa mencabut ketua');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails(
  $$select public.remove_team_member((select v from ids where k = 'community'), '00000000-0000-0000-0000-00000000000b')$$,
  'last_leader_cannot_be_removed', 'ketua terakhir tidak bisa dicabut');

-- Tim melihat rekan tim lewat view, tanpa nama lengkap
select pg_temp.assert((select count(*) from public.v_organizer_team where organizer_id = (select v from ids where k = 'community')) = 2, 'view tim menampilkan 2 orang');
select pg_temp.assert(
  (select count(*) from public.profiles where id = '00000000-0000-0000-0000-00000000000c') = 0,
  'ketua tidak bisa membaca baris profil pengurus (nama lengkap tersembunyi)');

-- ---------------------------------------------------------------------------
-- 5. Keanggotaan komunitas
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert(public.request_membership((select v from ids where k = 'community'), 'Sudah ikut latihan 2 bulan') = 'pending', 'kebijakan approval: pending');
select pg_temp.assert_fails(
  $$select public.request_membership((select v from ids where k = 'community'), null)$$,
  'already_requested', 'tidak bisa minta dua kali');
select pg_temp.assert_fails(
  $$select public.request_membership((select v from ids where k = 'merchant'), null)$$,
  'community_unavailable', 'tidak bisa jadi member merchant');

-- Tim mendapat notifikasi dan melihat permintaan lewat view
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from public.notifications where kind = 'membership_requested') = 1, 'pengurus mendapat notifikasi permintaan');
select pg_temp.assert(
  (select nickname from public.v_community_members where community_id = (select v from ids where k = 'community') and status = 'pending') = 'warga',
  'view member menampilkan nickname');
select pg_temp.assert(
  (select district_name from public.v_community_members where community_id = (select v from ids where k = 'community') and status = 'pending') = 'Cimahi Tengah',
  'view member menampilkan kecamatan');
select pg_temp.assert((select pending_requests from public.v_community_member_stats where community_id = (select v from ids where k = 'community')) = 1, 'statistik: 1 permintaan');
insert into ids select 'req', id from public.v_community_members where status = 'pending';

-- Warga lain tidak melihat view member
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.v_community_members) = 0, 'bukan tim: view member kosong');
select pg_temp.assert_fails(
  $$select public.decide_membership((select v from ids where k = 'req'), true)$$,
  'not_allowed', 'bukan tim tidak bisa memutuskan');

-- Pengurus menerima
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.decide_membership((select v from ids where k = 'req'), true);
select pg_temp.assert((select active_members from public.v_community_member_stats where community_id = (select v from ids where k = 'community')) = 3, 'statistik: 3 member aktif');
select pg_temp.assert((select new_members_month from public.v_community_member_stats where community_id = (select v from ids where k = 'community')) = 3, 'statistik: member baru bulan ini');
select pg_temp.assert(public.community_public_stats((select v from ids where k = 'community')) = 3, 'statistik publik');

-- Pengurus tidak bisa mengeluarkan ketua
select pg_temp.assert_fails(
  $$select public.remove_member((select id from public.v_community_members where team_role = 'chair'), 'x')$$,
  'cannot_remove_team', 'pengurus tidak bisa mengeluarkan ketua');

-- Warga mendapat notifikasi, lalu dikeluarkan ketua
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.notifications where kind = 'membership_approved') = 1, 'warga mendapat notifikasi diterima');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.remove_member((select id from public.v_community_members where nickname = 'warga' and status = 'active'), 'Melanggar aturan');
select pg_temp.assert((select count(*) from public.v_community_members where status = 'removed') = 1, 'member dikeluarkan');

-- Cooldown 30 hari
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails(
  $$select public.request_membership((select v from ids where k = 'community'), null)$$,
  'rejoin_cooldown', 'dikeluarkan: tunggu 30 hari');

-- Kebijakan open: langsung aktif
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails(
  $$select public.set_join_policy((select v from ids where k = 'community'), 'open')$$,
  'not_allowed', 'pengurus tidak bisa mengubah kebijakan');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.set_join_policy((select v from ids where k = 'community'), 'open');
select pg_temp.assert_fails(
  $$update public.community_profiles set join_policy = 'approval' where organizer_id = (select v from ids where k = 'community')$$,
  'permission denied', 'join_policy tidak bisa diubah langsung');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.request_membership((select v from ids where k = 'community'), null) = 'active', 'kebijakan open: langsung aktif');
select public.leave_community((select v from ids where k = 'community'));
select pg_temp.assert(public.request_membership((select v from ids where k = 'community'), null) = 'active', 'yang keluar sendiri boleh gabung lagi');

-- Pengurus keluar sebagai member: ikut keluar dari tim
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.leave_community((select v from ids where k = 'community'));
select pg_temp.assert(public.team_role((select v from ids where k = 'community')) is null, 'pengurus yang keluar tidak lagi di tim');

-- ---------------------------------------------------------------------------
-- 6. Cron kedaluwarsa permintaan
-- ---------------------------------------------------------------------------
reset role;
insert into public.community_memberships (community_id, user_id, status, created_at)
values ((select v from ids where k = 'community'), '00000000-0000-0000-0000-00000000000f', 'pending', now() - interval '31 days');
select pg_temp.assert(public.expire_membership_requests() = 1, 'permintaan lewat 30 hari ditolak otomatis');
select pg_temp.assert(
  (select status from public.community_memberships where user_id = '00000000-0000-0000-0000-00000000000f') = 'rejected',
  'status menjadi rejected');

select 'SEMUA UJI IRISAN 2 LOLOS' as hasil;
\o
select 'SEMUA UJI IRISAN 2 LOLOS' as hasil;
rollback;
