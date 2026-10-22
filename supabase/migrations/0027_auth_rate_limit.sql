-- =============================================================================
-- 0027: pembatas percobaan masuk per email (anti brute-force).
--
-- Login dipanggil dari server Next.js, jadi batas per-IP bawaan Supabase Auth
-- melihat IP server Vercel, bukan IP warga. Karena itu gagal masuk dihitung per
-- email di sini: kata sandi salah dan kode 6 angka salah (masuk atau konfirmasi
-- daftar). Setelah batas tercapai, email itu ditolak sampai jendela waktu lewat.
-- Login berhasil menghapus hitungan.
--
-- Keputusan pemilik proyek: orang lain bisa sengaja mengunci email korban selama
-- satu jendela; korban tetap bisa masuk lewat Google. CAPTCHA menyusul.
-- Email disimpan sebagai hash SHA-256, bukan teks asli.
-- =============================================================================

insert into public.app_settings (key, value) values
  ('auth.login_max_failures', '5'),
  ('auth.login_window_minutes', '15')
on conflict (key) do nothing;

create table public.auth_login_failures (
  id bigint generated always as identity primary key,
  email_hash text not null,
  failed_at timestamptz not null default now()
);
create index auth_login_failures_email_idx on public.auth_login_failures (email_hash, failed_at);
alter table public.auth_login_failures enable row level security;
revoke all on table public.auth_login_failures from anon, authenticated;
-- Tanpa policy: hanya dibaca dan ditulis fungsi security definer di bawah.

create function public.auth_email_hash(p_email text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  if char_length(v_email) not between 3 and 320 then
    raise exception 'invalid_email';
  end if;
  return encode(sha256(convert_to(v_email, 'UTF8')), 'hex');
end;
$$;
revoke execute on function public.auth_email_hash(text) from public, anon, authenticated;

-- Sisa detik sampai email ini boleh mencoba lagi; 0 berarti boleh.
create function public.auth_login_wait_seconds(p_email text)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text := public.auth_email_hash(p_email);
  v_window interval := make_interval(mins => public.setting_int('auth.login_window_minutes'));
  v_count integer;
  v_oldest timestamptz;
begin
  select count(*), min(failed_at) into v_count, v_oldest
  from public.auth_login_failures
  where email_hash = v_hash and failed_at > now() - v_window;
  if v_count < public.setting_int('auth.login_max_failures') then
    return 0;
  end if;
  return greatest(1, ceil(extract(epoch from (v_oldest + v_window - now())))::integer);
end;
$$;

-- Mencatat satu kali gagal, lalu mengembalikan sisa detik tunggu (0 jika masih boleh).
-- Saat sudah terkunci tidak mencatat lagi, supaya tabel tidak bisa dibanjiri.
create function public.auth_login_failed(p_email text)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text := public.auth_email_hash(p_email);
begin
  if public.auth_login_wait_seconds(p_email) > 0 then
    return public.auth_login_wait_seconds(p_email);
  end if;
  insert into public.auth_login_failures (email_hash) values (v_hash);
  return public.auth_login_wait_seconds(p_email);
end;
$$;

-- Dipanggil setelah berhasil masuk: hapus hitungan gagal untuk email akun ini.
-- Email diambil dari akun yang sedang masuk, bukan dari parameter, supaya
-- orang lain tidak bisa mereset hitungan email korban.
create function public.auth_login_succeeded()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  select email into v_email from auth.users where id = auth.uid();
  if v_email is null then
    return;
  end if;
  delete from public.auth_login_failures where email_hash = public.auth_email_hash(v_email);
end;
$$;

revoke execute on function public.auth_login_wait_seconds(text), public.auth_login_failed(text),
  public.auth_login_succeeded() from public, anon, authenticated;
grant execute on function public.auth_login_wait_seconds(text), public.auth_login_failed(text) to anon, authenticated;
grant execute on function public.auth_login_succeeded() to authenticated;

-- Bersihkan catatan lama setiap hari.
create function public.cleanup_auth_login_failures()
returns integer
language sql
security definer
set search_path = ''
as $$
  with deleted as (
    delete from public.auth_login_failures where failed_at < now() - interval '1 day' returning 1
  )
  select count(*)::integer from deleted;
$$;
revoke execute on function public.cleanup_auth_login_failures() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('cleanup_auth_login_failures', '35 17 * * *', $cron$select public.cleanup_auth_login_failures()$cron$); -- 00.35 WIB
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal cleanup_auth_login_failures dilewati: %', sqlerrm;
end;
$$;
