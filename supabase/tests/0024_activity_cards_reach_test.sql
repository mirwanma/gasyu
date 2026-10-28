-- Uji 0024: v_activity_cards membawa jangkauan dan mode lokasi.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0024.
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

-- Akun: O pemilik merchant (sponsor hadiah), A admin, W1 warga Cimahi, W2–W4 tanpa kecamatan
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
grant all on table ids to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into ids select 'g', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Tantangan Online HUT Kota', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
insert into ids select 'r', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Festival Regional', 'starts_at', '2030-05-01T10:00+07', 'ends_at', '2030-05-02T18:00+07')::jsonb);
select public.set_activity_reach((select v from ids where k = 'g'), 'global', 'online');

select pg_temp.assert((select reach = 'global' and location_mode = 'online' from public.v_activity_cards where id = (select v from ids where k = 'g')),
  'kartu Event Global membawa jangkauan dan mode lokasi');
select pg_temp.assert((select reach = 'regional' and location_mode = 'onsite' from public.v_activity_cards where id = (select v from ids where k = 'r')),
  'kartu event regional tetap regional di lokasi');

-- View tetap security_invoker: warga tidak melihat draft lewat kartu
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) = 0 from public.v_activity_cards where id in (select v from ids)), 'draft tidak terlihat warga');

rollback;
\o
\echo UJI 0024 LULUS
