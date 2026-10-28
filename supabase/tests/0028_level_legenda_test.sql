-- Uji 0028: nama level 5. Jalankan setelah 0001–0028.
\o /dev/null
begin;

create function pg_temp.assert(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'UJI GAGAL: %', p_msg; end if;
end;
$$;

select pg_temp.assert((select name = 'Legenda' from public.levels where level = 5), 'level 5 bernama Legenda');
select pg_temp.assert((select min_xp = 10000 from public.levels where level = 5), 'ambang level 5 tetap 10.000');

rollback;
\o
\echo UJI 0028 LULUS
