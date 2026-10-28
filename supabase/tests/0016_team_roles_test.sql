-- Uji peran tim (0016). Semua perubahan dibatalkan di akhir (rollback).
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

-- O pemilik, S staf, X warga luar tim
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 's@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'x@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Uji', terms_accepted_at = now(), onboarded_at = now();

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
grant all on table ids, tok to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into tok select 'inv', public.create_organizer_invite((select v from ids where k = 'm'), 'staff');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_organizer_invite((select v from tok where k = 'inv'));

-- Staf tidak bisa mengubah peran
select pg_temp.assert_fails($$select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000c', 'owner')$$,
  'not_allowed', 'staf tidak bisa mengangkat diri jadi pemilik');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000c', 'chair')$$,
  'invalid_member_role', 'peran komunitas tidak berlaku di merchant');
select pg_temp.assert_fails($$select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-0000000000d1', 'staff')$$,
  'not_team_member', 'bukan anggota tim');
select pg_temp.assert_fails($$select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000a', 'staff')$$,
  'last_leader_cannot_be_removed', 'pemilik satu-satunya tidak bisa turun');

-- Serahkan: angkat staf jadi pemilik, lalu pemilik lama turun jadi staf
select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000c', 'owner');
select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000a', 'staff');
reset role;
select pg_temp.assert((select role = 'owner' from public.organizer_members where user_id = '00000000-0000-0000-0000-00000000000c'), 'staf jadi pemilik');
select pg_temp.assert((select role = 'staff' from public.organizer_members where user_id = '00000000-0000-0000-0000-00000000000a'), 'pemilik lama jadi staf');
select pg_temp.assert((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000c' and kind = 'team_role_changed'), 'yang diangkat mendapat notifikasi');
set local role authenticated;

-- Pemilik lama sekarang staf: tidak bisa mengubah peran lagi, dan sekarang boleh hapus akun
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.set_team_role((select v from ids where k = 'm'), '00000000-0000-0000-0000-00000000000a', 'owner')$$,
  'not_allowed', 'staf tidak bisa naik sendiri');
select public.delete_my_account('HAPUS');
reset role;
select pg_temp.assert((select deleted_at is not null from public.profiles where id = '00000000-0000-0000-0000-00000000000a'), 'setelah menyerahkan peran, akun bisa dihapus');

rollback;
\o
\echo UJI 0016 LULUS
