-- Uji akun warga (0015): ubah profil, ganti kelurahan, hapus akun.
-- Semua perubahan dibatalkan di akhir (rollback). Jalankan setelah 0001–0015.
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

-- Akun: O pemilik merchant, S staf merchant, K ketua komunitas, A admin, W1 W2 warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 's@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';
select public.award_xp('00000000-0000-0000-0000-00000000000c', 120, 'adjustment');

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
grant all on table ids, tok to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into tok select 'inv', public.create_organizer_invite((select v from ids where k = 'm'), 'staff');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_organizer_invite((select v from tok where k = 'inv'));
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'c', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'c'), true, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.request_membership((select v from ids where k = 'c'), null);

-- ---------------------------------------------------------------------------
-- 1. Ubah profil
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.update_my_profile('ab', 'Rani')$$, 'invalid_nickname', 'nickname terlalu pendek');
select pg_temp.assert_fails($$select public.update_my_profile('rani', '   ')$$, 'invalid_full_name', 'nama lengkap kosong');
select pg_temp.assert_fails($$select public.update_my_profile('UJID2', 'Rani')$$, 'nickname_taken', 'nickname orang lain (beda huruf besar) ditolak');
select public.update_my_profile('  rani_baros  ', ' Rani Puspita ');
select pg_temp.assert((select nickname::text = 'rani_baros' and full_name = 'Rani Puspita' from public.profiles where id = auth.uid()), 'profil diperbarui dan dirapikan');

-- ---------------------------------------------------------------------------
-- 2. Ganti kelurahan
-- ---------------------------------------------------------------------------
select pg_temp.assert_fails($$select public.change_home_village((select id from public.regions where name = 'Baros'))$$, 'same_village', 'kelurahan sama ditolak');
select pg_temp.assert_fails($$select public.change_home_village((select id from public.regions where level = 'district' limit 1))$$, 'invalid_village', 'kecamatan bukan kelurahan');
select public.change_home_village((select id from public.regions where name = 'Cibabat'));
select pg_temp.assert((select home_village_id = (select id from public.regions where name = 'Cibabat') and home_village_changed_at is not null
  from public.profiles where id = auth.uid()), 'kelurahan berganti dan tanggal tercatat');
select pg_temp.assert_fails($$select public.change_home_village((select id from public.regions where name = 'Melong'))$$, 'village_change_too_soon', 'ganti lagi sebelum 90 hari ditolak');
reset role;
update public.profiles set home_village_changed_at = now() - interval '91 days' where id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;
select public.change_home_village(null);
select pg_temp.assert((select home_village_id is null from public.profiles where id = auth.uid()), 'setelah 90 hari boleh ganti ke Luar Cimahi');

-- ---------------------------------------------------------------------------
-- 3. Hapus akun
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.delete_my_account('hapus akun')$$, 'confirmation_required', 'harus mengetik HAPUS');
select pg_temp.assert_fails($$select public.delete_my_account('HAPUS')$$, 'transfer_leadership_first', 'pemilik satu-satunya tidak bisa menghapus akun');

select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert_fails($$select public.delete_my_account('HAPUS')$$, 'admin_account', 'admin tidak bisa menghapus akun sendiri');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.delete_my_account('hapus');
reset role;
select pg_temp.assert((select deleted_at is not null and full_name is null and home_village_id is null and nickname::text like 'hapus-%'
  from public.profiles where id = '00000000-0000-0000-0000-00000000000c'), 'data pribadi dikosongkan');
select pg_temp.assert((select count(*) = 0 from public.organizer_members where user_id = '00000000-0000-0000-0000-00000000000c'), 'keluar dari tim');
select pg_temp.assert((select status = 'left' from public.community_memberships where user_id = '00000000-0000-0000-0000-00000000000c'), 'keanggotaan komunitas jadi keluar');
select pg_temp.assert((select count(*) = 0 from public.notifications where user_id = '00000000-0000-0000-0000-00000000000c'), 'notifikasi dihapus');
select pg_temp.assert((select coalesce(sum(amount), 0) = 120 from public.xp_ledger where user_id = '00000000-0000-0000-0000-00000000000c'), 'ledger XP tetap ada');
set local role authenticated;
select pg_temp.assert_fails($$select public.update_my_profile('kembali', 'Kembali')$$, 'account_inactive', 'akun terhapus tidak bisa beraksi lagi');

-- Pemilik tetap pemilik, tim merchant tinggal satu orang
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) = 1 from public.v_organizer_team where organizer_id = (select v from ids where k = 'm')), 'tim merchant tinggal pemilik');

-- ---------------------------------------------------------------------------
-- 4. Hapus akun dengan pendaftaran aktivitas
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
-- Aktivitas gratis
insert into ids select 'free', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Bareng', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07')::jsonb);
select public.add_checkpoint((select v from ids where k = 'free'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.submit_activity((select v from ids where k = 'free'));
-- Aktivitas berbayar
insert into ids select 'paid', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Kelas Latte Art', 'starts_at', '2030-01-02T10:00+07', 'ends_at', '2030-01-02T14:00+07',
  'is_paid', true, 'price_idr', '50000', 'payment_instructions', 'Transfer BCA 1234567')::jsonb);
select public.add_checkpoint((select v from ids where k = 'paid'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.submit_activity((select v from ids where k = 'paid'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'free'), true, null);
select public.review_activity((select v from ids where k = 'paid'), true, null);

-- W2 ikut aktivitas gratis lalu menghapus akun: pendaftarannya dibatalkan
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'free'));
select public.delete_my_account('HAPUS');
reset role;
select pg_temp.assert((select status = 'cancelled' from public.participations
  where activity_id = (select v from ids where k = 'free') and user_id = '00000000-0000-0000-0000-0000000000d2'), 'hapus akun membatalkan pendaftaran yang belum berjalan');
set local role authenticated;

-- W1 ikut aktivitas berbayar dan sudah kirim bukti: hapus akun ditolak
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.join_activity((select v from ids where k = 'paid'));
select public.submit_payment_proof(
  (select id from public.participations where activity_id = (select v from ids where k = 'paid') and user_id = auth.uid()),
  (select v from ids where k = 'paid') || '/00000000-0000-0000-0000-0000000000d1/bukti.jpg');
select pg_temp.assert_fails($$select public.delete_my_account('HAPUS')$$, 'active_paid_participation', 'pembayaran menunggu konfirmasi menahan hapus akun');
-- Setelah membatalkan pendaftaran sendiri (refund jadi urusan penyelenggara), akun bisa dihapus
select public.cancel_participation((select id from public.participations where activity_id = (select v from ids where k = 'paid') and user_id = auth.uid()));
select public.delete_my_account('HAPUS');
reset role;
select pg_temp.assert((select deleted_at is not null from public.profiles where id = '00000000-0000-0000-0000-0000000000d1'), 'setelah pendaftaran berbayar dibatalkan, akun bisa dihapus');
set local role authenticated;

-- anon tidak bisa memanggil fungsi
reset role;
set local role anon;
select pg_temp.assert_fails($$select public.delete_my_account('HAPUS')$$, 'permission denied', 'anon tidak bisa menghapus akun');

rollback;
\o
\echo UJI 0015 LULUS
