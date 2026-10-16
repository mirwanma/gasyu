-- 0008_dashboards.sql — Irisan 8: Dashboard dan moderasi
--
-- Isi: v_activity_stats, v_activity_partner_stats, v_village_active_month,
--      v_merchant_dashboard (+ v_merchant_outlet_vouchers), v_community_dashboard,
--      v_organizer_reputation, v_admin_overview, v_admin_weekly_active,
--      v_moderation_checkins, v_moderation_flags, get_citizen_dashboard,
--      reverse_checkin, approve_checkin, review_fraud_flag, suspend_user,
--      suspend_organizer, detect_fraud_patterns (cron), pengaturan deteksi pola.
-- Semua view memakai security_invoker atau filter admin/tim di dalamnya;
-- data warga lain hanya nickname dan agregat.

-- -----------------------------------------------------------------------------
-- Pengaturan deteksi pola (angka dibaca dari app_settings)
-- -----------------------------------------------------------------------------

insert into public.app_settings (key, value) values
  ('fraud.burst_min_accounts', '5'),
  ('fraud.burst_window_minutes', '10'),
  ('fraud.new_account_hours', '48'),
  ('fraud.travel_min_km', '3'),
  ('fraud.travel_window_minutes', '15')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Statistik aktivitas untuk tim penyelenggara
-- -----------------------------------------------------------------------------

-- Per aktivitas: pendaftar pribadi/grup, hadir, selesai, check-in hari ini,
-- warga baru vs kembali (relatif terhadap host: pernah check-in di host sebelum aktivitas ini?).
create view public.v_activity_stats
with (security_invoker = true)
as
select
  a.id as activity_id,
  a.host_organizer_id,
  (select count(*) from public.participations p where p.activity_id = a.id and p.status in ('registered', 'in_progress', 'completed') and p.group_id is null)::integer as registered_individual,
  (select count(*) from public.participations p where p.activity_id = a.id and p.status in ('registered', 'in_progress', 'completed') and p.group_id is not null)::integer as registered_group,
  (select count(distinct p.group_id) from public.participations p where p.activity_id = a.id and p.status in ('registered', 'in_progress', 'completed') and p.group_id is not null)::integer as groups_count,
  (select count(distinct c.user_id) from public.checkins c where c.activity_id = a.id and c.review_status <> 'rejected')::integer as attended,
  (select count(*) from public.participations p where p.activity_id = a.id and p.status = 'completed')::integer as completed,
  (select count(*) from public.checkins c where c.activity_id = a.id and c.local_date = public.local_today() and c.review_status <> 'rejected')::integer as checkins_today,
  (select count(*) from public.checkins c where c.activity_id = a.id and c.review_status = 'flagged')::integer as checkins_flagged,
  (select count(*) from (
    select c.user_id, min(c.checked_in_at) as first_at
    from public.checkins c where c.activity_id = a.id and c.review_status <> 'rejected' group by c.user_id
  ) f where not exists (
    select 1 from public.checkins o
    where o.user_id = f.user_id and o.partner_organizer_id = a.host_organizer_id and o.activity_id <> a.id
      and o.review_status <> 'rejected' and o.checked_in_at < f.first_at
  ))::integer as new_citizens,
  (select count(*) from (
    select c.user_id, min(c.checked_in_at) as first_at
    from public.checkins c where c.activity_id = a.id and c.review_status <> 'rejected' group by c.user_id
  ) f where exists (
    select 1 from public.checkins o
    where o.user_id = f.user_id and o.partner_organizer_id = a.host_organizer_id and o.activity_id <> a.id
      and o.review_status <> 'rejected' and o.checked_in_at < f.first_at
  ))::integer as returning_citizens,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'awaiting_confirmation')::integer as payments_pending
from public.activities a
where public.is_activity_team(a.id) or (select public.is_admin());

grant select on public.v_activity_stats to authenticated;

-- Check-in per hari untuk satu aktivitas (grafik kecil di halaman kelola).
create view public.v_activity_daily_checkins
with (security_invoker = true)
as
select c.activity_id, c.local_date, count(*)::integer as checkins, count(distinct c.user_id)::integer as citizens
from public.checkins c
where c.review_status <> 'rejected' and (public.is_activity_team(c.activity_id) or (select public.is_admin()))
group by c.activity_id, c.local_date;

grant select on public.v_activity_daily_checkins to authenticated;

