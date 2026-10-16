-- =============================================================================
-- Irisan 7: Kolaborasi
-- Isi: seed organizer "Ramein" (type platform), invite_partner, respond_partner_invite,
--      cancel_partner_invite, admin_add_partner, leave_activity, collab_posts +
--      collab_applications (open call), apply/withdraw/decide, close_collab_post,
--      cron close_expired_collab_posts, create_activity untuk host platform (admin),
--      submit_activity menutup open call, v_organizer_reputation, RLS.
-- Sumber: docs/ALUR-SISTEM.md bagian 10; docs/DESAIN-DATABASE.md bagian 4, 6, 7.
-- Catatan: set_partner_budget sudah dibuat di irisan 6.
-- =============================================================================

create type public.collab_kind as enum ('collab', 'sponsor');
create type public.post_status as enum ('open', 'closed');
create type public.application_status as enum ('pending', 'accepted', 'rejected', 'withdrawn');

-- -----------------------------------------------------------------------------
-- Organizer platform "Ramein": host event buatan admin, tanpa anggota tim.
-- -----------------------------------------------------------------------------

insert into public.organizers (type, name, slug, status, description)
values ('platform', 'Ramein', 'ramein', 'approved', 'Event dan challenge kota yang diselenggarakan tim Ramein.')
on conflict (slug) do nothing;

create function public.platform_organizer_id()
returns uuid
language sql
stable
set search_path = ''
as $$
  select id from public.organizers where type = 'platform' order by created_at limit 1;
$$;

grant execute on function public.platform_organizer_id() to authenticated;

-- -----------------------------------------------------------------------------
-- Tabel open call
-- -----------------------------------------------------------------------------

create table public.collab_posts (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id),
  activity_id uuid references public.activities (id),
  kind public.collab_kind not null,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  needs text not null check (char_length(btrim(needs)) between 3 and 500),
  benefits text not null check (char_length(btrim(benefits)) between 3 and 500),
  category text,
  region_id uuid references public.regions (id),
  deadline timestamptz,
  status public.post_status not null default 'open',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index collab_posts_board_idx on public.collab_posts (status, kind, region_id);
create index collab_posts_organizer_idx on public.collab_posts (organizer_id);

create trigger collab_posts_set_updated_at
  before update on public.collab_posts
  for each row execute function public.set_updated_at();

create table public.collab_applications (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.collab_posts (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id),
  proposed_role public.partner_role not null check (proposed_role <> 'host'),
  proposed_points_budget integer not null default 0 check (proposed_points_budget >= 0),
  contribution text check (contribution is null or char_length(contribution) <= 500),
  message text check (message is null or char_length(message) <= 500),
  status public.application_status not null default 'pending',
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint collab_applications_unique unique (post_id, organizer_id)
);

create index collab_applications_organizer_idx on public.collab_applications (organizer_id, status);

create trigger collab_applications_set_updated_at
  before update on public.collab_applications
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------

-- Partner baru harus approved, bukan platform, bukan host, dan peran cohost/sponsor.
create function public.check_partner_candidate(p_activity_id uuid, p_organizer_id uuid, p_role public.partner_role)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_o public.organizers;
begin
  if p_role not in ('cohost', 'sponsor') then
    raise exception 'invalid_role';
  end if;
  select * into v_o from public.organizers where id = p_organizer_id;
  if not found or v_o.status <> 'approved' or v_o.type = 'platform' then
    raise exception 'partner_unavailable';
  end if;
  if exists (select 1 from public.activities where id = p_activity_id and host_organizer_id = p_organizer_id) then
    raise exception 'partner_is_host';
  end if;
  if exists (select 1 from public.activity_partners where activity_id = p_activity_id and organizer_id = p_organizer_id and status in ('invited', 'accepted')) then
    raise exception 'partner_exists';
  end if;
end;
$$;

-- awaiting_partners → in_review bila tidak ada undangan tertunda lagi.
create function public.advance_if_partners_answered(p_activity_id uuid)
returns void
language plpgsql
set search_path = ''
as $$
begin
  update public.activities a
  set status = 'in_review', review_note = null
  where a.id = p_activity_id and a.status = 'awaiting_partners'
    and not exists (select 1 from public.activity_partners ap where ap.activity_id = a.id and ap.status = 'invited');
