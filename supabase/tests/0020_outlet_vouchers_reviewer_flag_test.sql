-- Uji 0020: voucher per outlet dan flag peninjau terlalu cepat.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0020.
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

-- Akun: O pemilik merchant, P pemilik merchant lain, S staf merchant, A admin, W1–W4 warga
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
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table res (k text primary key, v jsonb);
grant all on table ids, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'm2', public.register_organizer('merchant', json_build_object('name', 'Seblak Teh Ai', 'whatsapp', '08120000002',
  'merchant_category', 'kuliner', 'outlets', json_build_array(json_build_object('name', 'Pasar Atas', 'address', 'Jl. Pasar Atas 1',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.88, 'lng', 107.53)))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select public.review_organizer((select v from ids where k = 'm2'), true, null);

reset role;
insert into ids select 'o_baros', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
insert into ids select 'o_lain', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm2');
with x as (insert into public.merchant_outlets (organizer_id, name, address, lat, lng)
  values ((select v from ids where k = 'm'), 'Cabang Cibabat', 'Jl. Cibabat 20', -6.87, 107.55) returning id)
insert into ids select 'o_cibabat', id from x;
with x as (insert into public.merchant_outlets (organizer_id, name, address, lat, lng, is_active)
  values ((select v from ids where k = 'm'), 'Cabang Tutup', 'Jl. Tutup 1', -6.86, 107.56, false) returning id)
insert into ids select 'o_tutup', id from x;
insert into public.organizer_members (organizer_id, user_id, role) values ((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000f', 'staff');
insert into public.point_ledger (user_id, amount, reason, expires_at)
  values ('00000000-0000-0000-0000-0000000000d1', 500, 'adjustment', now() + interval '30 days');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Reward dengan outlet tertentu
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'm'), null,
  json_build_object('title', 'Kopi gratis', 'price_points', '50', 'stock', '5', 'valid_outlet_ids', json_build_array((select v from ids where k = 'o_lain')))::jsonb)$$,
  'invalid_outlet', 'outlet merchant lain ditolak');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'm'), null,
  json_build_object('title', 'Kopi gratis', 'price_points', '50', 'stock', '5', 'valid_outlet_ids', json_build_array((select v from ids where k = 'o_tutup')))::jsonb)$$,
  'invalid_outlet', 'outlet nonaktif ditolak');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'm'), null,
  '{"title":"Kopi gratis","price_points":"50","stock":"5","valid_outlet_ids":[]}')$$, 'outlets_required', 'outlet tertentu tanpa pilihan ditolak');
insert into ids select 'rw', public.upsert_reward((select v from ids where k = 'm'), null,
  json_build_object('title', 'Kopi gratis', 'price_points', '50', 'stock', '5',
    'valid_outlet_ids', json_build_array((select v from ids where k = 'o_baros'), (select v from ids where k = 'o_baros')))::jsonb);
select pg_temp.assert((select valid_outlet_ids = array[(select v from ids where k = 'o_baros')] from public.rewards where id = (select v from ids where k = 'rw')),
  'daftar outlet tersimpan tanpa duplikat');
insert into ids select 'rw_all', public.upsert_reward((select v from ids where k = 'm'), null, '{"title":"Diskon 10%","price_points":"20","stock":"5"}');
select pg_temp.assert((select valid_outlet_ids is null from public.rewards where id = (select v from ids where k = 'rw_all')), 'tanpa pilihan outlet = semua outlet');

-- Ubah status tanpa menyentuh outlet: daftar outlet tetap
select public.upsert_reward((select v from ids where k = 'm'), (select v from ids where k = 'rw'), '{"stock":"6"}');
select pg_temp.assert((select valid_outlet_ids is not null and stock = 6 from public.rewards where id = (select v from ids where k = 'rw')), 'edit lain tidak menghapus daftar outlet');

-- ---------------------------------------------------------------------------
-- 2. Kasir: voucher hanya di outlet yang berlaku
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'v1', public.redeem_reward((select v from ids where k = 'rw'));
insert into res select 'v2', public.redeem_reward((select v from ids where k = 'rw_all'));
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.use_voucher((select v from res where k = 'v1') ->> 'code', (select v from ids where k = 'o_cibabat'))$$,
  'outlet_not_valid', 'voucher ditolak di outlet yang tidak termasuk');
select pg_temp.assert_fails($$select public.use_voucher((select v from res where k = 'v1') ->> 'code', (select v from ids where k = 'o_lain'))$$,
  'invalid_outlet', 'outlet merchant lain tetap invalid_outlet');
select public.use_voucher((select v from res where k = 'v1') ->> 'code', (select v from ids where k = 'o_baros'));
select public.use_voucher((select v from res where k = 'v2') ->> 'code', (select v from ids where k = 'o_cibabat'));
reset role;
select pg_temp.assert((select count(*) = 2 from public.redemptions where status = 'used'), 'voucher dipakai di outlet yang berlaku');
select pg_temp.assert((select used_outlet_id = (select v from ids where k = 'o_baros') from public.redemptions where code = (select v from res where k = 'v1') ->> 'code'),
  'outlet pemakaian tercatat');

