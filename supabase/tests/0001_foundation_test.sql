-- Uji Irisan 1 (Fondasi). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan: psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/tests/0001_foundation_test.sql
-- Jika semua lolos, baris terakhir mencetak "SEMUA UJI IRISAN 1 LOLOS".

\o /dev/null
begin;

-- Helper uji: gagal jika kondisi salah.
create function pg_temp.assert(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is not true then
    raise exception 'UJI GAGAL: %', p_msg;
  end if;
end;
$$;

-- Helper uji: jalankan SQL dan pastikan gagal dengan pesan yang memuat p_expected.
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

grant execute on all functions in schema pg_temp to anon, authenticated;

-- ---------------------------------------------------------------------------
-- 1. Seed wilayah, setting, level
-- ---------------------------------------------------------------------------
select pg_temp.assert((select count(*) from public.regions where level = 'city') = 1, '1 kota');
select pg_temp.assert((select count(*) from public.regions where level = 'district') = 3, '3 kecamatan');
select pg_temp.assert((select count(*) from public.regions where level = 'village') = 15, '15 kelurahan');
select pg_temp.assert(public.setting_int('xp.daily_cap') = 1000, 'xp.daily_cap = 1000');
select pg_temp.assert((select count(*) from public.levels) = 5, '5 level');
select pg_temp.assert_fails(
  $$insert into public.regions (level, name, parent_id)
    select 'village', 'Salah Induk', id from public.regions where level = 'city'$$,
  'invalid_region_parent', 'kelurahan tidak boleh langsung di bawah kota');

-- ---------------------------------------------------------------------------
-- 2. Trigger auth membuat profiles
-- ---------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'a@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'b@uji.test');

select pg_temp.assert(
  (select count(*) from public.profiles
   where id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b')) = 2,
  'profiles dibuat otomatis');

-- ---------------------------------------------------------------------------
-- 3. Warga A (login)
-- ---------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000a","role":"authenticated"}', true);

select pg_temp.assert(auth.uid() = '00000000-0000-0000-0000-00000000000a', 'auth.uid() warga A');
select pg_temp.assert(public.is_admin() = false, 'warga A bukan admin');

-- Kolom terlarang
select pg_temp.assert_fails(
  $$update public.profiles set is_admin = true where id = auth.uid()$$,
  'permission denied', 'warga tidak bisa menjadikan dirinya admin');
select pg_temp.assert_fails(
  $$update public.profiles set onboarded_at = now() where id = auth.uid()$$,
  'permission denied', 'warga tidak bisa mengisi onboarded_at sendiri');
select pg_temp.assert_fails(
  $$update public.profiles set home_village_id = null where id = auth.uid()$$,
  'permission denied', 'kelurahan hanya diubah lewat fungsi');

-- XP tidak bisa ditulis dari client
select pg_temp.assert_fails(
  $$insert into public.xp_ledger (user_id, amount, reason) values (auth.uid(), 999, 'adjustment')$$,
  'permission denied', 'warga tidak bisa insert xp_ledger');
select pg_temp.assert_fails(
  $$select public.award_xp(auth.uid(), 999, 'adjustment')$$,
  'permission denied', 'warga tidak bisa memanggil award_xp');

-- Onboarding: validasi
select pg_temp.assert_fails(
  $$select public.complete_onboarding('ab', 'Andi Saputra', null)$$,
  'invalid_nickname', 'nickname kurang dari 3 karakter');
select pg_temp.assert_fails(
  $$select public.complete_onboarding('andi', '   ', null)$$,
  'invalid_full_name', 'nama lengkap kosong');
select pg_temp.assert_fails(
  $$select public.complete_onboarding('andi', 'Andi Saputra',
      (select id from public.regions where level = 'district' limit 1))$$,
  'invalid_village', 'kecamatan bukan kelurahan');

-- Onboarding: berhasil, +50 XP
select pg_temp.assert(
  public.complete_onboarding('Andi', 'Andi Saputra',
    (select id from public.regions where name = 'Cibabat')) = 50,
  'onboarding memberi 50 XP');
select pg_temp.assert(
  (select onboarded_at is not null and terms_accepted_at is not null from public.profiles where id = auth.uid()),
  'onboarded_at dan terms_accepted_at terisi');
select pg_temp.assert(
  (select sum(amount) from public.xp_ledger where user_id = auth.uid()) = 50,
  'warga A melihat 50 XP miliknya');
select pg_temp.assert(
  (select village_id from public.xp_ledger where user_id = auth.uid())
    = (select id from public.regions where name = 'Cibabat'),
  'xp_ledger menyimpan snapshot kelurahan');
select pg_temp.assert_fails(
  $$select public.complete_onboarding('andi2', 'Andi Saputra', null)$$,
  'already_onboarded', 'onboarding hanya sekali');

-- Kolom aman boleh diubah
update public.profiles set full_name = 'Andi S.' where id = auth.uid();
select pg_temp.assert(
  (select full_name from public.profiles where id = auth.uid()) = 'Andi S.',
  'warga bisa mengubah nama lengkap');

-- ---------------------------------------------------------------------------
-- 4. Warga B (luar Cimahi) tidak melihat data A
-- ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select pg_temp.assert((select count(*) from public.profiles) = 1, 'warga B hanya melihat profilnya sendiri');
select pg_temp.assert((select count(*) from public.xp_ledger) = 0, 'warga B tidak melihat XP warga A');
select pg_temp.assert_fails(
  $$select public.complete_onboarding('ANDI', 'Budi', null)$$,
  'nickname_taken', 'nickname unik tanpa beda huruf besar-kecil');
select pg_temp.assert(public.complete_onboarding('budi', 'Budi Santoso', null) = 50, 'warga luar Cimahi bisa onboarding');
select pg_temp.assert(
  (select home_village_id is null from public.profiles where id = auth.uid()),
  'warga luar Cimahi: home_village_id null');
-- RLS menyaring diam-diam: update tidak error, tetapi tidak ada baris yang berubah
update public.app_settings set value = '99999' where key = 'xp.daily_cap';
select pg_temp.assert(public.setting_int('xp.daily_cap') = 1000, 'warga tidak bisa mengubah app_settings');

-- ---------------------------------------------------------------------------
-- 5. Pengunjung tanpa login
-- ---------------------------------------------------------------------------
reset role;
set local role anon;
select set_config('request.jwt.claims', '', true);

select pg_temp.assert((select count(*) from public.regions) = 19, 'anon bisa membaca wilayah');
select pg_temp.assert_fails($$select * from public.profiles$$, 'permission denied', 'anon tidak bisa membaca profiles');
select pg_temp.assert_fails($$select public.complete_onboarding('x', 'x', null)$$, 'permission denied', 'anon tidak bisa onboarding');

-- ---------------------------------------------------------------------------
-- 6. Batas XP harian dan ledger hanya-insert (sebagai server)
-- ---------------------------------------------------------------------------
reset role;

select pg_temp.assert(
  public.award_xp('00000000-0000-0000-0000-00000000000a', 2000, 'adjustment') = 950,
  'batas 1.000 XP per hari: sisa 950');
select pg_temp.assert(
  public.award_xp('00000000-0000-0000-0000-00000000000a', 10, 'adjustment') = 0,
  'setelah batas tercapai tidak ada XP lagi');
select pg_temp.assert(
  (select sum(amount) from public.xp_ledger where user_id = '00000000-0000-0000-0000-00000000000a') = 1000,
  'total XP hari ini = 1.000');
select pg_temp.assert_fails(
  $$update public.xp_ledger set amount = 1 where user_id = '00000000-0000-0000-0000-00000000000a'$$,
  'ledger_is_append_only', 'ledger tidak bisa di-update');
select pg_temp.assert_fails(
  $$delete from public.xp_ledger$$,
  'ledger_is_append_only', 'ledger tidak bisa dihapus');

-- ---------------------------------------------------------------------------
-- 7. Admin
-- ---------------------------------------------------------------------------
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000b';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-00000000000b","role":"authenticated"}', true);

select pg_temp.assert(public.is_admin(), 'is_admin() true untuk admin');
select pg_temp.assert((select count(*) from public.profiles) >= 2, 'admin membaca semua profil');
update public.app_settings set value = '1200' where key = 'xp.daily_cap';
select pg_temp.assert(public.setting_int('xp.daily_cap') = 1200, 'admin bisa mengubah app_settings');

reset role;
\o
select 'SEMUA UJI IRISAN 1 LOLOS' as hasil;

rollback;
