-- =============================================================================
-- Irisan 5: Challenge & grup
-- Isi: enum target_kind/group_role/group_member_status, challenge_targets,
--      groups, group_members (+ FK participations.group_id), fungsi grup
--      (buat, gabung, keluar, keluarkan, serahkan ketua, kode baru),
--      register_group / confirm_group_registration, target challenge di
--      create/update/submit_activity, progress + penyelesaian challenge dan
--      bonus grup di perform_checkin, v_group_progress, cron undangan grup
--      kedaluwarsa, RLS.
-- Sumber: docs/ALUR-SISTEM.md bagian 6, 11, 13, 14c, 15; docs/DESAIN-DATABASE.md bagian 4, 6, 7.
-- Catatan: target berbasis misi (required_missions, missions_completed)
--          dievaluasi di irisan 10; sekarang hanya check-in yang menambah progress.
-- =============================================================================

create type public.target_kind as enum ('total_checkins', 'distinct_checkpoints', 'required_missions', 'missions_completed');
create type public.group_role as enum ('leader', 'member');
create type public.group_member_status as enum ('active', 'left', 'removed');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.challenge_targets (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null unique references public.activities (id) on delete cascade,
  kind public.target_kind not null,
  target_count integer not null check (target_count > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger challenge_targets_set_updated_at
  before update on public.challenge_targets
  for each row execute function public.set_updated_at();

create table public.groups (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 3 and 30),
  leader_id uuid not null references public.profiles (id),
  invite_code text not null unique check (invite_code ~ '^[A-Z0-9]{6}$'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger groups_set_updated_at
  before update on public.groups
  for each row execute function public.set_updated_at();

create table public.group_members (
  group_id uuid not null references public.groups (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  role public.group_role not null default 'member',
  status public.group_member_status not null default 'active',
  joined_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (group_id, user_id)
);

create unique index group_members_one_leader_idx on public.group_members (group_id) where role = 'leader' and status = 'active';
create index group_members_user_idx on public.group_members (user_id) where status = 'active';

create trigger group_members_set_updated_at
  before update on public.group_members
  for each row execute function public.set_updated_at();

alter table public.participations
  add constraint participations_group_id_fkey foreign key (group_id) references public.groups (id);

-- Batas: maksimal N anggota aktif per grup, maksimal M grup aktif per warga (app_settings).
create function public.check_group_member_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status = 'active' and (tg_op = 'INSERT' or old.status <> 'active') then
    if (select count(*) from public.group_members where group_id = new.group_id and status = 'active' and user_id <> new.user_id)
       >= public.setting_int('group.max_size') then
      raise exception 'group_full';
    end if;
    if (select count(*) from public.group_members where user_id = new.user_id and status = 'active' and group_id <> new.group_id)
       >= public.setting_int('group.max_groups_per_user') then
      raise exception 'too_many_groups';
    end if;
  end if;
  return new;
end;
$$;

create trigger group_members_check
  before insert or update on public.group_members
  for each row execute function public.check_group_member_row();

-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------

create function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active'
  );
$$;

create function public.is_group_leader(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.group_members
    where group_id = p_group_id and user_id = auth.uid() and status = 'active' and role = 'leader'
  );
$$;

-- Kode undangan 6 karakter tanpa huruf/angka yang mirip (0/O, 1/I).
create function public.new_invite_code()
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_chars text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  v_code text;
begin
  loop
    v_code := '';
    for i in 1..6 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.groups where invite_code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.is_group_member(uuid), public.is_group_leader(uuid), public.new_invite_code() from public, anon;
grant execute on function public.is_group_member(uuid), public.is_group_leader(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Fungsi grup (warga)
-- Kode error: invalid_group_name, group_full, too_many_groups, invalid_invite_code,
--   already_in_group, not_group_member, not_group_leader, cannot_remove_leader
-- -----------------------------------------------------------------------------

create function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_id uuid;
begin
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 30 then
    raise exception 'invalid_group_name';
  end if;
  insert into public.groups (name, leader_id, invite_code)
  values (btrim(p_name), v_uid, public.new_invite_code())
  returning id into v_id;
  insert into public.group_members (group_id, user_id, role) values (v_id, v_uid, 'leader');
  return v_id;
end;
$$;

create function public.join_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_g public.groups;
  v_m public.group_members;
begin
  select * into v_g from public.groups where invite_code = upper(btrim(coalesce(p_invite_code, '')));
  if not found then
    raise exception 'invalid_invite_code';
  end if;
  select * into v_m from public.group_members where group_id = v_g.id and user_id = v_uid;
  if found and v_m.status = 'active' then
    raise exception 'already_in_group';
  end if;
  if found then
    update public.group_members set status = 'active', role = 'member', joined_at = now()
    where group_id = v_g.id and user_id = v_uid;
  else
    insert into public.group_members (group_id, user_id, role) values (v_g.id, v_uid, 'member');
  end if;
  return v_g.id;
end;
$$;

-- Ketua yang keluar menyerahkan peran ke anggota aktif paling lama.
create function public.leave_group(p_group_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_m public.group_members;
  v_next uuid;
begin
  select * into v_m from public.group_members where group_id = p_group_id and user_id = v_uid and status = 'active' for update;
  if not found then
    raise exception 'not_group_member';
  end if;
  update public.group_members set status = 'left', role = 'member' where group_id = p_group_id and user_id = v_uid;
  if v_m.role = 'leader' then
    select user_id into v_next from public.group_members
    where group_id = p_group_id and status = 'active' order by joined_at limit 1;
    if v_next is not null then
      update public.group_members set role = 'leader' where group_id = p_group_id and user_id = v_next;
      update public.groups set leader_id = v_next where id = p_group_id;
    end if;
  end if;
end;
$$;

create function public.remove_group_member(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.active_uid();
  if not public.is_group_leader(p_group_id) then
    raise exception 'not_group_leader';
  end if;
  if p_user_id = auth.uid() then
    raise exception 'cannot_remove_leader';
  end if;
  update public.group_members set status = 'removed'
  where group_id = p_group_id and user_id = p_user_id and status = 'active';
  if not found then
    raise exception 'not_group_member';
  end if;
end;
$$;

create function public.transfer_group_leader(p_group_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if not public.is_group_leader(p_group_id) then
    raise exception 'not_group_leader';
  end if;
  if not exists (select 1 from public.group_members where group_id = p_group_id and user_id = p_user_id and status = 'active') then
    raise exception 'not_group_member';
  end if;
  update public.group_members set role = 'member' where group_id = p_group_id and user_id = v_uid;
  update public.group_members set role = 'leader' where group_id = p_group_id and user_id = p_user_id;
  update public.groups set leader_id = p_user_id where id = p_group_id;
end;
$$;

create function public.regenerate_invite_code(p_group_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text;
begin
  perform public.active_uid();
  if not public.is_group_leader(p_group_id) then
    raise exception 'not_group_leader';
  end if;
  v_code := public.new_invite_code();
  update public.groups set invite_code = v_code where id = p_group_id;
  return v_code;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pendaftaran grup ke aktivitas
-- Kode error: activity_unavailable, join_mode_individual, not_group_leader,
--   invalid_group_members, invalid_group_size, quota_full, member_already_joined,
--   members_only, residents_only, cannot_confirm
-- -----------------------------------------------------------------------------

create function public.register_group(p_activity_id uuid, p_group_id uuid, p_member_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_g public.groups;
  v_ids uuid[] := (select array_agg(distinct x) from unnest(coalesce(p_member_ids, '{}'::uuid[])) x);
  v_n integer := coalesce(array_length(v_ids, 1), 0);
  v_member uuid;
  v_leader_nick text;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or v_a.status not in ('published', 'running') then
    raise exception 'activity_unavailable';
  end if;
  if v_a.join_mode = 'individual' then
    raise exception 'join_mode_individual';
  end if;
  if not public.is_group_leader(p_group_id) then
    raise exception 'not_group_leader';
  end if;
  select * into v_g from public.groups where id = p_group_id;

  if v_n = 0 or exists (
    select 1 from unnest(v_ids) x
    where not exists (select 1 from public.group_members m where m.group_id = p_group_id and m.user_id = x and m.status = 'active')
  ) then
    raise exception 'invalid_group_members';
  end if;
  if v_n < coalesce(v_a.group_min, 2) or v_n > coalesce(v_a.group_max, 10) then
    raise exception 'invalid_group_size';
  end if;
  if exists (
    select 1 from public.participations p
    where p.activity_id = p_activity_id and p.user_id = any (v_ids) and p.status <> 'cancelled'
  ) then
    raise exception 'member_already_joined';
  end if;
  if v_a.quota is not null and public.activity_seats_taken(p_activity_id) + v_n > v_a.quota then
    raise exception 'quota_full';
  end if;
  if v_a.audience = 'members_only' and exists (
    select 1 from unnest(v_ids) x
    where not exists (select 1 from public.community_memberships cm where cm.community_id = v_a.host_organizer_id and cm.user_id = x and cm.status = 'active')
  ) then
    raise exception 'members_only';
  end if;
  if v_a.residency_rule = 'residents_only' and exists (
    select 1 from unnest(v_ids) x where not public.is_resident_of(x, v_a.scope_region_id)
  ) then
    raise exception 'residents_only';
  end if;

  select nickname into v_leader_nick from public.profiles where id = v_uid;

  foreach v_member in array v_ids loop
    -- Partisipasi lama yang dibatalkan dipakai ulang supaya tetap satu baris per warga per aktivitas.
    delete from public.participations where activity_id = p_activity_id and user_id = v_member and status = 'cancelled'
      and not exists (select 1 from public.checkins c where c.participation_id = participations.id);
    insert into public.participations (activity_id, user_id, group_id, status, registered_by, payment_status, payment_due_at)
    values (
      p_activity_id, v_member, p_group_id,
      case when v_member = v_uid then 'registered'::public.participation_status else 'invited'::public.participation_status end,
      v_uid,
      case when v_a.is_paid then 'unpaid'::public.payment_status else 'not_required'::public.payment_status end,
      case when v_a.is_paid then least(now() + make_interval(hours => v_a.payment_window_hours), v_a.starts_at) end
    );
    if v_member <> v_uid then
      perform public.notify(v_member, 'group_registration', jsonb_build_object(
        'activity_id', p_activity_id, 'title', v_a.title, 'group_id', p_group_id, 'group_name', v_g.name,
        'leader_nickname', v_leader_nick, 'respond_before', v_a.starts_at));
    end if;
  end loop;
  return v_n;
end;
$$;

create function public.confirm_group_registration(p_participation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  update public.participations
  set status = case when p_accept then 'registered'::public.participation_status else 'cancelled'::public.participation_status end
  where id = p_participation_id and user_id = v_uid and status = 'invited';
  if not found then
    raise exception 'cannot_confirm';
  end if;
end;
$$;

-- Partisipasi yang dibatalkan tidak boleh menyisakan baris ganda: register_group
-- menghapus baris cancelled tanpa check-in; hapus ini hanya dilakukan fungsi.
revoke execute on function
  public.create_group(text), public.join_group(text), public.leave_group(uuid), public.remove_group_member(uuid, uuid),
  public.transfer_group_leader(uuid, uuid), public.regenerate_invite_code(uuid),
  public.register_group(uuid, uuid, uuid[]), public.confirm_group_registration(uuid, boolean)
  from public, anon;
grant execute on function
  public.create_group(text), public.join_group(text), public.leave_group(uuid), public.remove_group_member(uuid, uuid),
  public.transfer_group_leader(uuid, uuid), public.regenerate_invite_code(uuid),
  public.register_group(uuid, uuid, uuid[]), public.confirm_group_registration(uuid, boolean)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Target challenge di create/update/submit_activity
-- -----------------------------------------------------------------------------

-- Menyimpan target dari p_data (target_kind, target_count) untuk challenge draft.
create function public.upsert_challenge_target(p_activity_id uuid, p_data jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_a public.activities;
  v_kind public.target_kind;
  v_count integer;
begin
  select * into v_a from public.activities where id = p_activity_id;
  if v_a.type <> 'challenge' then
    delete from public.challenge_targets where activity_id = p_activity_id;
    return;
  end if;
  if not (p_data ? 'target_kind' or p_data ? 'target_count') then
    return;
  end if;
  v_kind := coalesce(nullif(p_data ->> 'target_kind', ''), (select kind::text from public.challenge_targets where activity_id = p_activity_id), 'total_checkins')::public.target_kind;
  v_count := coalesce(nullif(p_data ->> 'target_count', '')::integer, (select target_count from public.challenge_targets where activity_id = p_activity_id), 1);
  if v_kind = 'required_missions' then
    v_count := 1;
    if v_a.target_scope = 'group' then
      raise exception 'invalid_target';
    end if;
  end if;
  if v_count < 1 then
    raise exception 'invalid_target';
  end if;
  insert into public.challenge_targets (activity_id, kind, target_count)
  values (p_activity_id, v_kind, v_count)
  on conflict (activity_id) do update set kind = excluded.kind, target_count = excluded.target_count;
end;
$$;

revoke execute on function public.upsert_challenge_target(uuid, jsonb) from public, anon, authenticated;

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
begin
  select * into v_host from public.organizers where id = p_host_organizer_id;
  if not found or v_host.type = 'platform' then
    raise exception 'organizer_unavailable';
  end if;
  if not public.is_team_member(p_host_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_scope is not null and not exists (select 1 from public.regions where id = v_scope and is_active) then
    raise exception 'invalid_region';
  end if;
  if v_type = 'event' then
    v_target_scope := 'individual';
  end if;
  -- Target grup hanya masuk akal jika pendaftaran lewat grup.
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
      coalesce(nullif(p_data ->> 'audience', ''), 'public')::public.activity_audience,
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

  return v_id;
end;
$$;

create or replace function public.update_activity(p_activity_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.activities;
  v_join public.join_mode;
  v_scope uuid;
  v_type public.activity_type;
  v_target_scope public.target_scope;
begin
  perform public.active_uid();
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.is_activity_host_team(p_activity_id) then
    raise exception 'not_allowed';
  end if;

  if v_a.status in ('published', 'running') then
    update public.activities
    set description = coalesce(nullif(btrim(p_data ->> 'description'), ''), description),
        cover_url = coalesce(p_data ->> 'cover_url', cover_url)
    where id = p_activity_id;
    return;
  end if;
  if v_a.status <> 'draft' then
    raise exception 'activity_locked';
  end if;

  v_type := coalesce(nullif(p_data ->> 'type', ''), v_a.type::text)::public.activity_type;
  v_join := coalesce(nullif(p_data ->> 'join_mode', ''), v_a.join_mode::text)::public.join_mode;
  v_target_scope := case when v_type = 'event' then 'individual'::public.target_scope
    else coalesce(nullif(p_data ->> 'target_scope', ''), v_a.target_scope::text)::public.target_scope end;
  v_scope := case when p_data ? 'scope_region_id' then nullif(p_data ->> 'scope_region_id', '')::uuid else v_a.scope_region_id end;
  if v_scope is not null and not exists (select 1 from public.regions where id = v_scope and is_active) then
    raise exception 'invalid_region';
  end if;
  if v_target_scope = 'group' and v_join <> 'group' then
    raise exception 'group_target_requires_group_join';
  end if;

  begin
    update public.activities
    set type = v_type,
        goal = coalesce(nullif(p_data ->> 'goal', ''), goal::text)::public.activity_goal,
        title = coalesce(nullif(btrim(p_data ->> 'title'), ''), title),
        description = case when p_data ? 'description' then nullif(btrim(p_data ->> 'description'), '') else description end,
        cover_url = coalesce(p_data ->> 'cover_url', cover_url),
        scope_region_id = v_scope,
        starts_at = coalesce((p_data ->> 'starts_at')::timestamptz, starts_at),
        ends_at = coalesce((p_data ->> 'ends_at')::timestamptz, ends_at),
        quota = case when p_data ? 'quota' then nullif(p_data ->> 'quota', '')::integer else quota end,
        difficulty = case when v_type = 'event' then null else coalesce(nullif(p_data ->> 'difficulty', '')::public.difficulty, difficulty, 'easy') end,
        join_mode = v_join,
        group_min = case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_min', '')::smallint, group_min, 2) end,
        group_max = case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_max', '')::smallint, group_max, 10) end,
        target_scope = v_target_scope,
        residency_rule = coalesce(nullif(p_data ->> 'residency_rule', ''), residency_rule::text)::public.residency_rule,
        audience = coalesce(nullif(p_data ->> 'audience', ''), audience::text)::public.activity_audience,
        review_note = null
    where id = p_activity_id;
  exception
    when check_violation then
      raise exception '%', case
        when sqlerrm like '%activities_title%' then 'invalid_title'
        when sqlerrm like '%activities_time_order%' then 'invalid_time'
        when sqlerrm like '%activities_group_size%' then 'invalid_group_size'
        when sqlerrm like '%activities_residency_scope%' then 'invalid_region'
        else 'invalid_activity' end;
    when invalid_datetime_format then
      raise exception 'invalid_time';
  end;

  perform public.upsert_challenge_target(p_activity_id, case when v_type = 'challenge' and not exists (select 1 from public.challenge_targets where activity_id = p_activity_id)
    then p_data || jsonb_build_object('target_count', coalesce(nullif(p_data ->> 'target_count', ''), '1')) else p_data end);
end;
$$;

-- submit_activity: challenge wajib punya target.
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
-- perform_checkin: progress challenge, penyelesaian individu/grup, bonus grup
-- -----------------------------------------------------------------------------

-- Progress satu partisipasi (atau satu grup) sesuai jenis target.
create function public.checkin_progress(p_activity_id uuid, p_kind public.target_kind, p_participation_id uuid default null, p_group_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_kind = 'distinct_checkpoints' then count(distinct c.checkpoint_id)
    else count(*)
  end::integer
  from public.checkins c
  where c.activity_id = p_activity_id
    and c.review_status <> 'rejected'
    and (p_participation_id is null or c.participation_id = p_participation_id)
    and (p_group_id is null or c.group_id = p_group_id);
$$;

-- Dipakai oleh v_group_progress (view berjalan dengan hak pemanggil), hanya mengembalikan angka.
revoke execute on function public.checkin_progress(uuid, public.target_kind, uuid, uuid) from public, anon;
grant execute on function public.checkin_progress(uuid, public.target_kind, uuid, uuid) to authenticated;

-- XP penyelesaian challenge untuk satu warga (dasar + bonus kolaborasi), sekali saja.
create function public.award_challenge_completion(p_user_id uuid, p_activity public.activities, p_checkin_id uuid)
returns integer
language plpgsql
set search_path = ''
as $$
declare
  v_xp integer := 0;
  v_partner_count integer;
begin
  if exists (select 1 from public.xp_ledger where user_id = p_user_id and activity_id = p_activity.id and reason = 'challenge_complete') then
    return 0;
  end if;
  v_xp := public.award_xp(p_user_id, p_activity.xp_base, 'challenge_complete', p_activity.id, p_checkin_id, null, 'Challenge selesai: ' || p_activity.title);
  select count(*) into v_partner_count from public.activity_partners where activity_id = p_activity.id and status = 'accepted';
  if v_partner_count > 1 then
    v_xp := v_xp + public.award_xp(p_user_id, round(p_activity.xp_base * public.setting_int('xp.collab_bonus_pct') / 100.0)::integer, 'collab_bonus', p_activity.id, p_checkin_id, null,
      'Bonus kolaborasi ' || p_activity.title);
  end if;
  return v_xp;
end;
$$;

revoke execute on function public.award_challenge_completion(uuid, public.activities, uuid) from public, anon, authenticated;

create or replace function public.perform_checkin(p_checkpoint_id uuid, p_token text, p_lat numeric default null, p_lng numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_cp public.activity_checkpoints;
  v_a public.activities;
  v_p public.participations;
  v_partner public.organizers;
  v_target public.challenge_targets;
  v_slot bigint := public.qr_slot();
  v_distance integer;
  v_flagged boolean := false;
  v_checkin_id uuid;
  v_base integer := 0;
  v_first integer := 0;
  v_collab integer := 0;
  v_group integer := 0;
  v_partner_count integer;
  v_completed boolean := false;
  v_progress integer := 0;
  v_group_progress integer;
  v_target_count integer;
  v_total_xp integer;
  v_present integer;
  v_row record;
begin
  select * into v_cp from public.activity_checkpoints where id = p_checkpoint_id and is_active;
  if not found then
    raise exception 'invalid_checkpoint';
  end if;

  select * into v_a from public.activities where id = v_cp.activity_id for update;
  if v_a.status = 'published' and v_a.starts_at <= now() and v_a.ends_at > now() then
    update public.activities set status = 'running' where id = v_a.id;
    v_a.status := 'running';
  end if;
  if v_a.status <> 'running' then
    raise exception 'activity_not_running';
  end if;

  if p_token is null or p_token not in (
    public.qr_token(v_cp.qr_secret, v_cp.id, v_slot),
    public.qr_token(v_cp.qr_secret, v_cp.id, v_slot - 1)
  ) then
    raise exception 'invalid_token';
  end if;

  select * into v_p from public.participations
  where activity_id = v_a.id and user_id = v_uid for update;
  if not found or v_p.status not in ('registered', 'in_progress') then
    raise exception 'not_registered';
  end if;
  if v_p.payment_status not in ('not_required', 'paid') then
    raise exception 'payment_required';
  end if;

  if p_lat is not null and p_lng is not null then
    v_distance := public.distance_m(p_lat, p_lng, v_cp.lat, v_cp.lng);
    v_flagged := v_distance > v_cp.radius_m;
  else
    v_flagged := true;
  end if;

  begin
    insert into public.checkins (participation_id, activity_id, user_id, group_id, checkpoint_id, partner_organizer_id, lat, lng, distance_m, review_status)
    values (v_p.id, v_a.id, v_uid, v_p.group_id, v_cp.id, v_cp.partner_organizer_id, p_lat, p_lng, v_distance,
      case when v_flagged then 'flagged'::public.review_status else 'ok'::public.review_status end)
    returning id into v_checkin_id;
  exception when unique_violation then
    raise exception 'already_checked_in_today';
  end;

  if v_flagged then
    insert into public.fraud_flags (user_id, checkin_id, kind, detail)
    values (v_uid, v_checkin_id, 'out_of_radius',
      jsonb_build_object('distance_m', v_distance, 'radius_m', v_cp.radius_m, 'has_location', p_lat is not null));
  end if;

  -- XP dasar event diberikan dulu supaya batas harian memotong bonus, bukan XP dasar.
  if v_a.type = 'event' then
    v_base := public.award_xp(v_uid, v_a.xp_base, 'event_checkin', v_a.id, v_checkin_id, null, 'Check-in ' || v_a.title);
  end if;

  -- Kunjungan pertama ke penyelenggara ini (event maupun challenge)
  if not exists (
    select 1 from public.checkins
    where user_id = v_uid and partner_organizer_id = v_cp.partner_organizer_id and id <> v_checkin_id
  ) then
    select * into v_partner from public.organizers where id = v_cp.partner_organizer_id;
    v_first := public.award_xp(v_uid, public.setting_int('xp.first_visit_bonus'), 'first_visit_bonus', v_a.id, v_checkin_id, null,
      'Kunjungan pertama ke ' || v_partner.name);
  end if;

  if v_a.type = 'event' then
    select count(*) into v_partner_count from public.activity_partners where activity_id = v_a.id and status = 'accepted';
    if v_partner_count > 1 then
      v_collab := public.award_xp(v_uid, round(v_a.xp_base * public.setting_int('xp.collab_bonus_pct') / 100.0)::integer, 'collab_bonus', v_a.id, v_checkin_id, null,
        'Bonus kolaborasi ' || v_a.title);
    end if;
    -- Event tanpa misi: selesai saat check-in (misi wajib menyusul di irisan 10).
    update public.participations set status = 'completed', progress = 1, completed_at = now() where id = v_p.id;
    v_completed := true;
    v_progress := 1;
    v_target_count := 1;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    v_target_count := coalesce(v_target.target_count, 1);
    -- Target berbasis misi dihitung di irisan 10; check-in hanya mencatat kehadiran.
    v_progress := case when v_target.kind in ('total_checkins', 'distinct_checkpoints')
      then public.checkin_progress(v_a.id, v_target.kind, v_p.id, null) else v_p.progress end;

    if v_a.target_scope = 'individual' then
      if v_target.kind in ('total_checkins', 'distinct_checkpoints') and v_progress >= v_target_count then
        update public.participations set status = 'completed', progress = v_progress, completed_at = now() where id = v_p.id;
        v_base := public.award_challenge_completion(v_uid, v_a, v_checkin_id);
        v_completed := true;
      else
        update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
      end if;
    else
      update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
      if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
        v_group_progress := public.checkin_progress(v_a.id, v_target.kind, null, v_p.group_id);
        if v_group_progress >= v_target_count then
          -- Semua anggota yang sudah berkontribusi minimal satu kali selesai bersama.
          for v_row in
            select p.id, p.user_id from public.participations p
            where p.activity_id = v_a.id and p.group_id = v_p.group_id and p.status = 'in_progress'
              and exists (select 1 from public.checkins c where c.participation_id = p.id and c.review_status <> 'rejected')
          loop
            update public.participations set status = 'completed', completed_at = now() where id = v_row.id;
            if v_row.user_id = v_uid then
              v_base := public.award_challenge_completion(v_uid, v_a, v_checkin_id);
              v_completed := true;
            else
              perform public.award_challenge_completion(v_row.user_id, v_a, null);
            end if;
          end loop;
        end if;
      end if;
    end if;
  end if;

  -- Bonus grup: minimal N anggota grup yang sama check-in di aktivitas ini hari ini (sekali per anggota per hari).
  if v_p.group_id is not null then
    select count(distinct user_id) into v_present from public.checkins
    where activity_id = v_a.id and group_id = v_p.group_id and local_date = public.local_today() and review_status <> 'rejected';
    if v_present >= public.setting_int('xp.group_bonus_min_members') then
      for v_row in
        select distinct c.user_id, c.id as checkin_id from public.checkins c
        where c.activity_id = v_a.id and c.group_id = v_p.group_id and c.local_date = public.local_today() and c.review_status <> 'rejected'
          and not exists (
            select 1 from public.xp_ledger x
            where x.user_id = c.user_id and x.activity_id = v_a.id and x.reason = 'group_bonus' and x.local_date = public.local_today()
          )
      loop
        if v_row.user_id = v_uid then
          v_group := public.award_xp(v_uid, round(v_a.xp_base * public.setting_int('xp.group_bonus_pct') / 100.0)::integer, 'group_bonus', v_a.id, v_checkin_id, null, 'Bonus grup ' || v_a.title);
        else
          perform public.award_xp(v_row.user_id, round(v_a.xp_base * public.setting_int('xp.group_bonus_pct') / 100.0)::integer, 'group_bonus', v_a.id, v_row.checkin_id, null, 'Bonus grup ' || v_a.title);
        end if;
      end loop;
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_total_xp from public.xp_ledger where user_id = v_uid;

  return jsonb_build_object(
    'checkin_id', v_checkin_id,
    'activity_id', v_a.id,
    'activity_title', v_a.title,
    'activity_type', v_a.type,
    'target_scope', v_a.target_scope,
    'checkpoint_name', v_cp.name,
    'partner_name', (select name from public.organizers where id = v_cp.partner_organizer_id),
    'distance_m', v_distance,
    'flagged', v_flagged,
    'completed', v_completed,
    'progress', v_progress,
    'group_progress', v_group_progress,
    'target_count', v_target_count,
    'xp_base', v_base,
    'xp_first_visit', v_first,
    'xp_collab', v_collab,
    'xp_group', v_group,
    'xp_total', v_base + v_first + v_collab + v_group,
    'total_xp', v_total_xp
  );
end;
$$;

-- Cron: undangan grup yang tidak dijawab sampai aktivitas mulai dilepas.
create or replace function public.advance_activity_status()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := 0;
  v_n integer;
begin
  update public.activities set status = 'running' where status = 'published' and starts_at <= now();
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  update public.participations p set status = 'cancelled'
  from public.activities a
  where a.id = p.activity_id and a.status = 'running' and p.status = 'invited';
  update public.participations p set status = 'in_progress'
  from public.activities a
  where a.id = p.activity_id and a.status = 'running' and p.status = 'registered';
  update public.activities set status = 'ended' where status = 'running' and ends_at <= now();
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  return v_count;
end;
$$;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

-- Progress grup per challenge grup; terlihat oleh peserta aktivitas, tim, dan admin.
create view public.v_group_progress as
with base as (
  select
    a.id as activity_id,
    g.id as group_id,
    g.name as group_name,
    t.kind,
    t.target_count,
    public.checkin_progress(a.id, t.kind, null, g.id) as progress,
    (select count(distinct c.user_id) from public.checkins c where c.activity_id = a.id and c.group_id = g.id and c.review_status <> 'rejected')::integer as contributors,
    (select count(*) from public.participations p where p.activity_id = a.id and p.group_id = g.id and p.status <> 'cancelled')::integer as members
  from public.activities a
  join public.challenge_targets t on t.activity_id = a.id
  join public.groups g on exists (select 1 from public.participations p where p.activity_id = a.id and p.group_id = g.id and p.status <> 'cancelled')
  where a.type = 'challenge' and a.target_scope = 'group'
)
select
  activity_id, group_id, group_name, kind, target_count, progress, contributors, members,
  rank() over (partition by activity_id order by progress desc, contributors desc, group_name)::integer as rank
from base
where exists (select 1 from public.participations p where p.activity_id = base.activity_id and p.user_id = auth.uid())
   or public.is_activity_team(base.activity_id)
   or (select public.is_admin());

grant select on public.v_group_progress to authenticated;

-- Kartu aktivitas: tambah kolom target dan ukuran grup (kolom baru di akhir).
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
  a.target_scope, a.group_min, a.group_max, t.kind as target_kind, t.target_count
from public.activities a
join public.organizers o on o.id = a.host_organizer_id
left join public.regions r on r.id = a.scope_region_id
left join public.challenge_targets t on t.activity_id = a.id;

-- Anggota grup dengan nickname (hanya untuk sesama anggota dan admin).
create view public.v_group_members as
select m.group_id, m.user_id, m.role, m.status, m.joined_at, pr.nickname::text as nickname, r.name as village_name
from public.group_members m
join public.profiles pr on pr.id = m.user_id
left join public.regions r on r.id = pr.home_village_id
where public.is_group_member(m.group_id) or (select public.is_admin());

grant select on public.v_group_members to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

revoke all on table public.challenge_targets, public.groups, public.group_members from anon, authenticated;
alter table public.challenge_targets enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;

grant select on public.challenge_targets to authenticated;
create policy challenge_targets_select on public.challenge_targets
  for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

-- Grup: anggota aktif (termasuk yang pernah keluar, untuk riwayat) dan admin.
grant select on public.groups to authenticated;
create policy groups_select on public.groups
  for select to authenticated
  using (
    exists (select 1 from public.group_members m where m.group_id = id and m.user_id = (select auth.uid()))
    or (select public.is_admin())
  );

grant select on public.group_members to authenticated;
create policy group_members_select on public.group_members
  for select to authenticated
  using (public.is_group_member(group_id) or user_id = (select auth.uid()) or (select public.is_admin()));
