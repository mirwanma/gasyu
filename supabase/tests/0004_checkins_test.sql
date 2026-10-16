-- Uji Irisan 4 (Check-in). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0004.
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

-- Akun: O pemilik merchant, K ketua komunitas, W warga Baros, L warga luar Cimahi, A admin
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000d', 'w@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 'l@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 1), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now();
update public.profiles set home_village_id = (select id from public.regions where name = 'Baros')
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-00000000000d');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
grant all on table ids, tok to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'merchant', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.890000, 'lng', 107.540000)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'merchant');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'community', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'merchant'), true, null);
select public.review_organizer((select v from ids where k = 'community'), true, null);

-- Event 1 (merchant sendiri) dan event 2 (merchant + komunitas cohost), keduanya terbit
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev1', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi Bareng', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp1', public.add_checkpoint((select v from ids where k = 'ev1'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
insert into ids select 'ev2', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi Kolab', 'starts_at', '2030-01-02T10:00+07', 'ends_at', '2030-01-02T14:00+07')::jsonb);
insert into ids select 'cp2', public.add_checkpoint((select v from ids where k = 'ev2'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.submit_activity((select v from ids where k = 'ev1'));
select public.submit_activity((select v from ids where k = 'ev2'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev1'), true, null);
select public.review_activity((select v from ids where k = 'ev2'), true, null);

reset role;
insert into public.activity_partners (activity_id, organizer_id, role, source, status)
values ((select v from ids where k = 'ev2'), (select v from ids where k = 'community'), 'cohost', 'invite', 'accepted');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. QR checkpoint
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.get_checkpoint_qr((select v from ids where k = 'cp1'))$$, 'not_allowed', 'tim organizer lain tidak bisa minta QR');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails($$select public.get_checkpoint_qr((select v from ids where k = 'cp1'))$$, 'not_allowed', 'warga tidak bisa minta QR');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tok select 'cp1', public.get_checkpoint_qr((select v from ids where k = 'cp1')) ->> 'token';
select pg_temp.assert(length((select v from tok where k = 'cp1')) = 16, 'token 16 karakter');
select pg_temp.assert((public.get_checkpoint_qr((select v from ids where k = 'cp1')) ->> 'rotate_seconds')::int = 60, 'rotasi 60 detik dari app_settings');
select pg_temp.assert(public.get_checkpoint_qr((select v from ids where k = 'cp1')) ->> 'token' = (select v from tok where k = 'cp1'), 'token sama dalam slot yang sama');
insert into tok select 'cp2', public.get_checkpoint_qr((select v from ids where k = 'cp2')) ->> 'token';
select pg_temp.assert((select v from tok where k = 'cp2') <> (select v from tok where k = 'cp1'), 'token berbeda per checkpoint');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.get_checkpoint_qr((select v from ids where k = 'cp2'))$$, 'not_allowed', 'cohost tidak bisa tampilkan QR checkpoint milik merchant');
insert into ids select 'cp3', public.add_checkpoint((select v from ids where k = 'ev2'), json_build_object('partner_organizer_id', (select v from ids where k = 'community'),
  'name', 'Basecamp Runners', 'lat', -6.8722, 'lng', 107.5425)::jsonb);
insert into tok select 'cp3', public.get_checkpoint_qr((select v from ids where k = 'cp3')) ->> 'token';
select pg_temp.assert(length((select v from tok where k = 'cp3')) = 16, 'cohost bisa tampilkan QR checkpoint miliknya sendiri');

-- ---------------------------------------------------------------------------
-- 2. Pemeriksaan sebelum check-in
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails(
  $$select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.89, 107.54)$$,
  'activity_not_running', 'belum berjalan tidak bisa check-in');

reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours'
where id in (select v from ids where k in ('ev1', 'ev2'));
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails(
  $$select public.perform_checkin((select v from ids where k = 'cp1'), 'salah-token', -6.89, 107.54)$$,
  'invalid_token', 'token salah ditolak');
select pg_temp.assert_fails(
  $$select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.89, 107.54)$$,
  'not_registered', 'belum daftar tidak bisa check-in');
select public.join_activity((select v from ids where k = 'ev1'));
select public.join_activity((select v from ids where k = 'ev2'));

-- ---------------------------------------------------------------------------
-- 3. Check-in sah di dalam radius
-- ---------------------------------------------------------------------------
create temp table res (k text primary key, v jsonb);
grant all on table res to anon, authenticated;
insert into res select 'w1', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);
select pg_temp.assert(((select v from res where k = 'w1') ->> 'flagged')::boolean = false, 'dalam radius tidak di-flag');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'xp_base')::int = 100, 'XP dasar event 100');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'xp_first_visit')::int = 50, 'kunjungan pertama +50');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'xp_collab')::int = 0, 'tanpa partner tidak ada bonus kolaborasi');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'completed')::boolean, 'event tanpa misi selesai saat check-in');
select pg_temp.assert((select status from public.participations where activity_id = (select v from ids where k = 'ev1') and user_id = '00000000-0000-0000-0000-00000000000d') = 'completed', 'partisipasi completed');
select pg_temp.assert((select sum(amount) from public.xp_ledger where user_id = '00000000-0000-0000-0000-00000000000d') = 150, 'ledger XP 150');
select pg_temp.assert((select count(*) from public.checkins) = 1, 'warga melihat check-in miliknya');
select pg_temp.assert((select total_xp from public.v_user_level where user_id = '00000000-0000-0000-0000-00000000000d') = 150, 'v_user_level total 150');
select pg_temp.assert((select level from public.v_user_level where user_id = '00000000-0000-0000-0000-00000000000d') = 1, 'level 1');
select pg_temp.assert((select next_min_xp from public.v_user_level where user_id = '00000000-0000-0000-0000-00000000000d') = 500, 'level berikutnya 500');

