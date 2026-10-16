-- =============================================================================
-- Irisan 3: Event
-- Isi: enum aktivitas, activities, activity_partners (host dulu), activity_checkpoints,
--      participations, fungsi buat/ubah/ajukan/tarik/review/batalkan aktivitas,
--      checkpoint, join dan batal partisipasi, is_resident_of, cron status,
--      bucket covers, RLS.
-- Sumber: docs/ALUR-SISTEM.md bagian 6, 7, 13; docs/DESAIN-DATABASE.md bagian 4, 6, 7.
-- Catatan: kolom berbayar dan payment_status sudah dibuat di sini (default
--          gratis) supaya irisan 11 tidak perlu mengubah struktur tabel.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------

create type public.activity_type as enum ('event', 'challenge');
create type public.activity_goal as enum ('awareness', 'visit', 'sales', 'membership');
create type public.activity_status as enum (
  'draft', 'awaiting_partners', 'in_review', 'published', 'running', 'ended', 'settled', 'cancelled'
);
create type public.difficulty as enum ('easy', 'medium', 'hard');
create type public.join_mode as enum ('individual', 'group', 'both');
create type public.target_scope as enum ('individual', 'group');
create type public.residency_rule as enum ('open', 'residents_only');
create type public.activity_audience as enum ('public', 'members_only');
create type public.partner_role as enum ('host', 'cohost', 'sponsor');
create type public.partner_source as enum ('creator', 'invite', 'open_call', 'admin');
create type public.partner_status as enum ('invited', 'accepted', 'declined', 'removed');
create type public.participation_status as enum (
  'invited', 'registered', 'in_progress', 'completed', 'not_completed', 'cancelled'
);
create type public.payment_status as enum ('not_required', 'unpaid', 'awaiting_confirmation', 'paid', 'refunded');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.activities (
  id uuid primary key default gen_random_uuid(),
  host_organizer_id uuid not null references public.organizers (id),
  type public.activity_type not null,
  goal public.activity_goal not null,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text check (description is null or char_length(description) <= 3000),
  cover_url text,
  scope_region_id uuid references public.regions (id),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  quota integer check (quota is null or quota > 0),
  difficulty public.difficulty,
  xp_base integer not null default 100 check (xp_base >= 0),
  points_per_completion integer not null default 0 check (points_per_completion >= 0),
  join_mode public.join_mode not null default 'individual',
  group_min smallint check (group_min is null or group_min between 2 and 10),
  group_max smallint check (group_max is null or group_max between 2 and 10),
  target_scope public.target_scope not null default 'individual',
  residency_rule public.residency_rule not null default 'open',
  audience public.activity_audience not null default 'public',
  is_paid boolean not null default false,
  price_idr integer,
  payment_instructions text,
  payment_window_hours integer not null default 24 check (payment_window_hours between 1 and 720),
  status public.activity_status not null default 'draft',
  review_note text,
  reviewed_by uuid references public.profiles (id),
  submitted_at timestamptz,
  published_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activities_time_order check (ends_at > starts_at),
  constraint activities_group_size check (
    join_mode = 'individual'
    or (group_min is not null and group_max is not null and group_max >= group_min)
  ),
  constraint activities_target_scope check (target_scope = 'individual' or type = 'challenge'),
  constraint activities_difficulty check (type = 'event' or difficulty is not null),
  constraint activities_residency_scope check (residency_rule = 'open' or scope_region_id is not null),
  constraint activities_paid check (
    (is_paid = false and price_idr is null)
    or (is_paid = true and price_idr >= 1000 and payment_instructions is not null)
  )
);

create index activities_status_starts_idx on public.activities (status, starts_at);
create index activities_scope_status_idx on public.activities (scope_region_id, status);
create index activities_host_idx on public.activities (host_organizer_id);

create trigger activities_set_updated_at
  before update on public.activities
  for each row execute function public.set_updated_at();

create table public.activity_partners (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  organizer_id uuid not null references public.organizers (id),
  role public.partner_role not null,
  source public.partner_source not null,
  status public.partner_status not null default 'invited',
  points_budget integer not null default 0 check (points_budget >= 0),
  contribution_note text,
  benefits_note text,
  invited_by uuid references public.profiles (id),
  responded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_partners_unique unique (activity_id, organizer_id)
);

