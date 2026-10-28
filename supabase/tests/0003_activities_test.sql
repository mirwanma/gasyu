-- Uji Irisan 3 (Event). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0003.
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

-- Akun: O pemilik merchant, K ketua komunitas, W warga Cimahi Tengah, L akun lama tanpa kecamatan, A admin
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000d', 'w@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 'l@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 1), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now();
update public.profiles set home_district_id = (select id from public.regions where name = 'Cimahi Tengah')
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
grant all on table ids to anon, authenticated;
set local role authenticated;

-- Merchant dan komunitas approved
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'merchant', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'merchant');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'community', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'merchant'), true, null);
select public.review_organizer((select v from ids where k = 'community'), true, null);

-- ---------------------------------------------------------------------------
-- 1. Merchant membuat event
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails(
  $$select public.create_activity((select v from ids where k = 'community'), '{"title":"X","starts_at":"2030-01-01T10:00+07","ends_at":"2030-01-01T12:00+07"}')$$,
  'not_allowed', 'bukan tim komunitas tidak bisa membuat aktivitas atas namanya');
select pg_temp.assert_fails(
  $$select public.create_activity((select v from ids where k = 'merchant'), '{"title":"Ngopi","starts_at":"2030-01-01T12:00+07","ends_at":"2030-01-01T10:00+07"}')$$,
  'invalid_time', 'waktu selesai harus setelah mulai');
select pg_temp.assert_fails(
  $$select public.create_activity((select v from ids where k = 'merchant'), '{"title":"Ngopi","audience":"members_only","starts_at":"2030-01-01T10:00+07","ends_at":"2030-01-01T12:00+07"}')$$,
  'members_only_requires_community_host', 'merchant tidak bisa members_only');

insert into ids select 'event', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi Bareng Baros', 'goal', 'visit', 'description', 'Kopi gratis buat 50 pendaftar pertama.',
  'scope_region_id', (select id from public.regions where name = 'Cimahi Tengah'),
  'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07', 'quota', 2, 'residency_rule', 'residents_only')::jsonb);
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'event')) = 'draft', 'aktivitas baru = draft');
select pg_temp.assert((select xp_base from public.activities where id = (select v from ids where k = 'event')) = 100, 'xp_base event = 100 dari app_settings');
select pg_temp.assert((select count(*) from public.activity_partners where activity_id = (select v from ids where k = 'event') and role = 'host' and status = 'accepted') = 1, 'host tercatat sebagai partner accepted');

-- Warga tidak melihat draft
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.activities) = 0, 'warga tidak melihat draft');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'event'))$$, 'activity_unavailable', 'tidak bisa join draft');

-- Ajukan tanpa checkpoint gagal
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.submit_activity((select v from ids where k = 'event'))$$, 'checkpoint_required', 'ajukan butuh checkpoint');
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'event'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select pg_temp.assert((select name from public.activity_checkpoints where id = (select v from ids where k = 'cp')) = 'Cabang Baros', 'checkpoint dari outlet memakai nama outlet');
select pg_temp.assert((select radius_m from public.activity_checkpoints where id = (select v from ids where k = 'cp')) = 150, 'radius default dari app_settings');
select pg_temp.assert_fails($$select qr_secret from public.activity_checkpoints$$, 'permission denied', 'qr_secret tidak bisa dibaca client');

select pg_temp.assert(public.submit_activity((select v from ids where k = 'event')) = 'in_review', 'tanpa partner tertunda: in_review');
select pg_temp.assert_fails(
  $$select public.update_activity((select v from ids where k = 'event'), '{"title":"Ubah"}')$$,
  'activity_locked', 'in_review tidak bisa diubah');
select public.withdraw_activity((select v from ids where k = 'event'));
select public.update_activity((select v from ids where k = 'event'), '{"title":"Ngopi Bareng Baros!"}');
select pg_temp.assert(public.submit_activity((select v from ids where k = 'event')) = 'in_review', 'ajukan ulang');

-- ---------------------------------------------------------------------------
-- 2. Admin review
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails($$select public.review_activity((select v from ids where k = 'event'), true, null)$$, 'not_allowed', 'warga tidak bisa review');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.activities where status = 'in_review') = 1, 'admin melihat antrean review');
select public.review_activity((select v from ids where k = 'event'), false, 'Deskripsi kurang jelas');
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'event')) = 'draft', 'ditolak kembali ke draft');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.notifications where kind = 'activity_rejected') = 1, 'host diberi tahu penolakan');
select pg_temp.assert((select review_note from public.activities where id = (select v from ids where k = 'event')) = 'Deskripsi kurang jelas', 'catatan admin terlihat host');
select public.submit_activity((select v from ids where k = 'event'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'event'), true, null);
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'event')) = 'published', 'disetujui: published');
select pg_temp.assert((select count(*) from public.admin_actions where action in ('approve_activity', 'reject_activity')) = 2, 'tindakan admin tercatat');

