-- Uji 0022: Event Global (skor terpisah dari XP/poin, peringkat, hadiah, klaim) dan kota asal.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0022.
\o /dev/null
begin;
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

-- Akun: O pemilik merchant (sponsor hadiah), A admin, W1 warga Cimahi, W2 Kota Bandung, W3 Jakarta Pusat, W4 belum mengisi kecamatan
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'w3@uji.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'w4@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Rahasia', terms_accepted_at = now(), onboarded_at = now();
update public.profiles set home_district_id = (select id from public.regions where name = 'Cimahi Tengah')
  where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000e', '00000000-0000-0000-0000-0000000000d1');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
create temp table res (k text primary key, v jsonb);
grant all on table ids, tok, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);

-- ---------------------------------------------------------------------------
-- 1. Warga dari kota lain (kota belum dibuka) mengisi kecamatan asal
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.change_home_district((select id from public.regions where code = '32.73.01'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.change_home_district((select id from public.regions where code = '31.71.01'));

-- ---------------------------------------------------------------------------
-- 2. Membuat Event Global (admin, host platform)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into ids select 'g', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Lomba Foto Wisata Cimahi', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
insert into ids select 'r', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Festival Regional', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.set_activity_reach((select v from ids where k = 'g'), 'global', 'hybrid')$$, 'not_allowed', 'merchant tidak bisa membuat Event Global');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.set_activity_reach((select v from ids where k = 'g'), 'global', 'hybrid');
select pg_temp.assert((select reach = 'global' and location_mode = 'hybrid' and xp_base = 0 and join_mode = 'individual'
  and audience = 'public' and residency_rule = 'open' and points_per_completion = 0 from public.activities where id = (select v from ids where k = 'g')),
  'Event Global: publik, terbuka, pribadi, tanpa XP dasar dan poin');

reset role;
select pg_temp.assert_fails($$update public.activities set location_mode = 'online' where id = (select v from ids where k = 'r')$$, 'location_mode_requires_global', 'mode online hanya untuk Event Global');
select pg_temp.assert_fails($$update public.activities set join_mode = 'group', group_min = 2, group_max = 5 where id = (select v from ids where k = 'g')$$, 'global_requires_open_individual', 'Event Global hanya daftar pribadi');
select pg_temp.assert_fails($$update public.activities set points_per_completion = 10 where id = (select v from ids where k = 'g')$$, 'global_no_points', 'Event Global tanpa poin');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');

-- Partner sponsor hadiah: tidak bisa diberi budget poin
insert into ids select 'fp', public.admin_add_partner((select v from ids where k = 'g'), (select v from ids where k = 'm'), 'sponsor', 'Penyedia hadiah juara 1');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.set_partner_budget((select v from ids where k = 'fp'), 100)$$, 'global_no_points', 'Event Global tidak memakai budget poin');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'g'), '{"name":"Alun-alun Cimahi","lat":-6.87,"lng":107.54}');

-- Event online: tanpa checkpoint
insert into ids select 'go', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Tantangan Online HUT Kota', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
select public.set_activity_reach((select v from ids where k = 'go'), 'global', 'online');
select pg_temp.assert_fails($$select public.add_checkpoint((select v from ids where k = 'go'), '{"name":"Titik","lat":-6.87,"lng":107.54}')$$, 'online_no_checkpoint', 'event online tidak punya checkpoint');
select pg_temp.assert_fails($$select public.set_activity_reach((select v from ids where k = 'g'), 'global', 'online')$$, 'online_no_checkpoint', 'tidak bisa jadi online selama ada checkpoint');

-- ---------------------------------------------------------------------------
-- 3. Misi Event Global: skor 10–1000, tanpa XP, total maks. 5.000
-- ---------------------------------------------------------------------------
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'g'), '{"title":"Foto ikon","verification":"photo","score_reward":5}')$$,
  'invalid_mission_score', 'skor misi minimal 10');
