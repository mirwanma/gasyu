-- Uji Irisan 10 (Misi). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0010.
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

-- Akun: O pemilik merchant (host), S pemilik merchant 2 (sponsor), K komunitas, A admin, W1 W2 warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000f', 's@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

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
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into ids select 's', public.register_organizer('merchant', json_build_object('name', 'Seblak Teh Ai', 'whatsapp', '08120000002',
  'merchant_category', 'kuliner', 'outlets', json_build_array(json_build_object('name', 'Warung Melong', 'address', 'Jl. Melong 2',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.8905, 'lng', 107.5405)))::jsonb);
insert into ids select 'outlet_s', id from public.merchant_outlets where organizer_id = (select v from ids where k = 's');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select public.review_organizer((select v from ids where k = 's'), true, null);

-- Event dengan sponsor; 100 poin per penyelesaian
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Jelajah', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.set_points_per_completion((select v from ids where k = 'ev'), 100);
select public.set_partner_budget((select id from public.activity_partners where activity_id = (select v from ids where k = 'ev')), 300);
insert into ids select 'inv', public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 's'), 'sponsor', 0, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.respond_partner_invite((select v from ids where k = 'inv'), true, null);
insert into ids select 'cp_s', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('partner_organizer_id', (select v from ids where k = 's'), 'outlet_id', (select v from ids where k = 'outlet_s'))::jsonb);

-- ---------------------------------------------------------------------------
-- 1. Membuat misi: aturan XP, kepemilikan, kode, prasyarat
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"x","verification":"manual","xp_reward":50}')$$, 'title', 'judul terlalu pendek');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi mahal","verification":"manual","xp_reward":150}')$$, 'invalid_mission_xp', 'XP misi maks. 100');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi murah","verification":"manual","xp_reward":5}')$$, 'invalid_mission_xp', 'XP misi min. 10');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Scan tanpa titik","verification":"qr_scan","xp_reward":30}')$$, 'mission_checkpoint_required', 'qr_scan butuh checkpoint');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Kode kosong","verification":"secret_code","xp_reward":30}')$$, 'mission_code_required', 'secret_code butuh kode');
-- Misi wajib: manual (finish), qr di booth sponsor (dibuat sponsor), kode; bonus: foto
insert into ids select 'mis_manual', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Selesaikan rute 5K","description":"Ditandai panitia di finish","verification":"manual","xp_reward":50,"is_required":true}');
insert into ids select 'mis_code', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Kode misi malam","verification":"secret_code","code":"MALAM19","xp_reward":40,"is_required":false,"reveal_mode":"manual"}');
insert into ids select 'mis_photo', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Foto bareng tim","description":"Foto bersama di garis finish","verification":"photo","xp_reward":20,"is_required":false}');
insert into ids select 'mis_chain', public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Tos dengan maskot', 'verification', 'manual', 'xp_reward', 20, 'is_required', false, 'reveal_mode', 'after_mission', 'prerequisite_mission_id', (select v from ids where k = 'mis_manual'))::jsonb);
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Wajib berantai bonus', 'verification', 'manual', 'xp_reward', 10, 'is_required', true, 'reveal_mode', 'after_mission', 'prerequisite_mission_id', (select v from ids where k = 'mis_photo'))::jsonb)$$,
  'mission_prerequisite_must_be_required', 'misi wajib hanya berprasyarat misi wajib');
select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('id', (select v from ids where k = 'mis_photo'), 'reveal_mode', 'after_mission', 'prerequisite_mission_id', (select v from ids where k = 'mis_chain'))::jsonb);
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('id', (select v from ids where k = 'mis_chain'), 'prerequisite_mission_id', (select v from ids where k = 'mis_photo'))::jsonb)$$,
  'mission_prerequisite_cycle', 'prasyarat tidak boleh berputar');
select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('id', (select v from ids where k = 'mis_photo'), 'reveal_mode', 'on_publish')::jsonb);
select pg_temp.assert((select prerequisite_mission_id is null from public.activity_missions where id = (select v from ids where k = 'mis_photo')), 'kembali on_publish: prasyarat dikosongkan');
insert into ids select 'mis_extra', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi ekstra","verification":"manual","xp_reward":100,"is_required":false}');
insert into ids select 'mis_e2', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi ekstra 2","verification":"manual","xp_reward":100,"is_required":false}');
insert into ids select 'mis_e3', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi ekstra 3","verification":"manual","xp_reward":100,"is_required":false}');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi ekstra 4","verification":"manual","xp_reward":100,"is_required":false}')$$, 'mission_total_xp_exceeded', 'total XP misi aktif maks. 500 (130 + 300 + 100)');
select public.set_mission_active((select v from ids where k = 'mis_e2'), false);
select public.set_mission_active((select v from ids where k = 'mis_e3'), false);
select public.set_mission_active((select v from ids where k = 'mis_extra'), false);