-- Per aktivitas per partner: check-in di checkpoint miliknya, warga unik,
-- voucher partner yang ditukar/dipakai oleh peserta aktivitas sejak aktivitas mulai.
create view public.v_activity_partner_stats
with (security_invoker = true)
as
select
  ap.activity_id,
  ap.organizer_id,
  ap.role,
  o.name as organizer_name,
  o.type as organizer_type,
  (select count(*) from public.checkins c where c.activity_id = ap.activity_id and c.partner_organizer_id = ap.organizer_id and c.review_status <> 'rejected')::integer as checkins,
  (select count(distinct c.user_id) from public.checkins c where c.activity_id = ap.activity_id and c.partner_organizer_id = ap.organizer_id and c.review_status <> 'rejected')::integer as citizens,
  (select count(*) from public.redemptions rd
    join public.rewards rw on rw.id = rd.reward_id
    where rw.organizer_id = ap.organizer_id and rd.created_at >= a.starts_at
      and exists (select 1 from public.checkins c where c.activity_id = ap.activity_id and c.user_id = rd.user_id and c.review_status <> 'rejected'))::integer as vouchers_redeemed,
  (select count(*) from public.redemptions rd
    join public.rewards rw on rw.id = rd.reward_id
    where rw.organizer_id = ap.organizer_id and rd.status = 'used' and rd.created_at >= a.starts_at
      and exists (select 1 from public.checkins c where c.activity_id = ap.activity_id and c.user_id = rd.user_id and c.review_status <> 'rejected'))::integer as vouchers_used,
  ap.points_budget
from public.activity_partners ap
join public.activities a on a.id = ap.activity_id
join public.organizers o on o.id = ap.organizer_id
where ap.status = 'accepted' and (public.is_activity_team(ap.activity_id) or (select public.is_admin()));

grant select on public.v_activity_partner_stats to authenticated;

-- -----------------------------------------------------------------------------
-- Agregat kota (hanya angka, tanpa identitas warga)
-- -----------------------------------------------------------------------------

-- Warga aktif bulan ini per kelurahan (≥1 check-in sah bulan berjalan, WIB).
create view public.v_village_active_month as
select
  pr.home_village_id as village_id,
  count(distinct c.user_id)::integer as active_citizens
from public.checkins c
join public.profiles pr on pr.id = c.user_id
where c.review_status <> 'rejected'
  and pr.home_village_id is not null
  and c.local_date >= date_trunc('month', public.local_today())::date
group by pr.home_village_id;

grant select on public.v_village_active_month to authenticated;

-- Reputasi penyelenggara 90 hari terakhir (menggantikan versi irisan 7): tingkat hadir,
-- tingkat selesai, jumlah kolaborasi, dan skor 0–100. Publik untuk pengguna login.
drop view public.v_organizer_reputation;
create view public.v_organizer_reputation as
select
  o.id as organizer_id,
  o.name,
  o.type,
  (select count(*) from public.checkins c where c.partner_organizer_id = o.id and c.checked_in_at > now() - interval '90 days' and c.review_status <> 'rejected')::integer as checkins_90d,
  coalesce(s.registered, 0)::integer as registered_90d,
  coalesce(s.attended, 0)::integer as attended_90d,
  coalesce(s.completed, 0)::integer as completed_90d,
  case when coalesce(s.registered, 0) > 0 then round(100.0 * coalesce(s.attended, 0) / s.registered)::integer else null end as attendance_pct,
  case when coalesce(s.attended, 0) > 0 then round(100.0 * coalesce(s.completed, 0) / s.attended)::integer else null end as completion_pct,
  coalesce(k.collabs, 0)::integer as collabs_90d,
  (case when coalesce(s.registered, 0) > 0 then 50.0 * coalesce(s.attended, 0) / s.registered else 0 end
   + case when coalesce(s.attended, 0) > 0 then 30.0 * coalesce(s.completed, 0) / s.attended else 0 end
   + least(20, 5 * coalesce(k.collabs, 0)))::integer as score
from public.organizers o
left join lateral (
  select
    count(*) filter (where p.status in ('registered', 'in_progress', 'completed', 'not_completed')) as registered,
    count(*) filter (where exists (select 1 from public.checkins c where c.participation_id = p.id and c.review_status <> 'rejected')) as attended,
    count(*) filter (where p.status = 'completed') as completed
  from public.participations p
  join public.activities a on a.id = p.activity_id
  where a.host_organizer_id = o.id and a.starts_at > now() - interval '90 days' and a.status not in ('draft', 'cancelled')
) s on true
left join lateral (
  select count(distinct ap.activity_id) as collabs from public.activity_partners ap
  join public.activities a on a.id = ap.activity_id
  where ap.organizer_id = o.id and ap.status = 'accepted' and a.starts_at > now() - interval '90 days' and a.status not in ('draft', 'cancelled')
    and exists (select 1 from public.activity_partners x where x.activity_id = a.id and x.status = 'accepted' and x.organizer_id <> o.id)
) k on true
where o.type <> 'platform' and o.status = 'approved';

grant select on public.v_organizer_reputation to authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard merchant dan komunitas (satu baris per penyelenggara, untuk timnya)
-- -----------------------------------------------------------------------------

