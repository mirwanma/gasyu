-- Uji Irisan 6 (Poin & reward). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0006.
\o /dev/null
begin;
-- Trigger badge (irisan 9) tertunda sampai commit; di uji dipaksa langsung.
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

-- Akun: O pemilik merchant, S staf merchant, K ketua komunitas, A admin, W warga, L warga 2
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000f', 's@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-00000000000d', 'w@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 'l@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 1), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
create temp table res (k text primary key, v jsonb);
grant all on table ids, tok, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'merchant', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.890000, 'lng', 107.540000)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'merchant');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'community', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'merchant'), true, null);
select public.review_organizer((select v from ids where k = 'community'), true, null);
reset role;
insert into public.organizer_members (organizer_id, user_id, role) values ((select v from ids where k = 'merchant'), '00000000-0000-0000-0000-00000000000f', 'staff');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 1. Budget poin dan poin per penyelesaian
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'merchant'), json_build_object(
  'title', 'Ngopi Berhadiah', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
insert into ids select 'host_partner', id from public.activity_partners where activity_id = (select v from ids where k = 'ev');
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.set_points_per_completion((select v from ids where k = 'ev'), 100);
select pg_temp.assert_fails($$select public.submit_activity((select v from ids where k = 'ev'))$$, 'points_budget_insufficient', 'budget poin kurang: tidak bisa diajukan');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.set_partner_budget((select v from ids where k = 'host_partner'), 250)$$, 'not_allowed', 'staf tidak bisa mengisi budget');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.set_partner_budget((select v from ids where k = 'host_partner'), 250);
select pg_temp.assert((select budget from public.v_activity_budget where activity_id = (select v from ids where k = 'ev')) = 250, 'budget 250 tersimpan');
select pg_temp.assert((select remaining from public.v_activity_budget where activity_id = (select v from ids where k = 'ev')) = 250, 'sisa 250');
select public.submit_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev'), true, null);

-- Komunitas tidak bisa punya budget
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'kev', public.create_activity((select v from ids where k = 'community'), json_build_object(
  'title', 'Lari Komunitas', 'starts_at', '2030-01-02T06:00+07', 'ends_at', '2030-01-02T08:00+07')::jsonb);
select pg_temp.assert_fails(
  $$select public.set_partner_budget((select id from public.activity_partners where activity_id = (select v from ids where k = 'kev')), 100)$$,
  'points_budget_requires_merchant', 'komunitas tidak punya budget poin');

-- ---------------------------------------------------------------------------
-- 2. Check-in memberi poin sampai budget habis
-- ---------------------------------------------------------------------------
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours' where id = (select v from ids where k = 'ev');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into tok select 'cp', public.get_checkpoint_qr((select v from ids where k = 'cp')) ->> 'token';

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select public.join_activity((select v from ids where k = 'ev'));
insert into res select 'w', public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'w') ->> 'points')::int = 100, 'warga dapat 100 poin saat selesai');
select pg_temp.assert(((select v from res where k = 'w') ->> 'points_balance')::int = 100, 'saldo 100');
select pg_temp.assert((select balance from public.v_user_points_balance) = 100, 'v_user_points_balance 100');
select pg_temp.assert((select count(*) from public.point_ledger where user_id = auth.uid() and reason = 'activity_reward' and amount = 100) = 1, 'ledger kredit 100');
select pg_temp.assert((select expires_at from public.point_ledger where user_id = auth.uid()) > now() + interval '5 months', 'kredit kedaluwarsa 6 bulan');
select pg_temp.assert_fails($$insert into public.point_ledger (user_id, amount, reason, expires_at) values (auth.uid(), 999, 'adjustment', now() + interval '1 day')$$, 'permission denied', 'poin tidak bisa ditulis client');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.join_activity((select v from ids where k = 'ev'));
insert into res select 'l', public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'l') ->> 'points')::int = 100, 'warga kedua dapat 100 poin');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select public.join_activity((select v from ids where k = 'ev'));
insert into res select 'k', public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'k') ->> 'points')::int = 0, 'budget sisa 50 < 100: tanpa poin, XP tetap');
select pg_temp.assert(((select v from res where k = 'k') ->> 'xp_base')::int = 100, 'XP tetap diberikan');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select used from public.v_activity_budget where activity_id = (select v from ids where k = 'ev')) = 200, 'budget terpakai 200');
select pg_temp.assert_fails($$select public.set_partner_budget((select v from ids where k = 'host_partner'), 150)$$, 'activity_locked', 'budget terkunci saat berjalan');

