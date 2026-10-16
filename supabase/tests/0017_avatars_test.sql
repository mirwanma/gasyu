-- Uji foto profil (0017). Semua perubahan dibatalkan di akhir (rollback).
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

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Uji', terms_accepted_at = now(), onboarded_at = now();
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$update public.profiles set avatar_url = 'https://contoh.com/foto.png' where id = auth.uid()$$,
  'permission denied', 'avatar_url tidak bisa diubah langsung');
select pg_temp.assert_fails($$select public.set_my_avatar('https://contoh.com/foto.png')$$, 'invalid_avatar', 'URL dari situs lain ditolak');
select pg_temp.assert_fails($$select public.set_my_avatar('https://x.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-0000000000d2/a.jpg')$$,
  'invalid_avatar', 'foto di folder warga lain ditolak');
select pg_temp.assert_fails($$select public.set_my_avatar('https://x.supabase.co/storage/v1/object/public/logos/00000000-0000-0000-0000-0000000000d1/a.jpg')$$,
  'invalid_avatar', 'bucket lain ditolak');
select public.set_my_avatar('https://x.supabase.co/storage/v1/object/public/avatars/00000000-0000-0000-0000-0000000000d1/avatar-1700000000.jpg');
select pg_temp.assert((select avatar_url like '%/avatars/00000000-0000-0000-0000-0000000000d1/avatar-1700000000.jpg' from public.profiles where id = auth.uid()), 'foto di folder sendiri tersimpan');
select public.set_my_avatar(null);
select pg_temp.assert((select avatar_url is null from public.profiles where id = auth.uid()), 'foto bisa dihapus');
-- Nama lengkap tetap bisa diubah langsung (grant kolom lain tidak ikut dicabut)
update public.profiles set full_name = 'Nama Baru' where id = auth.uid();
select pg_temp.assert((select full_name = 'Nama Baru' from public.profiles where id = auth.uid()), 'kolom lain tetap bisa diubah');

rollback;
\o
\echo UJI 0017 LULUS
