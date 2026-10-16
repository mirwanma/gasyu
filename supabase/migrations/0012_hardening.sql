-- 0012_hardening.sql — Pengerasan akses (temuan Supabase security advisor)
--
-- 1. Fungsi security definer tidak boleh bisa dipanggil anon/public: semuanya
--    memakai active_uid()/auth.uid() sehingga anon pasti gagal, tetapi hak
--    eksekusinya dicabut supaya tidak bergantung pada pengecekan di dalam.
-- 2. activity_is_public: search_path dikunci.
-- Catatan: view tanpa security_invoker (v_admin_*, v_merchant_dashboard, dll.)
-- memang disengaja: filter is_admin()/is_team_member() ada di dalam view
-- supaya warga tidak bisa membaca agregat tim lain; policy RLS tabel dasar
-- tetap berlaku untuk akses langsung.

do $$
declare
  v_fn record;
begin
  for v_fn in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('public', p.oid, 'execute'))
  loop
    execute format('revoke execute on function %s from public, anon', v_fn.sig);
  end loop;
end;
$$;

-- Fungsi trigger (dipanggil Postgres, bukan client) juga tidak perlu bisa dieksekusi authenticated.
revoke execute on function public.checkins_award_badges(), public.reveal_missions_on_publish() from public, anon, authenticated;

create or replace function public.activity_is_public(p_status public.activity_status)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_status in ('published', 'running', 'ended', 'settled');
$$;