insert into ids select 'm_photo', public.upsert_mission((select v from ids where k = 'g'),
  '{"title":"Foto di Alun-alun","verification":"photo","score_reward":300,"xp_reward":50,"is_required":false}');
insert into ids select 'm_code', public.upsert_mission((select v from ids where k = 'g'),
  '{"title":"Kode rahasia panggung","verification":"secret_code","code":"GASYU26","score_reward":200,"is_required":false}');
reset role;
select pg_temp.assert((select bool_and(xp_reward = 0) from public.activity_missions where activity_id = (select v from ids where k = 'g')), 'misi global selalu 0 XP');
set local role authenticated;
select public.upsert_mission((select v from ids where k = 'g'), '{"title":"Bonus satu","verification":"manual","score_reward":1000,"is_required":false}');
select public.upsert_mission((select v from ids where k = 'g'), '{"title":"Bonus dua","verification":"manual","score_reward":1000,"is_required":false}');
select public.upsert_mission((select v from ids where k = 'g'), '{"title":"Bonus tiga","verification":"manual","score_reward":1000,"is_required":false}');
select public.upsert_mission((select v from ids where k = 'g'), '{"title":"Bonus empat","verification":"manual","score_reward":1000,"is_required":false}');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'g'), '{"title":"Bonus lima","verification":"manual","score_reward":1000,"is_required":false}')$$,
  'mission_total_score_exceeded', 'total skor misi maks. 5.000');
insert into ids select 'm_reg', public.upsert_mission((select v from ids where k = 'r'), '{"title":"Misi regional","verification":"manual","xp_reward":50,"score_reward":100}');
reset role;
select pg_temp.assert((select score_reward = 0 and xp_reward = 50 from public.activity_missions where id = (select v from ids where k = 'm_reg')), 'misi regional tetap XP, skor diabaikan');
select pg_temp.assert_fails($$update public.activity_missions set score_reward = 10 where id = (select v from ids where k = 'm_reg')$$, 'regional_mission_no_score', 'misi regional tidak boleh punya skor');
set local role authenticated;
select pg_temp.assert_fails($$select public.set_activity_reach((select v from ids where k = 'g'), 'regional', 'onsite')$$, 'reach_change_with_missions', 'jangkauan tidak bisa diganti setelah ada misi');

-- ---------------------------------------------------------------------------
-- 4. Hadiah per peringkat
-- ---------------------------------------------------------------------------
select pg_temp.assert_fails($$select public.submit_activity((select v from ids where k = 'g'))$$, 'prize_required', 'Event Global wajib punya hadiah');
insert into ids select 'pz1', public.upsert_activity_prize((select v from ids where k = 'g'), json_build_object(
  'rank_from', 1, 'title', 'Juara 1: Sepeda lipat', 'kind', 'physical', 'fulfillment', 'shipping', 'sponsor_organizer_id', (select v from ids where k = 'm'))::jsonb);
insert into ids select 'pz2', public.upsert_activity_prize((select v from ids where k = 'g'),
  '{"rank_from":2,"rank_to":3,"title":"Juara 2-3: Voucher makan","kind":"voucher","fulfillment":"pickup","pickup_note":"Ambil di panggung utama"}');
select pg_temp.assert_fails($$select public.upsert_activity_prize((select v from ids where k = 'g'), '{"rank_from":3,"rank_to":5,"title":"Tumpang tindih","kind":"other","fulfillment":"digital"}')$$,
  'prize_rank_overlap', 'rentang hadiah tidak boleh tumpang tindih');
select pg_temp.assert_fails($$select public.upsert_activity_prize((select v from ids where k = 'g'), '{"rank_from":101,"title":"Terlalu jauh","kind":"other","fulfillment":"digital"}')$$,
  'invalid_prize_rank', 'peringkat hadiah maks. 100');