create view public.v_merchant_dashboard as
select
  o.id as organizer_id,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'running')::integer as running_activities,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'published')::integer as published_activities,
  (select min(a.starts_at) from public.activities a where a.host_organizer_id = o.id and a.status = 'published') as next_starts_at,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'draft')::integer as draft_activities,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and p.status in ('registered', 'in_progress', 'completed'))::integer as participants,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and p.status in ('registered', 'in_progress', 'completed') and p.created_at >= now() - interval '7 days')::integer as participants_week,
  (select count(*) from public.checkins c where c.partner_organizer_id = o.id and c.local_date = public.local_today() and c.review_status <> 'rejected')::integer as checkins_today,
  (select count(*) from (
    select c.user_id, min(c.checked_in_at) as first_at from public.checkins c
    where c.partner_organizer_id = o.id and c.review_status <> 'rejected' group by c.user_id
  ) f where f.first_at >= now() - interval '30 days')::integer as new_citizens_30d,
  (select count(*) from (
    select c.user_id, min(c.checked_in_at) as first_at, max(c.checked_in_at) as last_at from public.checkins c
    where c.partner_organizer_id = o.id and c.review_status <> 'rejected' group by c.user_id
  ) f where f.first_at < now() - interval '30 days' and f.last_at >= now() - interval '30 days')::integer as returning_citizens_30d,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and p.payment_status = 'awaiting_confirmation')::integer as payments_pending,
  0::integer as mission_proofs_pending, -- diisi di irisan 10
  (select count(*) from public.activity_partners ap join public.activities a on a.id = ap.activity_id
    where ap.organizer_id = o.id and ap.status = 'invited')::integer as partner_invites_pending,
  (select count(*) from public.activity_partners ap join public.activities a on a.id = ap.activity_id
    where ap.organizer_id = o.id and ap.status = 'accepted' and ap.role <> 'host' and ap.points_budget = 0
      and a.status in ('published', 'running', 'awaiting_partners', 'in_review'))::integer as partner_budget_empty,
  coalesce((select sum(ap.points_budget) from public.activity_partners ap where ap.organizer_id = o.id and ap.status = 'accepted'), 0)::integer as points_budget,
  coalesce((select sum(l.amount) from public.point_ledger l where l.source_organizer_id = o.id and l.reason in ('activity_reward', 'reversal')), 0)::integer as points_used,
  (select count(*) from public.redemptions rd join public.rewards rw on rw.id = rd.reward_id where rw.organizer_id = o.id)::integer as vouchers_redeemed,
  (select count(*) from public.redemptions rd join public.rewards rw on rw.id = rd.reward_id where rw.organizer_id = o.id and rd.status = 'used')::integer as vouchers_used,
  (select count(*) from public.redemptions rd join public.rewards rw on rw.id = rd.reward_id where rw.organizer_id = o.id and rd.status = 'active')::integer as vouchers_active
from public.organizers o
where o.type = 'merchant' and (public.is_team_member(o.id) or (select public.is_admin()));

grant select on public.v_merchant_dashboard to authenticated;

-- Voucher dipakai per outlet (kartu "Poin dan voucher").
create view public.v_merchant_outlet_vouchers as
select
  mo.organizer_id,
  mo.id as outlet_id,
  mo.name as outlet_name,
  (select count(*) from public.redemptions rd where rd.used_outlet_id = mo.id and rd.status = 'used')::integer as vouchers_used,
  (select count(*) from public.redemptions rd where rd.used_outlet_id = mo.id and rd.status = 'used' and rd.used_at >= now() - interval '30 days')::integer as vouchers_used_30d
from public.merchant_outlets mo
where mo.is_active and (public.is_team_member(mo.organizer_id) or (select public.is_admin()));

grant select on public.v_merchant_outlet_vouchers to authenticated;

create view public.v_community_dashboard as
select
  o.id as organizer_id,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'running')::integer as running_activities,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'published')::integer as published_activities,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'draft')::integer as draft_activities,
  (select count(*) from public.activities a where a.host_organizer_id = o.id and a.status = 'awaiting_partners')::integer as awaiting_partner_activities,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and p.status in ('registered', 'in_progress', 'completed'))::integer as participants,
  (select count(*) from public.checkins c where c.partner_organizer_id = o.id and c.local_date = public.local_today() and c.review_status <> 'rejected')::integer as checkins_today,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and p.payment_status = 'awaiting_confirmation')::integer as payments_pending,
  0::integer as mission_proofs_pending, -- diisi di irisan 10
  (select count(*) from public.community_memberships m where m.community_id = o.id and m.status = 'pending')::integer as pending_requests,
  (select count(*) from public.activity_partners ap where ap.organizer_id = o.id and ap.status = 'invited')::integer as partner_invites_pending
from public.organizers o
where o.type = 'community' and (public.is_team_member(o.id) or (select public.is_admin()));

grant select on public.v_community_dashboard to authenticated;

-- -----------------------------------------------------------------------------
-- Dashboard admin
-- -----------------------------------------------------------------------------

