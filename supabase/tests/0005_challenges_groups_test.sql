-- Uji Irisan 5 (Challenge & grup). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0005.
\o /dev/null
begin;
-- Trigger badge (irisan 9) tertunda sampai commit; di uji dipaksa langsung.
set constraints all immediate;

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

-- Akun: O pemilik merchant, A admin, W1..W4 warga Cimahi Tengah, L akun lama tanpa kecamatan
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-000000000001', 'w1@uji.test'),
  ('00000000-0000-0000-0000-000000000002', 'w2@uji.test'),
  ('00000000-0000-0000-0000-000000000003', 'w3@uji.test'),
  ('00000000-0000-0000-0000-000000000004', 'w4@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 'l@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 1), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now();
update public.profiles set home_district_id = (select id from public.regions where name = 'Cimahi Tengah')
  where id not in ('00000000-0000-0000-0000-00000000000c');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
create temp table res (k text primary key, v jsonb);
grant all on table ids, tok, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'merchant', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(
    json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10', 'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.890000, 'lng', 107.540000),
    json_build_object('name', 'Cabang Cibabat', 'address', 'Jl. Cibabat 5', 'district_id', (select id from public.regions where name = 'Cimahi Utara'), 'lat', -6.870000, 'lng', 107.550000)))::jsonb);
insert into ids select 'outlet1', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'merchant') and name = 'Cabang Baros';
insert into ids select 'outlet2', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'merchant') and name = 'Cabang Cibabat';
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'merchant'), true, null);

-- ---------------------------------------------------------------------------
-- 1. Grup: buat, gabung, batas, ketua
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select pg_temp.assert_fails($$select public.create_group('ab')$$, 'invalid_group_name', 'nama grup minimal 3 karakter');
insert into ids select 'g1', public.create_group('Geng Baros');
insert into tok select 'code', invite_code from public.groups where id = (select v from ids where k = 'g1');
select pg_temp.assert((select v from tok where k = 'code') ~ '^[A-Z0-9]{6}$', 'kode undangan 6 karakter');
select pg_temp.assert((select count(*) from public.group_members where group_id = (select v from ids where k = 'g1') and role = 'leader') = 1, 'pembuat jadi ketua');
select pg_temp.assert_fails($$select public.join_group((select v from tok where k = 'code'))$$, 'already_in_group', 'ketua tidak bisa gabung lagi');
select pg_temp.assert_fails($$insert into public.groups (name, leader_id, invite_code) values ('X', auth.uid(), 'ABCDEF')$$, 'permission denied', 'grup hanya lewat fungsi');

select pg_temp.login('00000000-0000-0000-0000-000000000002');
select pg_temp.assert(public.join_group('ZZZZZZ') is null, 'kode salah ditolak (null, percobaan dicatat)');
select pg_temp.assert((select count(*) from public.groups) = 0, 'bukan anggota tidak melihat grup');
select public.join_group(lower((select v from tok where k = 'code')));
select pg_temp.assert((select count(*) from public.groups) = 1, 'anggota melihat grupnya');
select pg_temp.login('00000000-0000-0000-0000-000000000003');
select public.join_group((select v from tok where k = 'code'));
select pg_temp.login('00000000-0000-0000-0000-000000000004');
select public.join_group((select v from tok where k = 'code'));
select pg_temp.assert((select count(*) from public.group_members where group_id = (select v from ids where k = 'g1') and status = 'active') = 4, '4 anggota aktif');

-- Maksimal 3 grup per warga
select pg_temp.login('00000000-0000-0000-0000-000000000002');
select public.create_group('Grup Dua');
select public.create_group('Grup Tiga');
select pg_temp.assert_fails($$select public.create_group('Grup Empat')$$, 'too_many_groups', 'maksimal 3 grup per warga');

-- Hanya ketua yang bisa mengeluarkan dan membuat kode baru
select pg_temp.assert_fails($$select public.remove_group_member((select v from ids where k = 'g1'), '00000000-0000-0000-0000-000000000003')$$, 'not_group_leader', 'anggota biasa tidak bisa mengeluarkan');
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select pg_temp.assert(public.regenerate_invite_code((select v from ids where k = 'g1')) <> (select v from tok where k = 'code'), 'kode baru berbeda');
select pg_temp.assert(public.join_group((select v from tok where k = 'code')) is null, 'kode lama tidak berlaku');

