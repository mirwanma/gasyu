-- Uji 0027: wilayah se-Indonesia, kecamatan asal, kota dibuka admin, peringkat per kota.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0027.
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

create temp table ids (k text primary key, v uuid);
create temp table res (k text primary key, v jsonb);
grant all on table ids, res to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Data wilayah
-- ---------------------------------------------------------------------------
select pg_temp.assert((select not is_active and province_name = 'Jawa Barat' from public.regions where code = '32.73'),
  'Kota Bandung ada, belum dibuka, provinsi tercatat');
select pg_temp.assert((select is_active and province_name = 'Jawa Barat' from public.regions where code = '32.77'),
  'Kota Cimahi tetap aktif');
select pg_temp.assert((select count(*) from public.regions d join public.regions c on c.id = d.parent_id where c.code = '32.73') = 30,
  'Kota Bandung punya 30 kecamatan');
select pg_temp.assert((select count(*) from public.regions where level = 'district' and not is_active) = 0, 'semua kecamatan aktif sebagai data');
select pg_temp.assert(public.region_label((select id from public.regions where code = '32.73.01')) = 'Sukasari, Kota Bandung', 'label kecamatan dan kota');
select pg_temp.assert(public.region_label((select id from public.regions where code = '32.73')) = 'Kota Bandung', 'label kota');
select pg_temp.assert(to_regclass('public.cities') is null and to_regclass('public.monthly_village_winners') is null, 'tabel lama dihapus');
select pg_temp.assert(to_regprocedure('public.set_home_city(text)') is null and to_regprocedure('public.change_home_village(uuid)') is null,
  'fungsi lama dihapus');
select pg_temp.assert((select rule ->> 'type' = 'distinct_districts' and (rule ->> 'count')::int = 3 from public.badges where code = 'district_explorer'),
  'badge Penjelajah Kecamatan: 3 kecamatan');
select pg_temp.assert(public.setting_int('profile.district_change_days') = 90, 'kunci ganti wilayah 90 hari');

-- Akun: A admin, W1 warga Cimahi Tengah, W2 warga Sukasari (Kota Bandung), W3 akun lama tanpa kecamatan, K ketua komunitas
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'w3@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test');
update public.profiles set is_admin = true, nickname = 'admin', full_name = 'Admin', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah')
  where id = '00000000-0000-0000-0000-00000000000e';
update public.profiles set nickname = 'lama', full_name = 'Lama', terms_accepted_at = now(), onboarded_at = now(),
  home_district_changed_at = now() - interval '1 day'
  where id = '00000000-0000-0000-0000-0000000000d3';
update public.profiles set nickname = 'ketua', full_name = 'Ketua', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where code = '31.71.01')
  where id = '00000000-0000-0000-0000-00000000000b';

-- ---------------------------------------------------------------------------
-- 2. Onboarding dengan kecamatan dari kota mana pun
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.complete_onboarding('wargacimahi', 'Warga Cimahi', (select id from public.regions where name = 'Cimahi Tengah'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select public.complete_onboarding('wargabdg', 'Warga Bandung', (select id from public.regions where code = '32.73'))$$,
  'invalid_district', 'kota saja tidak cukup, harus kecamatan');
select pg_temp.assert(public.complete_onboarding('wargabdg', 'Warga Bandung', (select id from public.regions where code = '32.73.01')) = 50,
  'warga kota yang belum dibuka bisa onboarding');
select pg_temp.assert((select district_name = 'Sukasari, Kota Bandung' from public.public_profile('00000000-0000-0000-0000-0000000000d2')),
  'profil publik menampilkan kecamatan dan kota');

-- Akun lama tanpa kecamatan langsung boleh melengkapinya walau pernah ganti wilayah kemarin
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.change_home_district((select id from public.regions where code = '31.71.01'));
select pg_temp.assert((select home_district_id = (select id from public.regions where code = '31.71.01') from public.profiles where id = auth.uid()),
  'akun lama melengkapi kecamatan');
select pg_temp.assert_fails($$select public.change_home_district((select id from public.regions where code = '32.73.01'))$$,
  'district_change_too_soon', 'setelah terisi, ganti lagi mengikuti batas 90 hari');

-- Domisili: kecamatan dan kota induknya
reset role;
select pg_temp.assert(public.is_resident_of('00000000-0000-0000-0000-0000000000d2', (select id from public.regions where code = '32.73.01')), 'warga Sukasari: warga kecamatannya');
select pg_temp.assert(public.is_resident_of('00000000-0000-0000-0000-0000000000d2', (select id from public.regions where code = '32.73')), 'warga Sukasari: warga Kota Bandung');
select pg_temp.assert(not public.is_resident_of('00000000-0000-0000-0000-0000000000d2', (select id from public.regions where code = '32.77')), 'warga Sukasari bukan warga Cimahi');

-- ---------------------------------------------------------------------------
-- 3. Peringkat: kota yang belum dibuka tidak tampil
-- ---------------------------------------------------------------------------
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
insert into res select 'closed', public.get_leaderboard('city', null, null);
select pg_temp.assert(not ((select v from res where k = 'closed') ->> 'city_active')::boolean
  and ((select v from res where k = 'closed') ->> 'total')::int = 0, 'kota belum dibuka: peringkat kosong');
insert into res select 'home_closed', public.get_citizen_dashboard();
select pg_temp.assert((select v ->> 'city_name' = 'Kota Bandung' and not (v ->> 'city_active')::boolean and v ->> 'rank_city' is null
  from res where k = 'home_closed'), 'beranda: kota belum dibuka, tanpa peringkat');
select pg_temp.assert((select count(*) from public.v_leaderboard_districts_month where city_name = 'Kota Bandung') = 0, 'view kecamatan tanpa kota tertutup');

-- Admin membuka Kota Bandung
select pg_temp.assert_fails($$select public.set_city_active((select id from public.regions where code = '32.73'), true)$$,
  'not_allowed', 'warga tidak bisa membuka kota');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert_fails($$select public.set_city_active((select id from public.regions where code = '32.73.01'), true)$$,
  'invalid_city', 'yang dibuka harus kota');
select public.set_city_active((select id from public.regions where code = '32.73'), true);
select pg_temp.assert((select count(*) = 1 from public.admin_actions where action = 'open_city'), 'pembukaan kota tercatat');

select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
insert into res select 'open', public.get_leaderboard('city', null, null);
select pg_temp.assert(((select v from res where k = 'open') ->> 'city_active')::boolean
  and ((select v from res where k = 'open') ->> 'total')::int = 1
  and ((select v from res where k = 'open') -> 'me' ->> 'rank')::int = 1, 'kota dibuka: warga Bandung peringkat 1 di kotanya');
insert into res select 'cimahi', public.get_leaderboard('city', (select id from public.regions where code = '32.77'), null);
select pg_temp.assert((select count(*) from jsonb_array_elements((select v from res where k = 'cimahi') -> 'rows') e where e ->> 'nickname' = 'wargabdg') = 0
  and ((select v from res where k = 'cimahi') ->> 'city_name') = 'Kota Cimahi', 'peringkat Cimahi tidak memuat warga Bandung');
insert into res select 'districts', public.get_leaderboard('districts', null, null);
select pg_temp.assert(jsonb_array_length((select v from res where k = 'districts') -> 'rows') = 30, 'peringkat kecamatan Kota Bandung: 30 kecamatan');
insert into res select 'home_open', public.get_citizen_dashboard();
select pg_temp.assert((select (v ->> 'city_active')::boolean and (v ->> 'rank_city')::int = 1 and (v ->> 'rank_district')::int = 1
  from res where k = 'home_open'), 'beranda: peringkat kota dan kecamatan');

-- ---------------------------------------------------------------------------
-- 4. Penyelenggara di kota lain, cakupan aktivitas hanya di kota yang dibuka
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.register_organizer('community', json_build_object('name', 'Salah', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'activity_area_district_id', (select id from public.regions where name = 'Baros' and level = 'village'))::jsonb)$$,
  'invalid_district', 'area komunitas harus kecamatan');
