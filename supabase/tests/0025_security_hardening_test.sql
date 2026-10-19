-- Uji 0025: perbaikan hasil tinjauan keamanan.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0025.
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
-- Akun: O pemilik merchant, P pemilik merchant lain, S staf merchant O, A admin, W1–W4 warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'p@uji.test'),
  ('00000000-0000-0000-0000-00000000000f', 's@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'w3@uji.test'),
  ('00000000-0000-0000-0000-0000000000d4', 'w4@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table res (k text primary key, v jsonb);
create temp table tok (k text primary key, v text);
grant all on table ids, res, tok to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'm2', public.register_organizer('merchant', json_build_object('name', 'Seblak Teh Ai', 'whatsapp', '08120000002',
  'merchant_category', 'kuliner', 'outlets', json_build_array(json_build_object('name', 'Pasar Atas', 'address', 'Jl. Pasar Atas 1',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.88, 'lng', 107.53)))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select public.review_organizer((select v from ids where k = 'm2'), true, null);

reset role;
insert into ids select 'o_baros', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
insert into ids select 'o_lain', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm2');
insert into public.organizer_members (organizer_id, user_id, role) values ((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000f', 'staff');
insert into public.point_ledger (user_id, amount, reason, expires_at)
  values ('00000000-0000-0000-0000-0000000000d1', 500, 'adjustment', now() + interval '30 days');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. View tidak bisa ditulis; sisa izin tabel
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$update public.v_merchant_outlet_vouchers set organizer_id = (select v from ids where k = 'm2') where outlet_id = (select v from ids where k = 'o_baros')$$,
  'permission denied', 'staf tidak bisa memindahkan outlet lewat view dashboard');
select pg_temp.assert_fails($$delete from public.v_merchant_dashboard$$, 'permission denied', 'staf tidak bisa menghapus penyelenggara lewat view');
reset role;
select pg_temp.assert((select count(*) = 0 from pg_class c join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public' and c.relkind in ('v', 'm')
    and (has_table_privilege('authenticated', c.oid, 'INSERT') or has_table_privilege('authenticated', c.oid, 'UPDATE')
      or has_table_privilege('authenticated', c.oid, 'DELETE') or has_table_privilege('anon', c.oid, 'SELECT'))),
  'tidak ada view yang bisa ditulis warga/penyelenggara atau dibaca tanpa login');
select pg_temp.assert(not has_table_privilege('authenticated', 'public.suggestions', 'TRUNCATE')
  and not has_table_privilege('authenticated', 'public.mission_templates', 'TRUNCATE'), 'izin TRUNCATE dicabut');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 2. Event dengan partner; partner yang keluar kehilangan checkpoint, misi, dan QR
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Pagi', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('outlet_id', (select v from ids where k = 'o_baros'))::jsonb);
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Kode pendek","verification":"secret_code","code":"ABC","xp_reward":30}')$$,
  'invalid_code', 'kode misi baru minimal 6 karakter');
insert into ids select 'm_code', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Kode di kasir","verification":"secret_code","code":"PAGIHARI","xp_reward":30,"is_required":false}');
insert into ids select 'm_manual', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Ikut kelas seduh","verification":"manual","xp_reward":40,"is_required":false}');
insert into ids select 'm_photo', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Foto latte","verification":"photo","xp_reward":20,"is_required":false}');
select public.set_partner_budget((select id from public.activity_partners where activity_id = (select v from ids where k = 'ev') and role = 'host'), 1000);
select public.set_points_per_completion((select v from ids where k = 'ev'), 50);
insert into ids select 'inv', public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'm2'), 'cohost', 0, 'Ayo kolaborasi');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.respond_partner_invite((select v from ids where k = 'inv'), true, 0);
insert into ids select 'cp2', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object(
  'partner_organizer_id', (select v from ids where k = 'm2'), 'outlet_id', (select v from ids where k = 'o_lain'))::jsonb);