-- Setelah terbit: hanya deskripsi dan cover yang bisa diubah
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.update_activity((select v from ids where k = 'event'), '{"title":"Judul Baru","description":"Deskripsi baru"}');
select pg_temp.assert((select title from public.activities where id = (select v from ids where k = 'event')) = 'Ngopi Bareng Baros!', 'judul tidak berubah setelah terbit');
select pg_temp.assert((select description from public.activities where id = (select v from ids where k = 'event')) = 'Deskripsi baru', 'deskripsi berubah setelah terbit');
select pg_temp.assert_fails(
  $$update public.activities set is_paid = true, price_idr = 5000, payment_instructions = 'x' where id = (select v from ids where k = 'event')$$,
  'permission denied', 'tabel activities tidak bisa diubah langsung');

-- ---------------------------------------------------------------------------
-- 3. Warga join: domisili, kuota, batal
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from public.v_activity_cards) = 1, 'warga tanpa kecamatan melihat event terbit');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'event'))$$, 'residents_only', 'warga tanpa kecamatan ditolak residents_only');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
insert into ids select 'part', public.join_activity((select v from ids where k = 'event'));
select pg_temp.assert((select status from public.participations where id = (select v from ids where k = 'part')) = 'registered', 'join: registered');
select pg_temp.assert((select payment_status from public.participations where id = (select v from ids where k = 'part')) = 'not_required', 'gratis: not_required');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'event'))$$, 'already_joined', 'tidak bisa join dua kali');
select pg_temp.assert((select seats_taken from public.v_activity_cards) = 1, 'kursi terpakai 1');
select pg_temp.assert_fails($$insert into public.participations (activity_id, user_id) values ((select v from ids where k = 'event'), auth.uid())$$, 'permission denied', 'partisipasi hanya lewat fungsi');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.join_activity((select v from ids where k = 'event'));
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'event'))$$, 'quota_full', 'kuota 2 penuh');
select pg_temp.assert((select count(*) from public.v_activity_participants) = 2, 'tim host melihat 2 peserta (nickname saja)');

-- Warga batal, kursi kembali
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.cancel_participation((select v from ids where k = 'part'));
select pg_temp.assert((select status from public.participations where id = (select v from ids where k = 'part')) = 'cancelled', 'partisipasi dibatalkan');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.join_activity((select v from ids where k = 'event'));
select pg_temp.assert((select count(*) from public.participations where user_id = auth.uid() and status = 'registered') = 1, 'kursi kembali bisa diisi');
-- Warga yang batal bisa join lagi (memakai baris lama)
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'event'))$$, 'quota_full', 'kuota penuh lagi');

-- Peserta lain tidak melihat partisipasi orang lain
select pg_temp.assert((select count(*) from public.participations) = 1, 'warga hanya melihat partisipasinya sendiri');

-- ---------------------------------------------------------------------------
-- 4. Komunitas: members_only
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'member_event', public.create_activity((select v from ids where k = 'community'), json_build_object(
  'title', 'Latihan Khusus Member', 'audience', 'members_only',
  'starts_at', '2030-02-01T06:00+07', 'ends_at', '2030-02-01T08:00+07')::jsonb);
select public.add_checkpoint((select v from ids where k = 'member_event'), '{"name":"Stadion Sangkuriang","lat":-6.88,"lng":107.55}');
select public.submit_activity((select v from ids where k = 'member_event'));
-- Warga W jadi member (kebijakan open) sebelum aktivitas terbit, warga A tidak.
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.request_membership((select v from ids where k = 'community'), null);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'member_event'), true, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'member_event'))$$, 'members_only', 'bukan member ditolak');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.join_activity((select v from ids where k = 'member_event'));
select pg_temp.assert((select count(*) from public.notifications where kind = 'community_new_activity') = 1, 'member diberi tahu aktivitas baru komunitas');

-- ---------------------------------------------------------------------------
-- 5. Pembatalan dan cron status
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.cancel_activity((select v from ids where k = 'member_event'), 'Hujan badai');
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'member_event')) = 'cancelled', 'dibatalkan host');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.notifications where kind = 'activity_cancelled') = 1, 'peserta diberi tahu pembatalan');

reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '1 hour' where id = (select v from ids where k = 'event');
select pg_temp.assert(public.advance_activity_status() = 1, 'cron: published -> running');
select pg_temp.assert((select count(*) from public.participations where activity_id = (select v from ids where k = 'event') and status = 'in_progress') = 2, 'peserta ikut in_progress');
update public.activities set starts_at = now() - interval '50 hours', ends_at = now() - interval '49 hours' where id = (select v from ids where k = 'event');
select pg_temp.assert(public.advance_activity_status() = 1, 'cron: running -> ended');
select pg_temp.assert(public.settle_ended_activities() = 2, 'cron: ended -> settled, 2 peserta not_completed');

select 'SEMUA UJI IRISAN 3 LOLOS' as hasil;
\o
select 'SEMUA UJI IRISAN 3 LOLOS' as hasil;
rollback;
