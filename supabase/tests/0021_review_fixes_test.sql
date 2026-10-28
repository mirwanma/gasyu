-- Uji 0021: perbaikan hasil review (lookup_voucher, v_moderation_flags).
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0021.
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
-- 1. Kasir: cek voucher memberi tahu outlet tempat voucher berlaku
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'rw', public.upsert_reward((select v from ids where k = 'm'), null,
  json_build_object('title', 'Kopi gratis', 'price_points', '50', 'stock', '5',
    'valid_outlet_ids', json_build_array((select v from ids where k = 'o_baros')))::jsonb);
insert into ids select 'rw_all', public.upsert_reward((select v from ids where k = 'm'), null, '{"title":"Diskon 10%","price_points":"20","stock":"5"}');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'v1', public.redeem_reward((select v from ids where k = 'rw'));
insert into res select 'v2', public.redeem_reward((select v from ids where k = 'rw_all'));
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into res select 'l1', public.lookup_voucher((select v from ids where k = 'm'), (select v from res where k = 'v1') ->> 'code');
insert into res select 'l2', public.lookup_voucher((select v from ids where k = 'm'), (select v from res where k = 'v2') ->> 'code');
select pg_temp.assert((select v -> 'valid_outlet_ids' = jsonb_build_array((select v from ids where k = 'o_baros')) from res where k = 'l1'),
  'cek voucher mengembalikan daftar outlet');
select pg_temp.assert((select jsonb_typeof(v -> 'valid_outlet_ids') = 'null' and (v ->> 'valid')::boolean from res where k = 'l2'),
  'voucher semua outlet: daftar outlet null');

-- ---------------------------------------------------------------------------
-- 2. Moderasi tetap terbuka walau detail flag berisi activity_id tak lazim
-- ---------------------------------------------------------------------------
reset role;
insert into public.fraud_flags (user_id, kind, detail) values
  ('00000000-0000-0000-0000-0000000000d2', 'manual', '{"title":"Laporan warga","activity_id":"bukan-uuid"}'),
  ('00000000-0000-0000-0000-0000000000d3', 'manual', '{"title":"Laporan lain","activity_id":""}');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) = 2 and bool_and(activity_title is null) from public.v_moderation_flags), 'flag dengan activity_id tak lazim tetap tampil');

rollback;
\o
\echo UJI 0021 LULUS