insert into ids select 'm_qr2', public.upsert_mission((select v from ids where k = 'ev'), json_build_object('title', 'Mampir stand seblak',
  'verification', 'qr_scan', 'checkpoint_id', (select v from ids where k = 'cp2'), 'partner_organizer_id', (select v from ids where k = 'm2'), 'xp_reward', 20, 'is_required', false)::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.submit_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev'), true, null);

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert(public.get_checkpoint_qr((select v from ids where k = 'cp2')) ->> 'token' is not null, 'partner aktif menampilkan QR');
select public.leave_activity((select v from ids where k = 'inv'));
reset role;
select pg_temp.assert((select not is_active from public.activity_missions where id = (select v from ids where k = 'm_qr2')), 'misi partner ikut nonaktif saat keluar');
set local role authenticated;
select pg_temp.assert_fails($$select public.set_checkpoint_active((select v from ids where k = 'cp2'), true)$$, 'partner_inactive', 'partner keluar tidak bisa menyalakan checkpoint');
select pg_temp.assert_fails($$select public.get_checkpoint_qr((select v from ids where k = 'cp2'))$$, 'partner_inactive', 'partner keluar tidak bisa menampilkan QR checkpoint');
select pg_temp.assert_fails($$select public.get_mission_qr((select v from ids where k = 'm_qr2'))$$, 'partner_inactive', 'partner keluar tidak bisa menampilkan QR misi');
select pg_temp.assert_fails($$select public.set_mission_active((select v from ids where k = 'm_qr2'), true)$$, 'not_allowed', 'partner keluar tidak bisa menyalakan misinya');

-- Penyelenggara dibekukan: checkpoint dan misinya di aktivitas lain ikut nonaktif
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev2', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Sore', 'starts_at', '2030-02-01T15:00+07', 'ends_at', '2030-02-01T18:00+07')::jsonb);
insert into ids select 'inv2', public.invite_partner((select v from ids where k = 'ev2'), (select v from ids where k = 'm2'), 'cohost', 0, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.respond_partner_invite((select v from ids where k = 'inv2'), true, 0);
insert into ids select 'cp3', public.add_checkpoint((select v from ids where k = 'ev2'), json_build_object(
  'partner_organizer_id', (select v from ids where k = 'm2'), 'outlet_id', (select v from ids where k = 'o_lain'))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.suspend_organizer((select v from ids where k = 'm2'), true, 'Uji pembekuan');
reset role;
select pg_temp.assert((select not is_active from public.activity_checkpoints where id = (select v from ids where k = 'cp3')), 'checkpoint penyelenggara dibekukan nonaktif');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.set_checkpoint_active((select v from ids where k = 'cp3'), true)$$, 'partner_inactive', 'penyelenggara dibekukan tidak bisa menyalakan checkpoint');

-- ---------------------------------------------------------------------------
-- 3. Batas total XP misi tidak bisa diakali dengan menonaktifkan misi yang sudah memberi XP
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev3', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Malam', 'starts_at', '2030-03-01T19:00+07', 'ends_at', '2030-03-01T22:00+07')::jsonb);
select public.upsert_mission((select v from ids where k = 'ev3'), json_build_object('title', 'Misi ' || i, 'verification', 'manual', 'xp_reward', 100, 'is_required', false)::jsonb)
from generate_series(1, 5) i;
reset role;
update public.activity_missions set locked_at = now() where activity_id = (select v from ids where k = 'ev3');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.set_mission_active(id, false) from public.activity_missions where activity_id = (select v from ids where k = 'ev3');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev3'), '{"title":"Misi baru","verification":"manual","xp_reward":100}')$$,
  'mission_total_xp_exceeded', 'misi yang sudah memberi XP tetap dihitung walau dinonaktifkan');
select public.update_activity((select v from ids where k = 'ev3'), '{"cover_url":"https://cdn.uji.test/cover.jpg"}');
-- update_activity menerjemahkan pelanggaran constraint menjadi invalid_activity
select pg_temp.assert_fails($$select public.update_activity((select v from ids where k = 'ev3'), '{"cover_url":"https://evil.test/x);position:fixed"}')$$,
  'invalid_activity', 'URL cover yang bisa menyisipkan CSS ditolak');
reset role;
select pg_temp.assert_fails($$update public.activities set cover_url = 'javascript:alert(1)' where id = (select v from ids where k = 'ev3')$$,
  'activities_cover_url_safe', 'constraint URL cover aktif');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');

-- ---------------------------------------------------------------------------
-- 4. Event berjalan: poin tertahan, misi diri sendiri, syarat check-in, tebakan kode, balik misi
-- ---------------------------------------------------------------------------
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours', status = 'running' where id = (select v from ids where k = 'ev');
insert into tok select 'cp', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp');
update public.app_settings set value = '3' where key = 'mission.code_flag_attempts';
set local role authenticated;