create view public.v_admin_overview as
select
  (select count(distinct c.user_id) from public.checkins c where c.checked_in_at >= now() - interval '7 days' and c.review_status <> 'rejected')::integer as weekly_active,
  (select count(distinct c.user_id) from public.checkins c where c.checked_in_at >= now() - interval '14 days' and c.checked_in_at < now() - interval '7 days' and c.review_status <> 'rejected')::integer as weekly_active_prev,
  (select count(*) from public.profiles p where p.onboarded_at is not null and p.deleted_at is null)::integer as citizens,
  (select count(*) from public.activities a where a.status in ('published', 'running'))::integer as running_activities,
  (select count(*) from public.activities a where a.status in ('published', 'running') and a.type = 'event')::integer as running_events,
  (select count(*) from public.activities a where a.status in ('published', 'running') and a.type = 'challenge')::integer as running_challenges,
  (select count(*) from public.organizers o where o.type = 'merchant' and o.status = 'approved')::integer as active_merchants,
  (select count(*) from public.organizers o where o.type = 'community' and o.status = 'approved')::integer as active_communities,
  (select coalesce(sum(c.amount - coalesce((select sum(al.amount) from public.point_allocations al where al.credit_id = c.id), 0)), 0)
    from public.point_ledger c where c.amount > 0 and c.expires_at > now())::integer as points_circulating,
  (select coalesce(sum(-l.amount), 0) from public.point_ledger l
    where l.reason = 'redemption' and l.created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')::integer as points_redeemed_month,
  (select count(*) from public.organizers o where o.status = 'pending')::integer as pending_organizers,
  (select count(*) from public.organizers o where o.status = 'pending' and o.type = 'merchant')::integer as pending_merchants,
  (select count(*) from public.activities a where a.status = 'in_review')::integer as pending_activities,
  (select min(a.updated_at) from public.activities a where a.status = 'in_review') as oldest_pending_activity_at,
  (select count(*) from public.checkins c where c.review_status = 'flagged')::integer as flagged_checkins,
  (select count(*) from public.fraud_flags f where f.status = 'open' and f.kind <> 'out_of_radius')::integer as open_pattern_flags,
  (select count(*) from public.activities a where a.status = 'cancelled'
    and exists (select 1 from public.participations p where p.activity_id = a.id and p.payment_status = 'paid'))::integer as refunds_pending
where (select public.is_admin());

grant select on public.v_admin_overview to authenticated;

-- Warga aktif per minggu (≥1 check-in), 12 minggu terakhir, minggu dimulai Senin WIB.
create view public.v_admin_weekly_active as
select
  w.week_start::date as week_start,
  (select count(distinct c.user_id) from public.checkins c
    where c.review_status <> 'rejected' and c.local_date >= w.week_start::date and c.local_date < (w.week_start + interval '7 days')::date)::integer as active_citizens
from generate_series(
  date_trunc('week', public.local_today()::timestamp) - interval '11 weeks',
  date_trunc('week', public.local_today()::timestamp),
  interval '1 week') as w (week_start)
where (select public.is_admin());

grant select on public.v_admin_weekly_active to authenticated;

-- Antrean moderasi: check-in flagged (nickname saja), admin.
create view public.v_moderation_checkins as
select
  c.id, c.user_id, c.activity_id, c.checkpoint_id, c.partner_organizer_id, c.checked_in_at, c.local_date,
  c.distance_m, c.review_status, c.reviewed_at, c.review_note,
  pr.nickname::text as nickname, pr.created_at as account_created_at, r.name as village_name,
  a.title as activity_title, a.type as activity_type, cp.name as checkpoint_name, cp.radius_m, o.name as partner_name,
  (select coalesce(sum(x.amount), 0) from public.xp_ledger x where x.checkin_id = c.id)::integer as xp_awarded
from public.checkins c
join public.profiles pr on pr.id = c.user_id
left join public.regions r on r.id = pr.home_village_id
join public.activities a on a.id = c.activity_id
join public.activity_checkpoints cp on cp.id = c.checkpoint_id
join public.organizers o on o.id = c.partner_organizer_id
where (select public.is_admin());

grant select on public.v_moderation_checkins to authenticated;

-- Laporan pola mencurigakan (selain out_of_radius yang tampil lewat check-in).
create view public.v_moderation_flags as
select
  f.id, f.user_id, f.checkin_id, f.kind, f.detail, f.status, f.created_at, f.reviewed_at,
  pr.nickname::text as nickname, pr.suspended_at, r.name as village_name,
  a.title as activity_title, cp.name as checkpoint_name, o.name as partner_name
from public.fraud_flags f
join public.profiles pr on pr.id = f.user_id
left join public.regions r on r.id = pr.home_village_id
left join public.checkins c on c.id = f.checkin_id
left join public.activities a on a.id = c.activity_id
left join public.activity_checkpoints cp on cp.id = c.checkpoint_id
left join public.organizers o on o.id = c.partner_organizer_id
where f.kind <> 'out_of_radius' and (select public.is_admin());

grant select on public.v_moderation_flags to authenticated;

-- Daftar pengguna untuk admin (cari, bekukan): nickname, kelurahan, status.
create view public.v_admin_users as
select
  pr.id, pr.nickname::text as nickname, pr.full_name, pr.avatar_url, pr.is_admin, pr.onboarded_at, pr.suspended_at, pr.deleted_at, pr.created_at,
  r.name as village_name,
  (select coalesce(sum(x.amount), 0) from public.xp_ledger x where x.user_id = pr.id)::integer as total_xp,
  (select count(*) from public.checkins c where c.user_id = pr.id and c.review_status <> 'rejected')::integer as checkins,
  (select count(*) from public.fraud_flags f where f.user_id = pr.id and f.status = 'open')::integer as open_flags,
  (select max(c.checked_in_at) from public.checkins c where c.user_id = pr.id) as last_checkin_at
from public.profiles pr
left join public.regions r on r.id = pr.home_village_id
where (select public.is_admin());

grant select on public.v_admin_users to authenticated;

-- -----------------------------------------------------------------------------
-- Beranda warga: satu panggilan
-- -----------------------------------------------------------------------------

create function public.get_citizen_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_month_start date := date_trunc('month', public.local_today())::date;
  v_village uuid;
  v_total_xp integer;
  v_xp_month integer;
  v_level record;
  v_rank_city integer;
  v_rank_village integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select home_village_id into v_village from public.profiles where id = v_uid;
  select coalesce(sum(amount), 0) into v_total_xp from public.xp_ledger where user_id = v_uid;
  select coalesce(sum(amount), 0) into v_xp_month from public.xp_ledger where user_id = v_uid and local_date >= v_month_start;
  select l.level, l.name, l.min_xp, (select min(n.min_xp) from public.levels n where n.min_xp > v_total_xp) as next_min_xp
  into v_level
  from public.levels l where l.min_xp <= v_total_xp order by l.min_xp desc limit 1;

  if v_xp_month > 0 then
    select count(*) + 1 into v_rank_city from (
      select x.user_id, sum(x.amount) as xp from public.xp_ledger x
      join public.profiles p on p.id = x.user_id
      where x.local_date >= v_month_start and p.home_village_id is not null and p.suspended_at is null and p.deleted_at is null
      group by x.user_id having sum(x.amount) > v_xp_month
    ) t;
    if v_village is not null then
      select count(*) + 1 into v_rank_village from (
        select x.user_id, sum(x.amount) as xp from public.xp_ledger x
        join public.profiles p on p.id = x.user_id
        where x.local_date >= v_month_start and p.home_village_id = v_village and p.suspended_at is null and p.deleted_at is null
        group by x.user_id having sum(x.amount) > v_xp_month
      ) t;
    end if;
  end if;

  return jsonb_build_object(
    'total_xp', v_total_xp,
    'xp_month', v_xp_month,
    'level', v_level.level,
    'level_name', v_level.name,
    'level_min_xp', v_level.min_xp,
    'next_min_xp', v_level.next_min_xp,
    'points_balance', public.points_balance(v_uid),
    'points_expiring_30d', (select coalesce(sum(c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)), 0)
      from public.point_ledger c where c.user_id = v_uid and c.amount > 0 and c.expires_at > now() and c.expires_at <= now() + interval '30 days'),
    'active_vouchers', (select count(*) from public.redemptions r where r.user_id = v_uid and r.status = 'active'),
    'unread_notifications', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null),
    'rank_city', case when v_village is null then null else v_rank_city end,
    'rank_village', v_rank_village,
    'village_active_citizens', (select v.active_citizens from public.v_village_active_month v where v.village_id = v_village),
    'badges', '[]'::jsonb, -- diisi di irisan 9
    'my_activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'activity_id', p.activity_id, 'title', a.title, 'type', a.type, 'status', p.status, 'progress', p.progress,
        'payment_status', p.payment_status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'activity_status', a.status,
        'group_id', p.group_id) order by a.starts_at)
      from public.participations p join public.activities a on a.id = p.activity_id
      where p.user_id = v_uid and p.status in ('invited', 'registered', 'in_progress') and a.status in ('published', 'running')
    ), '[]'::jsonb)
  );
