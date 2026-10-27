-- Uji master misi (0018). Semua perubahan dibatalkan di akhir (rollback).
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

-- O pemilik merchant, A admin, W warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
grant all on table ids to anon, authenticated;
set local role authenticated;

-- Template awal tersedia
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) >= 12 from public.mission_templates), 'template awal terbaca warga yang login');
select pg_temp.assert((select count(*) = 0 from public.v_mission_template_stats), 'statistik template hanya untuk admin');

-- ---------------------------------------------------------------------------
-- 1. Hanya admin yang mengelola template
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.upsert_mission_template(null, '{"title":"Template liar","verification":"manual","xp_reward":30}')$$,
  'not_allowed', 'bukan admin tidak bisa membuat template');
select pg_temp.assert_fails($$insert into public.mission_templates (title, verification, xp_reward) values ('Langsung', 'manual', 30)$$,
  'permission denied', 'insert langsung ditolak');

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert_fails($$select public.upsert_mission_template(null, '{"title":"XP kebesaran","verification":"manual","xp_reward":500}')$$,
  'invalid_xp', 'XP di luar batas app_settings ditolak');
select pg_temp.assert_fails($$select public.upsert_mission_template(null, '{"title":"Ok","verification":"manual","xp_reward":30}')$$,
  'invalid_title', 'judul terlalu pendek ditolak');
insert into ids select 't', public.upsert_mission_template(null, json_build_object(
  'title', 'Check-in di stand sponsor', 'description', 'Pindai QR di stand sponsor.', 'organizer_tips', 'Taruh petugas di stand.',
  'category', 'visit', 'verification', 'qr_scan', 'xp_reward', 25, 'is_required', false, 'activity_type', 'event', 'organizer_type', 'merchant')::jsonb);
select pg_temp.assert((select title = 'Check-in di stand sponsor' and category = 'visit' and verification = 'qr_scan' and xp_reward = 25
  and not is_required and activity_type = 'event' and organizer_type = 'merchant' from public.mission_templates where id = (select v from ids where k = 't')), 'admin membuat template');
select pg_temp.assert((select count(*) = 1 from public.admin_actions where action = 'create_mission_template' and target_id = (select v from ids where k = 't')), 'pembuatan template tercatat di audit');

-- ---------------------------------------------------------------------------
-- 2. Penyelenggara memakai template: template_id tercatat, isi disalin
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into ids select 'ev', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Bareng', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object(
  'outlet_id', (select id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm')))::jsonb);
insert into ids select 'mi', public.upsert_mission((select v from ids where k = 'ev'), json_build_object(
  'template_id', (select v from ids where k = 't'), 'title', 'Check-in di stand Kopi Lereng', 'description', 'Pindai QR di stand.',
  'verification', 'qr_scan', 'checkpoint_id', (select v from ids where k = 'cp'), 'xp_reward', 25, 'is_required', false)::jsonb);
reset role;
select pg_temp.assert((select template_id = (select v from ids where k = 't') and title = 'Check-in di stand Kopi Lereng'
  from public.activity_missions where id = (select v from ids where k = 'mi')), 'misi mencatat template asal dan memakai judul yang diubah');
set local role authenticated;
-- Misi tanpa template tetap bisa
insert into ids select 'mi2', public.upsert_mission((select v from ids where k = 'ev'), json_build_object(
  'title', 'Misi buatan sendiri', 'verification', 'manual', 'xp_reward', 20)::jsonb);
reset role;
select pg_temp.assert((select template_id is null from public.activity_missions where id = (select v from ids where k = 'mi2')), 'misi tanpa template tetap bisa');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 3. Ubah dan nonaktifkan template tidak mengubah misi yang sudah dibuat
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.upsert_mission_template((select v from ids where k = 't'), json_build_object(
  'title', 'Check-in di stand partner', 'verification', 'qr_scan', 'xp_reward', 30, 'category', 'visit')::jsonb);
select public.set_mission_template_active((select v from ids where k = 't'), false);
select pg_temp.assert((select count(*) = 1 from public.v_mission_template_stats where template_id = (select v from ids where k = 't') and missions = 1 and activities = 1),
  'statistik menghitung pemakaian template');
select pg_temp.assert((select count(*) = 1 from public.admin_actions where action = 'deactivate_mission_template'), 'penonaktifan tercatat di audit');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
reset role;
select pg_temp.assert((select title = 'Check-in di stand Kopi Lereng' and xp_reward = 25 from public.activity_missions where id = (select v from ids where k = 'mi')),
  'misi lama tidak ikut berubah');
set local role authenticated;
select pg_temp.assert((select count(*) = 0 from public.mission_templates where id = (select v from ids where k = 't')), 'template nonaktif tidak terlihat penyelenggara');
select pg_temp.assert_fails($$select public.upsert_mission((select v from ids where k = 'ev'), json_build_object(
  'template_id', (select v from ids where k = 't'), 'title', 'Pakai template nonaktif', 'verification', 'qr_scan', 'checkpoint_id', (select v from ids where k = 'cp'), 'xp_reward', 25)::jsonb)$$,
  'invalid_template', 'template nonaktif tidak bisa dipakai');
select pg_temp.assert_fails($$select public.set_mission_template_active((select v from ids where k = 't'), true)$$,
  'not_allowed', 'bukan admin tidak bisa mengaktifkan template');

-- anon tidak bisa memanggil fungsi template
reset role;
set local role anon;
select pg_temp.assert_fails($$select public.upsert_mission_template(null, '{}')$$, 'permission denied', 'anon tidak bisa memanggil fungsi template');

rollback;
\o
\echo UJI 0018 LULUS