-- ---------------------------------------------------------------------------
-- 2. Challenge grup: target 4 check-in berbeda, join lewat grup
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails(
  $$select public.create_activity((select v from ids where k = 'merchant'), '{"title":"Jelajah","type":"challenge","target_scope":"group","join_mode":"individual","starts_at":"2030-01-01T10:00+07","ends_at":"2030-01-31T14:00+07"}')$$,
  'group_target_requires_group_join', 'target grup wajib join lewat grup');
insert into ids select 'ch', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Jelajah Kedai Lereng', 'type', 'challenge', 'difficulty', 'medium', 'target_scope', 'group', 'join_mode', 'group',
  'group_min', 2, 'group_max', 5, 'target_kind', 'total_checkins', 'target_count', 3,
  'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-31T14:00+07', 'quota', 10)::jsonb);
select pg_temp.assert((select xp_base from public.activities where id = (select v from ids where k = 'ch')) = 250, 'XP challenge medium 250 dari app_settings');
select pg_temp.assert((select target_count from public.challenge_targets where activity_id = (select v from ids where k = 'ch')) = 3, 'target tersimpan');
select public.update_activity((select v from ids where k = 'ch'), '{"target_count":"4"}');
select pg_temp.assert((select target_count from public.challenge_targets where activity_id = (select v from ids where k = 'ch')) = 4, 'target bisa diubah saat draft');
insert into ids select 'cp1', public.add_checkpoint((select v from ids where k = 'ch'), json_build_object('outlet_id', (select v from ids where k = 'outlet1'))::jsonb);
insert into ids select 'cp2', public.add_checkpoint((select v from ids where k = 'ch'), json_build_object('outlet_id', (select v from ids where k = 'outlet2'))::jsonb);
select public.submit_activity((select v from ids where k = 'ch'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ch'), true, null);

-- Challenge individu: target 2 checkpoint berbeda
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ci', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Dua Kedai', 'type', 'challenge', 'difficulty', 'easy', 'target_kind', 'distinct_checkpoints', 'target_count', 2,
  'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-31T14:00+07')::jsonb);
insert into ids select 'ci_cp1', public.add_checkpoint((select v from ids where k = 'ci'), json_build_object('outlet_id', (select v from ids where k = 'outlet1'))::jsonb);
insert into ids select 'ci_cp2', public.add_checkpoint((select v from ids where k = 'ci'), json_build_object('outlet_id', (select v from ids where k = 'outlet2'))::jsonb);
select public.submit_activity((select v from ids where k = 'ci'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ci'), true, null);

-- Join pribadi ditolak untuk join_mode group
select pg_temp.login('00000000-0000-0000-0000-000000000002');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'ch'))$$, 'join_mode_group', 'join_mode group tidak bisa join pribadi');
select pg_temp.assert_fails(
  $$select public.register_group((select v from ids where k = 'ch'), (select v from ids where k = 'g1'), array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::uuid[])$$,
  'not_group_leader', 'hanya ketua yang mendaftarkan grup');
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select pg_temp.assert_fails(
  $$select public.register_group((select v from ids where k = 'ch'), (select v from ids where k = 'g1'), array['00000000-0000-0000-0000-000000000001']::uuid[])$$,
  'invalid_group_size', 'minimal 2 anggota');