end;
$$;

grant execute on function public.get_citizen_dashboard() to authenticated;

-- -----------------------------------------------------------------------------
-- Moderasi: balikkan / sahkan check-in, tinjau flag, bekukan akun
-- -----------------------------------------------------------------------------

-- Admin menolak check-in: XP dan poin yang lahir dari check-in ini dibalik
-- (baris negatif, poin dialokasikan ke kredit supaya saldo turun), status partisipasi dimundurkan.
create function public.reverse_checkin(p_checkin_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_c public.checkins;
  v_a public.activities;
  v_p public.participations;
  v_xp integer := 0;
  v_points integer := 0;
  v_amount integer;
  v_row record;
  v_debit uuid;
  v_remaining integer;
  v_target public.challenge_targets;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_c from public.checkins where id = p_checkin_id for update;
  if not found then
    raise exception 'invalid_checkin';
  end if;
  if v_c.review_status = 'rejected' then
    raise exception 'already_rejected';
  end if;
  select * into v_a from public.activities where id = v_c.activity_id;
  select * into v_p from public.participations where id = v_c.participation_id for update;

  update public.checkins
  set review_status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = p_checkin_id;

  -- XP yang terikat ke check-in ini (dasar, kunjungan pertama, kolaborasi, bonus grup)
  select coalesce(sum(amount), 0) into v_amount from public.xp_ledger where checkin_id = p_checkin_id and reason <> 'reversal';
  if v_amount > 0 then
    insert into public.xp_ledger (user_id, amount, reason, activity_id, checkin_id, village_id, note)
    select v_c.user_id, -v_amount, 'reversal', v_c.activity_id, p_checkin_id, home_village_id, 'Check-in ditolak admin'
    from public.profiles where id = v_c.user_id;
    v_xp := v_amount;
  end if;

  -- Poin penyelesaian: hanya jika check-in ini yang menuntaskan (event selalu; challenge jika selesai)
  if v_p.status = 'completed' then
    for v_row in
      select c.id, c.amount, c.source_organizer_id,
        c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0) as remaining
      from public.point_ledger c
      where c.user_id = v_c.user_id and c.activity_id = v_c.activity_id and c.reason = 'activity_reward' and c.amount > 0
    loop
      v_remaining := v_row.remaining;
      if v_remaining > 0 then
        insert into public.point_ledger (user_id, amount, reason, activity_id, source_organizer_id, note)
        values (v_c.user_id, -v_remaining, 'reversal', v_c.activity_id, v_row.source_organizer_id, 'Check-in ditolak admin')
        returning id into v_debit;
        insert into public.point_allocations (credit_id, debit_id, amount) values (v_row.id, v_debit, v_remaining);
        v_points := v_points + v_remaining;
      end if;
    end loop;
  end if;

  -- Status partisipasi dimundurkan sesuai check-in yang tersisa
  if v_a.type = 'event' then
    if not exists (select 1 from public.checkins where participation_id = v_p.id and review_status <> 'rejected') then
      update public.participations set status = 'registered', progress = 0, completed_at = null where id = v_p.id;
    end if;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
      v_amount := public.checkin_progress(v_a.id, v_target.kind, v_p.id, null);
      update public.participations
      set progress = v_amount,
          status = case when v_amount = 0 then 'registered'::public.participation_status else 'in_progress'::public.participation_status end,
          completed_at = null
      where id = v_p.id;
    end if;
  end if;

  update public.fraud_flags set status = 'actioned', reviewed_by = v_uid, reviewed_at = now()
  where checkin_id = p_checkin_id and status = 'open';

  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'reverse_checkin', 'checkins', p_checkin_id, nullif(btrim(p_note), ''));

  perform public.notify(v_c.user_id, 'checkin_rejected',
    jsonb_build_object('activity_id', v_a.id, 'activity_title', v_a.title, 'xp', v_xp, 'points', v_points, 'note', nullif(btrim(p_note), '')));

  return jsonb_build_object('xp_reversed', v_xp, 'points_reversed', v_points);