select pg_temp.assert_fails($$select public.upsert_activity_prize((select v from ids where k = 'g'), '{"rank_from":30,"title":"Ambil tanpa info","kind":"physical","fulfillment":"pickup"}')$$,
  'invalid_prize', 'hadiah ambil di lokasi wajib punya info pengambilan');
select pg_temp.assert_fails($$select public.upsert_activity_prize((select v from ids where k = 'r'), '{"rank_from":1,"title":"Hadiah regional","kind":"other","fulfillment":"digital"}')$$,
  'prize_requires_global', 'hadiah peringkat hanya untuk Event Global');
insert into ids select 'b', public.create_prize_badge('Penjelajah Cimahi', 'Badge peserta terbaik lomba foto');
insert into ids select 'pz3', public.upsert_activity_prize((select v from ids where k = 'g'), json_build_object(
  'rank_from', 4, 'rank_to', 10, 'title', 'Badge Penjelajah', 'kind', 'badge', 'badge_id', (select v from ids where k = 'b'), 'min_score', 100)::jsonb);
select pg_temp.assert((select fulfillment = 'digital' from public.activity_prizes where id = (select v from ids where k = 'pz3')), 'hadiah badge selalu digital');

select pg_temp.assert(public.submit_activity((select v from ids where k = 'g')) = 'published', 'Event Global langsung terbit');

-- Setelah terbit: hadiah lama terkunci, hanya deskripsi/gambar; hadiah baru boleh ditambah
select public.upsert_activity_prize((select v from ids where k = 'g'), json_build_object('id', (select v from ids where k = 'pz1'),
  'title', 'Juara 1: Motor', 'description', 'Sepeda lipat warna hijau')::jsonb);
select pg_temp.assert((select title = 'Juara 1: Sepeda lipat' and description = 'Sepeda lipat warna hijau' from public.activity_prizes where id = (select v from ids where k = 'pz1')),
  'setelah terbit hanya deskripsi yang berubah');
select pg_temp.assert_fails($$select public.remove_activity_prize((select v from ids where k = 'pz1'))$$, 'prize_locked_after_publish', 'hadiah tidak bisa dihapus setelah terbit');
select public.upsert_activity_prize((select v from ids where k = 'g'), '{"rank_from":11,"rank_to":20,"title":"Sertifikat digital","kind":"other","fulfillment":"digital"}');
reset role;
select pg_temp.assert_fails($$update public.activities set reach = 'regional', location_mode = 'onsite' where id = (select v from ids where k = 'g')$$, 'reach_locked_after_publish', 'jangkauan terkunci setelah terbit');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.leave_activity((select v from ids where k = 'fp'))$$, 'partner_has_prize', 'penyedia hadiah tidak bisa keluar setelah terbit');

-- ---------------------------------------------------------------------------
-- 5. Ikut, check-in, dan misi: skor saja, tidak pernah XP atau poin
-- ---------------------------------------------------------------------------
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours', status = 'running' where id = (select v from ids where k = 'g');
insert into tok select 'cp', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp');
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-0000000000d1'); select public.join_activity((select v from ids where k = 'g'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d2'); select public.join_activity((select v from ids where k = 'g'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d3'); select public.join_activity((select v from ids where k = 'g'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d4'); select public.join_activity((select v from ids where k = 'g'));

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'ci', public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.8701, 107.5401);
select pg_temp.assert(((select v from res where k = 'ci') ->> 'score')::int = 100 and ((select v from res where k = 'ci') ->> 'xp_total')::int = 0,
  'check-in Event Global: +100 skor, 0 XP');