-- Sponsor hanya boleh misi qr_scan di checkpoint miliknya
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Sponsor manual', 'verification', 'manual', 'xp_reward', 10, 'partner_organizer_id', (select v from ids where k = 's'))::jsonb)$$,
  'partner_qr_only', 'sponsor hanya misi QR');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Scan booth host', 'verification', 'qr_scan', 'xp_reward', 30, 'partner_organizer_id', (select v from ids where k = 's'), 'checkpoint_id', (select v from ids where k = 'cp'))::jsonb)$$,
  'mission_checkpoint_not_owned', 'checkpoint harus milik partner');
insert into ids select 'mis_qr', public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Mampir booth Seblak', 'verification', 'qr_scan', 'xp_reward', 30, 'is_required', true, 'partner_organizer_id', (select v from ids where k = 's'), 'checkpoint_id', (select v from ids where k = 'cp_s'))::jsonb);
select pg_temp.assert((select partner_organizer_id from public.activity_missions where id = (select v from ids where k = 'mis_qr')) = (select v from ids where k = 's'), 'misi sponsor tercatat atas nama sponsor');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.get_mission_qr((select v from ids where k = 'mis_qr'))$$, 'not_allowed', 'warga tidak bisa minta QR misi');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Misi warga","verification":"manual","xp_reward":10}')$$, 'not_allowed', 'warga tidak bisa membuat misi');
select pg_temp.assert((select count(*) from public.activity_missions) = 0, 'warga tidak membaca tabel misi langsung');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.activity_missions where activity_id = (select v from ids where k = 'ev')) = 8, 'host melihat semua misi');
select pg_temp.assert_fails($$select qr_secret from public.activity_missions limit 1$$, 'permission denied', 'qr_secret tidak terbaca client');
select pg_temp.assert_fails($$select code_hash from public.activity_missions limit 1$$, 'permission denied', 'code_hash tidak terbaca client');

-- Terbitkan
select public.submit_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev'), true, null);
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours' where id = (select v from ids where k = 'ev');
select pg_temp.assert((select revealed_at is not null from public.activity_missions where id = (select v from ids where k = 'mis_manual')), 'misi on_publish terbuka saat terbit');
select pg_temp.assert((select revealed_at is null from public.activity_missions where id = (select v from ids where k = 'mis_code')), 'misi manual belum terbuka');
insert into tok select 'cp', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp');
insert into tok select 'mis_qr', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_missions where id = (select v from ids where k = 'mis_qr');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 2. Warga: daftar misi sesuai sudut pandang, check-in belum selesai (ada misi wajib)
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.join_activity((select v from ids where k = 'ev'));
insert into res select 'list1', public.get_activity_missions((select v from ids where k = 'ev'));
select pg_temp.assert(((select v from res where k = 'list1') ->> 'required_total')::int = 2, 'warga melihat 2 misi wajib terbuka (manual + QR sponsor)');
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'list1') -> 'missions') e where (e ->> 'open')::boolean) = 3, '3 misi terbuka (manual, QR, foto)');
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'list1') -> 'missions') e where not (e ->> 'open')::boolean) = 2, '2 teaser (kode manual, berantai)');
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'list1') -> 'missions') e where not (e ->> 'open')::boolean and e ? 'title') = 0, 'teaser tanpa judul');
select pg_temp.assert((select bool_and((e ->> 'can_work')::boolean = false) from jsonb_array_elements((select v from res where k = 'list1') -> 'missions') e where (e ->> 'open')::boolean), 'belum running: belum bisa dikerjakan');

insert into res select 'ci', public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.8901, 107.5401);
select pg_temp.assert(((select v from res where k = 'ci') ->> 'completed')::boolean = false, 'check-in belum menyelesaikan event karena ada misi wajib');
select pg_temp.assert(((select v from res where k = 'ci') ->> 'points')::int = 0, 'poin belum diberikan');
select pg_temp.assert(((select v from res where k = 'ci') ->> 'xp_base')::int = 100, 'XP check-in tetap 100');
select pg_temp.assert(((select v from res where k = 'ci') ->> 'required_total')::int = 2, 'hasil check-in menyebut 2 misi wajib');
reset role;
select pg_temp.assert((select status from public.participations where user_id = '00000000-0000-0000-0000-0000000000d1') = 'in_progress', 'partisipasi in_progress');
set local role authenticated;

