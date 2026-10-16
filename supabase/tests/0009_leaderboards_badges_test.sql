-- Uji Irisan 9 (Leaderboard dan badge). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0009.
\o /dev/null
begin;
-- Trigger badge tertunda sampai commit; di uji dipaksa langsung.
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

-- Akun: O pemilik merchant, K ketua komunitas, A admin, W1 W2 (Baros), W3 (Cibabat), W4 luar Cimahi
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'w3@uji.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'w4@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set home_village_id = (select id from public.regions where name = 'Cibabat') where id = '00000000-0000-0000-0000-0000000000d3';
update public.profiles set home_village_id = null where id = '00000000-0000-0000-0000-0000000000d4';
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';
update public.app_settings set value = '2' where key = 'leaderboard.min_active_citizens';

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
create temp table res (k text primary key, v jsonb);
grant all on table ids, tok, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'k', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select public.review_organizer((select v from ids where k = 'k'), true, null);

-- ev1 merchant (sendiri), ev2 komunitas + merchant cohost (kolaborasi)
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev1', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Bareng', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp1', public.add_checkpoint((select v from ids where k = 'ev1'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.submit_activity((select v from ids where k = 'ev1'));
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'ev2', public.create_activity((select v from ids where k = 'k'), json_build_object(
  'title', 'Lari Pagi', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp2', public.add_checkpoint((select v from ids where k = 'ev2'), json_build_object('name', 'Lapangan', 'lat', -6.93, 'lng', 107.54)::jsonb);
insert into ids select 'inv', public.invite_partner((select v from ids where k = 'ev2'), (select v from ids where k = 'm'), 'cohost', 0, null);
select public.submit_activity((select v from ids where k = 'ev2'));
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.respond_partner_invite((select v from ids where k = 'inv'), true, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev1'), true, null);
select public.review_activity((select v from ids where k = 'ev2'), true, null);
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours'
where id in (select v from ids where k in ('ev1', 'ev2'));
insert into tok select 'cp1', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp1');
insert into tok select 'cp2', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp2');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Badge "Langkah Pertama" setelah check-in pertama (trigger tertunda)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) from public.badges) = 6, '6 badge awal ter-seed');
select pg_temp.assert((select count(*) from public.user_badges where user_id = '00000000-0000-0000-0000-0000000000d1') = 0, 'belum punya badge');
select public.join_activity((select v from ids where k = 'ev1'));
select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);
select pg_temp.assert((select count(*) from public.user_badges ub join public.badges b on b.id = ub.badge_id
  where ub.user_id = '00000000-0000-0000-0000-0000000000d1' and b.code = 'first_step') = 1, 'badge Langkah Pertama diberikan');
select pg_temp.assert((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'badge_awarded') = 1, 'notifikasi badge dikirim');
select pg_temp.assert_fails($$insert into public.user_badges (user_id, badge_id) values ('00000000-0000-0000-0000-0000000000d1', (select id from public.badges where code = 'regular'))$$,
  'permission denied', 'warga tidak bisa menulis user_badges');
select pg_temp.assert_fails($$select public.award_badges('00000000-0000-0000-0000-0000000000d1')$$, 'permission denied', 'award_badges hanya internal');
-- Kolaborasi: check-in di ev2 (2 partner) dihitung ke badge Kolaborator (butuh 3)
select public.join_activity((select v from ids where k = 'ev2'));
select public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.93, 107.54);
select pg_temp.assert((select count(*) from public.user_badges where user_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'kolaborator belum (baru 1 aktivitas kolaborasi)');

-- Warga lain: W2 (Baros) check-in ev1; W3 (Cibabat) check-in ev2; W4 (luar) check-in ev1
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev1'));
select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.join_activity((select v from ids where k = 'ev2'));
select public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.93, 107.54);
select pg_temp.login('00000000-0000-0000-0000-0000000000d4');
select public.join_activity((select v from ids where k = 'ev1'));
select public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);