end;
$$;

-- Admin menyatakan check-in flagged sah.
create function public.approve_checkin(p_checkin_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  update public.checkins
  set review_status = 'approved', reviewed_by = v_uid, reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = p_checkin_id and review_status in ('flagged', 'ok');
  if not found then
    raise exception 'invalid_checkin';
  end if;
  update public.fraud_flags set status = 'dismissed', reviewed_by = v_uid, reviewed_at = now()
  where checkin_id = p_checkin_id and status = 'open';
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'approve_checkin', 'checkins', p_checkin_id, nullif(btrim(p_note), ''));
end;
$$;

-- Bekukan atau aktifkan kembali akun warga.
create function public.suspend_user(p_user_id uuid, p_suspend boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_user_id = v_uid then
    raise exception 'cannot_suspend_self';
  end if;
  if p_suspend and exists (select 1 from public.profiles where id = p_user_id and is_admin) then
    raise exception 'cannot_suspend_admin';
  end if;
  update public.profiles
  set suspended_at = case when p_suspend then coalesce(suspended_at, now()) else null end
  where id = p_user_id;
  if not found then
    raise exception 'invalid_user';
  end if;
  if p_suspend then
    update public.fraud_flags set status = 'actioned', reviewed_by = v_uid, reviewed_at = now()
    where user_id = p_user_id and status = 'open';
  end if;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, case when p_suspend then 'suspend_user' else 'unsuspend_user' end, 'profiles', p_user_id, nullif(btrim(p_note), ''));
  perform public.notify(p_user_id, case when p_suspend then 'account_suspended' else 'account_restored' end,
    jsonb_build_object('note', nullif(btrim(p_note), '')));