-- Misi kode belum terbuka → ditolak
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_code'), null, 'MALAM19', null, null, null)$$, 'mission_not_revealed', 'misi belum dibuka');
-- Misi manual tidak bisa dikerjakan sendiri
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_manual'), null, null, null, null, null)$$, 'manual_only', 'misi manual hanya ditandai panitia');
-- QR misi sponsor: token salah, lalu benar di luar radius → flagged tapi disetujui
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_qr'), 'salah', null, null, -6.8905, 107.5405)$$, 'invalid_token', 'token QR misi salah');
insert into res select 'qr', public.complete_mission((select v from ids where k = 'mis_qr'), (select v from tok where k = 'mis_qr'), null, null, -6.95, 107.60);
select pg_temp.assert((select v from res where k = 'qr') ->> 'status' = 'approved', 'misi QR disetujui langsung');
select pg_temp.assert(((select v from res where k = 'qr') ->> 'flagged')::boolean, 'di luar radius: ditandai');
select pg_temp.assert(((select v from res where k = 'qr') ->> 'mission_xp')::int = 30, 'XP misi 30');
select pg_temp.assert(((select v from res where k = 'qr') ->> 'completed')::boolean = false, 'masih ada misi wajib manual');
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_qr'), (select v from tok where k = 'mis_qr'), null, null, -6.8905, 107.5405)$$, 'mission_already_done', 'misi hanya sekali per warga');
reset role;
select pg_temp.assert((select count(*) from public.fraud_flags where mission_completion_id is not null) = 1, 'flag misi di luar radius tercatat');
select pg_temp.assert((select locked_at is not null from public.activity_missions where id = (select v from ids where k = 'mis_qr')), 'misi terkunci setelah ada yang selesai');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('id', (select v from ids where k = 'mis_qr'), 'xp_reward', 50)::jsonb)$$, 'mission_locked', 'XP terkunci setelah ada penyelesaian');
select public.upsert_mission((select v from ids where k = 'ev'), json_build_object('id', (select v from ids where k = 'mis_qr'), 'title', 'Mampir booth Seblak Teh Ai')::jsonb);
select pg_temp.assert(length(public.get_mission_qr((select v from ids where k = 'mis_qr')) ->> 'token') = 16, 'sponsor bisa menampilkan QR misinya');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.get_mission_qr((select v from ids where k = 'mis_qr'))$$, 'not_allowed', 'host tidak bisa menampilkan QR misi sponsor');

