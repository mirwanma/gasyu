-- Uji 0027: pembatas percobaan masuk per email.
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

insert into auth.users (id, email) values ('00000000-0000-0000-0000-0000000000d1', 'korban@uji.test');

-- Pengunjung belum masuk (anon)
set local role anon;
select pg_temp.assert(public.auth_login_wait_seconds('korban@uji.test') = 0, 'email baru boleh mencoba');
select pg_temp.assert(public.auth_login_failed('korban@uji.test') = 0, 'gagal ke-1 belum terkunci');
select pg_temp.assert(public.auth_login_failed(' Korban@Uji.Test ') = 0, 'gagal ke-2 (huruf besar + spasi dihitung email yang sama)');
select pg_temp.assert(public.auth_login_failed('korban@uji.test') = 0, 'gagal ke-3 belum terkunci');
select pg_temp.assert(public.auth_login_failed('korban@uji.test') = 0, 'gagal ke-4 belum terkunci');
select pg_temp.assert(public.auth_login_failed('korban@uji.test') between 1 and 900, 'gagal ke-5 langsung terkunci ±15 menit');
select pg_temp.assert(public.auth_login_wait_seconds('korban@uji.test') > 0, 'gagal ke-6 ditolak');
select public.auth_login_failed('korban@uji.test');
select pg_temp.assert(public.auth_login_wait_seconds('lain@uji.test') = 0, 'email lain tidak ikut terkunci');

select pg_temp.assert_fails('select * from public.auth_login_failures', 'permission denied', 'anon tidak bisa membaca tabel');
select pg_temp.assert_fails($q$insert into public.auth_login_failures (email_hash) values ('x')$q$, 'permission denied', 'anon tidak bisa menulis tabel');
select pg_temp.assert_fails($q$delete from public.auth_login_failures$q$, 'permission denied', 'anon tidak bisa menghapus hitungan');
select pg_temp.assert_fails('select public.auth_login_succeeded()', 'permission denied', 'anon tidak bisa mereset hitungan');
select pg_temp.assert_fails('select public.cleanup_auth_login_failures()', 'permission denied', 'anon tidak bisa memanggil pembersih');
select pg_temp.assert_fails($q$select public.auth_login_failed('')$q$, 'invalid_email', 'email kosong ditolak');

reset role;
select pg_temp.assert((select count(*) from public.auth_login_failures) = 5, 'saat terkunci tidak mencatat baris baru');
select pg_temp.assert((select bool_and(email_hash !~ '@') from public.auth_login_failures), 'email disimpan sebagai hash');

-- Jendela 15 menit lewat: boleh mencoba lagi
update public.auth_login_failures set failed_at = now() - interval '16 minutes';
set local role anon;
select pg_temp.assert(public.auth_login_wait_seconds('korban@uji.test') = 0, 'setelah 15 menit boleh lagi');
select public.auth_login_failed('korban@uji.test');

-- Masuk berhasil: hitungan email akun sendiri dihapus
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.auth_login_succeeded();
reset role;
select pg_temp.assert((select count(*) from public.auth_login_failures where failed_at > now() - interval '15 minutes') = 0,
  'login berhasil mereset hitungan');

-- Pembersih harian menghapus catatan lebih dari 1 hari
select public.auth_login_failed('lain@uji.test');
update public.auth_login_failures set failed_at = now() - interval '2 days';
select pg_temp.assert(public.cleanup_auth_login_failures() >= 1, 'pembersih menghapus catatan lama');
select pg_temp.assert((select count(*) from public.auth_login_failures) = 0, 'tabel bersih');

rollback;
