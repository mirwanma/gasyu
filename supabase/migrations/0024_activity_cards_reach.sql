-- 0024: kartu aktivitas membawa jangkauan dan mode lokasi Event Global.
-- Dipakai halaman admin (saringan Event Global, label mode lokasi) dan nanti tab Event Global di Jelajah.
-- Kolom baru ditaruh di akhir supaya create or replace view tetap sah.

create or replace view public.v_activity_cards
with (security_invoker = true)
as
select
  a.id, a.host_organizer_id, a.type, a.goal, a.title, a.description, a.cover_url, a.scope_region_id,
  a.starts_at, a.ends_at, a.quota, a.difficulty, a.xp_base, a.points_per_completion, a.join_mode,
  a.residency_rule, a.audience, a.is_paid, a.price_idr, a.status, a.published_at,
  o.name as host_name, o.type as host_type, o.slug as host_slug, o.logo_url as host_logo_url,
  r.name as scope_region_name, r.level as scope_region_level,
  public.activity_seats_taken(a.id) as seats_taken,
  (select count(*) from public.activity_partners ap where ap.activity_id = a.id and ap.status = 'accepted' and ap.role <> 'host') as partner_count,
  a.target_scope, a.group_min, a.group_max, t.kind as target_kind, t.target_count,
  a.reach, a.location_mode
from public.activities a
join public.organizers o on o.id = a.host_organizer_id
left join public.regions r on r.id = a.scope_region_id
left join public.challenge_targets t on t.activity_id = a.id;
