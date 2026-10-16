-- Uji Irisan 8 (Dashboard dan moderasi). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0008.
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

-- Akun: O pemilik merchant, K ketua komunitas, A admin, W1 W2 W3 warga, N1–N5 akun baru
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'w3@uji.test'),
  ('00000000-0000-0000-0000-0000000000a1', 'n1@uji.test'),
  ('00000000-0000-0000-0000-0000000000a2', 'n2@uji.test'),
  ('00000000-0000-0000-0000-0000000000a3', 'n3@uji.test'),
  ('00000000-0000-0000-0000-0000000000a4', 'n4@uji.test'),
  ('00000000-0000-0000-0000-0000000000a5', 'n5@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';
-- Warga lama: akun dibuat 30 hari lalu (bukan akun baru)
update public.profiles set created_at = now() - interval '30 days'
where id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-0000000000d3');

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
create temp table res (k text primary key, v jsonb);
grant all on table ids, tok, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.890000, 'lng', 107.540000)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'k', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select public.review_organizer((select v from ids where k = 'k'), true, null);

-- Event merchant dengan poin 100 per penyelesaian dan budget 250; event komunitas 4 km jauhnya
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev1', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Bareng', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp1', public.add_checkpoint((select v from ids where k = 'ev1'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.set_points_per_completion((select v from ids where k = 'ev1'), 100);
select public.set_partner_budget((select id from public.activity_partners where activity_id = (select v from ids where k = 'ev1')), 250);
select public.submit_activity((select v from ids where k = 'ev1'));
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'ev2', public.create_activity((select v from ids where k = 'k'), json_build_object(
  'title', 'Lari Pagi', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp2', public.add_checkpoint((select v from ids where k = 'ev2'), json_build_object('name', 'Lapangan Cisangkan', 'lat', -6.93, 'lng', 107.54)::jsonb);
select public.submit_activity((select v from ids where k = 'ev2'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev1'), true, null);
select public.review_activity((select v from ids where k = 'ev2'), true, null);
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours'
where id in (select v from ids where k in ('ev1', 'ev2'));
set local role authenticated;

-- Token QR
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tok select 'cp1', public.get_checkpoint_qr((select v from ids where k = 'cp1')) ->> 'token';
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into tok select 'cp2', public.get_checkpoint_qr((select v from ids where k = 'cp2')) ->> 'token';

-- W1 check-in sah (dapat 100 poin), W2 check-in di luar radius (flagged), W3 check-in di dua tempat berjauhan
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.join_activity((select v from ids where k = 'ev1'));
insert into res select 'w1', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);
select pg_temp.assert(((select v from res where k = 'w1') ->> 'points')::int = 100, 'W1 dapat 100 poin');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev1'));
insert into res select 'w2', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.95, 107.60);
select pg_temp.assert(((select v from res where k = 'w2') ->> 'flagged')::boolean, 'W2 di luar radius: flagged');
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.join_activity((select v from ids where k = 'ev1'));
select public.join_activity((select v from ids where k = 'ev2'));
insert into res select 'w3a', public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);
insert into res select 'w3b', public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.93, 107.54);
insert into ids select 'ci_w1', ((select v from res where k = 'w1') ->> 'checkin_id')::uuid;
insert into ids select 'ci_w2', ((select v from res where k = 'w2') ->> 'checkin_id')::uuid;
insert into ids select 'ci_w3b', ((select v from res where k = 'w3b') ->> 'checkin_id')::uuid;
-- Dalam satu transaksi now() beku; buat check-in kedua W3 terjadi 5 menit kemudian
reset role;
alter table public.checkins disable trigger checkins_guard;
update public.checkins set checked_in_at = checked_in_at + interval '5 minutes' where id = (select v from ids where k = 'ci_w3b');
alter table public.checkins enable trigger checkins_guard;
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Statistik aktivitas dan dashboard penyelenggara
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) from public.v_activity_stats) = 0, 'warga tidak melihat statistik aktivitas');
select pg_temp.assert((select count(*) from public.v_merchant_dashboard) = 0, 'warga tidak melihat dashboard merchant');
select pg_temp.assert((select count(*) from public.v_community_dashboard) = 0, 'warga tidak melihat dashboard komunitas');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select attended from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 3, 'ev1: 3 warga hadir');
select pg_temp.assert((select registered_individual from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 3, 'ev1: 3 pendaftar pribadi');
select pg_temp.assert((select completed from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 3, 'ev1: 3 selesai');
select pg_temp.assert((select checkins_today from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 3, 'ev1: 3 check-in hari ini');
select pg_temp.assert((select checkins_flagged from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 1, 'ev1: 1 check-in ditandai');
select pg_temp.assert((select new_citizens from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 3, 'ev1: semua warga baru bagi merchant');
select pg_temp.assert((select count(*) from public.v_activity_stats where activity_id = (select v from ids where k = 'ev2')) = 0, 'merchant tidak melihat statistik event komunitas');
select pg_temp.assert((select checkins from public.v_activity_partner_stats where activity_id = (select v from ids where k = 'ev1')) = 3, 'statistik partner host: 3 check-in');
select pg_temp.assert((select count(*) from public.v_activity_daily_checkins where activity_id = (select v from ids where k = 'ev1')) = 1, 'check-in per hari: 1 hari');
select pg_temp.assert((select running_activities from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 1, 'dashboard merchant: 1 berjalan');
select pg_temp.assert((select participants from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 3, 'dashboard merchant: 3 peserta');
select pg_temp.assert((select checkins_today from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 3, 'dashboard merchant: 3 check-in hari ini');
select pg_temp.assert((select new_citizens_30d from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 3, 'dashboard merchant: 3 warga baru');
select pg_temp.assert((select points_used from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 200, 'dashboard merchant: 200 poin terpakai (W1, W2; W3 tidak kebagian)');
select pg_temp.assert((select points_budget from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 250, 'dashboard merchant: budget 250');
select pg_temp.assert((select count(*) from public.v_merchant_outlet_vouchers where organizer_id = (select v from ids where k = 'm')) = 1, 'voucher per outlet: 1 outlet');
select pg_temp.assert((select score from public.v_organizer_reputation where organizer_id = (select v from ids where k = 'm')) = 80, 'reputasi: hadir 100% (50) + selesai 100% (30) + 0 kolaborasi = 80');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select checkins_today from public.v_community_dashboard where organizer_id = (select v from ids where k = 'k')) = 1, 'dashboard komunitas: 1 check-in hari ini');
select pg_temp.assert((select count(*) from public.v_merchant_dashboard) = 0, 'ketua komunitas tidak melihat dashboard merchant lain');

-- ---------------------------------------------------------------------------
-- 2. Dashboard admin dan antrean moderasi
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) from public.v_admin_overview) = 0, 'warga tidak melihat ringkasan admin');
select pg_temp.assert((select count(*) from public.v_moderation_checkins) = 0, 'warga tidak melihat antrean moderasi');
select pg_temp.assert((select count(*) from public.v_admin_users) = 0, 'warga tidak melihat daftar pengguna');
select pg_temp.assert((select count(*) from public.v_admin_weekly_active) = 0, 'warga tidak melihat grafik mingguan');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select weekly_active from public.v_admin_overview) = 3, 'admin: 3 warga aktif mingguan');
select pg_temp.assert((select running_activities from public.v_admin_overview) = 2, 'admin: 2 aktivitas berjalan');
select pg_temp.assert((select flagged_checkins from public.v_admin_overview) = 1, 'admin: 1 check-in ditandai');
select pg_temp.assert((select points_circulating from public.v_admin_overview) = 200, 'admin: 200 poin beredar');
select pg_temp.assert((select count(*) from public.v_admin_weekly_active) = 12, 'grafik 12 minggu');
select pg_temp.assert((select active_citizens from public.v_admin_weekly_active order by week_start desc limit 1) = 3, 'minggu ini 3 warga aktif');
select pg_temp.assert((select active_citizens from public.v_village_active_month where village_id = (select id from public.regions where name = 'Baros')) = 3, 'Baros: 3 warga aktif bulan ini');
select pg_temp.assert((select nickname from public.v_moderation_checkins where review_status = 'flagged') = 'ujid2', 'antrean: check-in W2 dengan nickname');
select pg_temp.assert((select xp_awarded from public.v_moderation_checkins where id = (select v from ids where k = 'ci_w1')) = 150, 'XP check-in W1 = 150 (dasar + kunjungan pertama)');
select pg_temp.assert((select count(*) from public.v_admin_users where nickname = 'ujid1' and checkins = 1) = 1, 'daftar pengguna: W1 dengan 1 check-in');

-- ---------------------------------------------------------------------------
-- 3. Sahkan dan balikkan check-in
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.approve_checkin((select v from ids where k = 'ci_w2'), null)$$, 'not_allowed', 'pemilik merchant tidak bisa menyahkan check-in');
select pg_temp.assert_fails($$select public.reverse_checkin((select v from ids where k = 'ci_w1'), 'x')$$, 'not_allowed', 'pemilik merchant tidak bisa membalikkan check-in');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.approve_checkin((select v from ids where k = 'ci_w2'), 'GPS kurang akurat');
reset role;
select pg_temp.assert((select review_status from public.checkins where id = (select v from ids where k = 'ci_w2')) = 'approved', 'check-in W2 disahkan');
select pg_temp.assert((select status from public.fraud_flags where checkin_id = (select v from ids where k = 'ci_w2')) = 'dismissed', 'flag W2 ditutup');
select pg_temp.assert((select count(*) from public.admin_actions where action = 'approve_checkin') = 1, 'tindakan admin tercatat');
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into res select 'rev', public.reverse_checkin((select v from ids where k = 'ci_w1'), 'Terbukti titip scan');
select pg_temp.assert(((select v from res where k = 'rev') ->> 'xp_reversed')::int = 150, 'XP 150 dibalik');
select pg_temp.assert(((select v from res where k = 'rev') ->> 'points_reversed')::int = 100, 'poin 100 dibalik');
select pg_temp.assert_fails($$select public.reverse_checkin((select v from ids where k = 'ci_w1'), 'lagi')$$, 'already_rejected', 'tidak bisa dibalik dua kali');
reset role;
select pg_temp.assert((select coalesce(sum(amount), 0) from public.xp_ledger where user_id = '00000000-0000-0000-0000-0000000000d1') = 0, 'total XP W1 kembali 0');
select pg_temp.assert(public.points_balance('00000000-0000-0000-0000-0000000000d1') = 0, 'saldo poin W1 kembali 0');
select pg_temp.assert((select count(*) from public.xp_ledger where user_id = '00000000-0000-0000-0000-0000000000d1') = 3, 'ledger XP hanya bertambah (2 kredit + 1 baris negatif)');
select pg_temp.assert((select review_status from public.checkins where id = (select v from ids where k = 'ci_w1')) = 'rejected', 'check-in W1 ditolak');
select pg_temp.assert((select status from public.participations where activity_id = (select v from ids where k = 'ev1') and user_id = '00000000-0000-0000-0000-0000000000d1') = 'registered', 'partisipasi W1 kembali terdaftar');
select pg_temp.assert((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'checkin_rejected') = 1, 'W1 diberi tahu');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select remaining from public.v_activity_budget where activity_id = (select v from ids where k = 'ev1')) = 150, 'sisa budget kembali 150 setelah poin W1 dibalik');
select pg_temp.assert((select attended from public.v_activity_stats where activity_id = (select v from ids where k = 'ev1')) = 2, 'statistik: hadir turun jadi 2');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select points_circulating from public.v_admin_overview) = 100, 'poin beredar turun jadi 100');