-- Dua kali sehari ditolak (status partisipasi sudah completed → not_registered; cek unik lewat admin di bawah)
select pg_temp.assert_fails(
  $$select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.89, 107.54)$$,
  'not_registered', 'sudah selesai tidak bisa check-in lagi');

-- Check-in event kolaborasi: bukan kunjungan pertama lagi, dapat bonus 25%
insert into res select 'w2', public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.8901, 107.5401);
select pg_temp.assert(((select v from res where k = 'w2') ->> 'xp_first_visit')::int = 0, 'kunjungan kedua ke merchant yang sama tanpa bonus');
select pg_temp.assert(((select v from res where k = 'w2') ->> 'xp_collab')::int = 25, 'bonus kolaborasi 25% dari 100');
select pg_temp.assert(((select v from res where k = 'w2') ->> 'total_xp')::int = 275, 'total XP 275');

-- ---------------------------------------------------------------------------
-- 4. Di luar radius: tetap dapat XP tetapi flagged; batas harian
-- ---------------------------------------------------------------------------
reset role;
select public.award_xp('00000000-0000-0000-0000-00000000000c', 950, 'adjustment', null, null, null, 'uji batas harian');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.join_activity((select v from ids where k = 'ev1'));
insert into res select 'l1', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.95, 107.60);
select pg_temp.assert(((select v from res where k = 'l1') ->> 'flagged')::boolean, 'di luar radius di-flag');
select pg_temp.assert(((select v from res where k = 'l1') ->> 'distance_m')::int > 150, 'jarak terhitung');
select pg_temp.assert(((select v from res where k = 'l1') ->> 'xp_base')::int = 50, 'XP dipotong batas harian 1000 (950 + 50)');
select pg_temp.assert(((select v from res where k = 'l1') ->> 'xp_first_visit')::int = 0, 'bonus kunjungan pertama habis oleh batas harian');
select pg_temp.assert((select count(*) from public.fraud_flags) = 0, 'warga tidak bisa baca fraud_flags');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.fraud_flags where kind = 'out_of_radius' and status = 'open') = 1, 'admin melihat flag out_of_radius');
select pg_temp.assert((select count(*) from public.checkins where review_status = 'flagged') = 1, 'satu check-in flagged');

-- Tanpa lokasi: diterima tetapi flagged
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.join_activity((select v from ids where k = 'ev2'));
insert into res select 'l2', public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), null, null);
select pg_temp.assert(((select v from res where k = 'l2') ->> 'flagged')::boolean, 'tanpa lokasi di-flag');

-- ---------------------------------------------------------------------------
-- 5. Privasi dan ledger
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.checkins) = 0, 'cohost tidak melihat check-in di checkpoint milik merchant');
select pg_temp.assert((select count(*) from public.v_checkpoint_checkins) = 0, 'umpan check-in kosong untuk cohost tanpa checkpoint');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.checkins) = 4, 'tim merchant melihat semua check-in di checkpoint miliknya');
select pg_temp.assert((select count(*) from public.v_checkpoint_checkins where nickname = 'ujid') = 2, 'umpan menampilkan nickname');
select pg_temp.assert_fails($$select full_name from public.v_checkpoint_checkins$$, 'does not exist', 'umpan tidak memuat full_name');
select pg_temp.assert_fails($$delete from public.checkins$$, 'permission denied', 'client tidak bisa menghapus check-in');
select pg_temp.assert_fails($$update public.checkins set review_status = 'approved'$$, 'permission denied', 'client tidak bisa mengubah check-in');
reset role;
select pg_temp.assert_fails($$delete from public.checkins$$, 'checkins_append_only', 'ledger check-in tidak bisa dihapus');
select pg_temp.assert_fails($$update public.checkins set user_id = '00000000-0000-0000-0000-00000000000a'$$, 'checkins_core_immutable', 'kolom inti check-in tidak bisa diubah');
select pg_temp.assert_fails(
  $$insert into public.checkins (participation_id, activity_id, user_id, checkpoint_id, partner_organizer_id)
    select id, activity_id, user_id, (select v from ids where k = 'cp1'), (select v from ids where k = 'merchant') from public.participations where user_id = '00000000-0000-0000-0000-00000000000d' and activity_id = (select v from ids where k = 'ev1')$$,
  'checkins_one_per_day', 'satu check-in per aktivitas per hari');

rollback;
\o
select 'SEMUA UJI IRISAN 4 LOLOS' as hasil;