-- Foto: unggah → pending_review → tim menolak → unggah ulang → setujui
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_photo'), null, null, 'salah/path.jpg', null, null)$$, 'proof_required', 'path foto harus activity/user');
insert into res select 'photo', public.complete_mission((select v from ids where k = 'mis_photo'), null, null, (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d1/foto1.jpg', null, null);
select pg_temp.assert((select v from res where k = 'photo') ->> 'status' = 'pending_review', 'foto menunggu tinjauan');
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_photo'), null, null, (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d1/foto2.jpg', null, null)$$, 'mission_already_done', 'tidak bisa kirim foto dua kali saat menunggu');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'mission_proof_submitted') >= 1, 'tim host diberi tahu bukti baru');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select public.review_mission_completion(((select v from res where k = 'photo') ->> 'completion_id')::uuid, true, null)$$, 'not_allowed', 'warga lain tidak bisa meninjau');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.v_mission_review_queue where status = 'pending_review') = 1, 'antrean tinjau foto: 1');
select pg_temp.assert_fails($$select public.review_mission_completion(((select v from res where k = 'photo') ->> 'completion_id')::uuid, false, null)$$, 'note_required', 'menolak wajib catatan');
select public.review_mission_completion(((select v from res where k = 'photo') ->> 'completion_id')::uuid, false, 'Foto buram');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
reset role;
select pg_temp.assert((select count(*) from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'mission_rejected') = 1, 'warga diberi tahu foto ditolak');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'photo2', public.complete_mission((select v from ids where k = 'mis_photo'), null, null, (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d1/foto2.jpg', null, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into res select 'rev', public.review_mission_completion(((select v from res where k = 'photo2') ->> 'completion_id')::uuid, true, null);
select pg_temp.assert(((select v from res where k = 'rev') ->> 'mission_xp')::int = 20, 'foto disetujui: +20 XP');
select pg_temp.assert(((select v from res where k = 'rev') ->> 'completed')::boolean = false, 'bonus tidak menyelesaikan event');

-- Kode: buka manual lalu kerjakan; batas percobaan
select pg_temp.assert_fails($$select public.reveal_mission((select v from ids where k = 'mis_manual'))$$, 'mission_not_manual', 'misi on_publish tidak perlu dibuka');
select public.reveal_mission((select v from ids where k = 'mis_code'));
select pg_temp.assert_fails($$select public.reveal_mission((select v from ids where k = 'mis_code'))$$, 'mission_already_revealed', 'tidak bisa dibuka dua kali');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'mission_revealed') = 1, 'peserta diberi tahu misi terbuka');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert(public.complete_mission((select v from ids where k = 'mis_code'), null, 'SALAH', null, null, null) ->> 'status' = 'wrong_code', 'kode salah ditolak');
select pg_temp.assert((public.complete_mission((select v from ids where k = 'mis_code'), null, 'SALAH', null, null, null) ->> 'attempts_left')::int = 3, 'sisa percobaan 3');
select pg_temp.assert(public.complete_mission((select v from ids where k = 'mis_code'), null, 'SALAH', null, null, null) ->> 'status' = 'wrong_code', 'kode salah 3');
select pg_temp.assert(public.complete_mission((select v from ids where k = 'mis_code'), null, 'SALAH', null, null, null) ->> 'status' = 'wrong_code', 'kode salah 4');
select pg_temp.assert((public.complete_mission((select v from ids where k = 'mis_code'), null, 'SALAH', null, null, null) ->> 'attempts_left')::int = 0, 'kode salah 5: sisa 0');
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'mis_code'), null, 'malam19', null, null, null)$$, 'too_many_attempts', 'percobaan ke-6 diblokir 15 menit');
reset role;
update public.mission_code_attempts set attempted_at = now() - interval '16 minutes';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'code', public.complete_mission((select v from ids where k = 'mis_code'), null, 'malam19', null, null, null);
select pg_temp.assert(((select v from res where k = 'code') ->> 'mission_xp')::int = 40, 'kode benar (tak peka huruf besar) +40 XP');

-- Manual: panitia menandai → event selesai → poin + misi berantai terbuka
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.mark_missions_manual((select v from ids where k = 'mis_manual'), array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2']::uuid[]) = 1, 'hanya peserta terdaftar yang ditandai (W2 belum daftar)');
reset role;
select pg_temp.assert((select status from public.participations where user_id = '00000000-0000-0000-0000-0000000000d1') = 'completed', 'semua misi wajib disetujui + check-in → selesai');
select pg_temp.assert((select sum(amount) from public.point_ledger where user_id = '00000000-0000-0000-0000-0000000000d1' and amount > 0) = 100, 'poin penyelesaian diberikan sekali saat selesai');
select pg_temp.assert((select coalesce(sum(amount), 0) from public.xp_ledger where user_id = '00000000-0000-0000-0000-0000000000d1') = 100 + 50 + 25 + 30 + 20 + 40 + 50, 'total XP: check-in 100 + kunjungan 50 + kolab 25 + misi 30+20+40+50');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'list2', public.get_activity_missions((select v from ids where k = 'ev'));
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'list2') -> 'missions') e where (e ->> 'open')::boolean and e ->> 'title' = 'Tos dengan maskot') = 1, 'misi berantai terbuka setelah prasyarat disetujui');
select pg_temp.assert(((select v from res where k = 'list2') ->> 'required_done')::int = 2, '2 dari 2 misi wajib selesai');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev'));
insert into res select 'list3', public.get_activity_missions((select v from ids where k = 'ev'));
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'list3') -> 'missions') e where not (e ->> 'open')::boolean and e ->> 'hint' like 'Selesaikan%') = 1, 'W2 melihat teaser berantai dengan nama prasyarat');