select public.complete_mission((select v from ids where k = 'm_code'), null, 'gasyu26', null, null, null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.complete_mission((select v from ids where k = 'm_code'), null, 'GASYU26', null, null, null);
select public.complete_mission((select v from ids where k = 'm_photo'), null, null, (select v from ids where k = 'g') || '/00000000-0000-0000-0000-0000000000d2/foto.jpg', null, null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.complete_mission((select v from ids where k = 'm_photo'), null, null, (select v from ids where k = 'g') || '/00000000-0000-0000-0000-0000000000d3/foto.jpg', null, null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d4');
select public.complete_mission((select v from ids where k = 'm_code'), null, 'GASYU26', null, null, null);

-- W3 mengirim foto lebih dulu daripada aksi terakhir W1 (seri dihitung dari waktu aksi)
reset role;
update public.mission_completions set submitted_at = now() - interval '30 minutes' where user_id = '00000000-0000-0000-0000-0000000000d3';
update public.mission_completions set submitted_at = now() - interval '10 minutes' where user_id = '00000000-0000-0000-0000-0000000000d2' and status = 'pending_review';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_mission_completion((select id from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d2' and status = 'pending_review'), true, null);
select public.review_mission_completion((select id from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d3' and status = 'pending_review'), true, null);

reset role;
select pg_temp.assert((select count(*) = 0 from public.xp_ledger where activity_id = (select v from ids where k = 'g')), 'Event Global tidak pernah menulis xp_ledger');
select pg_temp.assert((select count(*) = 0 from public.point_ledger where activity_id = (select v from ids where k = 'g')), 'Event Global tidak pernah menulis point_ledger');
select pg_temp.assert_fails($$select public.award_xp('00000000-0000-0000-0000-0000000000d1', 50, 'adjustment', (select v from ids where k = 'g'))$$,
  'global_activity_no_xp_or_points', 'award_xp menolak aktivitas global');
select pg_temp.assert(public.activity_score('00000000-0000-0000-0000-0000000000d1', (select v from ids where k = 'g')) = 300, 'W1: check-in 100 + kode 200');
select pg_temp.assert(public.activity_score('00000000-0000-0000-0000-0000000000d2', (select v from ids where k = 'g')) = 500, 'W2: kode 200 + foto 300');
select pg_temp.assert((select occurred_at = now() - interval '30 minutes' from public.activity_score_ledger
  where user_id = '00000000-0000-0000-0000-0000000000d3' and reason = 'mission_complete'), 'skor foto memakai waktu kirim, bukan waktu disetujui');
-- W4 dibekukan: hilang dari peringkat
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000d4';
set local role authenticated;

select pg_temp.assert_fails($$select * from public.v_activity_scoreboard$$, 'permission denied', 'view peringkat tidak dibaca langsung client');
select pg_temp.assert_fails($$select public.award_activity_score(auth.uid(), (select v from ids where k = 'g'), 999, 'adjustment')$$, 'permission denied', 'skor tidak bisa ditulis client');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$insert into public.activity_score_ledger (activity_id, user_id, amount, reason) values ((select v from ids where k = 'g'), auth.uid(), 999, 'adjustment')$$,
  'permission denied', 'ledger skor tidak bisa diisi client');

-- Papan peringkat: W2 500, W3 300 (lebih dulu), W1 300
insert into res select 'lb', public.get_activity_leaderboard((select v from ids where k = 'g'));
select pg_temp.assert((select v ->> 'status' = 'live' and jsonb_array_length(v -> 'rows') = 3 from res where k = 'lb'), 'papan live berisi 3 peserta (yang dibekukan tidak)');
select pg_temp.assert((select v -> 'rows' -> 0 ->> 'nickname' = 'ujid2' and v -> 'rows' -> 1 ->> 'nickname' = 'ujid3' and v -> 'rows' -> 2 ->> 'nickname' = 'ujid1' from res where k = 'lb'),
  'urutan: skor tertinggi, lalu yang lebih dulu mencapai skor');
select pg_temp.assert((select (v -> 'me' ->> 'rank')::int = 3 from res where k = 'lb'), 'posisi saya tercantum');
select pg_temp.assert((select position('Nama Rahasia' in v::text) = 0 from res where k = 'lb'), 'papan peringkat tidak memuat nama lengkap');

-- Check-in ditolak admin: skor dibalik dengan baris negatif
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.reverse_checkin(((select v from res where k = 'ci') ->> 'checkin_id')::uuid, 'Foto lokasi tidak cocok');
reset role;
select pg_temp.assert(public.activity_score('00000000-0000-0000-0000-0000000000d1', (select v from ids where k = 'g')) = 200, 'skor check-in dibalik');
select pg_temp.assert((select count(*) = 1 from public.activity_score_ledger where reason = 'reversal' and amount = -100), 'pembalikan berupa baris negatif');

-- Statistik admin: sebaran kota dan kecamatan asal
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select registrants = 4 and unknown_region_participants = 1
  and cities @> '[{"name":"Kota Bandung","province":"Jawa Barat","count":1},{"name":"Kota Cimahi","count":1}]'::jsonb
  and jsonb_array_length(cities) = 3
  and districts @> '[{"name":"Cimahi Tengah","city":"Kota Cimahi","count":1}]'::jsonb from public.v_global_event_stats where activity_id = (select v from ids where k = 'g')),
  'statistik peserta per asal');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) = 0 from public.v_global_event_stats), 'statistik hanya untuk admin');

-- ---------------------------------------------------------------------------
-- 6. Selesai: pemenang ditetapkan otomatis
-- ---------------------------------------------------------------------------
reset role;
update public.activities set status = 'ended', starts_at = now() - interval '50 hours', ends_at = now() - interval '49 hours' where id = (select v from ids where k = 'g');
select public.settle_ended_activities();
select pg_temp.assert((select status = 'settled' from public.activities where id = (select v from ids where k = 'g')), 'Event Global settled');
select pg_temp.assert((select count(*) = 3 from public.activity_winners where activity_id = (select v from ids where k = 'g')), '3 pemenang (badge butuh skor 100 tapi peringkat 4+ kosong)');
select pg_temp.assert((select user_id = '00000000-0000-0000-0000-0000000000d2' and prize_id = (select v from ids where k = 'pz1') and status = 'pending_claim'
  from public.activity_winners where activity_id = (select v from ids where k = 'g') and rank = 1), 'juara 1 mendapat hadiah juara 1');
select pg_temp.assert((select user_id = '00000000-0000-0000-0000-0000000000d1' and prize_id = (select v from ids where k = 'pz2')
  from public.activity_winners where activity_id = (select v from ids where k = 'g') and rank = 3), 'peserta tidak selesai tetap dinilai dari skor');
select pg_temp.assert((select count(*) = 3 from public.notifications where kind = 'prize_won'), 'pemenang diberi tahu');
select pg_temp.assert(public.finalize_activity_winners((select v from ids where k = 'g')) = 0, 'penetapan pemenang hanya sekali');
insert into ids select 'w1', id from public.activity_winners where activity_id = (select v from ids where k = 'g') and rank = 1;
insert into ids select 'w2', id from public.activity_winners where activity_id = (select v from ids where k = 'g') and rank = 2;
insert into ids select 'w3', id from public.activity_winners where activity_id = (select v from ids where k = 'g') and rank = 3;

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'lbf', public.get_activity_leaderboard((select v from ids where k = 'g'));
select pg_temp.assert((select v ->> 'status' = 'final' and v -> 'rows' -> 0 ->> 'prize_title' = 'Juara 1: Sepeda lipat' from res where k = 'lbf'), 'papan final menampilkan hadiah');

-- ---------------------------------------------------------------------------
-- 7. Klaim, data pengiriman privat, dikirim, hangus
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select pg_temp.assert_fails($$select public.claim_prize((select v from ids where k = 'w1'), null)$$, 'invalid_winner', 'hanya pemenang yang bisa mengklaim');
select public.claim_prize((select v from ids where k = 'w2'), null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select public.claim_prize((select v from ids where k = 'w1'), '{}')$$, 'invalid_shipping', 'hadiah dikirim wajib alamat');
select public.claim_prize((select v from ids where k = 'w1'), '{"name":"Rani","phone":"+62 812-3456-7890","address":"Jl. Merdeka No. 10, Bandung"}');
select pg_temp.assert((select get_winner_shipping ->> 'phone' = '081234567890' from public.get_winner_shipping((select v from ids where k = 'w1'))), 'pemenang melihat alamatnya sendiri');
reset role;
select pg_temp.assert((select count(*) = 2 from public.notifications where kind = 'prize_claimed'), 'admin diberi tahu setiap klaim');
set local role authenticated;

-- Partner sponsor hanya melihat peringkat dan status hadiahnya (0025), tanpa identitas atau alamat pemenang
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 0 from public.activity_winners where prize_id = (select v from ids where k = 'pz1')), 'sponsor tidak membaca baris pemenang');
select pg_temp.assert((select jsonb_array_length(p -> 'winners') = 1 and not (p -> 'winners' -> 0 ? 'user_id')
  from jsonb_array_elements(public.get_sponsored_prizes((select v from ids where k = 'm'))) p
  where p ->> 'id' = (select v from ids where k = 'pz1')::text), 'sponsor melihat peringkat dan status lewat get_sponsored_prizes');