insert into ids select 'k', public.register_organizer('community', json_build_object('name', 'Lari Jakarta', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open', 'activity_area_district_id', (select id from public.regions where code = '31.71.01'))::jsonb);
reset role;
select pg_temp.assert((select o.district_id = (select id from public.regions where code = '31.71.01') and c.activity_area_district_id = o.district_id
  from public.organizers o join public.community_profiles c on c.organizer_id = o.id where o.id = (select v from ids where k = 'k')),
  'komunitas Jakarta tercatat di kecamatannya');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'k'), true, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.create_activity((select v from ids where k = 'k'), json_build_object('title', 'Lari Pagi',
  'scope_region_id', (select id from public.regions where code = '31.71.01'), 'starts_at', '2030-01-01T06:00+07', 'ends_at', '2030-01-01T09:00+07')::jsonb)$$,
  'invalid_region', 'cakupan di kota yang belum dibuka ditolak');
select pg_temp.assert_fails($$select public.create_activity((select v from ids where k = 'k'), json_build_object('title', 'Lari Pagi',
  'scope_region_id', (select id from public.regions where name = 'Baros' and level = 'village'), 'starts_at', '2030-01-01T06:00+07', 'ends_at', '2030-01-01T09:00+07')::jsonb)$$,
  'invalid_region', 'cakupan kelurahan tidak dipakai lagi');
insert into ids select 'act', public.create_activity((select v from ids where k = 'k'), json_build_object('title', 'Lari Pagi',
  'starts_at', '2030-01-01T06:00+07', 'ends_at', '2030-01-01T09:00+07')::jsonb);
select pg_temp.assert((select city_name = 'Kota Administrasi Jakarta Pusat' from public.v_activity_cards where id = (select v from ids where k = 'act')),
  'kartu aktivitas memakai kota penyelenggara');

-- Kolom kecamatan penyelenggara hanya berisi kecamatan
select pg_temp.assert_fails($$update public.organizers set district_id = (select id from public.regions where name = 'Baros' and level = 'village')
  where id = (select v from ids where k = 'k')$$, 'invalid_district', 'tim tidak bisa mengisi kelurahan');
select pg_temp.assert_fails($$update public.community_profiles set activity_area_district_id = (select id from public.regions where code = '31.71')
  where organizer_id = (select v from ids where k = 'k')$$, 'invalid_district', 'area komunitas tidak bisa diisi kota');

-- Statistik kota untuk admin
select pg_temp.assert((select count(*) = 0 from public.v_admin_city_stats), 'statistik kota hanya untuk admin');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select citizens = 2 and organizers = 1 and not is_active from public.v_admin_city_stats
  where name = 'Kota Administrasi Jakarta Pusat'), 'statistik Jakarta Pusat: 2 warga (W3, ketua), 1 komunitas');
select pg_temp.assert((select count(*) = 514 from public.v_admin_city_stats), 'admin melihat semua kota');

rollback;
\o
\echo UJI 0027 LULUS