-- ---------------------------------------------------------------------------
-- 4. Bekukan akun warga dan penyelenggara
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select public.suspend_user('00000000-0000-0000-0000-0000000000d1', true, null)$$, 'not_allowed', 'warga tidak bisa membekukan');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert_fails($$select public.suspend_user('00000000-0000-0000-0000-00000000000e', true, null)$$, 'cannot_suspend_self', 'admin tidak bisa membekukan dirinya');
select public.suspend_user('00000000-0000-0000-0000-0000000000d2', true, 'Titip scan');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select public.join_activity((select v from ids where k = 'ev2'))$$, 'account_inactive', 'akun beku tidak bisa ikut aktivitas');
select pg_temp.assert_fails($$select public.perform_checkin((select v from ids where k = 'cp2'), (select v from tok where k = 'cp2'), -6.93, 107.54)$$, 'account_inactive', 'akun beku tidak bisa check-in');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.suspend_user('00000000-0000-0000-0000-0000000000d2', false, null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev2'));
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d2' and kind in ('account_suspended', 'account_restored')) = 2, 'warga diberi tahu beku dan aktif kembali');
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert_fails($$select public.suspend_organizer((select id from public.organizers where type = 'platform'), true, null)$$, 'invalid_organizer', 'organizer Ramein tidak bisa dibekukan');
select public.suspend_organizer((select v from ids where k = 'k'), true, 'Peninjau terlalu cepat');
reset role;
select pg_temp.assert((select status from public.organizers where id = (select v from ids where k = 'k')) = 'suspended', 'komunitas dibekukan');
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'ev2')) = 'cancelled', 'aktivitas berjalan komunitas dibatalkan');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.suspend_organizer((select v from ids where k = 'k'), false, null);
reset role;
select pg_temp.assert((select status from public.organizers where id = (select v from ids where k = 'k')) = 'approved', 'komunitas aktif kembali');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 5. Deteksi pola dan tinjauan flag
-- ---------------------------------------------------------------------------
-- 5 akun baru check-in di checkpoint yang sama dalam beberapa menit
do $$
declare v_uid uuid;
begin
  foreach v_uid in array array['00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000a3',
    '00000000-0000-0000-0000-0000000000a4', '00000000-0000-0000-0000-0000000000a5']::uuid[]
  loop
    perform pg_temp.login(v_uid);
    perform public.join_activity((select v from ids where k = 'ev1'));
    perform public.perform_checkin((select v from ids where k = 'cp1'), (select v from tok where k = 'cp1'), -6.8901, 107.5401);
  end loop;