end;
$$;

-- Bekukan penyelenggara: status suspended, aktivitas terbit/berjalan dibatalkan. Aktifkan: approved.
create function public.suspend_organizer(p_organizer_id uuid, p_suspend boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_o public.organizers;
  v_row record;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_o from public.organizers where id = p_organizer_id for update;
  if not found or v_o.type = 'platform' then
    raise exception 'invalid_organizer';
  end if;
  if p_suspend then
    if v_o.status = 'suspended' then
      raise exception 'already_suspended';
    end if;
    update public.organizers set status = 'suspended', review_note = coalesce(nullif(btrim(p_note), ''), review_note) where id = p_organizer_id;
    for v_row in
      select id from public.activities where host_organizer_id = p_organizer_id and status in ('awaiting_partners', 'in_review', 'published', 'running')
    loop
      perform public.cancel_activity(v_row.id, coalesce(nullif(btrim(p_note), ''), 'Penyelenggara dibekukan'));
    end loop;
  else
    if v_o.status <> 'suspended' then
      raise exception 'not_suspended';
    end if;
    update public.organizers set status = 'approved' where id = p_organizer_id;
  end if;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, case when p_suspend then 'suspend_organizer' else 'unsuspend_organizer' end, 'organizers', p_organizer_id, nullif(btrim(p_note), ''));
  perform public.notify_team(p_organizer_id, case when p_suspend then 'organizer_suspended' else 'organizer_restored' end,
    jsonb_build_object('organizer_id', p_organizer_id, 'organizer_name', v_o.name, 'note', nullif(btrim(p_note), '')));
end;
$$;

-- Tinjau laporan pola: abaikan, beri peringatan, atau bekukan akun.
create function public.review_fraud_flag(p_flag_id uuid, p_action text, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_f public.fraud_flags;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if p_action not in ('dismiss', 'warn', 'suspend') then
    raise exception 'invalid_action';
  end if;
  select * into v_f from public.fraud_flags where id = p_flag_id for update;
  if not found or v_f.status <> 'open' then
    raise exception 'flag_unavailable';
  end if;
  update public.fraud_flags
  set status = case when p_action = 'dismiss' then 'dismissed'::public.flag_status else 'actioned'::public.flag_status end,
      reviewed_by = v_uid, reviewed_at = now(),
      detail = detail || jsonb_build_object('admin_action', p_action, 'admin_note', nullif(btrim(p_note), ''))
  where id = p_flag_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'flag_' || p_action, 'fraud_flags', p_flag_id, nullif(btrim(p_note), ''));
  if p_action = 'warn' then
    perform public.notify(v_f.user_id, 'fraud_warning', jsonb_build_object('kind', v_f.kind, 'note', nullif(btrim(p_note), '')));
  elsif p_action = 'suspend' then
    perform public.suspend_user(v_f.user_id, true, coalesce(nullif(btrim(p_note), ''), 'Pola mencurigakan: ' || v_f.kind::text));
  end if;
end;
$$;