-- ---------------------------------------------------------------------------
-- 2. Leaderboard warga: XP W1 = 150 + 100 + 25 + 50 = 325, W2 = 150, W3 = 175, W4 = 150
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select * from public.leaderboard_users(null)$$, 'permission denied', 'fungsi leaderboard internal tidak bisa dipanggil langsung');
select pg_temp.assert_fails($$select * from public.v_leaderboard_users_month$$, 'permission denied', 'view warga lengkap tidak dibuka ke warga');
select pg_temp.assert_fails($$select public.get_leaderboard('x', null, null)$$, 'invalid_scope', 'scope tak dikenal ditolak');
insert into res select 'city', public.get_leaderboard('city', null, null);
select pg_temp.assert(((select v from res where k = 'city') ->> 'total')::int = 4, 'se-kota: 4 warga termasuk luar Cimahi');
select pg_temp.assert((select v from res where k = 'city') -> 'rows' -> 0 ->> 'nickname' = 'ujid1', 'peringkat 1 kota: W1');
select pg_temp.assert(((select v from res where k = 'city') -> 'rows' -> 0 ->> 'xp')::int = 325, 'XP W1 bulan ini 325');
select pg_temp.assert(((select v from res where k = 'city') -> 'me' ->> 'rank')::int = 3, 'W2 peringkat 3 kota (seri dengan W4)');
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'city') -> 'rows') e where e ? 'user_id' or e ? 'full_name') = 0, 'baris leaderboard tanpa user_id/full_name');
insert into res select 'village', public.get_leaderboard('village', null, null);
select pg_temp.assert(((select v from res where k = 'village') ->> 'total')::int = 2, 'Baros: 2 warga (W1, W2)');
select pg_temp.assert((select v from res where k = 'village') ->> 'village_name' = 'Baros', 'nama kelurahan ikut');
select pg_temp.assert(((select v from res where k = 'village') -> 'me' ->> 'rank')::int = 2, 'W2 peringkat 2 di Baros');
select pg_temp.login('00000000-0000-0000-0000-0000000000d4');
insert into res select 'outside', public.get_leaderboard('village', null, null);
select pg_temp.assert(jsonb_array_length((select v from res where k = 'outside') -> 'rows') = 0, 'warga luar Cimahi tidak punya peringkat kelurahan');
select pg_temp.assert((public.get_leaderboard('city', null, null) -> 'me' ->> 'rank')::int = 3, 'warga luar Cimahi tetap masuk peringkat kota');

-- ---------------------------------------------------------------------------
-- 3. Leaderboard kelurahan (min. 2 warga aktif di uji ini)
-- ---------------------------------------------------------------------------
insert into res select 'villages', public.get_leaderboard('villages', null, null);
select pg_temp.assert((select v from res where k = 'villages') -> 'rows' -> 0 ->> 'name' = 'Baros', 'Baros peringkat 1 kelurahan');
select pg_temp.assert(((select v from res where k = 'villages') -> 'rows' -> 0 ->> 'active_citizens')::int = 2, 'Baros 2 warga aktif');
select pg_temp.assert(((select v from res where k = 'villages') -> 'rows' -> 0 ->> 'avg_xp')::numeric = 237.5, 'rata-rata XP Baros (325+150)/2');
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'villages') -> 'rows') e where (e ->> 'name') = 'Cibabat' and (e ->> 'qualifies')::boolean = false) = 1, 'Cibabat (1 warga aktif) tidak memenuhi syarat');
select pg_temp.assert((select count(*) from public.v_leaderboard_villages_month) = 1, 'view kelurahan hanya memuat yang memenuhi syarat');
select pg_temp.assert((select rank from public.v_leaderboard_villages_month where village_name = 'Baros') = 1, 'Baros rank 1 di view');
-- Pindah kelurahan: XP lama tetap di Baros (snapshot)
reset role;
update public.profiles set home_village_id = (select id from public.regions where name = 'Cibabat') where id = '00000000-0000-0000-0000-0000000000d2';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'villages2', public.get_leaderboard('villages', null, null);
select pg_temp.assert((select (e ->> 'xp_total')::int from jsonb_array_elements((select v from res where k = 'villages2') -> 'rows') e where e ->> 'name' = 'Baros') = 475, 'XP W2 tetap tercatat di Baros setelah pindah');
reset role;
update public.profiles set home_village_id = (select id from public.regions where name = 'Baros') where id = '00000000-0000-0000-0000-0000000000d2';
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 4. Streak dan bonus mingguan
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert(public.user_streak_weeks('00000000-0000-0000-0000-0000000000d1') = 1, 'streak W1: 1 minggu');
reset role;
-- Simulasi check-in W1 di 3 minggu sebelumnya (local_date mundur)
alter table public.checkins disable trigger checkins_guard;
alter table public.checkins disable trigger checkins_award_badges;
insert into public.checkins (participation_id, activity_id, user_id, checkpoint_id, partner_organizer_id, checked_in_at, local_date, lat, lng, distance_m)
select p.id, p.activity_id, p.user_id, (select v from ids where k = 'cp1'), (select v from ids where k = 'm'),
  now() - make_interval(weeks => w), public.local_today() - 7 * w, -6.89, 107.54, 10