end;
$$;
reset role;
select pg_temp.assert((select count(*) from public.fraud_flags where kind = 'burst_accounts') = 0, 'belum ada flag pola sebelum deteksi');
select pg_temp.assert(public.detect_fraud_patterns() = 6, 'deteksi: 5 akun beruntun + 1 perjalanan mustahil');
select pg_temp.assert((select count(*) from public.fraud_flags where kind = 'burst_accounts' and status = 'open') = 5, '5 flag akun beruntun');
select pg_temp.assert((select count(*) from public.fraud_flags where kind = 'impossible_travel' and checkin_id = (select v from ids where k = 'ci_w3b')) = 1, 'W3: perjalanan mustahil pada check-in kedua');
select pg_temp.assert(public.detect_fraud_patterns() = 0, 'deteksi ulang tidak menggandakan flag');
insert into ids select 'flag_n1', id from public.fraud_flags where kind = 'burst_accounts' and user_id = '00000000-0000-0000-0000-0000000000a1';
insert into ids select 'flag_n2', id from public.fraud_flags where kind = 'burst_accounts' and user_id = '00000000-0000-0000-0000-0000000000a2';
insert into ids select 'flag_w3', id from public.fraud_flags where kind = 'impossible_travel';
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
select pg_temp.assert_fails($$select public.detect_fraud_patterns()$$, 'permission denied', 'deteksi pola hanya cron');
select pg_temp.assert_fails($$select public.review_fraud_flag((select v from ids where k = 'flag_n1'), 'dismiss', null)$$, 'not_allowed', 'warga tidak bisa meninjau flag');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.v_moderation_flags where status = 'open') = 6, 'admin melihat 6 laporan pola');
select pg_temp.assert((select open_pattern_flags from public.v_admin_overview) = 6, 'ringkasan admin: 6 flag pola terbuka');
select pg_temp.assert_fails($$select public.review_fraud_flag((select v from ids where k = 'flag_n1'), 'hapus', null)$$, 'invalid_action', 'tindakan tak dikenal ditolak');
select public.review_fraud_flag((select v from ids where k = 'flag_w3'), 'dismiss', 'Naik ojek');
select public.review_fraud_flag((select v from ids where k = 'flag_n1'), 'warn', 'Jangan diulang');
select public.review_fraud_flag((select v from ids where k = 'flag_n2'), 'suspend', null);
select pg_temp.assert_fails($$select public.review_fraud_flag((select v from ids where k = 'flag_n1'), 'warn', null)$$, 'flag_unavailable', 'flag yang sudah ditinjau tidak bisa ditinjau lagi');
reset role;
select pg_temp.assert((select status from public.fraud_flags where id = (select v from ids where k = 'flag_w3')) = 'dismissed', 'flag W3 diabaikan');
select pg_temp.assert((select status from public.fraud_flags where id = (select v from ids where k = 'flag_n1')) = 'actioned', 'flag N1 ditindak');
select pg_temp.assert((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000a1' and kind = 'fraud_warning') = 1, 'N1 dapat peringatan');
select pg_temp.assert((select suspended_at from public.profiles where id = '00000000-0000-0000-0000-0000000000a2') is not null, 'N2 dibekukan');
select pg_temp.assert((select count(*) from public.admin_actions where action in ('flag_dismiss', 'flag_warn', 'flag_suspend', 'suspend_user')) = 5, 'semua tindakan tercatat di audit');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 6. Beranda warga dalam satu panggilan
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
insert into res select 'home', public.get_citizen_dashboard();
select pg_temp.assert(((select v from res where k = 'home') ->> 'total_xp')::int = 300, 'W3: total XP 300 (dua event + dua kunjungan pertama)');
select pg_temp.assert(((select v from res where k = 'home') ->> 'points_balance')::int = 0, 'W3: saldo 0 (budget habis oleh W1 dan W2)');
select pg_temp.assert(((select v from res where k = 'home') ->> 'rank_village')::int = 1, 'W3: peringkat 1 di kelurahan');
select pg_temp.assert(((select v from res where k = 'home') ->> 'rank_city')::int = 1, 'W3: peringkat 1 di kota');
select pg_temp.assert(((select v from res where k = 'home') ->> 'village_active_citizens')::int = 7, 'W3: 7 warga aktif di Baros (W2, W3, 5 akun baru; W1 ditolak)');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert((public.get_citizen_dashboard() ->> 'points_balance')::int = 100, 'W2: saldo 100 poin (check-in flagged lalu disahkan)');
select pg_temp.assert((select v from res where k = 'home') ? 'level_name', 'ada nama level');
select pg_temp.assert(jsonb_typeof((select v from res where k = 'home') -> 'my_activities') = 'array', 'aktivitasku berupa array');
select pg_temp.login('00000000-0000-0000-0000-0000000000a1');
insert into res select 'home_n1', public.get_citizen_dashboard();
select pg_temp.assert(((select v from res where k = 'home_n1') ->> 'rank_village')::int = 2, 'N1 (150 XP) peringkat 2 di kelurahan');

rollback;
\o
\echo UJI 0008 LULUS