-- Outlet dinonaktifkan setelahnya: reward masih bisa diedit
update public.merchant_outlets set is_active = false where id = (select v from ids where k = 'o_baros');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.upsert_reward((select v from ids where k = 'm'), (select v from ids where k = 'rw'), '{"title":"Kopi gratis ukuran besar"}');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'm'), (select v from ids where k = 'rw'),
  json_build_object('valid_outlet_ids', json_build_array((select v from ids where k = 'o_baros'), (select v from ids where k = 'o_cibabat')))::jsonb)$$,
  'invalid_outlet', 'daftar outlet baru yang memuat outlet nonaktif ditolak');
select public.upsert_reward((select v from ids where k = 'm'), (select v from ids where k = 'rw'), '{"valid_outlet_ids":null}');
select pg_temp.assert((select valid_outlet_ids is null from public.rewards where id = (select v from ids where k = 'rw')), 'kembali ke semua outlet');

-- ---------------------------------------------------------------------------
-- 3. Peninjau terlalu cepat
-- ---------------------------------------------------------------------------
reset role;
update public.app_settings set value = '3' where key = 'fraud.reviewer_burst_count';
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Jelajah', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
select public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('outlet_id', (select v from ids where k = 'o_cibabat'))::jsonb);
insert into ids select 'mis', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Foto bareng barista","verification":"photo","xp_reward":20,"is_required":false}');
select public.submit_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev'), true, null);
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours', status = 'running' where id = (select v from ids where k = 'ev');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1'); select public.join_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d2'); select public.join_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d3'); select public.join_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d4'); select public.join_activity((select v from ids where k = 'ev'));
reset role;
insert into public.mission_completions (mission_id, participation_id, activity_id, user_id, status, proof_path)
select (select v from ids where k = 'mis'), p.id, p.activity_id, p.user_id, 'pending_review', p.user_id || '/foto.jpg'
from public.participations p where p.activity_id = (select v from ids where k = 'ev');
set local role authenticated;

-- Staf menyetujui 2 bukti: belum ada flag
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.review_mission_completion((select id from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d1'), true, null);
select public.review_mission_completion((select id from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d2'), true, null);
reset role;
select pg_temp.assert((select count(*) = 0 from public.fraud_flags where kind = 'reviewer_burst'), 'di bawah ambang: belum ada flag');
set local role authenticated;

-- Bukti ke-3 dalam 10 menit: satu flag, persetujuan tetap berlaku
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.review_mission_completion((select id from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d3'), true, null);
-- Bukti ke-4 di jendela yang sama: tidak membuat flag kedua
select public.review_mission_completion((select id from public.mission_completions where user_id = '00000000-0000-0000-0000-0000000000d4'), true, null);
reset role;
select pg_temp.assert((select count(*) = 1 from public.fraud_flags where kind = 'reviewer_burst'), 'tepat satu flag per jendela');
select pg_temp.assert((select user_id = '00000000-0000-0000-0000-00000000000f' and organizer_id = (select v from ids where k = 'm')
  and (detail ->> 'approvals')::integer = 3 and detail ->> 'activity_id' = (select v from ids where k = 'ev')::text
  from public.fraud_flags where kind = 'reviewer_burst'), 'flag berisi peninjau, penyelenggara, aktivitas, jumlah bukti');
select pg_temp.assert((select count(*) = 4 from public.mission_completions where status = 'approved'), 'persetujuan tetap berlaku');
select pg_temp.assert((select count(*) = 4 from public.xp_ledger where reason::text like 'mission%'), 'XP misi tetap diberikan');

-- Admin melihat flag di moderasi; warga tidak
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
set local role authenticated;
select pg_temp.assert((select organizer_name = 'Kopi Lereng' and activity_title = 'Ngopi Jelajah' from public.v_moderation_flags where kind = 'reviewer_burst'),
  'moderasi menampilkan penyelenggara dan aktivitas');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) = 0 from public.fraud_flags), 'tim tidak bisa membaca flag');
select pg_temp.assert_fails($$select public.check_reviewer_burst(auth.uid(), null, null)$$, 'permission denied', 'fungsi deteksi tidak bisa dipanggil langsung');

-- Jendela berikutnya (flag lama lebih dari 10 menit): flag baru boleh dibuat lagi
reset role;
update public.fraud_flags set created_at = now() - interval '11 minutes' where kind = 'reviewer_burst';
update public.mission_completions set reviewed_at = now() - interval '11 minutes';
select pg_temp.assert((select count(*) = 1 from public.fraud_flags where kind = 'reviewer_burst'), 'flag lama tetap ada');

rollback;
\o
\echo UJI 0020 LULUS