select pg_temp.assert_fails($$select ship_address from public.activity_winners$$, 'permission denied', 'sponsor tidak bisa membaca alamat pemenang');
select pg_temp.assert_fails($$select public.get_winner_shipping((select v from ids where k = 'w1'))$$, 'not_allowed', 'sponsor tidak bisa memanggil fungsi alamat');

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select get_winner_shipping ->> 'address' like 'Jl. Merdeka%' from public.get_winner_shipping((select v from ids where k = 'w1'))), 'admin melihat alamat untuk pengiriman');
select public.mark_prize_delivered((select v from ids where k = 'w1'), 'JNE 1234567');
select pg_temp.assert((select status = 'delivered' from public.activity_winners where id = (select v from ids where k = 'w1')), 'hadiah terkirim');
select public.forfeit_prize((select v from ids where k = 'w2'), 'Akun ganda terbukti');
select pg_temp.assert((select status = 'forfeited' from public.activity_winners where id = (select v from ids where k = 'w2')), 'admin bisa membatalkan hadiah');

-- Cron: pengingat, lewat batas klaim, hapus alamat setelah 30 hari
reset role;
update public.activity_winners set claim_deadline = now() + interval '2 days' where id = (select v from ids where k = 'w3');
select public.process_prizes();
select pg_temp.assert((select count(*) = 1 from public.notifications where kind = 'prize_claim_reminder'), 'pengingat klaim 3 hari sebelum batas');
select public.process_prizes();
select pg_temp.assert((select count(*) = 1 from public.notifications where kind = 'prize_claim_reminder'), 'pengingat hanya sekali');
update public.activity_winners set claim_deadline = now() - interval '1 minute' where id = (select v from ids where k = 'w3');
select public.process_prizes();
select pg_temp.assert((select status = 'forfeited' and forfeited_reason = 'Lewat batas klaim' from public.activity_winners where id = (select v from ids where k = 'w3')),
  'hadiah tidak diklaim hangus');
update public.activity_winners set delivered_at = now() - interval '31 days' where id = (select v from ids where k = 'w1');
select public.process_prizes();
select pg_temp.assert((select ship_address is null and ship_phone is null from public.activity_winners where id = (select v from ids where k = 'w1')), 'alamat dihapus 30 hari setelah terkirim');

-- ---------------------------------------------------------------------------
-- 8. Hapus akun mengosongkan kecamatan asal
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.delete_my_account('HAPUS');
reset role;
select pg_temp.assert((select home_district_id is null from public.profiles where id = '00000000-0000-0000-0000-0000000000d2'), 'hapus akun mengosongkan kecamatan asal');

rollback;
\o
\echo UJI 0022 LULUS