end;
$$;

revoke execute on function public.check_partner_candidate(uuid, uuid, public.partner_role), public.advance_if_partners_answered(uuid)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Undangan partner
-- Kode error: not_allowed, activity_locked, invalid_role, partner_unavailable,
--   partner_is_host, partner_exists, invite_unavailable, points_budget_requires_merchant
-- -----------------------------------------------------------------------------

create function public.invite_partner(p_activity_id uuid, p_organizer_id uuid, p_role public.partner_role, p_budget integer default 0, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_id uuid;
  v_host_name text;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.is_activity_host_leader(p_activity_id) then
    raise exception 'not_allowed';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners', 'in_review', 'published') then
    raise exception 'activity_locked';
  end if;
  perform public.check_partner_candidate(p_activity_id, p_organizer_id, p_role);
  if coalesce(p_budget, 0) > 0 and not exists (select 1 from public.organizers where id = p_organizer_id and type = 'merchant') then
    raise exception 'points_budget_requires_merchant';
  end if;

  -- Baris declined/removed lama dipakai ulang supaya tetap satu baris per partner.
  delete from public.activity_partners where activity_id = p_activity_id and organizer_id = p_organizer_id and status in ('declined', 'removed');
  insert into public.activity_partners (activity_id, organizer_id, role, source, status, points_budget, contribution_note, invited_by)
  values (p_activity_id, p_organizer_id, p_role, 'invite', 'invited', coalesce(p_budget, 0), nullif(btrim(p_note), ''), v_uid)
  returning id into v_id;

  select name into v_host_name from public.organizers where id = v_a.host_organizer_id;
  perform public.notify_team(p_organizer_id, 'partner_invite', jsonb_build_object(
    'partner_id', v_id, 'activity_id', p_activity_id, 'title', v_a.title, 'host_name', v_host_name, 'role', p_role, 'note', nullif(btrim(p_note), '')));
  return v_id;
end;
$$;

create function public.respond_partner_invite(p_partner_id uuid, p_accept boolean, p_budget integer default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_ap public.activity_partners;
  v_a public.activities;
  v_name text;
begin
  select * into v_ap from public.activity_partners where id = p_partner_id for update;
  if not found or not public.is_team_leader(v_ap.organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_ap.status <> 'invited' then
    raise exception 'invite_unavailable';
  end if;
  select * into v_a from public.activities where id = v_ap.activity_id for update;
  if v_a.status in ('ended', 'settled', 'cancelled') then
    raise exception 'activity_locked';
  end if;
  if p_accept then
    if p_budget is not null and p_budget > 0 and not exists (select 1 from public.organizers where id = v_ap.organizer_id and type = 'merchant') then
      raise exception 'points_budget_requires_merchant';
    end if;
    update public.activity_partners
    set status = 'accepted', responded_at = now(), points_budget = coalesce(p_budget, points_budget)
    where id = p_partner_id;
  else
    update public.activity_partners set status = 'declined', responded_at = now() where id = p_partner_id;
  end if;
  select name into v_name from public.organizers where id = v_ap.organizer_id;
  perform public.notify_team(v_a.host_organizer_id, case when p_accept then 'partner_accepted' else 'partner_declined' end,
    jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'partner_name', v_name, 'role', v_ap.role));
  perform public.advance_if_partners_answered(v_a.id);
end;
$$;

-- Host membatalkan undangan yang belum dijawab.
create function public.cancel_partner_invite(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ap public.activity_partners;
begin
  perform public.active_uid();
  select * into v_ap from public.activity_partners where id = p_partner_id for update;
  if not found or not public.is_activity_host_leader(v_ap.activity_id) then
    raise exception 'not_allowed';
  end if;
  if v_ap.status <> 'invited' then
    raise exception 'invite_unavailable';
  end if;
  update public.activity_partners set status = 'removed', responded_at = now() where id = p_partner_id;
  perform public.advance_if_partners_answered(v_ap.activity_id);
end;
$$;

-- Admin menambahkan partner langsung ke event Ramein.
create function public.admin_add_partner(p_activity_id uuid, p_organizer_id uuid, p_role public.partner_role, p_note text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not exists (select 1 from public.organizers where id = v_a.host_organizer_id and type = 'platform') then
    raise exception 'platform_host_required';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners', 'in_review', 'published') then
    raise exception 'activity_locked';
  end if;
  perform public.check_partner_candidate(p_activity_id, p_organizer_id, p_role);
  delete from public.activity_partners where activity_id = p_activity_id and organizer_id = p_organizer_id and status in ('declined', 'removed');
  insert into public.activity_partners (activity_id, organizer_id, role, source, status, contribution_note, invited_by, responded_at)
  values (p_activity_id, p_organizer_id, p_role, 'admin', 'accepted', nullif(btrim(p_note), ''), v_uid, now())
  returning id into v_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'add_partner', 'activity_partners', v_id, nullif(btrim(p_note), ''));
  perform public.notify_team(p_organizer_id, 'partner_added_by_admin', jsonb_build_object(
    'partner_id', v_id, 'activity_id', p_activity_id, 'title', v_a.title, 'role', p_role, 'note', nullif(btrim(p_note), '')));
  return v_id;
end;
$$;

-- Partner keluar selama aktivitas belum berjalan; checkpoint miliknya dinonaktifkan.
create function public.leave_activity(p_partner_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_ap public.activity_partners;
  v_a public.activities;
  v_name text;
begin
  select * into v_ap from public.activity_partners where id = p_partner_id for update;
  if not found or not (public.is_team_leader(v_ap.organizer_id) or public.is_admin()) then
    raise exception 'not_allowed';
  end if;
  if v_ap.role = 'host' then
    raise exception 'host_cannot_leave';
  end if;
  if v_ap.status <> 'accepted' then
    raise exception 'invite_unavailable';
  end if;
  select * into v_a from public.activities where id = v_ap.activity_id for update;
  if v_a.status not in ('draft', 'awaiting_partners', 'in_review', 'published') then
    raise exception 'activity_locked';
  end if;
  update public.activity_partners set status = 'removed', responded_at = now() where id = p_partner_id;
  update public.activity_checkpoints set is_active = false where activity_id = v_a.id and partner_organizer_id = v_ap.organizer_id;
  select name into v_name from public.organizers where id = v_ap.organizer_id;
  if exists (select 1 from public.organizers where id = v_a.host_organizer_id and type = 'platform') then
    insert into public.notifications (user_id, kind, payload)
    select id, 'partner_left', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'partner_name', v_name)
    from public.profiles where is_admin;
  else
    perform public.notify_team(v_a.host_organizer_id, 'partner_left', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'partner_name', v_name));
  end if;
end;
$$;

revoke execute on function
  public.invite_partner(uuid, uuid, public.partner_role, integer, text), public.respond_partner_invite(uuid, boolean, integer),
  public.cancel_partner_invite(uuid), public.admin_add_partner(uuid, uuid, public.partner_role, text), public.leave_activity(uuid)
  from public, anon;
grant execute on function
  public.invite_partner(uuid, uuid, public.partner_role, integer, text), public.respond_partner_invite(uuid, boolean, integer),
  public.cancel_partner_invite(uuid), public.admin_add_partner(uuid, uuid, public.partner_role, text), public.leave_activity(uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Open call
-- Kode error: not_allowed, invalid_post, post_closed, own_post, already_applied,
--   application_unavailable
-- -----------------------------------------------------------------------------

create function public.create_collab_post(p_organizer_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_activity uuid := nullif(p_data ->> 'activity_id', '')::uuid;
  v_id uuid;
begin
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.organizers where id = p_organizer_id and status = 'approved' and type <> 'platform') then
    raise exception 'not_allowed';
  end if;
  if v_activity is not null and not exists (
    select 1 from public.activities where id = v_activity and host_organizer_id = p_organizer_id and status in ('draft', 'awaiting_partners', 'in_review', 'published')
  ) then
    raise exception 'invalid_post';
  end if;
  begin
    insert into public.collab_posts (organizer_id, activity_id, kind, title, needs, benefits, category, region_id, deadline, created_by)
    values (
      p_organizer_id, v_activity,
      coalesce(nullif(p_data ->> 'kind', ''), 'collab')::public.collab_kind,
      btrim(p_data ->> 'title'), btrim(p_data ->> 'needs'), btrim(p_data ->> 'benefits'),
      nullif(btrim(p_data ->> 'category'), ''),
      nullif(p_data ->> 'region_id', '')::uuid,
      nullif(p_data ->> 'deadline', '')::timestamptz,
      v_uid
    ) returning id into v_id;
  exception
    when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format then
      raise exception 'invalid_post';
  end;
  return v_id;
end;
$$;

create function public.close_collab_post(p_post_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.collab_posts;
begin
  perform public.active_uid();
  select * into v_p from public.collab_posts where id = p_post_id for update;
  if not found or not (public.is_team_leader(v_p.organizer_id) or public.is_admin()) then
    raise exception 'not_allowed';
  end if;
  update public.collab_posts set status = 'closed' where id = p_post_id;
end;
$$;

create function public.apply_open_call(p_post_id uuid, p_organizer_id uuid, p_role public.partner_role, p_budget integer default 0, p_contribution text default null, p_message text default null)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_p public.collab_posts;
  v_id uuid;
  v_name text;
begin
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.organizers where id = p_organizer_id and status = 'approved' and type <> 'platform') then
    raise exception 'not_allowed';
  end if;
  select * into v_p from public.collab_posts where id = p_post_id for update;
  if not found or v_p.status <> 'open' or (v_p.deadline is not null and v_p.deadline < now()) then
    raise exception 'post_closed';
  end if;
  if v_p.organizer_id = p_organizer_id then
    raise exception 'own_post';
  end if;
  if p_role not in ('cohost', 'sponsor') then
    raise exception 'invalid_role';
  end if;
  if coalesce(p_budget, 0) > 0 and not exists (select 1 from public.organizers where id = p_organizer_id and type = 'merchant') then
    raise exception 'points_budget_requires_merchant';
  end if;
  if exists (select 1 from public.collab_applications where post_id = p_post_id and organizer_id = p_organizer_id and status in ('pending', 'accepted')) then
    raise exception 'already_applied';
  end if;
  delete from public.collab_applications where post_id = p_post_id and organizer_id = p_organizer_id and status in ('rejected', 'withdrawn');
  insert into public.collab_applications (post_id, organizer_id, proposed_role, proposed_points_budget, contribution, message, created_by)
  values (p_post_id, p_organizer_id, p_role, coalesce(p_budget, 0), nullif(btrim(p_contribution), ''), nullif(btrim(p_message), ''), v_uid)
  returning id into v_id;
  select name into v_name from public.organizers where id = p_organizer_id;
  perform public.notify_team(v_p.organizer_id, 'application_received', jsonb_build_object(
    'application_id', v_id, 'post_id', p_post_id, 'post_title', v_p.title, 'applicant_name', v_name, 'role', p_role));
  return v_id;
end;
$$;

create function public.withdraw_application(p_application_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ap public.collab_applications;
begin
  perform public.active_uid();
  select * into v_ap from public.collab_applications where id = p_application_id for update;
  if not found or not public.is_team_leader(v_ap.organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_ap.status <> 'pending' then
    raise exception 'application_unavailable';
  end if;
  update public.collab_applications set status = 'withdrawn' where id = p_application_id;
end;
$$;

create function public.decide_application(p_application_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_ap public.collab_applications;
  v_p public.collab_posts;
begin
  select * into v_ap from public.collab_applications where id = p_application_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;
  select * into v_p from public.collab_posts where id = v_ap.post_id for update;
  if not public.is_team_leader(v_p.organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_ap.status <> 'pending' then
    raise exception 'application_unavailable';
  end if;
  update public.collab_applications
  set status = case when p_accept then 'accepted'::public.application_status else 'rejected'::public.application_status end,
      decided_by = v_uid, decided_at = now()
  where id = p_application_id;

  if p_accept and v_p.activity_id is not null then
    perform public.check_partner_candidate(v_p.activity_id, v_ap.organizer_id, v_ap.proposed_role);
    delete from public.activity_partners where activity_id = v_p.activity_id and organizer_id = v_ap.organizer_id and status in ('declined', 'removed');
    insert into public.activity_partners (activity_id, organizer_id, role, source, status, points_budget, contribution_note, invited_by, responded_at)
    values (v_p.activity_id, v_ap.organizer_id, v_ap.proposed_role, 'open_call', 'accepted', v_ap.proposed_points_budget, v_ap.contribution, v_uid, now());
  end if;

  perform public.notify_team(v_ap.organizer_id, case when p_accept then 'application_accepted' else 'application_rejected' end,
    jsonb_build_object('application_id', v_ap.id, 'post_title', v_p.title, 'activity_id', v_p.activity_id, 'host_name', (select name from public.organizers where id = v_p.organizer_id)));
end;
$$;

revoke execute on function
  public.create_collab_post(uuid, jsonb), public.close_collab_post(uuid),
  public.apply_open_call(uuid, uuid, public.partner_role, integer, text, text),
  public.withdraw_application(uuid), public.decide_application(uuid, boolean)
  from public, anon;
grant execute on function
  public.create_collab_post(uuid, jsonb), public.close_collab_post(uuid),
  public.apply_open_call(uuid, uuid, public.partner_role, integer, text, text),
  public.withdraw_application(uuid), public.decide_application(uuid, boolean)
  to authenticated;

-- Cron: tutup open call yang lewat tenggat (tiap jam).
create function public.close_expired_collab_posts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.collab_posts set status = 'closed' where status = 'open' and deadline is not null and deadline <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.close_expired_collab_posts() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('close_expired_collab_posts', '20 * * * *', $cron$select public.close_expired_collab_posts()$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal open call dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- create_activity: admin membuat atas nama Ramein (host platform)
-- -----------------------------------------------------------------------------

create or replace function public.create_activity(p_host_organizer_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_host public.organizers;
  v_id uuid;
  v_type public.activity_type := coalesce(nullif(p_data ->> 'type', ''), 'event')::public.activity_type;
  v_join public.join_mode := coalesce(nullif(p_data ->> 'join_mode', ''), 'individual')::public.join_mode;
  v_scope uuid := nullif(p_data ->> 'scope_region_id', '')::uuid;
  v_target_scope public.target_scope := coalesce(nullif(p_data ->> 'target_scope', ''), 'individual')::public.target_scope;
  v_audience public.activity_audience := coalesce(nullif(p_data ->> 'audience', ''), 'public')::public.activity_audience;
begin
  select * into v_host from public.organizers where id = p_host_organizer_id;
  if not found then
    raise exception 'organizer_unavailable';
  end if;
  if v_host.type = 'platform' then
    if not public.is_admin() then
      raise exception 'not_allowed';
    end if;
    v_audience := 'public';
  elsif not public.is_team_member(p_host_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_scope is not null and not exists (select 1 from public.regions where id = v_scope and is_active) then
    raise exception 'invalid_region';
  end if;
  if v_type = 'event' then
    v_target_scope := 'individual';
  end if;
  if v_target_scope = 'group' and v_join <> 'group' then
    raise exception 'group_target_requires_group_join';
  end if;

  begin
    insert into public.activities (
      host_organizer_id, type, goal, title, description, scope_region_id, starts_at, ends_at,
      quota, difficulty, join_mode, group_min, group_max, target_scope, residency_rule, audience,
      created_by
    ) values (
      p_host_organizer_id,
      v_type,
      coalesce(nullif(p_data ->> 'goal', ''), 'awareness')::public.activity_goal,
      btrim(p_data ->> 'title'),
      nullif(btrim(p_data ->> 'description'), ''),
      v_scope,
      (p_data ->> 'starts_at')::timestamptz,
      (p_data ->> 'ends_at')::timestamptz,
      nullif(p_data ->> 'quota', '')::integer,
      case when v_type = 'challenge' then coalesce(nullif(p_data ->> 'difficulty', ''), 'easy')::public.difficulty end,
      v_join,
      case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_min', ''), '2')::smallint end,
      case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_max', ''), '10')::smallint end,
      v_target_scope,
      coalesce(nullif(p_data ->> 'residency_rule', ''), 'open')::public.residency_rule,
      v_audience,
      v_uid
    ) returning id into v_id;
  exception
    when check_violation then
      raise exception '%', case
        when sqlerrm like '%activities_title%' then 'invalid_title'
        when sqlerrm like '%activities_time_order%' then 'invalid_time'
        when sqlerrm like '%activities_group_size%' then 'invalid_group_size'
        when sqlerrm like '%activities_residency_scope%' then 'invalid_region'
        else 'invalid_activity' end;
    when not_null_violation or invalid_datetime_format then
      raise exception 'invalid_time';
  end;

  insert into public.activity_partners (activity_id, organizer_id, role, source, status, invited_by)
  values (v_id, p_host_organizer_id, 'host', 'creator', 'accepted', v_uid);

  if v_type = 'challenge' then
    perform public.upsert_challenge_target(v_id, p_data || jsonb_build_object('target_count', coalesce(nullif(p_data ->> 'target_count', ''), '1')));
  end if;

  if v_host.type = 'platform' then
    insert into public.admin_actions (admin_id, action, target_table, target_id) values (v_uid, 'create_platform_activity', 'activities', v_id);
  end if;

  return v_id;
end;
$$;

-- submit_activity: menutup open call aktivitas itu.
create or replace function public.submit_activity(p_activity_id uuid)
returns public.activity_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_host public.organizers;
  v_pending integer;
  v_budget integer;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.is_activity_host_leader(p_activity_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_host from public.organizers where id = v_a.host_organizer_id;
  if v_host.status <> 'approved' and v_host.type <> 'platform' then
    raise exception 'host_not_approved';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners') then
    raise exception 'activity_locked';
  end if;
  if v_a.starts_at <= now() then
    raise exception 'starts_in_past';
  end if;
  if not exists (select 1 from public.activity_checkpoints where activity_id = p_activity_id and is_active) then
    raise exception 'checkpoint_required';
  end if;
  if v_a.type = 'challenge' and not exists (select 1 from public.challenge_targets where activity_id = p_activity_id) then
    raise exception 'target_required';
  end if;
  if v_a.points_per_completion > 0 then
    select coalesce(sum(points_budget), 0) into v_budget
    from public.activity_partners where activity_id = p_activity_id and status = 'accepted';
    if v_budget < v_a.points_per_completion then
      raise exception 'points_budget_insufficient';
    end if;
  end if;
  if v_a.audience = 'members_only' and v_host.type <> 'community' then
    raise exception 'members_only_requires_community_host';
  end if;
  if v_a.residency_rule = 'residents_only' and v_a.scope_region_id is null then
    raise exception 'residency_requires_scope';
  end if;
  if v_a.is_paid and (v_a.price_idr is null or v_a.price_idr < public.setting_int('payment.min_price_idr') or v_a.payment_instructions is null) then
    raise exception 'invalid_payment';
  end if;

  update public.collab_posts set status = 'closed' where activity_id = p_activity_id and status = 'open';

  select count(*) into v_pending
  from public.activity_partners where activity_id = p_activity_id and status = 'invited';

  if v_host.type = 'platform' then
    update public.activities
    set status = 'published', submitted_at = now(), published_at = now(), reviewed_by = v_uid, review_note = null
    where id = p_activity_id;
    insert into public.admin_actions (admin_id, action, target_table, target_id)
    values (v_uid, 'publish_platform_activity', 'activities', p_activity_id);
    return 'published';
  end if;

  if v_pending > 0 then
    update public.activities set status = 'awaiting_partners', submitted_at = now() where id = p_activity_id;
    return 'awaiting_partners';
  end if;

  update public.activities set status = 'in_review', submitted_at = now(), review_note = null where id = p_activity_id;
  return 'in_review';
end;
$$;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

-- Partner di aktivitas dengan nama organizer (terlihat sesuai policy activity_partners).
create view public.v_activity_partners
with (security_invoker = true)
as
select
  ap.id, ap.activity_id, ap.organizer_id, ap.role, ap.source, ap.status, ap.points_budget, ap.contribution_note, ap.responded_at, ap.created_at,
  o.name as organizer_name, o.type as organizer_type, o.slug as organizer_slug, o.logo_url as organizer_logo_url,
  a.title as activity_title, a.status as activity_status, a.starts_at, a.ends_at, a.host_organizer_id,
  h.name as host_name, h.type as host_type
from public.activity_partners ap
join public.organizers o on o.id = ap.organizer_id
join public.activities a on a.id = ap.activity_id
join public.organizers h on h.id = a.host_organizer_id;

grant select on public.v_activity_partners to authenticated;

-- Reputasi penyelenggara 90 hari terakhir (tanpa platform): hadir, penyelesaian, kolaborasi.
create view public.v_organizer_reputation as
select
  o.id as organizer_id,
  o.name,
  o.type,
  (select count(*) from public.checkins c where c.partner_organizer_id = o.id and c.checked_in_at > now() - interval '90 days' and c.review_status <> 'rejected')::integer as checkins_90d,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and a.ends_at > now() - interval '90 days' and p.status = 'completed')::integer as completed_90d,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where a.host_organizer_id = o.id and a.ends_at > now() - interval '90 days' and p.status in ('completed', 'not_completed', 'in_progress', 'registered'))::integer as registered_90d,
  (select count(distinct ap.activity_id) from public.activity_partners ap
    join public.activities a on a.id = ap.activity_id
    where ap.organizer_id = o.id and ap.status = 'accepted' and a.starts_at > now() - interval '90 days'
      and (select count(*) from public.activity_partners x where x.activity_id = ap.activity_id and x.status = 'accepted') > 1)::integer as collabs_90d
from public.organizers o
where o.type <> 'platform' and o.status = 'approved';

grant select on public.v_organizer_reputation to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

-- Partner yang masih diundang boleh melihat aktivitasnya (untuk memutuskan).
-- Lewat fungsi security definer supaya policy activities dan activity_partners tidak saling memanggil.
create function public.is_invited_partner_team(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activity_partners ap
    where ap.activity_id = p_activity_id and ap.status = 'invited' and public.is_team_member(ap.organizer_id)
  );
$$;
revoke execute on function public.is_invited_partner_team(uuid) from public, anon;
grant execute on function public.is_invited_partner_team(uuid) to authenticated;

drop policy activities_select on public.activities;
create policy activities_select on public.activities
  for select to authenticated
  using (
    public.activity_is_public(status)
    or public.is_activity_team(id)
    or (select public.is_admin())
    or public.is_invited_partner_team(id)
  );

revoke all on table public.collab_posts, public.collab_applications from anon, authenticated;
alter table public.collab_posts enable row level security;
alter table public.collab_applications enable row level security;

-- Papan: semua open call terbuka terlihat anggota tim penyelenggara terverifikasi; pemilik melihat semuanya.
grant select on public.collab_posts to authenticated;
create policy collab_posts_select on public.collab_posts
  for select to authenticated
  using (
    public.is_team_member(organizer_id)
    or (select public.is_admin())
    or (status = 'open' and exists (
      select 1 from public.organizer_members m join public.organizers og on og.id = m.organizer_id
      where m.user_id = (select auth.uid()) and og.status = 'approved'))
  );

grant select on public.collab_applications to authenticated;
create policy collab_applications_select on public.collab_applications
  for select to authenticated
  using (
    public.is_team_member(organizer_id)
    or exists (select 1 from public.collab_posts p where p.id = post_id and public.is_team_member(p.organizer_id))
    or (select public.is_admin())
  );