-- ---------------------------------------------------------------------------
-- 3. Statistik dan dashboard
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select approved from public.v_mission_stats where mission_id = (select v from ids where k = 'mis_photo')) = 1, 'statistik foto: 1 disetujui');
select pg_temp.assert((select rejected from public.v_mission_stats where mission_id = (select v from ids where k = 'mis_photo')) = 1, 'statistik foto: 1 ditolak');
select pg_temp.assert((select flagged from public.v_mission_stats where mission_id = (select v from ids where k = 'mis_qr')) = 1, 'statistik QR: 1 di luar radius');
select pg_temp.assert((select unlocked_for from public.v_mission_stats where mission_id = (select v from ids where k = 'mis_chain')) = 1, 'misi berantai terbuka untuk 1 warga');
select pg_temp.assert((select mission_proofs_pending from public.v_merchant_dashboard where organizer_id = (select v from ids where k = 'm')) = 0, 'dashboard: tidak ada bukti menunggu');
select pg_temp.assert((select required_done from public.v_participation_missions where user_id = '00000000-0000-0000-0000-0000000000d1' limit 1) = 2, 'view partisipasi misi: 2 wajib selesai');

-- ---------------------------------------------------------------------------
-- 4. Challenge bertarget misi: wajib punya misi sebelum diajukan; selesai saat semua misi wajib disetujui
-- ---------------------------------------------------------------------------
insert into ids select 'ch', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'type', 'challenge', 'title', 'Tantangan Misi', 'difficulty', 'easy', 'target_kind', 'required_missions', 'target_count', 1,
  'starts_at', '2030-02-01T10:00+07', 'ends_at', '2030-02-05T14:00+07')::jsonb);
insert into ids select 'ch_cp', public.add_checkpoint((select v from ids where k = 'ch'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select pg_temp.assert_fails($$select public.submit_activity((select v from ids where k = 'ch'))$$, 'mission_required', 'challenge bertarget misi wajib punya misi');
insert into ids select 'ch_m1', public.upsert_mission((select v from ids where k = 'ch'), '{"title":"Kode pos satu","verification":"secret_code","code":"POSSATU","xp_reward":30}');
select public.submit_activity((select v from ids where k = 'ch'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ch'), true, null);
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours' where id = (select v from ids where k = 'ch');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ch'));
insert into res select 'chk', public.complete_mission((select v from ids where k = 'ch_m1'), null, 'possatu', null, null, null);
select pg_temp.assert(((select v from res where k = 'chk') ->> 'completed')::boolean, 'challenge misi selesai saat semua misi wajib disetujui');
select pg_temp.assert(((select v from res where k = 'chk') ->> 'xp')::int = 150, 'XP challenge mudah 150');
reset role;
select pg_temp.assert((select status from public.participations where user_id = '00000000-0000-0000-0000-0000000000d2' and activity_id = (select v from ids where k = 'ch')) = 'completed', 'partisipasi challenge selesai tanpa check-in');

-- ---------------------------------------------------------------------------
-- 5. Cron: misi terjadwal dan bukti menggantung saat ditutup
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'mis_sched', public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Misi jam 19', 'verification', 'manual', 'xp_reward', 10, 'is_required', false, 'reveal_mode', 'scheduled', 'reveal_at', now() - interval '1 minute')::jsonb);
reset role;
select pg_temp.assert(public.reveal_scheduled_missions() = 1, 'cron membuka 1 misi terjadwal');
select pg_temp.assert((select revealed_at is not null from public.activity_missions where id = (select v from ids where k = 'mis_sched')), 'misi terjadwal terbuka');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.complete_mission((select v from ids where k = 'mis_photo'), null, null, (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d2/foto.jpg', null, null);
reset role;
update public.activities set status = 'ended', starts_at = now() - interval '4 days', ends_at = now() - interval '3 days' where id = (select v from ids where k = 'ev');
select public.settle_ended_activities();
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'ev')) = 'settled', 'aktivitas ditutup');
select pg_temp.assert((select status from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d2' and mission_id = (select v from ids where k = 'mis_photo')) = 'rejected', 'bukti menggantung ditolak saat ditutup');
select pg_temp.assert((select status from public.participations where user_id = '00000000-0000-0000-0000-0000000000d2' and activity_id = (select v from ids where k = 'ev')) = 'not_completed', 'peserta yang belum selesai → not_completed');
select pg_temp.assert(public.prune_code_attempts() = 0, 'log percobaan kode 16 menit belum dibersihkan');
update public.mission_code_attempts set attempted_at = now() - interval '2 days';
select pg_temp.assert(public.prune_code_attempts() = 5, 'log percobaan kode > 1 hari dibersihkan');

rollback;
\o
\echo UJI 0010 LULUS