-- W1 check-in di luar radius: event selesai, 50 poin tertahan sampai admin menyetujui
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.join_activity((select v from ids where k = 'ev'));
select public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.95, 107.60);
select pg_temp.assert(public.points_balance(auth.uid()) = 500 and public.points_held(auth.uid()) = 50, 'poin dari check-in ditandai tertahan');
select pg_temp.assert((select held = 50 and balance = 500 from public.v_user_points_balance), 'dompet menampilkan poin tertahan');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.points_balance('00000000-0000-0000-0000-0000000000d1') = 0, 'saldo warga lain tidak bisa diintip');
select pg_temp.assert_fails($$select lat from public.checkins$$, 'permission denied', 'partner tidak membaca koordinat GPS check-in');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.approve_checkin((select id from public.checkins where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Lokasi wajar');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert(public.points_balance(auth.uid()) = 550 and public.points_held(auth.uid()) = 0, 'poin bisa dipakai setelah disetujui');

-- Staf ikut event sendiri: tidak bisa menyetujui foto atau menandai misinya sendiri
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.join_activity((select v from ids where k = 'ev'));
select public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.8901, 107.5401);
insert into res select 'photo', public.complete_mission((select v from ids where k = 'm_photo'), null, null,
  (select v from ids where k = 'ev')::text || '/' || auth.uid()::text || '/latte.jpg', null, null);
select pg_temp.assert_fails($$select public.review_mission_completion(((select v from res where k = 'photo') ->> 'completion_id')::uuid, true, null)$$,
  'self_review_not_allowed', 'staf tidak bisa menyetujui foto misinya sendiri');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert(public.mark_missions_manual((select v from ids where k = 'm_manual'),
  array['00000000-0000-0000-0000-00000000000f', '00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2']::uuid[]) = 1,
  'hanya W1 yang ditandai: diri sendiri dan peserta belum check-in dilewati');
select pg_temp.assert((select eligible from public.v_mission_manual_candidates where mission_id = (select v from ids where k = 'm_manual')
  and user_id = '00000000-0000-0000-0000-0000000000d2') = false, 'kandidat belum check-in ditandai tidak memenuhi syarat');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((public.review_mission_completion(((select v from res where k = 'photo') ->> 'completion_id')::uuid, true, null) ->> 'approved')::boolean,
  'anggota tim lain boleh menyetujui foto staf');

-- Tebakan kode massal per misi masuk Moderasi (ambang diturunkan ke 3 untuk uji)
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.complete_mission((select v from ids where k = 'm_code'), null, 'SALAH1', null, null, null);
select public.complete_mission((select v from ids where k = 'm_code'), null, 'SALAH2', null, null, null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.complete_mission((select v from ids where k = 'm_code'), null, 'SALAH3', null, null, null);
select public.complete_mission((select v from ids where k = 'm_code'), null, 'SALAH4', null, null, null);
reset role;
select pg_temp.assert((select count(*) = 1 from public.fraud_flags where kind = 'code_bruteforce'
  and detail ->> 'mission_id' = (select v from ids where k = 'm_code')::text), 'satu flag tebakan kode per misi');
set local role authenticated;

-- Admin membalik misi: XP misi ditarik, warga diberi tahu
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'code', public.complete_mission((select v from ids where k = 'm_code'), null, 'pagihari', null, null, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.reverse_mission_completion(((select v from res where k = 'code') ->> 'completion_id')::uuid, 'curang')$$,
  'not_allowed', 'hanya admin yang membalik misi');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into res select 'rev', public.reverse_mission_completion(((select v from res where k = 'code') ->> 'completion_id')::uuid, 'Kode bocor');
reset role;
select pg_temp.assert(((select v from res where k = 'rev') ->> 'xp_reversed')::int = 30, 'XP misi 30 dibalik');
select pg_temp.assert((select sum(amount) = 0 from public.xp_ledger where mission_completion_id = ((select v from res where k = 'code') ->> 'completion_id')::uuid),
  'saldo XP misi itu kembali 0');
select pg_temp.assert((select status = 'rejected' from public.mission_completions where id = ((select v from res where k = 'code') ->> 'completion_id')::uuid), 'penyelesaian ditolak');
select pg_temp.assert((select count(*) = 1 from public.notifications where kind = 'mission_reversed'), 'warga diberi tahu');

-- Pembalikan check-in memakai kelurahan saat XP diberikan, bukan kelurahan baru
update public.profiles set home_village_id = (select id from public.regions where name = 'Cibabat') where id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.reverse_checkin((select id from public.checkins where user_id = '00000000-0000-0000-0000-0000000000d1'), 'Uji');
reset role;
select pg_temp.assert((select bool_and(village_id = (select id from public.regions where name = 'Baros')) from public.xp_ledger
  where user_id = '00000000-0000-0000-0000-0000000000d1' and reason = 'reversal' and checkin_id is not null), 'pembalikan check-in tercatat di kelurahan asli');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 5. Kode voucher aktif tidak terlihat tim
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'rw', public.upsert_reward((select v from ids where k = 'm'), null, '{"title":"Gratis es kopi","price_points":"60","stock":"5","valid_days":"14"}');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
reset role;
insert into public.point_ledger (user_id, amount, reason, expires_at) values ('00000000-0000-0000-0000-0000000000d2', 100, 'adjustment', now() + interval '30 days');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
insert into res select 'rd', public.redeem_reward((select v from ids where k = 'rw'));
select pg_temp.assert((select count(*) = 1 from public.redemptions where code is not null), 'warga melihat kode vouchernya sendiri');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) = 0 from public.redemptions), 'staf tidak membaca tabel voucher langsung');
select pg_temp.assert((select code is null from public.v_reward_redemptions where id = ((select v from res where k = 'rd') ->> 'redemption_id')::uuid),
  'kode voucher aktif disembunyikan dari tim');

