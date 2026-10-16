-- =============================================================================
-- Hapus SEMUA data dummy Gasyu (lihat seed.sql untuk penandanya).
-- Jalankan di SQL editor Supabase sebagai postgres. Data warga/penyelenggara
-- asli tidak disentuh: hanya baris yang terhubung ke akun dd000000-… .
-- =============================================================================
set session_replication_role = replica;

create temp table dm_users as select id from public.profiles where id::text like 'dd000000-0000-4000-8000-%';
create temp table dm_orgs as
  select distinct o.id from public.organizers o
  where o.created_by in (select id from dm_users)
     or o.id in (select organizer_id from public.organizer_members where user_id in (select id from dm_users) and role in ('owner', 'chair'));
create temp table dm_acts as
  select id from public.activities where host_organizer_id in (select id from dm_orgs) or created_by in (select id from dm_users);
create temp table dm_groups as select id from public.groups where leader_id in (select id from dm_users);

-- Berkas di Storage (logo, cover, bukti bayar, foto misi)
do $$
begin
  if to_regclass('storage.objects') is not null then
    delete from storage.objects where bucket_id in ('logos', 'organizer-proofs') and split_part(name, '/', 1) in (select id::text from dm_orgs);
    delete from storage.objects where bucket_id in ('covers', 'payment-proofs', 'mission-proofs') and split_part(name, '/', 1) in (select id::text from dm_acts);
    delete from storage.objects where bucket_id = 'avatars' and split_part(name, '/', 1) in (select id::text from dm_users);
  end if;
end $$;

delete from public.mission_code_attempts where user_id in (select id from dm_users) or mission_id in (select id from public.activity_missions where activity_id in (select id from dm_acts));
delete from public.mission_completions where activity_id in (select id from dm_acts) or user_id in (select id from dm_users);
delete from public.activity_missions where activity_id in (select id from dm_acts);
delete from public.fraud_flags where user_id in (select id from dm_users) or checkin_id in (select id from public.checkins where activity_id in (select id from dm_acts));
delete from public.user_badges where user_id in (select id from dm_users);
delete from public.redemptions where user_id in (select id from dm_users) or reward_id in (select id from public.rewards where organizer_id in (select id from dm_orgs));
delete from public.point_allocations where credit_id in (select id from public.point_ledger where user_id in (select id from dm_users) or source_organizer_id in (select id from dm_orgs))
   or debit_id in (select id from public.point_ledger where user_id in (select id from dm_users) or source_organizer_id in (select id from dm_orgs));
delete from public.point_ledger where user_id in (select id from dm_users) or source_organizer_id in (select id from dm_orgs);
delete from public.xp_ledger where user_id in (select id from dm_users) or activity_id in (select id from dm_acts);
delete from public.rewards where organizer_id in (select id from dm_orgs);
delete from public.checkins where activity_id in (select id from dm_acts) or user_id in (select id from dm_users);
delete from public.participations where activity_id in (select id from dm_acts) or user_id in (select id from dm_users);
delete from public.group_members where group_id in (select id from dm_groups) or user_id in (select id from dm_users);
delete from public.groups where id in (select id from dm_groups);
delete from public.challenge_targets where activity_id in (select id from dm_acts);
delete from public.activity_checkpoints where activity_id in (select id from dm_acts);
delete from public.collab_applications where organizer_id in (select id from dm_orgs) or post_id in (select id from public.collab_posts where organizer_id in (select id from dm_orgs) or activity_id in (select id from dm_acts));
delete from public.collab_posts where organizer_id in (select id from dm_orgs) or activity_id in (select id from dm_acts);
delete from public.activity_partners where activity_id in (select id from dm_acts) or organizer_id in (select id from dm_orgs);
delete from public.activities where id in (select id from dm_acts);
delete from public.suggestions where user_id in (select id from dm_users) or organizer_id in (select id from dm_orgs);
delete from public.notifications where user_id in (select id from dm_users);
delete from public.admin_actions where admin_id in (select id from dm_users) or target_id in (select id from dm_orgs) or target_id in (select id from dm_acts);
delete from public.merchant_outlets where organizer_id in (select id from dm_orgs);
delete from public.merchant_profiles where organizer_id in (select id from dm_orgs);
delete from public.community_profiles where organizer_id in (select id from dm_orgs);
delete from public.community_memberships where community_id in (select id from dm_orgs) or user_id in (select id from dm_users);
delete from public.organizer_members where organizer_id in (select id from dm_orgs) or user_id in (select id from dm_users);
delete from public.organizer_invites where organizer_id in (select id from dm_orgs);
delete from public.organizers where id in (select id from dm_orgs);
delete from public.profiles where id in (select id from dm_users);
do $$
begin
  if to_regclass('auth.identities') is not null then
    delete from auth.identities where user_id in (select id from dm_users);
  end if;
end $$;
delete from auth.users where id in (select id from dm_users);

set session_replication_role = default;
select 'Data dummy dihapus' as hasil;
