-- Uji pengingat kedaluwarsa (0019). Semua perubahan dibatalkan di akhir (rollback).
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

-- O pemilik merchant, W1 warga, W2 warga dibekukan
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Uji', terms_accepted_at = now(), onboarded_at = now();
update public.profiles set suspended_at = now() where id = '00000000-0000-0000-0000-0000000000d2';

create temp table ids (k text primary key, v uuid);
grant all on table ids to anon, authenticated;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
reset role;

-- Data langsung (superuser): satu reward, voucher, dan kredit poin
with x as (insert into public.rewards (organizer_id, title, price_points, stock) values ((select v from ids where k = 'm'), 'Kopi susu aren', 50, 10) returning id)
insert into ids select 'rw', id from x;
insert into public.redemptions (reward_id, user_id, code, price_points, expires_at) values
  ((select v from ids where k = 'rw'), '00000000-0000-0000-0000-0000000000d1', 'ABCD1234', 50, now() + interval '3 days'),   -- segera kedaluwarsa
  ((select v from ids where k = 'rw'), '00000000-0000-0000-0000-0000000000d1', 'EFGH5678', 50, now() + interval '20 days'),  -- masih lama
  ((select v from ids where k = 'rw'), '00000000-0000-0000-0000-0000000000d2', 'IJKL9012', 50, now() + interval '2 days');   -- akun dibekukan
insert into public.point_ledger (user_id, amount, reason, expires_at, note) values
  ('00000000-0000-0000-0000-0000000000d1', 40, 'adjustment', now() + interval '5 days', 'uji'),
  ('00000000-0000-0000-0000-0000000000d1', 25, 'adjustment', now() + interval '6 days', 'uji'),
  ('00000000-0000-0000-0000-0000000000d1', 100, 'adjustment', now() + interval '60 days', 'uji');

-- Jalankan pengingat
select public.notify_expiring();
select pg_temp.assert((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'voucher_expiring'),
  'satu pengingat untuk voucher yang kedaluwarsa dalam 7 hari');
select pg_temp.assert((select payload ->> 'reward_title' = 'Kopi susu aren' and payload ->> 'merchant_name' = 'Kopi Lereng'
  from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'voucher_expiring'), 'pengingat voucher berisi nama hadiah dan merchant');
select pg_temp.assert((select (payload ->> 'points')::int = 65 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'points_expiring'),
  'pengingat poin menjumlah poin yang kedaluwarsa dalam 7 hari (40 + 25)');
select pg_temp.assert((select count(*) = 0 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d2'), 'akun dibekukan tidak dikirimi pengingat');

-- Dijalankan lagi: tidak ada duplikat
select public.notify_expiring();
select pg_temp.assert((select count(*) = 2 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1'), 'dijalankan ulang tidak menggandakan pengingat');

-- Poin yang sudah terpakai tidak dihitung: alokasikan 40 poin pertama ke debit
with x as (insert into public.point_ledger (user_id, amount, reason, note) values ('00000000-0000-0000-0000-0000000000d1', -40, 'adjustment', 'uji pakai') returning id)
insert into ids select 'debit', id from x;
insert into public.point_allocations (credit_id, debit_id, amount)
  select id, (select v from ids where k = 'debit'), 40 from public.point_ledger where user_id = '00000000-0000-0000-0000-0000000000d1' and amount = 40;
delete from public.notifications where kind = 'points_expiring';
select public.notify_expiring();
select pg_temp.assert((select (payload ->> 'points')::int = 25 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'points_expiring'),
  'poin yang sudah dipakai tidak ikut dihitung');

-- Fungsi tidak bisa dipanggil pengguna
set local role authenticated;
do $$
begin
  perform public.notify_expiring();
  raise exception 'UJI GAGAL: warga bisa memanggil notify_expiring';
exception when insufficient_privilege then null;
end $$;

rollback;
\o
\echo UJI 0019 LULUS