grant execute on function
  public.reverse_checkin(uuid, text), public.approve_checkin(uuid, text), public.suspend_user(uuid, boolean, text),
  public.suspend_organizer(uuid, boolean, text), public.review_fraud_flag(uuid, text, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- Deteksi pola (cron per jam): akun beruntun dan perjalanan mustahil
-- -----------------------------------------------------------------------------

create function public.detect_fraud_patterns()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_min_accounts integer := public.setting_int('fraud.burst_min_accounts');
  v_window interval := make_interval(mins => public.setting_int('fraud.burst_window_minutes'));
  v_new_hours interval := make_interval(hours => public.setting_int('fraud.new_account_hours'));
  v_travel_km integer := public.setting_int('fraud.travel_min_km');
  v_travel_window interval := make_interval(mins => public.setting_int('fraud.travel_window_minutes'));
  v_inserted integer := 0;
  v_n integer;
begin
  -- Akun beruntun: ≥N akun baru (dibuat < new_account_hours sebelum check-in) check-in
  -- di checkpoint yang sama dalam jendela waktu yang sama.
  with recent as (
    select c.id, c.user_id, c.checkpoint_id, c.checked_in_at
    from public.checkins c
    join public.profiles p on p.id = c.user_id
    where c.checked_in_at >= now() - interval '2 days' and c.review_status <> 'rejected'
      and p.created_at >= c.checked_in_at - v_new_hours
  ), bursts as (
    select r.id, r.user_id, r.checkpoint_id, r.checked_in_at,
      (select count(distinct o.user_id) from recent o
        where o.checkpoint_id = r.checkpoint_id and o.checked_in_at between r.checked_in_at - v_window and r.checked_in_at + v_window) as peers
    from recent r
  )
  insert into public.fraud_flags (user_id, checkin_id, kind, detail)
  select b.user_id, b.id, 'burst_accounts',
    jsonb_build_object('accounts', b.peers, 'window_minutes', public.setting_int('fraud.burst_window_minutes'), 'checkpoint_id', b.checkpoint_id)
  from bursts b
  where b.peers >= v_min_accounts
    and not exists (select 1 from public.fraud_flags f where f.checkin_id = b.id and f.kind = 'burst_accounts');
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  -- Perjalanan mustahil: dua check-in warga yang sama di titik berjarak ≥ travel_min_km
  -- dalam travel_window_minutes.
  insert into public.fraud_flags (user_id, checkin_id, kind, detail)
  select c2.user_id, c2.id, 'impossible_travel',
    jsonb_build_object('previous_checkin_id', c1.id, 'minutes', round(extract(epoch from (c2.checked_in_at - c1.checked_in_at)) / 60)::integer,
      'distance_km', round(public.distance_m(p1.lat, p1.lng, p2.lat, p2.lng) / 1000.0, 1))
  from public.checkins c2
  join public.checkins c1 on c1.user_id = c2.user_id
    and (c1.checked_in_at, c1.id) < (c2.checked_in_at, c2.id) and c1.checked_in_at >= c2.checked_in_at - v_travel_window
  join public.activity_checkpoints p1 on p1.id = c1.checkpoint_id
  join public.activity_checkpoints p2 on p2.id = c2.checkpoint_id
  where c2.checked_in_at >= now() - interval '2 days'
    and c1.review_status <> 'rejected' and c2.review_status <> 'rejected'
    and public.distance_m(p1.lat, p1.lng, p2.lat, p2.lng) >= v_travel_km * 1000
    and not exists (select 1 from public.fraud_flags f where f.checkin_id = c2.id and f.kind = 'impossible_travel');
  get diagnostics v_n = row_count;
  v_inserted := v_inserted + v_n;

  return v_inserted;
end;
$$;

revoke execute on function public.detect_fraud_patterns() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('detect_fraud_patterns', '35 * * * *', $cron$select public.detect_fraud_patterns()$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal deteksi pola dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Budget poin: poin yang dibalik admin (reason reversal) mengembalikan sisa budget
-- -----------------------------------------------------------------------------

create or replace view public.v_activity_budget as
select
  ap.activity_id,
  ap.organizer_id,
  ap.points_budget as budget,
  coalesce((select sum(l.amount) from public.point_ledger l
    where l.activity_id = ap.activity_id and l.source_organizer_id = ap.organizer_id and l.reason in ('activity_reward', 'reversal')), 0)::integer as used,
  (ap.points_budget - coalesce((select sum(l.amount) from public.point_ledger l
    where l.activity_id = ap.activity_id and l.source_organizer_id = ap.organizer_id and l.reason in ('activity_reward', 'reversal')), 0))::integer as remaining
from public.activity_partners ap
join public.organizers o on o.id = ap.organizer_id
where ap.status = 'accepted' and o.type = 'merchant'
  and (public.is_activity_team(ap.activity_id) or (select public.is_admin()));

-- Pemberian poin ikut memperhitungkan poin yang dibalik saat menghitung sisa budget.
create or replace function public.grant_completion_points(p_user_id uuid, p_activity public.activities, p_preferred_organizer_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_need integer := coalesce(p_activity.points_per_completion, 0);
  v_row record;
begin
  if v_need <= 0 then
    return 0;
  end if;
  if exists (select 1 from public.point_ledger where user_id = p_user_id and activity_id = p_activity.id and reason = 'activity_reward') then
    return 0;
  end if;
  perform 1 from public.activity_partners where activity_id = p_activity.id for update;
  for v_row in
    select ap.organizer_id, o.name,
      ap.points_budget - coalesce((select sum(l.amount) from public.point_ledger l
        where l.activity_id = ap.activity_id and l.source_organizer_id = ap.organizer_id and l.reason in ('activity_reward', 'reversal')), 0) as remaining
    from public.activity_partners ap
    join public.organizers o on o.id = ap.organizer_id
    where ap.activity_id = p_activity.id and ap.status = 'accepted' and o.type = 'merchant' and ap.points_budget > 0
    order by (ap.organizer_id = p_preferred_organizer_id) desc, (ap.role = 'host') desc, ap.created_at
  loop
    if v_row.remaining >= v_need then
      perform public.credit_points(p_user_id, v_need, 'activity_reward', p_activity.id, v_row.organizer_id, null,
        'Selesai ' || p_activity.title || ' · dari ' || v_row.name);
      return v_need;
    end if;
  end loop;
  return 0;
end;
$$;
