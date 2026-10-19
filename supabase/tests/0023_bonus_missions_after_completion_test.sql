-- Uji 0023: misi bonus tetap bisa dikerjakan setelah warga berstatus selesai.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0023.
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
-- Event tanpa misi wajib: check-in langsung selesai, misi bonus tetap terbuka
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Pagi', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('outlet_id', (select v from ids where k = 'o_baros'))::jsonb);
insert into ids select 'm_code', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Kode di kasir","verification":"secret_code","code":"PAGIHARI","xp_reward":30,"is_required":false}');
insert into ids select 'm_manual', public.upsert_mission((select v from ids where k = 'ev'), '{"title":"Ikut kelas seduh","verification":"manual","xp_reward":40,"is_required":false}');
select public.submit_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev'), true, null);
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours', status = 'running' where id = (select v from ids where k = 'ev');
insert into tok select 'cp', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp');
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.join_activity((select v from ids where k = 'ev'));
select public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.8901, 107.5401);
reset role;
select pg_temp.assert((select status = 'completed' from public.participations where user_id = '00000000-0000-0000-0000-0000000000d1'), 'check-in menyelesaikan event');
set local role authenticated;

insert into res select 'list', public.get_activity_missions((select v from ids where k = 'ev'));
select pg_temp.assert((select bool_or((e ->> 'can_work')::boolean) from jsonb_array_elements((select v from res where k = 'list') -> 'missions') e),
  'warga yang sudah selesai masih melihat misi bonus bisa dikerjakan');
insert into res select 'code', public.complete_mission((select v from ids where k = 'm_code'), null, 'pagihari', null, null, null);
select pg_temp.assert((select v ->> 'status' = 'approved' from res where k = 'code'), 'misi bonus diterima setelah selesai');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert(public.mark_missions_manual((select v from ids where k = 'm_manual'), array['00000000-0000-0000-0000-0000000000d1'::uuid]) = 1,
  'panitia bisa menandai misi manual untuk warga yang sudah selesai');

reset role;
select pg_temp.assert((select count(*) = 2 from public.xp_ledger where user_id = '00000000-0000-0000-0000-0000000000d1' and reason = 'mission_complete'),
  'XP dua misi bonus tercatat');
select pg_temp.assert((select status = 'completed' from public.participations where user_id = '00000000-0000-0000-0000-0000000000d1'), 'status tetap selesai');
set local role authenticated;

-- Misi yang sama tidak bisa dikerjakan dua kali
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'm_code'), null, 'PAGI', null, null, null)$$, 'mission_already_done', 'misi tetap sekali per warga');

-- Warga yang batal tetap tidak bisa mengerjakan misi
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev'));
select public.cancel_participation((select id from public.participations where user_id = auth.uid()));
select pg_temp.assert_fails($$select public.complete_mission((select v from ids where k = 'm_code'), null, 'PAGI', null, null, null)$$, 'not_registered', 'warga batal ditolak');

rollback;
\o
\echo UJI 0023 LULUS