create unique index activity_partners_one_host_idx on public.activity_partners (activity_id) where role = 'host';
create index activity_partners_organizer_idx on public.activity_partners (organizer_id, status);

create trigger activity_partners_set_updated_at
  before update on public.activity_partners
  for each row execute function public.set_updated_at();

create table public.activity_checkpoints (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  partner_organizer_id uuid not null references public.organizers (id),
  outlet_id uuid references public.merchant_outlets (id),
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text,
  lat numeric(9, 6) not null check (lat between -90 and 90),
  lng numeric(9, 6) not null check (lng between -180 and 180),
  radius_m integer not null default 150 check (radius_m between 20 and 2000),
  qr_secret bytea not null default extensions.gen_random_bytes(32),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_checkpoints_activity_idx on public.activity_checkpoints (activity_id);

create trigger activity_checkpoints_set_updated_at
  before update on public.activity_checkpoints
  for each row execute function public.set_updated_at();

create table public.participations (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  group_id uuid, -- FK ke groups ditambahkan di irisan 5
  status public.participation_status not null default 'registered',
  progress integer not null default 0 check (progress >= 0),
  registered_by uuid references public.profiles (id),
  payment_status public.payment_status not null default 'not_required',
  payment_due_at timestamptz,
  payment_proof_path text,
  payment_note text,
  payment_confirmed_by uuid references public.profiles (id),
  payment_confirmed_at timestamptz,
  refunded_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint participations_unique unique (activity_id, user_id)
);

create index participations_activity_status_idx on public.participations (activity_id, status);
create index participations_user_idx on public.participations (user_id, status);
create index participations_group_idx on public.participations (group_id);

create trigger participations_set_updated_at
  before update on public.participations
  for each row execute function public.set_updated_at();

-- FK dari xp_ledger yang ditunda sejak irisan 1
alter table public.xp_ledger
  add constraint xp_ledger_activity_id_fkey foreign key (activity_id) references public.activities (id);

-- -----------------------------------------------------------------------------
-- Trigger penjaga konsistensi
-- -----------------------------------------------------------------------------

-- members_only hanya untuk host komunitas; xp_base mengikuti tipe dan kesulitan.
create function public.check_activity_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_host_type public.organizer_type;
  v_challenge jsonb;
begin
  select type into v_host_type from public.organizers where id = new.host_organizer_id;

  if new.audience = 'members_only' and v_host_type <> 'community' then
    raise exception 'members_only_requires_community_host';
  end if;

  if new.type = 'event' then
    new.xp_base := public.setting_int('xp.event_checkin');
  else
    select value into v_challenge from public.app_settings where key = 'xp.challenge';
    new.xp_base := coalesce((v_challenge ->> new.difficulty::text)::integer, new.xp_base);
  end if;

  -- Harga dan status berbayar terkunci setelah terbit (ALUR bagian 7).
  if tg_op = 'UPDATE' and old.status in ('published', 'running', 'ended', 'settled')
     and (new.is_paid <> old.is_paid or new.price_idr is distinct from old.price_idr) then
    raise exception 'price_locked_after_publish';
  end if;

  return new;
end;
$$;

create trigger activities_check_row
  before insert or update on public.activities
  for each row execute function public.check_activity_row();

-- Partner: host selalu accepted; budget poin > 0 hanya untuk merchant;
-- source admin hanya untuk host platform; organizer platform tidak jadi partner lain.
create function public.check_activity_partner()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.organizer_type;
  v_host_type public.organizer_type;
begin
  select type into v_type from public.organizers where id = new.organizer_id;
  select o.type into v_host_type
  from public.activities a join public.organizers o on o.id = a.host_organizer_id
  where a.id = new.activity_id;

  if new.role = 'host' then
    new.status := 'accepted';
    new.source := coalesce(new.source, 'creator');
  end if;
  if new.points_budget > 0 and v_type <> 'merchant' then
    raise exception 'points_budget_requires_merchant';
  end if;
  if new.source = 'admin' and v_host_type <> 'platform' then
    raise exception 'admin_source_requires_platform_host';
  end if;
  if v_type = 'platform' and new.role <> 'host' then
    raise exception 'platform_cannot_be_partner';
  end if;
  return new;
end;
$$;

create trigger activity_partners_check
  before insert or update on public.activity_partners
  for each row execute function public.check_activity_partner();

-- Checkpoint harus milik partner accepted di aktivitas ini.
create function public.check_checkpoint_partner()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.activity_partners
    where activity_id = new.activity_id and organizer_id = new.partner_organizer_id and status = 'accepted'
  ) then
    raise exception 'checkpoint_partner_not_accepted';
  end if;
  return new;