from public.participations p, generate_series(1, 3) w
where p.user_id = '00000000-0000-0000-0000-0000000000d1' and p.activity_id = (select v from ids where k = 'ev1');
alter table public.checkins enable trigger checkins_award_badges;
alter table public.checkins enable trigger checkins_guard;
select pg_temp.assert(public.user_streak_weeks('00000000-0000-0000-0000-0000000000d1') = 4, 'streak W1: 4 minggu berturut-turut');
select pg_temp.assert(public.award_streak() = 1, 'bonus streak hanya untuk W1 (dua minggu terakhir berturut-turut)');
select pg_temp.assert((select coalesce(sum(amount), 0) from public.xp_ledger where user_id = '00000000-0000-0000-0000-0000000000d1' and reason = 'streak') = 50, 'bonus streak +50 XP');
select pg_temp.assert(public.award_streak() = 0, 'bonus streak tidak dobel di minggu yang sama');
select pg_temp.assert((select count(*) from public.user_badges ub join public.badges b on b.id = ub.badge_id
  where ub.user_id = '00000000-0000-0000-0000-0000000000d1' and b.code = 'consistent') = 1, 'badge Konsisten setelah streak 4 minggu');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.award_streak()$$, 'permission denied', 'award_streak hanya cron');
insert into res select 'home', public.get_citizen_dashboard();
select pg_temp.assert(((select v from res where k = 'home') ->> 'streak_weeks')::int = 4, 'beranda: streak 4 minggu');
select pg_temp.assert(jsonb_array_length((select v from res where k = 'home') -> 'badges') = 2, 'beranda: 2 badge');
select pg_temp.assert(((select v from res where k = 'home') ->> 'rank_village')::int = 1, 'beranda: peringkat 1 kelurahan');
select pg_temp.assert(((select v from res where k = 'home') ->> 'village_rank')::int = 1, 'beranda: kelurahan peringkat 1');

-- ---------------------------------------------------------------------------
-- 5. Badge Langganan (5x di penyelenggara sama) dan Satu Tim
-- ---------------------------------------------------------------------------
reset role;
select pg_temp.assert((select count(*) from public.checkins where user_id = '00000000-0000-0000-0000-0000000000d1' and partner_organizer_id = (select v from ids where k = 'm')) = 4, 'W1 sudah 4x di Kopi Lereng');
alter table public.checkins disable trigger checkins_guard;
alter table public.checkins disable trigger checkins_award_badges;
insert into public.checkins (participation_id, activity_id, user_id, checkpoint_id, partner_organizer_id, checked_in_at, local_date, lat, lng, distance_m)
select p.id, p.activity_id, p.user_id, (select v from ids where k = 'cp1'), (select v from ids where k = 'm'), now() - interval '4 weeks', public.local_today() - 28, -6.89, 107.54, 10
from public.participations p where p.user_id = '00000000-0000-0000-0000-0000000000d1' and p.activity_id = (select v from ids where k = 'ev1');
alter table public.checkins enable trigger checkins_award_badges;
alter table public.checkins enable trigger checkins_guard;
select public.award_badges('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) from public.user_badges ub join public.badges b on b.id = ub.badge_id
  where ub.user_id = '00000000-0000-0000-0000-0000000000d1' and b.code = 'regular') = 1, 'badge Langganan setelah 5x check-in di merchant sama');
select pg_temp.assert(public.award_badges('00000000-0000-0000-0000-0000000000d1') = 0, 'badge tidak diberikan dua kali');

-- ---------------------------------------------------------------------------
-- 6. Juara bulanan (snapshot bulan lalu kosong → 0; bulan ini dipaksa)
-- ---------------------------------------------------------------------------
select pg_temp.assert(public.snapshot_monthly_winners() = 0, 'bulan lalu belum ada data');
insert into public.monthly_village_winners (month, village_id, rank, avg_xp, active_citizens)
select date_trunc('month', public.local_today())::date, village_id, rank, avg_xp, active_citizens from public.leaderboard_villages(null) where rank is not null;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select pg_temp.assert((select count(*) from public.monthly_village_winners) = 1, 'warga bisa membaca juara bulanan');
select pg_temp.assert_fails($$insert into public.monthly_village_winners (month, village_id, rank, avg_xp, active_citizens) values (date '2020-01-01', (select id from public.regions where name = 'Baros'), 1, 1, 1)$$,
  'permission denied', 'warga tidak bisa menulis juara bulanan');
update public.badges set name = 'x' where code = 'first_step';
select pg_temp.assert((select name from public.badges where code = 'first_step') = 'Langkah Pertama', 'warga tidak bisa mengubah badge (RLS: 0 baris berubah)');

rollback;
\o
\echo UJI 0009 LULUS
