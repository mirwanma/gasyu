-- Uji 0026: kota aktivitas di v_activity_cards untuk pemilih kota di Jelajah.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0026.
\o /dev/null
begin;
set constraints all immediate;

create function pg_temp.assert(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'UJI GAGAL: %', p_msg; end if;
end;
$$;
create function pg_temp.login(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Kota kedua untuk memastikan wilayah generik: Kota Uji > Uji Tengah > Sukauji
insert into public.regions (level, name, code) values ('city', 'Kota Uji', '99.01');
insert into public.regions (parent_id, level, name, code)
  select id, 'district', 'Uji Tengah', '99.01.01' from public.regions where name = 'Kota Uji';
insert into public.regions (parent_id, level, name, code)
  select id, 'village', 'Sukauji', '99.01.01.1001' from public.regions where name = 'Uji Tengah';

-- Akun: O pemilik merchant, A admin
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 1), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
grant all on table ids to anon, authenticated;

-- region_city dari tiap tingkat wilayah
select pg_temp.assert(public.region_city((select id from public.regions where name = 'Baros'))
  = (select id from public.regions where name = 'Kota Cimahi'), 'kota dari kelurahan');
select pg_temp.assert(public.region_city((select id from public.regions where name = 'Cimahi Tengah'))
  = (select id from public.regions where name = 'Kota Cimahi'), 'kota dari kecamatan');
select pg_temp.assert(public.region_city((select id from public.regions where name = 'Kota Uji'))
  = (select id from public.regions where name = 'Kota Uji'), 'kota dari kota itu sendiri');
select pg_temp.assert(public.region_city(null) is null, 'wilayah kosong tidak punya kota');

set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'merchant', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
reset role;
update public.organizers set village_id = (select id from public.regions where name = 'Baros') where id = (select v from ids where k = 'merchant');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'merchant'), true, null);

-- Aktivitas merchant: tanpa cakupan, cakupan kelurahan kota lain, cakupan kecamatan
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'tanpa_cakupan', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi Bareng', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'kota_lain', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi di Kota Uji', 'scope_region_id', (select id from public.regions where name = 'Sukauji'),
  'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'kecamatan', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi Cimahi Tengah', 'scope_region_id', (select id from public.regions where name = 'Cimahi Tengah'),
  'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);

select pg_temp.assert((select city_name = 'Kota Cimahi' from public.v_activity_cards where id = (select v from ids where k = 'tanpa_cakupan')),
  'tanpa cakupan: kota dari kelurahan penyelenggara');
select pg_temp.assert((select city_name = 'Kota Uji' from public.v_activity_cards where id = (select v from ids where k = 'kota_lain')),
  'cakupan kelurahan menentukan kota, bukan lokasi penyelenggara');
select pg_temp.assert((select city_id = (select id from public.regions where name = 'Kota Cimahi') from public.v_activity_cards where id = (select v from ids where k = 'kecamatan')),
  'cakupan kecamatan: kota induknya');

-- Event Gasyu tanpa cakupan berlaku untuk semua kota
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into ids select 'gasyu', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Festival Gasyu', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
select pg_temp.assert((select city_id is null and city_name is null from public.v_activity_cards where id = (select v from ids where k = 'gasyu')),
  'event Gasyu tanpa cakupan tidak terikat kota');

-- View tetap security_invoker: anon tidak bisa membaca kartu
reset role;
set local role anon;
select pg_temp.assert(not has_table_privilege('anon', 'public.v_activity_cards', 'select'), 'anon tidak punya akses ke kartu aktivitas');

rollback;
\o
\echo UJI 0026 LULUS