end;
$$;

create trigger activity_checkpoints_check_partner
  before insert or update of partner_organizer_id on public.activity_checkpoints
  for each row execute function public.check_checkpoint_partner();

-- -----------------------------------------------------------------------------
-- Helper akses
-- -----------------------------------------------------------------------------

-- Anggota tim dari partner accepted (host atau partner lain) di aktivitas ini.
-- Admin dianggap tim untuk aktivitas yang host-nya organizer platform.
create function public.is_activity_team(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.activity_partners ap
    where ap.activity_id = p_activity_id
      and ap.status = 'accepted'
      and public.is_team_member(ap.organizer_id)
  ) or exists (
    select 1
    from public.activities a join public.organizers o on o.id = a.host_organizer_id
    where a.id = p_activity_id and o.type = 'platform' and public.is_admin()
  );
$$;

create function public.is_activity_host_team(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activities a
    where a.id = p_activity_id
      and (
        public.is_team_member(a.host_organizer_id)
        or exists (select 1 from public.organizers o where o.id = a.host_organizer_id and o.type = 'platform' and public.is_admin())
      )
  );
$$;

-- Pemilik/ketua host (atau admin untuk host platform).
create function public.is_activity_host_leader(p_activity_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activities a
    where a.id = p_activity_id
      and (
        public.is_team_leader(a.host_organizer_id)
        or exists (select 1 from public.organizers o where o.id = a.host_organizer_id and o.type = 'platform' and public.is_admin())
      )
  );
$$;