-- ---------------------------------------------------------------------------
-- 3. Reward: buat, tukar, pakai di kasir, refund
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'merchant'), null, '{"title":"Gratis kopi","price_points":"60","stock":"2"}')$$, 'not_allowed', 'staf tidak bisa membuat reward');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'community'), null, '{"title":"Gratis kopi","price_points":"60","stock":"2"}')$$, 'not_allowed', 'komunitas tidak bisa membuat reward');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.upsert_reward((select v from ids where k = 'merchant'), null, '{"title":"X","price_points":"60","stock":"2"}')$$, 'invalid_reward', 'judul reward minimal 3 karakter');
insert into ids select 'rw', public.upsert_reward((select v from ids where k = 'merchant'), null, '{"title":"Gratis 1 es kopi susu","price_points":"60","stock":"2","valid_days":"14"}');
insert into ids select 'rw2', public.upsert_reward((select v from ids where k = 'merchant'), null, '{"title":"Diskon 50%","price_points":"500","stock":"5"}');
select public.upsert_reward((select v from ids where k = 'merchant'), (select v from ids where k = 'rw2'), '{"status":"inactive"}');

select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.rewards) = 1, 'warga hanya melihat reward aktif');
select pg_temp.assert_fails($$select public.redeem_reward((select v from ids where k = 'rw2'))$$, 'reward_unavailable', 'reward nonaktif tidak bisa ditukar');
insert into res select 'rd1', public.redeem_reward((select v from ids where k = 'rw'));
select pg_temp.assert((select v from res where k = 'rd1') ->> 'code' ~ '^[A-Z0-9]{8}$', 'kode voucher 8 karakter');
select pg_temp.assert(((select v from res where k = 'rd1') ->> 'balance')::int = 40, 'saldo 100 - 60 = 40');
select pg_temp.assert((select balance from public.v_user_points_balance) = 40, 'v_user_points_balance 40');
select pg_temp.assert((select stock from public.rewards where id = (select v from ids where k = 'rw')) = 1, 'stok berkurang');
select pg_temp.assert((select count(*) from public.point_allocations) = 1, 'alokasi debit ke kredit tercatat');
select pg_temp.assert_fails($$select public.redeem_reward((select v from ids where k = 'rw'))$$, 'insufficient_points', 'saldo 40 < 60');
select pg_temp.assert((select count(*) from public.redemptions where user_id = auth.uid() and status = 'active') = 1, 'voucher aktif milik warga');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
insert into res select 'rd2', public.redeem_reward((select v from ids where k = 'rw'));
select pg_temp.assert_fails($$select public.redeem_reward((select v from ids where k = 'rw'))$$, 'out_of_stock', 'stok habis');
select pg_temp.assert((select count(*) from public.redemptions) = 1, 'warga tidak melihat voucher orang lain');