select pg_temp.assert_fails(
  $$select public.register_group((select v from ids where k = 'ch'), (select v from ids where k = 'g1'), array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-00000000000c']::uuid[])$$,
  'invalid_group_members', 'bukan anggota grup ditolak');
select pg_temp.assert(public.register_group((select v from ids where k = 'ch'), (select v from ids where k = 'g1'),
  array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002','00000000-0000-0000-0000-000000000003','00000000-0000-0000-0000-000000000004']::uuid[]) = 4, '4 anggota didaftarkan');
select pg_temp.assert((select status from public.participations where activity_id = (select v from ids where k = 'ch') and user_id = auth.uid()) = 'registered', 'ketua langsung registered');
reset role;
select pg_temp.assert((select count(*) from public.participations where activity_id = (select v from ids where k = 'ch') and status = 'invited') = 3, '3 anggota invited');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select pg_temp.assert((select seats_taken from public.v_activity_cards where id = (select v from ids where k = 'ch')) = 4, 'kursi dihitung termasuk invited');
select pg_temp.assert_fails(
  $$select public.register_group((select v from ids where k = 'ch'), (select v from ids where k = 'g1'), array['00000000-0000-0000-0000-000000000001','00000000-0000-0000-0000-000000000002']::uuid[])$$,
  'member_already_joined', 'tidak bisa mendaftar dua kali');

-- Anggota konfirmasi / tolak
select pg_temp.login('00000000-0000-0000-0000-000000000002');
select pg_temp.assert((select count(*) from public.notifications where kind = 'group_registration') = 1, 'anggota dapat notifikasi undangan grup');
insert into ids select 'p2', id from public.participations where activity_id = (select v from ids where k = 'ch') and user_id = auth.uid();
select public.confirm_group_registration((select v from ids where k = 'p2'), true);
select pg_temp.assert((select status from public.participations where id = (select v from ids where k = 'p2')) = 'registered', 'konfirmasi: registered');
select pg_temp.assert_fails($$select public.confirm_group_registration((select v from ids where k = 'p2'), true)$$, 'cannot_confirm', 'konfirmasi dua kali ditolak');
select pg_temp.login('00000000-0000-0000-0000-000000000003');
select public.confirm_group_registration((select id from public.participations where activity_id = (select v from ids where k = 'ch') and user_id = auth.uid()), true);
select pg_temp.login('00000000-0000-0000-0000-000000000004');
select public.confirm_group_registration((select id from public.participations where activity_id = (select v from ids where k = 'ch') and user_id = auth.uid()), false);
select pg_temp.assert((select seats_taken from public.v_activity_cards where id = (select v from ids where k = 'ch')) = 3, 'kursi kembali setelah tolak');

-- ---------------------------------------------------------------------------
-- 3. Check-in challenge: progress, bonus grup, penyelesaian grup
-- ---------------------------------------------------------------------------
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours'
where id in (select v from ids where k in ('ch', 'ci'));
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tok select 'cp1', public.get_checkpoint_qr((select v from ids where k = 'cp1')) ->> 'token';
insert into tok select 'cp2', public.get_checkpoint_qr((select v from ids where k = 'cp2')) ->> 'token';
insert into tok select 'ci_cp1', public.get_checkpoint_qr((select v from ids where k = 'ci_cp1')) ->> 'token';
insert into tok select 'ci_cp2', public.get_checkpoint_qr((select v from ids where k = 'ci_cp2')) ->> 'token';

-- W1 check-in: progress grup 1/4, hanya kunjungan pertama (belum ada bonus grup)
select pg_temp.login('00000000-0000-0000-0000-000000000001');
insert into res select 'w1', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'w1') ->> 'group_progress')::int = 1, 'progress grup 1');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'completed')::boolean = false, 'belum selesai');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'xp_base')::int = 0, 'challenge: tanpa XP dasar saat check-in');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'xp_first_visit')::int = 50, 'kunjungan pertama +50');
select pg_temp.assert(((select v from res where k = 'w1') ->> 'xp_group')::int = 0, 'baru 1 anggota: tanpa bonus grup');
select pg_temp.assert((select status from public.participations where activity_id = (select v from ids where k = 'ch') and user_id = auth.uid()) = 'in_progress', 'status in_progress');
select pg_temp.assert((select progress from public.v_group_progress where group_id = (select v from ids where k = 'g1')) = 1, 'v_group_progress 1');

-- W2 check-in: 2/4
select pg_temp.login('00000000-0000-0000-0000-000000000002');
insert into res select 'w2', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'w2') ->> 'xp_group')::int = 0, '2 anggota: belum bonus grup');

-- W3 check-in: anggota ketiga → bonus grup 20% (50) untuk ketiganya; progress 3/4
select pg_temp.login('00000000-0000-0000-0000-000000000003');
insert into res select 'w3', public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.87, 107.55);
select pg_temp.assert(((select v from res where k = 'w3') ->> 'xp_group')::int = 50, 'anggota ketiga dapat bonus grup 20% dari 250');
select pg_temp.assert(((select v from res where k = 'w3') ->> 'group_progress')::int = 3, 'progress grup 3');
select pg_temp.assert(((select v from res where k = 'w3') ->> 'completed')::boolean = false, 'target 4 belum tercapai');
reset role;
select pg_temp.assert((select count(*) from public.xp_ledger where reason = 'group_bonus' and amount = 50) = 3, 'bonus grup untuk 3 anggota yang hadir');
set local role authenticated;