-- Apakah kelurahan asal warga berada di dalam wilayah (kelurahan/kecamatan/kota).
create function public.is_resident_of(p_user_id uuid, p_region_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with recursive up as (
    select r.id, r.parent_id
    from public.profiles p join public.regions r on r.id = p.home_village_id
    where p.id = p_user_id
    union all
    select r.id, r.parent_id from public.regions r join up on r.id = up.parent_id
  )
  select exists (select 1 from up where id = p_region_id);
$$;

revoke execute on function public.is_activity_team(uuid), public.is_activity_host_team(uuid),
  public.is_activity_host_leader(uuid), public.is_resident_of(uuid, uuid) from public, anon;
grant execute on function public.is_activity_team(uuid), public.is_activity_host_team(uuid),
  public.is_activity_host_leader(uuid), public.is_resident_of(uuid, uuid) to authenticated;

-- Aktivitas yang terlihat publik.
create function public.activity_is_public(p_status public.activity_status)
returns boolean
language sql
immutable
as $$
  select p_status in ('published', 'running', 'ended', 'settled');
$$;

-- -----------------------------------------------------------------------------
-- Membuat dan mengubah aktivitas (tim host)
-- Kode error: not_allowed, organizer_unavailable, invalid_title, invalid_time,
--   invalid_region, invalid_group_size, members_only_requires_community_host,
--   price_locked_after_publish, activity_locked
-- -----------------------------------------------------------------------------

create function public.create_activity(p_host_organizer_id uuid, p_data jsonb)
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
      nullif(p_data ->> 'difficulty', '')::public.difficulty,
      v_join,
      case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_min', ''), '2')::smallint end,
      case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_max', ''), '10')::smallint end,
      coalesce(nullif(p_data ->> 'target_scope', ''), 'individual')::public.target_scope,
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

  return v_id;
end;
$$;

-- Draft: semua kolom boleh diubah. Terbit/berjalan: hanya deskripsi dan cover.
create function public.update_activity(p_activity_id uuid, p_data jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.activities;
  v_join public.join_mode;
  v_scope uuid;
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

  v_join := coalesce(nullif(p_data ->> 'join_mode', ''), v_a.join_mode::text)::public.join_mode;
  v_scope := case when p_data ? 'scope_region_id' then nullif(p_data ->> 'scope_region_id', '')::uuid else v_a.scope_region_id end;
  if v_scope is not null and not exists (select 1 from public.regions where id = v_scope and is_active) then
    raise exception 'invalid_region';
  end if;

  begin
    update public.activities
    set type = coalesce(nullif(p_data ->> 'type', ''), type::text)::public.activity_type,
        goal = coalesce(nullif(p_data ->> 'goal', ''), goal::text)::public.activity_goal,
        title = coalesce(nullif(btrim(p_data ->> 'title'), ''), title),
        description = case when p_data ? 'description' then nullif(btrim(p_data ->> 'description'), '') else description end,
        cover_url = coalesce(p_data ->> 'cover_url', cover_url),
        scope_region_id = v_scope,
        starts_at = coalesce((p_data ->> 'starts_at')::timestamptz, starts_at),
        ends_at = coalesce((p_data ->> 'ends_at')::timestamptz, ends_at),
        quota = case when p_data ? 'quota' then nullif(p_data ->> 'quota', '')::integer else quota end,
        difficulty = case when p_data ? 'difficulty' then nullif(p_data ->> 'difficulty', '')::public.difficulty else difficulty end,
        join_mode = v_join,
        group_min = case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_min', '')::smallint, group_min, 2) end,
        group_max = case when v_join = 'individual' then null else coalesce(nullif(p_data ->> 'group_max', '')::smallint, group_max, 10) end,
        target_scope = coalesce(nullif(p_data ->> 'target_scope', ''), target_scope::text)::public.target_scope,
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
end;
$$;

-- -----------------------------------------------------------------------------
-- Checkpoint (tim partner accepted; selama aktivitas belum in_review/ended)
-- -----------------------------------------------------------------------------

create function public.add_checkpoint(p_activity_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_partner uuid := coalesce(nullif(p_data ->> 'partner_organizer_id', '')::uuid, (select host_organizer_id from public.activities where id = p_activity_id));
  v_outlet public.merchant_outlets;
  v_id uuid;
  v_lat numeric; v_lng numeric; v_name text; v_address text;
begin
  select * into v_a from public.activities where id = p_activity_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners', 'published') then
    raise exception 'activity_locked';
  end if;
  -- Tim partner hanya boleh menambah checkpoint atas nama partner-nya sendiri;
  -- tim host (atau admin untuk platform) boleh atas nama partner mana pun.
  if not (public.is_activity_host_team(p_activity_id) or (public.is_team_member(v_partner) and public.is_activity_team(p_activity_id))) then
    raise exception 'not_allowed';
  end if;

  if nullif(p_data ->> 'outlet_id', '') is not null then
    select * into v_outlet from public.merchant_outlets where id = (p_data ->> 'outlet_id')::uuid and organizer_id = v_partner;
    if not found then
      raise exception 'invalid_outlet';
    end if;
    v_lat := v_outlet.lat; v_lng := v_outlet.lng;
    v_name := coalesce(nullif(btrim(p_data ->> 'name'), ''), v_outlet.name);
    v_address := v_outlet.address;
  else
    v_lat := (p_data ->> 'lat')::numeric; v_lng := (p_data ->> 'lng')::numeric;
    v_name := btrim(p_data ->> 'name');
    v_address := nullif(btrim(p_data ->> 'address'), '');
  end if;

  begin
    insert into public.activity_checkpoints (activity_id, partner_organizer_id, outlet_id, name, address, lat, lng, radius_m)
    values (p_activity_id, v_partner, v_outlet.id, v_name, v_address, v_lat, v_lng,
      coalesce(nullif(p_data ->> 'radius_m', '')::integer, public.setting_int('checkin.radius_m_default')))
    returning id into v_id;
  exception
    when check_violation or not_null_violation or invalid_text_representation then
      raise exception 'invalid_checkpoint';
  end;
  return v_id;
end;
$$;

create function public.set_checkpoint_active(p_checkpoint_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cp public.activity_checkpoints;
begin
  perform public.active_uid();
  select * into v_cp from public.activity_checkpoints where id = p_checkpoint_id;
  if not found or not (public.is_activity_host_team(v_cp.activity_id) or public.is_team_member(v_cp.partner_organizer_id)) then
    raise exception 'not_allowed';
  end if;
  update public.activity_checkpoints set is_active = p_active where id = p_checkpoint_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Siklus hidup: ajukan, tarik, review admin, batalkan
-- -----------------------------------------------------------------------------

-- Validasi ALUR bagian 6; bagian misi/challenge/berbayar ditambah di irisan terkait.
create function public.submit_activity(p_activity_id uuid)
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

-- Host menarik kembali dari awaiting_partners/in_review ke draft.
create function public.withdraw_activity(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.active_uid();
  if not public.is_activity_host_leader(p_activity_id) then
    raise exception 'not_allowed';
  end if;
  update public.activities set status = 'draft'
  where id = p_activity_id and status in ('awaiting_partners', 'in_review');
  if not found then
    raise exception 'activity_locked';
  end if;
end;
$$;

create function public.review_activity(p_activity_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_note text := nullif(btrim(p_note), '');
  v_a public.activities;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if not p_approve and v_note is null then
    raise exception 'note_required';
  end if;
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or v_a.status <> 'in_review' then
    raise exception 'not_in_review';
  end if;

  update public.activities
  set status = case when p_approve then 'published'::public.activity_status else 'draft'::public.activity_status end,
      review_note = v_note,
      reviewed_by = v_uid,
      published_at = case when p_approve then now() else published_at end
  where id = p_activity_id;

  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, case when p_approve then 'approve_activity' else 'reject_activity' end, 'activities', p_activity_id, v_note);

  perform public.notify_team(v_a.host_organizer_id,
    case when p_approve then 'activity_approved' else 'activity_rejected' end,
    jsonb_build_object('activity_id', p_activity_id, 'title', v_a.title, 'note', v_note));

  -- Komunitas host: kabari member aktif tentang aktivitas baru.
  if p_approve then
    insert into public.notifications (user_id, kind, payload)
    select m.user_id, 'community_new_activity',
      jsonb_build_object('activity_id', p_activity_id, 'title', v_a.title, 'community_id', v_a.host_organizer_id, 'community_name', o.name)
    from public.community_memberships m
    join public.organizers o on o.id = m.community_id
    where m.community_id = v_a.host_organizer_id and m.status = 'active'
      and not exists (select 1 from public.organizer_members om where om.organizer_id = m.community_id and om.user_id = m.user_id);
  end if;
end;
$$;

create function public.cancel_activity(p_activity_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_admin boolean := public.is_admin();
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'not_allowed';
  end if;
  if not (v_admin or public.is_activity_host_leader(p_activity_id)) then
    raise exception 'not_allowed';
  end if;
  -- Host hanya boleh membatalkan sebelum berjalan; admin juga saat running.
  if v_a.status in ('ended', 'settled', 'cancelled') or (v_a.status = 'running' and not v_admin) then
    raise exception 'activity_locked';
  end if;

  update public.activities set status = 'cancelled', review_note = coalesce(nullif(btrim(p_reason), ''), review_note)
  where id = p_activity_id;

  insert into public.notifications (user_id, kind, payload)
  select user_id,
    case when payment_status = 'paid' then 'payment_refund_due' else 'activity_cancelled' end,
    jsonb_build_object('activity_id', p_activity_id, 'title', v_a.title, 'reason', nullif(btrim(p_reason), ''))
  from public.participations
  where activity_id = p_activity_id and status in ('invited', 'registered', 'in_progress');

  update public.participations set status = 'cancelled'
  where activity_id = p_activity_id and status in ('invited', 'registered', 'in_progress');

  if v_admin then
    insert into public.admin_actions (admin_id, action, target_table, target_id, note)
    values (v_uid, 'cancel_activity', 'activities', p_activity_id, nullif(btrim(p_reason), ''));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Partisipasi warga (pribadi). Grup menyusul di irisan 5.
-- Kode error: activity_unavailable, members_only, residents_only, quota_full,
--   already_joined, join_mode_group
-- -----------------------------------------------------------------------------

create function public.activity_seats_taken(p_activity_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer from public.participations
  where activity_id = p_activity_id and status in ('invited', 'registered', 'in_progress', 'completed');
$$;

grant execute on function public.activity_seats_taken(uuid) to authenticated;

create function public.join_activity(p_activity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_id uuid;
  v_existing public.participations;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or v_a.status not in ('published', 'running') then
    raise exception 'activity_unavailable';
  end if;
  if v_a.join_mode = 'group' then
    raise exception 'join_mode_group';
  end if;
  if v_a.audience = 'members_only' and not exists (
    select 1 from public.community_memberships
    where community_id = v_a.host_organizer_id and user_id = v_uid and status = 'active'
  ) then
    raise exception 'members_only';
  end if;
  if v_a.residency_rule = 'residents_only' and not public.is_resident_of(v_uid, v_a.scope_region_id) then
    raise exception 'residents_only';
  end if;

  select * into v_existing from public.participations where activity_id = p_activity_id and user_id = v_uid;
  if found and v_existing.status <> 'cancelled' then
    raise exception 'already_joined';
  end if;
  if v_a.quota is not null and public.activity_seats_taken(p_activity_id) >= v_a.quota then
    raise exception 'quota_full';
  end if;

  if found then
    update public.participations
    set status = 'registered', group_id = null, registered_by = v_uid, progress = 0,
        payment_status = case when v_a.is_paid then 'unpaid'::public.payment_status else 'not_required'::public.payment_status end,
        payment_due_at = case when v_a.is_paid then least(now() + make_interval(hours => v_a.payment_window_hours), v_a.starts_at) end,
        payment_proof_path = null, payment_note = null, payment_confirmed_by = null, payment_confirmed_at = null
    where id = v_existing.id
    returning id into v_id;
  else
    insert into public.participations (activity_id, user_id, status, registered_by, payment_status, payment_due_at)
    values (
      p_activity_id, v_uid, 'registered', v_uid,
      case when v_a.is_paid then 'unpaid'::public.payment_status else 'not_required'::public.payment_status end,
      case when v_a.is_paid then least(now() + make_interval(hours => v_a.payment_window_hours), v_a.starts_at) end
    ) returning id into v_id;
  end if;
  return v_id;
end;
$$;

-- Batal sebelum check-in pertama (dicek lewat progress dan status).
create function public.cancel_participation(p_participation_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_p public.participations;
  v_a public.activities;
begin
  select * into v_p from public.participations where id = p_participation_id and user_id = v_uid for update;
  if not found or v_p.status not in ('invited', 'registered') then
    raise exception 'cannot_cancel';
  end if;
  select * into v_a from public.activities where id = v_p.activity_id;
  update public.participations set status = 'cancelled' where id = p_participation_id;
  if v_p.payment_status = 'paid' then
    perform public.notify_team(v_a.host_organizer_id, 'payment_refund_due',
      jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'participation_id', p_participation_id, 'user_id', v_uid));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cron: status aktivitas
-- -----------------------------------------------------------------------------

create function public.advance_activity_status()
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
  update public.participations p set status = 'in_progress'
  from public.activities a
  where a.id = p.activity_id and a.status = 'running' and p.status = 'registered';
  update public.activities set status = 'ended' where status = 'running' and ends_at <= now();
  get diagnostics v_n = row_count; v_count := v_count + v_n;
  return v_count;
end;
$$;

create function public.settle_ended_activities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  with settled as (
    update public.activities set status = 'settled'
    where status = 'ended' and ends_at <= now() - interval '48 hours'
    returning id
  )
  update public.participations p set status = 'not_completed'
  from settled s
  where p.activity_id = s.id and p.status in ('registered', 'in_progress');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.advance_activity_status(), public.settle_ended_activities() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('advance_activity_status', '*/5 * * * *', $cron$select public.advance_activity_status()$cron$);
  perform cron.schedule('settle_ended_activities', '15 * * * *', $cron$select public.settle_ended_activities()$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal aktivitas dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hak akses fungsi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.create_activity(uuid, jsonb), public.update_activity(uuid, jsonb),
  public.add_checkpoint(uuid, jsonb), public.set_checkpoint_active(uuid, boolean),
  public.submit_activity(uuid), public.withdraw_activity(uuid),
  public.review_activity(uuid, boolean, text), public.cancel_activity(uuid, text),
  public.join_activity(uuid), public.cancel_participation(uuid)
  from public, anon;
grant execute on function
  public.create_activity(uuid, jsonb), public.update_activity(uuid, jsonb),
  public.add_checkpoint(uuid, jsonb), public.set_checkpoint_active(uuid, boolean),
  public.submit_activity(uuid), public.withdraw_activity(uuid),
  public.review_activity(uuid, boolean, text), public.cancel_activity(uuid, text),
  public.join_activity(uuid), public.cancel_participation(uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- View ringkas untuk daftar (tanpa data pribadi)
-- -----------------------------------------------------------------------------

create view public.v_activity_cards
with (security_invoker = true)
as
select
  a.id, a.host_organizer_id, a.type, a.goal, a.title, a.description, a.cover_url, a.scope_region_id,
  a.starts_at, a.ends_at, a.quota, a.difficulty, a.xp_base, a.points_per_completion, a.join_mode,
  a.residency_rule, a.audience, a.is_paid, a.price_idr, a.status, a.published_at,
  o.name as host_name, o.type as host_type, o.slug as host_slug, o.logo_url as host_logo_url,
  r.name as scope_region_name, r.level as scope_region_level,
  public.activity_seats_taken(a.id) as seats_taken,
  (select count(*) from public.activity_partners ap where ap.activity_id = a.id and ap.status = 'accepted' and ap.role <> 'host') as partner_count
from public.activities a
join public.organizers o on o.id = a.host_organizer_id
left join public.regions r on r.id = a.scope_region_id;

grant select on public.v_activity_cards to authenticated;

-- Peserta untuk tim host: nickname dan kelurahan saja.
create view public.v_activity_participants as
select
  p.id, p.activity_id, p.user_id, p.group_id, p.status, p.progress, p.payment_status, p.payment_due_at,
  p.payment_proof_path, p.payment_note, p.payment_confirmed_at, p.refunded_at, p.completed_at, p.created_at,
  pr.nickname::text as nickname, r.name as village_name
from public.participations p
join public.profiles pr on pr.id = p.user_id
left join public.regions r on r.id = pr.home_village_id
where public.is_activity_host_team(p.activity_id) or (select public.is_admin());

grant select on public.v_activity_participants to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

revoke all on table public.activities, public.activity_partners, public.activity_checkpoints, public.participations
  from anon, authenticated;

alter table public.activities enable row level security;
alter table public.activity_partners enable row level security;
alter table public.activity_checkpoints enable row level security;
alter table public.participations enable row level security;

grant select on public.activities to authenticated;
create policy activities_select on public.activities
  for select to authenticated
  using (public.activity_is_public(status) or public.is_activity_team(id) or (select public.is_admin()));

grant select on public.activity_partners to authenticated;
create policy activity_partners_select on public.activity_partners
  for select to authenticated
  using (
    exists (select 1 from public.activities a where a.id = activity_id and (public.activity_is_public(a.status) or public.is_activity_team(a.id)))
    or public.is_team_member(organizer_id)
    or (select public.is_admin())
  );

-- qr_secret tidak pernah bisa dibaca client.
grant select (id, activity_id, partner_organizer_id, outlet_id, name, address, lat, lng, radius_m, is_active, created_at, updated_at)
  on public.activity_checkpoints to authenticated;
create policy activity_checkpoints_select on public.activity_checkpoints
  for select to authenticated
  using (
    exists (select 1 from public.activities a where a.id = activity_id and (public.activity_is_public(a.status) or public.is_activity_team(a.id)))
    or (select public.is_admin())
  );

grant select on public.participations to authenticated;
create policy participations_select on public.participations
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_activity_host_team(activity_id) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Storage: covers (publik), path <activity_id>/cover-*.ext, hanya tim host
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage tidak tersedia, bucket covers dilewati';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('covers', 'covers', true, 3145728, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;
  execute $p$
    create policy covers_read_all on storage.objects
      for select to anon, authenticated using (bucket_id = 'covers')
  $p$;
  execute $p$
    create policy covers_write_host on storage.objects
      for insert to authenticated
      with check (bucket_id = 'covers' and public.is_activity_host_team((storage.foldername(name))[1]::uuid))
  $p$;
  execute $p$
    create policy covers_update_host on storage.objects
      for update to authenticated
      using (bucket_id = 'covers' and public.is_activity_host_team((storage.foldername(name))[1]::uuid))
  $p$;
end;
$$;