-- Kasir (staf) memakai voucher
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.use_voucher((select v from res where k = 'rd1') ->> 'code', (select v from ids where k = 'outlet'))$$, 'not_allowed', 'tim lain tidak bisa memakai voucher');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.use_voucher('ZZZZZZZZ', (select v from ids where k = 'outlet'))$$, 'invalid_code', 'kode salah');
select pg_temp.assert((public.lookup_voucher((select v from ids where k = 'merchant'), lower((select v from res where k = 'rd1') ->> 'code')) ->> 'valid')::boolean, 'lookup: voucher valid');
select pg_temp.assert(public.lookup_voucher((select v from ids where k = 'merchant'), (select v from res where k = 'rd1') ->> 'code') ->> 'nickname' = 'ujid', 'lookup menampilkan nickname');
insert into res select 'use', public.use_voucher((select v from res where k = 'rd1') ->> 'code', (select v from ids where k = 'outlet'));
select pg_temp.assert((select v from res where k = 'use') ->> 'nickname' = 'ujid', 'kasir melihat nickname pemilik');
select pg_temp.assert_fails($$select public.use_voucher((select v from res where k = 'rd1') ->> 'code', (select v from ids where k = 'outlet'))$$, 'voucher_unavailable', 'voucher sekali pakai');
select pg_temp.assert((select count(*) from public.v_reward_redemptions where status = 'used' and outlet_name = 'Cabang Baros') = 1, 'tim melihat voucher dipakai per outlet');
select pg_temp.assert_fails($$select full_name from public.v_reward_redemptions$$, 'does not exist', 'tidak ada full_name');

-- Refund oleh pemilik: poin kembali, stok naik
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert_fails($$select public.refund_redemption(((select v from res where k = 'rd2') ->> 'redemption_id')::uuid)$$, 'not_allowed', 'staf tidak bisa refund');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.refund_redemption(((select v from res where k = 'rd2') ->> 'redemption_id')::uuid)$$, 'reward_still_active', 'refund hanya setelah reward dinonaktifkan');
select public.upsert_reward((select v from ids where k = 'merchant'), (select v from ids where k = 'rw'), '{"status":"inactive"}');
select public.refund_redemption(((select v from res where k = 'rd2') ->> 'redemption_id')::uuid);
select pg_temp.assert((select stock from public.rewards where id = (select v from ids where k = 'rw')) = 1, 'stok kembali 1');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select balance from public.v_user_points_balance) = 100, 'poin kembali: saldo 100');
select pg_temp.assert((select status from public.redemptions where id = ((select v from res where k = 'rd2') ->> 'redemption_id')::uuid) = 'refunded', 'status refunded');
select pg_temp.assert((select count(*) from public.notifications where kind = 'voucher_refunded') = 1, 'warga diberi tahu refund');

-- ---------------------------------------------------------------------------
-- 4. Kedaluwarsa (cron) dan ledger tidak bisa diubah
-- ---------------------------------------------------------------------------
reset role;
alter table public.point_ledger disable trigger point_ledger_append_only;
update public.point_ledger set expires_at = now() - interval '1 day' where user_id = '00000000-0000-0000-0000-00000000000d' and amount > 0;
alter table public.point_ledger enable trigger point_ledger_append_only;
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select balance from public.v_user_points_balance) = 0, 'kredit kedaluwarsa tidak dihitung');
reset role;
select pg_temp.assert(public.expire_points() = 1, 'expire_points menulis 1 baris');
select pg_temp.assert((select sum(amount) from public.point_ledger where user_id = '00000000-0000-0000-0000-00000000000d') = 0, 'ledger total 0 setelah kedaluwarsa (100 - 60 - 40)');
select pg_temp.assert(public.expire_points() = 0, 'expire_points idempoten');
update public.redemptions set expires_at = now() - interval '1 minute' where status = 'active';
select pg_temp.assert(public.expire_redemptions() = 0, 'tidak ada voucher aktif tersisa');
select pg_temp.assert_fails($$update public.point_ledger set amount = 1$$, 'point_ledger_append_only', 'ledger tidak bisa diubah');
select pg_temp.assert_fails($$delete from public.point_ledger$$, 'point_ledger_append_only', 'ledger tidak bisa dihapus');

rollback;
\o
select 'SEMUA UJI IRISAN 6 LOLOS' as hasil;