-- W1 check-in lagi di hari yang sama ditolak
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select pg_temp.assert_fails(
  $$select public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.87, 107.55)$$,
  'already_checked_in_today', 'satu check-in per aktivitas per hari');

-- W4 (menolak undangan) tidak bisa check-in
select pg_temp.login('00000000-0000-0000-0000-000000000004');
select pg_temp.assert_fails(
  $$select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.89, 107.54)$$,
  'not_registered', 'anggota yang menolak tidak terdaftar');

-- Simulasi hari berikutnya: ubah local_date check-in lama (sebagai postgres) lalu W2 check-in → 4/4 selesai
reset role;
alter table public.checkins disable trigger checkins_guard;
update public.checkins set local_date = local_date - 1 where activity_id = (select v from ids where k = 'ch');
alter table public.checkins enable trigger checkins_guard;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-000000000002');
insert into res select 'w2b', public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.87, 107.55);
select pg_temp.assert(((select v from res where k = 'w2b') ->> 'group_progress')::int = 4, 'progress grup 4');
select pg_temp.assert(((select v from res where k = 'w2b') ->> 'completed')::boolean, 'grup mencapai target: selesai');
select pg_temp.assert(((select v from res where k = 'w2b') ->> 'xp_base')::int = 250, 'XP penyelesaian challenge 250');
select pg_temp.assert(((select v from res where k = 'w2b') ->> 'xp_group')::int = 0, 'hari baru: baru 1 anggota, tanpa bonus grup');
reset role;
select pg_temp.assert((select count(*) from public.participations where activity_id = (select v from ids where k = 'ch') and status = 'completed') = 3, 'semua kontributor selesai');
select pg_temp.assert((select count(*) from public.xp_ledger where reason = 'challenge_complete' and amount = 250) = 3, 'XP penyelesaian untuk 3 kontributor');
select pg_temp.assert((select rank from public.v_group_progress where group_id = (select v from ids where k = 'g1')) = 1, 'peringkat grup 1');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 4. Challenge individu: 2 checkpoint berbeda
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.join_activity((select v from ids where k = 'ci'));
insert into res select 'l1', public.perform_checkin((select v from ids where k = 'ci_cp1'), (select v from tok where k = 'ci_cp1'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'l1') ->> 'progress')::int = 1, 'progress pribadi 1');
select pg_temp.assert(((select v from res where k = 'l1') ->> 'completed')::boolean = false, 'belum selesai');
reset role;
alter table public.checkins disable trigger checkins_guard;
update public.checkins set local_date = local_date - 1 where activity_id = (select v from ids where k = 'ci');
alter table public.checkins enable trigger checkins_guard;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
insert into res select 'l2', public.perform_checkin((select v from ids where k = 'ci_cp2'), (select v from tok where k = 'ci_cp2'), -6.87, 107.55);
select pg_temp.assert(((select v from res where k = 'l2') ->> 'progress')::int = 2, 'progress pribadi 2 (checkpoint berbeda)');
select pg_temp.assert(((select v from res where k = 'l2') ->> 'completed')::boolean, 'target tercapai: selesai');
select pg_temp.assert(((select v from res where k = 'l2') ->> 'xp_base')::int = 150, 'XP challenge easy 150');
select pg_temp.assert((select status from public.participations where activity_id = (select v from ids where k = 'ci') and user_id = auth.uid()) = 'completed', 'partisipasi completed');

-- ---------------------------------------------------------------------------
-- 5. Keluar grup: ketua pindah ke anggota paling lama
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-000000000001');
select public.leave_group((select v from ids where k = 'g1'));
select pg_temp.assert((select leader_id from public.groups where id = (select v from ids where k = 'g1')) = '00000000-0000-0000-0000-000000000002', 'ketua pindah ke anggota paling lama');
reset role;
select pg_temp.assert((select count(*) from public.group_members where group_id = (select v from ids where k = 'g1') and role = 'leader' and status = 'active') = 1, 'tepat satu ketua aktif');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) from public.v_group_progress) = 0, 'bukan peserta tidak melihat progress grup challenge lain');

rollback;
\o
select 'SEMUA UJI IRISAN 5 LOLOS' as hasil;