-- ---------------------------------------------------------------------------
-- 6. Kode grup: batas percobaan dan anggota yang dikeluarkan
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.join_group('SALAH' || i) from generate_series(1, 5) i;
select pg_temp.assert_fails($$select public.join_group('SALAH6')$$, 'too_many_attempts', 'kode grup salah lebih dari 5 kali diblokir');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into ids select 'g', public.create_group('Baros Squad');
insert into tok select 'g', invite_code from public.groups where id = (select v from ids where k = 'g');
select pg_temp.login('00000000-0000-0000-0000-0000000000d4');
select public.join_group((select v from tok where k = 'g'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.remove_group_member((select v from ids where k = 'g'), '00000000-0000-0000-0000-0000000000d4');
select pg_temp.login('00000000-0000-0000-0000-0000000000d4');
select pg_temp.assert_fails($$select public.join_group((select v from tok where k = 'g'))$$, 'removed_from_group', 'anggota yang dikeluarkan tidak bisa masuk lagi');

-- ---------------------------------------------------------------------------
-- 7. Aturan 13: check-in Event Global tidak dihitung untuk streak dan peringkat kelurahan
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into ids select 'g_ev', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Lomba Foto', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
select public.set_activity_reach((select v from ids where k = 'g_ev'), 'global', 'hybrid');
insert into ids select 'g_cp', public.add_checkpoint((select v from ids where k = 'g_ev'), '{"name":"Alun-alun","lat":-6.87,"lng":107.54}');
reset role;
insert into res select 'lb_before', to_jsonb(l) from public.leaderboard_villages() l where l.village_name = 'Baros';
with p as (insert into public.participations (activity_id, user_id) values ((select v from ids where k = 'g_ev'), '00000000-0000-0000-0000-0000000000d3') returning id)
insert into public.checkins (participation_id, activity_id, user_id, checkpoint_id, partner_organizer_id)
select p.id, (select v from ids where k = 'g_ev'), '00000000-0000-0000-0000-0000000000d3', (select v from ids where k = 'g_cp'), public.platform_organizer_id() from p;
select pg_temp.assert(public.user_streak_weeks('00000000-0000-0000-0000-0000000000d3') = 0, 'check-in Event Global tidak membentuk streak');
select pg_temp.assert((select (to_jsonb(l) ->> 'active_citizens') = ((select v from res where k = 'lb_before') ->> 'active_citizens')
  from public.leaderboard_villages() l where l.village_name = 'Baros'), 'check-in Event Global tidak menambah warga aktif kelurahan');

rollback;
\o
\echo UJI 0025 LULUS
