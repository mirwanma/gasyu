-- 0010_missions.sql — Irisan 10: Misi
--
-- Isi: enum misi, activity_missions, mission_completions, mission_code_attempts,
--      bucket mission-proofs, upsert_mission, set_mission_active, reveal_mission,
--      get_mission_qr, get_activity_missions, complete_mission,
--      review_mission_completion, mark_missions_manual, evaluate_completion
--      (syarat selesai terpusat, dipakai perform_checkin versi baru),
--      v_participation_missions, v_mission_stats, v_group_progress (misi),
--      dashboard (bukti misi menunggu), settle_ended_activities (tolak bukti
--      menggantung), cron prune_code_attempts dan reveal_scheduled_missions, RLS.
-- Aturan: XP misi 10–100, total maks. 500 per aktivitas; kode maks. 5 percobaan
-- per 15 menit; QR misi berganti tiap 60 detik; satu penyelesaian per warga per misi.

create type public.mission_verification as enum ('qr_scan', 'secret_code', 'photo', 'manual');
create type public.mission_reveal as enum ('on_publish', 'scheduled', 'manual', 'after_mission');
create type public.completion_status as enum ('pending_review', 'approved', 'rejected');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.activity_missions (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  partner_organizer_id uuid not null references public.organizers (id),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text,
  icon text,
  sort_order smallint not null default 0,
  verification public.mission_verification not null,
  checkpoint_id uuid references public.activity_checkpoints (id),
  qr_secret bytea not null default extensions.gen_random_bytes(32),
  code_hash text,
  xp_reward integer not null,
  is_required boolean not null default true,
  available_from timestamptz,
  available_until timestamptz,
  is_active boolean not null default true,
  reveal_mode public.mission_reveal not null default 'on_publish',
  reveal_at timestamptz,
  prerequisite_mission_id uuid references public.activity_missions (id),
  show_teaser boolean not null default true,
  revealed_at timestamptz,
  locked_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index activity_missions_activity_idx on public.activity_missions (activity_id, sort_order) where is_active;
create index activity_missions_reveal_idx on public.activity_missions (reveal_at) where reveal_mode = 'scheduled' and revealed_at is null;

create trigger activity_missions_set_updated_at
  before update on public.activity_missions
  for each row execute function public.set_updated_at();

create table public.mission_completions (
  id uuid primary key default gen_random_uuid(),
  mission_id uuid not null references public.activity_missions (id),
  participation_id uuid not null references public.participations (id),
  activity_id uuid not null references public.activities (id),
  user_id uuid not null references public.profiles (id),
  group_id uuid references public.groups (id),
  status public.completion_status not null,
  proof_path text,
  lat numeric(9, 6),
  lng numeric(9, 6),
  distance_m integer,
  is_flagged boolean not null default false,
  submitted_at timestamptz not null default now(),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  local_date date
);

-- Satu baris aktif (menunggu atau disetujui) per misi per warga; yang ditolak tetap tersimpan.
create unique index mission_completions_active_once_idx on public.mission_completions (mission_id, user_id)
  where status in ('pending_review', 'approved');
create index mission_completions_participation_idx on public.mission_completions (participation_id, status);
create index mission_completions_review_idx on public.mission_completions (activity_id, status) where status = 'pending_review';
create index mission_completions_user_idx on public.mission_completions (user_id, status);

create table public.mission_code_attempts (
  id bigint generated always as identity primary key,
  mission_id uuid not null references public.activity_missions (id),
  user_id uuid not null references public.profiles (id),
  attempted_at timestamptz not null default now()
);

create index mission_code_attempts_idx on public.mission_code_attempts (mission_id, user_id, attempted_at);

-- FK yang ditunda sejak irisan 1 dan 4
alter table public.xp_ledger
  add constraint xp_ledger_mission_completion_id_fkey foreign key (mission_completion_id) references public.mission_completions (id);
alter table public.fraud_flags
  add constraint fraud_flags_mission_completion_id_fkey foreign key (mission_completion_id) references public.mission_completions (id);

-- -----------------------------------------------------------------------------
-- Trigger penjaga misi
-- -----------------------------------------------------------------------------

create function public.check_mission_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a public.activities;
  v_cp public.activity_checkpoints;
  v_prev public.activity_missions;
  v_walk uuid;
  v_steps integer := 0;
  v_total integer;
begin
  select * into v_a from public.activities where id = new.activity_id;
  if new.xp_reward < public.setting_int('mission.xp_min') or new.xp_reward > public.setting_int('mission.xp_max') then
    raise exception 'invalid_mission_xp';
  end if;
  if not exists (select 1 from public.activity_partners ap where ap.activity_id = new.activity_id and ap.organizer_id = new.partner_organizer_id and ap.status = 'accepted') then
    raise exception 'mission_partner_not_accepted';
  end if;
  if new.verification = 'qr_scan' then
    if new.checkpoint_id is null then
      raise exception 'mission_checkpoint_required';
    end if;
    select * into v_cp from public.activity_checkpoints where id = new.checkpoint_id;
    if v_cp.activity_id <> new.activity_id or v_cp.partner_organizer_id <> new.partner_organizer_id then
      raise exception 'mission_checkpoint_not_owned';
    end if;
  else
    new.checkpoint_id := null;
  end if;
  if new.verification = 'secret_code' and new.code_hash is null then
    raise exception 'mission_code_required';
  end if;
  if new.verification <> 'secret_code' then
    new.code_hash := null;
  end if;
  if new.reveal_mode = 'scheduled' and new.reveal_at is null then
    raise exception 'mission_reveal_at_required';
  end if;
  if new.reveal_mode = 'after_mission' then
    if new.prerequisite_mission_id is null or new.prerequisite_mission_id = new.id then
      raise exception 'mission_prerequisite_required';
    end if;
    select * into v_prev from public.activity_missions where id = new.prerequisite_mission_id;
    if v_prev.activity_id <> new.activity_id then
      raise exception 'mission_prerequisite_other_activity';
    end if;
    if new.is_required and not v_prev.is_required then
      raise exception 'mission_prerequisite_must_be_required';
    end if;
    -- tidak boleh berputar
    v_walk := new.prerequisite_mission_id;
    while v_walk is not null loop
      if v_walk = new.id then
        raise exception 'mission_prerequisite_cycle';
      end if;
      select prerequisite_mission_id into v_walk from public.activity_missions where id = v_walk;
      v_steps := v_steps + 1;
      exit when v_steps > 50;
    end loop;
    new.revealed_at := null;
  else
    new.prerequisite_mission_id := null;
  end if;
  if new.available_from is not null and new.available_until is not null and new.available_from >= new.available_until then
    raise exception 'invalid_mission_window';
  end if;
  if new.reveal_mode = 'on_publish' and new.revealed_at is null and v_a.status in ('published', 'running', 'ended', 'settled') then
    new.revealed_at := now();
  end if;

  if tg_op = 'UPDATE' then
    if old.locked_at is not null and (new.verification <> old.verification or new.xp_reward <> old.xp_reward
       or new.is_required <> old.is_required or new.checkpoint_id is distinct from old.checkpoint_id) then
      raise exception 'mission_locked';
    end if;
    if old.revealed_at is not null and new.revealed_at is null then
      raise exception 'mission_cannot_hide';
    end if;
    if new.activity_id <> old.activity_id then
      raise exception 'mission_activity_immutable';
    end if;
  end if;

  select coalesce(sum(m.xp_reward), 0) into v_total from public.activity_missions m
  where m.activity_id = new.activity_id and m.is_active and m.id <> new.id;
  if new.is_active and v_total + new.xp_reward > public.setting_int('mission.max_total_xp') then
    raise exception 'mission_total_xp_exceeded';
  end if;
  return new;
end;
$$;

create trigger activity_missions_check_row
  before insert or update on public.activity_missions
  for each row execute function public.check_mission_row();

-- Saat aktivitas terbit, misi on_publish terbuka.
create function public.reveal_missions_on_publish()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status in ('published', 'running') and old.status not in ('published', 'running', 'ended', 'settled') then
    update public.activity_missions set revealed_at = now()
    where activity_id = new.id and reveal_mode = 'on_publish' and revealed_at is null;
  end if;
  return null;
end;
$$;

create trigger activities_reveal_missions
  after update of status on public.activities
  for each row execute function public.reveal_missions_on_publish();

-- Challenge bertarget misi harus punya misi aktif sebelum diajukan.
create function public.check_mission_targets_on_submit()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_kind public.target_kind;
begin
  if new.type = 'challenge' and old.status in ('draft', 'awaiting_partners') and new.status in ('awaiting_partners', 'in_review', 'published') then
    select kind into v_kind from public.challenge_targets where activity_id = new.id;
    if v_kind in ('required_missions', 'missions_completed')
       and not exists (select 1 from public.activity_missions m where m.activity_id = new.id and m.is_active) then
      raise exception 'mission_required';
    end if;
    if v_kind = 'required_missions'
       and not exists (select 1 from public.activity_missions m where m.activity_id = new.id and m.is_active and m.is_required) then
      raise exception 'required_mission_required';
    end if;
  end if;
  return new;
end;
$$;

create trigger activities_check_mission_targets
  before update of status on public.activities
  for each row execute function public.check_mission_targets_on_submit();

-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------

-- Boleh mengelola misi atas nama partner tertentu: tim host (admin untuk Ramein)
-- atau tim partner yang sudah accepted.
create function public.can_manage_missions(p_activity_id uuid, p_partner_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_activity_host_team(p_activity_id)
    or (public.is_team_member(p_partner_organizer_id) and exists (
      select 1 from public.activity_partners ap
      where ap.activity_id = p_activity_id and ap.organizer_id = p_partner_organizer_id and ap.status = 'accepted'));
$$;

-- Misi sudah terbuka untuk warga tertentu?
create function public.mission_open_for(p_mission_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select m.is_active and (
    m.revealed_at is not null
    or (m.reveal_mode = 'after_mission' and exists (
      select 1 from public.mission_completions mc
      where mc.mission_id = m.prerequisite_mission_id and mc.user_id = p_user_id and mc.status = 'approved'))
  )
  from public.activity_missions m where m.id = p_mission_id;
$$;

grant execute on function public.mission_open_for(uuid, uuid) to authenticated;

-- Progress misi untuk challenge bertarget misi.
create function public.mission_progress(p_activity_id uuid, p_kind public.target_kind, p_participation_id uuid default null, p_group_id uuid default null)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_kind = 'required_missions' then (
      select count(*) from public.mission_completions mc
      join public.activity_missions m on m.id = mc.mission_id
      where mc.participation_id = p_participation_id and mc.status = 'approved' and m.is_required and m.is_active)
    else (
      select count(*) from public.mission_completions mc
      where mc.activity_id = p_activity_id and mc.status = 'approved'
        and (p_participation_id is null or mc.participation_id = p_participation_id)
        and (p_group_id is null or mc.group_id = p_group_id))
  end::integer;
$$;

revoke execute on function public.mission_progress(uuid, public.target_kind, uuid, uuid) from public, anon;
grant execute on function public.mission_progress(uuid, public.target_kind, uuid, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Syarat selesai terpusat (ALUR bagian 9d)
-- -----------------------------------------------------------------------------

create function public.evaluate_completion(p_participation_id uuid, p_preferred_organizer_id uuid default null, p_checkin_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.participations;
  v_a public.activities;
  v_target public.challenge_targets;
  v_has_checkin boolean;
  v_req_total integer := 0;
  v_req_done integer := 0;
  v_progress integer := 0;
  v_target_count integer := 1;
  v_done boolean := false;
  v_xp integer := 0;
  v_points integer := 0;
  v_pref uuid;
begin
  select * into v_p from public.participations where id = p_participation_id for update;
  if not found then
    raise exception 'invalid_participation';
  end if;
  select * into v_a from public.activities where id = v_p.activity_id;
  if v_p.status = 'completed' then
    return jsonb_build_object('completed', true, 'newly_completed', false, 'xp', 0, 'points', 0, 'progress', v_p.progress, 'target_count', 1);
  end if;
  if v_p.status not in ('registered', 'in_progress') then
    return jsonb_build_object('completed', false, 'newly_completed', false, 'xp', 0, 'points', 0, 'progress', v_p.progress, 'target_count', 1);
  end if;

  v_has_checkin := exists (select 1 from public.checkins c where c.participation_id = v_p.id and c.review_status <> 'rejected');
  select count(*), count(*) filter (where exists (
      select 1 from public.mission_completions mc where mc.mission_id = m.id and mc.user_id = v_p.user_id and mc.status = 'approved'))
  into v_req_total, v_req_done
  from public.activity_missions m
  where m.activity_id = v_a.id and m.is_active and m.is_required and public.mission_open_for(m.id, v_p.user_id);

  if v_a.type = 'event' then
    v_done := v_has_checkin and v_req_done = v_req_total;
    v_progress := case when v_done then 1 else 0 end;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    v_target_count := coalesce(v_target.target_count, 1);
    if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
      v_progress := public.checkin_progress(v_a.id, v_target.kind, v_p.id, null);
      v_done := case when v_a.target_scope = 'group'
        then public.checkin_progress(v_a.id, v_target.kind, null, v_p.group_id) >= v_target_count
        else v_progress >= v_target_count end;
    elsif v_target.kind = 'required_missions' then
      v_progress := v_req_done;
      v_target_count := greatest(v_req_total, 1);
      v_done := v_req_total > 0 and v_req_done = v_req_total;
    else
      v_progress := public.mission_progress(v_a.id, v_target.kind, v_p.id, null);
      v_done := case when v_a.target_scope = 'group'
        then public.mission_progress(v_a.id, v_target.kind, null, v_p.group_id) >= v_target_count
        else v_progress >= v_target_count end;
    end if;
  end if;

  if v_done then
    update public.participations set status = 'completed', progress = v_progress, completed_at = now() where id = v_p.id;
    if v_a.type = 'challenge' then
      v_xp := public.award_challenge_completion(v_p.user_id, v_a, p_checkin_id);
    end if;
    v_pref := coalesce(p_preferred_organizer_id, v_a.host_organizer_id);
    v_points := public.grant_completion_points(v_p.user_id, v_a, v_pref);
  elsif v_has_checkin or v_progress > 0 then
    update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
  end if;

  return jsonb_build_object('completed', v_done, 'newly_completed', v_done, 'xp', v_xp, 'points', v_points,
    'progress', v_progress, 'target_count', v_target_count, 'required_total', v_req_total, 'required_done', v_req_done);
end;
$$;

revoke execute on function public.evaluate_completion(uuid, uuid, uuid) from public, anon, authenticated;

-- Setelah misi disetujui: XP, kunci misi, evaluasi selesai (termasuk anggota grup).
create function public.apply_mission_approval(p_completion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.mission_completions;
  v_m public.activity_missions;
  v_a public.activities;
  v_xp integer;
  v_eval jsonb;
  v_row record;
begin
  select * into v_c from public.mission_completions where id = p_completion_id;
  select * into v_m from public.activity_missions where id = v_c.mission_id;
  select * into v_a from public.activities where id = v_c.activity_id;
  v_xp := public.award_xp(v_c.user_id, v_m.xp_reward, 'mission_complete', v_a.id, null, v_c.id, 'Misi: ' || v_m.title);
  update public.mission_completions set local_date = public.local_today() where id = v_c.id;
  update public.activity_missions set locked_at = coalesce(locked_at, now()) where id = v_m.id;
  v_eval := public.evaluate_completion(v_c.participation_id, v_m.partner_organizer_id, null);
  -- Challenge grup bertarget misi: anggota lain ikut selesai saat target grup tercapai
  if (v_eval ->> 'completed')::boolean and v_a.target_scope = 'group' and v_c.group_id is not null then
    for v_row in
      select p.id from public.participations p
      where p.activity_id = v_a.id and p.group_id = v_c.group_id and p.status in ('registered', 'in_progress')
        and exists (select 1 from public.checkins c where c.participation_id = p.id and c.review_status <> 'rejected')
    loop
      perform public.evaluate_completion(v_row.id, v_m.partner_organizer_id, null);
    end loop;
  end if;
  return v_eval || jsonb_build_object('mission_xp', v_xp, 'mission_title', v_m.title);
end;
$$;

revoke execute on function public.apply_mission_approval(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Kelola misi (tim penyelenggara)
-- -----------------------------------------------------------------------------

create function public.upsert_mission(p_activity_id uuid, p_mission jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_id uuid := nullif(p_mission ->> 'id', '')::uuid;
  v_partner uuid;
  v_old public.activity_missions;
  v_code text := nullif(btrim(coalesce(p_mission ->> 'code', '')), '');
  v_verification public.mission_verification := (p_mission ->> 'verification')::public.mission_verification;
  v_reveal public.mission_reveal := coalesce(nullif(p_mission ->> 'reveal_mode', ''), 'on_publish')::public.mission_reveal;
begin
  select * into v_a from public.activities where id = p_activity_id;
  if not found then
    raise exception 'invalid_activity';
  end if;
  if v_a.status in ('ended', 'settled', 'cancelled') then
    raise exception 'activity_locked';
  end if;
  if v_id is not null then
    select * into v_old from public.activity_missions where id = v_id and activity_id = p_activity_id;
    if not found then
      raise exception 'invalid_mission';
    end if;
    v_partner := v_old.partner_organizer_id;
  else
    v_partner := coalesce(nullif(p_mission ->> 'partner_organizer_id', '')::uuid, v_a.host_organizer_id);
  end if;
  if not public.can_manage_missions(p_activity_id, v_partner) then
    raise exception 'not_allowed';
  end if;
  -- Partner (bukan host) hanya boleh misi qr_scan di checkpoint miliknya
  if v_partner <> v_a.host_organizer_id and not public.is_activity_host_team(p_activity_id) and v_verification <> 'qr_scan' then
    raise exception 'partner_qr_only';
  end if;
  if v_verification = 'secret_code' and v_code is not null and char_length(v_code) < 3 then
    raise exception 'invalid_code';
  end if;

  if v_id is null then
    if v_verification = 'secret_code' and v_code is null then
      raise exception 'mission_code_required';
    end if;
    insert into public.activity_missions (activity_id, partner_organizer_id, title, description, icon, sort_order, verification, checkpoint_id, code_hash,
      xp_reward, is_required, available_from, available_until, reveal_mode, reveal_at, prerequisite_mission_id, show_teaser, created_by)
    values (p_activity_id, v_partner, btrim(p_mission ->> 'title'), nullif(btrim(coalesce(p_mission ->> 'description', '')), ''), nullif(p_mission ->> 'icon', ''),
      coalesce((p_mission ->> 'sort_order')::smallint, (select coalesce(max(sort_order), 0) + 1 from public.activity_missions where activity_id = p_activity_id)),
      v_verification, nullif(p_mission ->> 'checkpoint_id', '')::uuid,
      case when v_verification = 'secret_code' then extensions.crypt(lower(v_code), extensions.gen_salt('bf')) end,
      (p_mission ->> 'xp_reward')::integer, coalesce((p_mission ->> 'is_required')::boolean, true),
      nullif(p_mission ->> 'available_from', '')::timestamptz, nullif(p_mission ->> 'available_until', '')::timestamptz,
      v_reveal, nullif(p_mission ->> 'reveal_at', '')::timestamptz, nullif(p_mission ->> 'prerequisite_mission_id', '')::uuid,
      coalesce((p_mission ->> 'show_teaser')::boolean, true), v_uid)
    returning id into v_id;
  else
    update public.activity_missions set
      title = coalesce(btrim(p_mission ->> 'title'), title),
      description = case when p_mission ? 'description' then nullif(btrim(p_mission ->> 'description'), '') else description end,
      icon = case when p_mission ? 'icon' then nullif(p_mission ->> 'icon', '') else icon end,
      sort_order = coalesce((p_mission ->> 'sort_order')::smallint, sort_order),
      verification = coalesce(v_verification, verification),
      checkpoint_id = case when p_mission ? 'checkpoint_id' then nullif(p_mission ->> 'checkpoint_id', '')::uuid else checkpoint_id end,
      code_hash = case when v_code is not null then extensions.crypt(lower(v_code), extensions.gen_salt('bf')) else code_hash end,
      xp_reward = coalesce((p_mission ->> 'xp_reward')::integer, xp_reward),
      is_required = coalesce((p_mission ->> 'is_required')::boolean, is_required),
      available_from = case when p_mission ? 'available_from' then nullif(p_mission ->> 'available_from', '')::timestamptz else available_from end,
      available_until = case when p_mission ? 'available_until' then nullif(p_mission ->> 'available_until', '')::timestamptz else available_until end,
      reveal_mode = case when p_mission ? 'reveal_mode' and revealed_at is null then v_reveal else reveal_mode end,
      reveal_at = case when p_mission ? 'reveal_at' then nullif(p_mission ->> 'reveal_at', '')::timestamptz else reveal_at end,
      prerequisite_mission_id = case when p_mission ? 'prerequisite_mission_id' then nullif(p_mission ->> 'prerequisite_mission_id', '')::uuid else prerequisite_mission_id end,
      show_teaser = coalesce((p_mission ->> 'show_teaser')::boolean, show_teaser)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create function public.set_mission_active(p_mission_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.activity_missions;
begin
  perform public.active_uid();
  select * into v_m from public.activity_missions where id = p_mission_id;
  if not found or not public.can_manage_missions(v_m.activity_id, v_m.partner_organizer_id) then
    raise exception 'not_allowed';
  end if;
  update public.activity_missions set is_active = p_active where id = p_mission_id;
end;
$$;

-- Buka misi manual untuk semua peserta + notifikasi. Tidak bisa dibatalkan.
create function public.reveal_mission(p_mission_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m public.activity_missions;
  v_a public.activities;
  v_row record;
  v_n integer := 0;
begin
  perform public.active_uid();
  select * into v_m from public.activity_missions where id = p_mission_id;
  if not found or not public.can_manage_missions(v_m.activity_id, v_m.partner_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_m.reveal_mode not in ('manual', 'scheduled') then
    raise exception 'mission_not_manual';
  end if;
  if v_m.revealed_at is not null then
    raise exception 'mission_already_revealed';
  end if;
  select * into v_a from public.activities where id = v_m.activity_id;
  if v_a.status not in ('published', 'running') then
    raise exception 'activity_not_live';
  end if;
  update public.activity_missions set revealed_at = now() where id = p_mission_id;
  for v_row in
    select p.user_id from public.participations p where p.activity_id = v_m.activity_id and p.status in ('registered', 'in_progress')
  loop
    perform public.notify(v_row.user_id, 'mission_revealed', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

-- Token QR misi menit berjalan untuk tim pembuat misi.
create function public.get_mission_qr(p_mission_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_m public.activity_missions;
  v_a public.activities;
  v_slot bigint := public.qr_slot();
  v_rotate integer := public.setting_int('checkin.qr_rotate_seconds');
begin
  perform public.active_uid();
  select * into v_m from public.activity_missions where id = p_mission_id;
  if not found or v_m.verification <> 'qr_scan' then
    raise exception 'invalid_mission';
  end if;
  if not (public.is_team_member(v_m.partner_organizer_id) or (public.is_activity_host_team(v_m.activity_id)
      and exists (select 1 from public.organizers o where o.id = v_m.partner_organizer_id and o.type = 'platform'))) then
    raise exception 'not_allowed';
  end if;
  select * into v_a from public.activities where id = v_m.activity_id;
  return jsonb_build_object(
    'mission_id', v_m.id,
    'token', public.qr_token(v_m.qr_secret, v_m.id, v_slot),
    'expires_in', v_rotate - (extract(epoch from now())::bigint % v_rotate),
    'rotate_seconds', v_rotate,
    'mission_title', v_m.title,
    'activity_title', v_a.title,
    'revealed', v_m.revealed_at is not null or v_m.reveal_mode = 'after_mission'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- Daftar misi dari sudut pandang warga
-- -----------------------------------------------------------------------------

create function public.get_activity_missions(p_activity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.activities;
  v_p public.participations;
  v_m public.activity_missions;
  v_prev public.activity_missions;
  v_items jsonb := '[]'::jsonb;
  v_my record;
  v_req_total integer := 0;
  v_req_done integer := 0;
  v_can_work boolean;
  v_hint text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_a from public.activities where id = p_activity_id;
  if not found then
    raise exception 'invalid_activity';
  end if;
  select * into v_p from public.participations where activity_id = p_activity_id and user_id = v_uid;
  v_can_work := v_a.status = 'running' and v_p.id is not null and v_p.status in ('registered', 'in_progress')
    and v_p.payment_status in ('not_required', 'paid');

  for v_m in select * from public.activity_missions where activity_id = p_activity_id and is_active order by sort_order, created_at loop
    if public.mission_open_for(v_m.id, v_uid) then
      select status, review_note, submitted_at into v_my from public.mission_completions
      where mission_id = v_m.id and user_id = v_uid order by submitted_at desc limit 1;
      if v_m.is_required then
        v_req_total := v_req_total + 1;
        if v_my.status = 'approved' then v_req_done := v_req_done + 1; end if;
      end if;
      v_items := v_items || jsonb_build_object(
        'id', v_m.id, 'open', true, 'title', v_m.title, 'description', v_m.description, 'icon', v_m.icon,
        'verification', v_m.verification, 'xp_reward', v_m.xp_reward, 'is_required', v_m.is_required,
        'available_from', v_m.available_from, 'available_until', v_m.available_until,
        'checkpoint_name', (select name from public.activity_checkpoints where id = v_m.checkpoint_id),
        'partner_name', (select name from public.organizers where id = v_m.partner_organizer_id),
        'my_status', v_my.status, 'my_note', v_my.review_note, 'my_submitted_at', v_my.submitted_at,
        'can_work', v_can_work and coalesce(v_my.status, 'rejected') = 'rejected' and v_m.verification <> 'manual'
          and (v_m.available_from is null or v_m.available_from <= now()) and (v_m.available_until is null or v_m.available_until > now()));
    elsif v_m.show_teaser then
      if v_m.reveal_mode = 'scheduled' then
        v_hint := 'Terbuka ' || to_char(v_m.reveal_at at time zone 'Asia/Jakarta', 'DD Mon HH24.MI');
      elsif v_m.reveal_mode = 'after_mission' then
        select * into v_prev from public.activity_missions where id = v_m.prerequisite_mission_id;
        v_hint := case when public.mission_open_for(v_prev.id, v_uid) then 'Selesaikan "' || v_prev.title || '" untuk membuka' else 'Terbuka setelah misi sebelumnya selesai' end;
      else
        v_hint := 'Dibuka panitia saat acara';
      end if;
      v_items := v_items || jsonb_build_object('id', v_m.id, 'open', false, 'xp_reward', v_m.xp_reward, 'is_required', v_m.is_required, 'hint', v_hint);
    end if;
  end loop;

  return jsonb_build_object('missions', v_items, 'required_total', v_req_total, 'required_done', v_req_done, 'can_work', v_can_work,
    'participation_status', v_p.status, 'payment_status', v_p.payment_status);
end;
$$;

-- -----------------------------------------------------------------------------
-- Warga mengerjakan misi
-- -----------------------------------------------------------------------------

create function public.complete_mission(p_mission_id uuid, p_token text default null, p_code text default null, p_proof_path text default null, p_lat numeric default null, p_lng numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_m public.activity_missions;
  v_a public.activities;
  v_p public.participations;
  v_cp public.activity_checkpoints;
  v_slot bigint := public.qr_slot();
  v_distance integer;
  v_flagged boolean := false;
  v_attempts integer;
  v_id uuid;
  v_eval jsonb;
begin
  select * into v_m from public.activity_missions where id = p_mission_id;
  if not found or not v_m.is_active then
    raise exception 'invalid_mission';
  end if;
  select * into v_a from public.activities where id = v_m.activity_id for update;
  if v_a.status = 'published' and v_a.starts_at <= now() and v_a.ends_at > now() then
    update public.activities set status = 'running' where id = v_a.id;
    v_a.status := 'running';
  end if;
  if v_a.status <> 'running' then
    raise exception 'activity_not_running';
  end if;
  select * into v_p from public.participations where activity_id = v_a.id and user_id = v_uid for update;
  if not found or v_p.status not in ('registered', 'in_progress') then
    raise exception 'not_registered';
  end if;
  if v_p.payment_status not in ('not_required', 'paid') then
    raise exception 'payment_required';
  end if;
  if not public.mission_open_for(v_m.id, v_uid) then
    raise exception 'mission_not_revealed';
  end if;
  if (v_m.available_from is not null and v_m.available_from > now()) or (v_m.available_until is not null and v_m.available_until <= now()) then
    raise exception 'mission_closed';
  end if;
  if exists (select 1 from public.mission_completions where mission_id = v_m.id and user_id = v_uid and status in ('approved', 'pending_review')) then
    raise exception 'mission_already_done';
  end if;

  if v_m.verification = 'qr_scan' then
    if p_token is null or p_token not in (public.qr_token(v_m.qr_secret, v_m.id, v_slot), public.qr_token(v_m.qr_secret, v_m.id, v_slot - 1)) then
      raise exception 'invalid_token';
    end if;
    select * into v_cp from public.activity_checkpoints where id = v_m.checkpoint_id;
    if p_lat is not null and p_lng is not null then
      v_distance := public.distance_m(p_lat, p_lng, v_cp.lat, v_cp.lng);
      v_flagged := v_distance > v_cp.radius_m;
    else
      v_flagged := true;
    end if;
    insert into public.mission_completions (mission_id, participation_id, activity_id, user_id, group_id, status, lat, lng, distance_m, is_flagged)
    values (v_m.id, v_p.id, v_a.id, v_uid, v_p.group_id, 'approved', p_lat, p_lng, v_distance, v_flagged)
    returning id into v_id;
    if v_flagged then
      insert into public.fraud_flags (user_id, mission_completion_id, kind, detail)
      values (v_uid, v_id, 'out_of_radius', jsonb_build_object('distance_m', v_distance, 'radius_m', v_cp.radius_m, 'has_location', p_lat is not null, 'mission', true));
    end if;
  elsif v_m.verification = 'secret_code' then
    select count(*) into v_attempts from public.mission_code_attempts
    where mission_id = v_m.id and user_id = v_uid and attempted_at > now() - make_interval(mins => public.setting_int('mission.code_window_minutes'));
    if v_attempts >= public.setting_int('mission.code_max_attempts') then
      raise exception 'too_many_attempts';
    end if;
    if p_code is null or extensions.crypt(lower(btrim(p_code)), v_m.code_hash) <> v_m.code_hash then
      -- Dicatat lalu dikembalikan sebagai hasil (bukan exception) supaya log percobaan tersimpan.
      insert into public.mission_code_attempts (mission_id, user_id) values (v_m.id, v_uid);
      return jsonb_build_object('status', 'wrong_code', 'attempts_left', public.setting_int('mission.code_max_attempts') - v_attempts - 1,
        'mission_title', v_m.title, 'completed', false, 'xp', 0);
    end if;
    insert into public.mission_completions (mission_id, participation_id, activity_id, user_id, group_id, status)
    values (v_m.id, v_p.id, v_a.id, v_uid, v_p.group_id, 'approved')
    returning id into v_id;
  elsif v_m.verification = 'photo' then
    if p_proof_path is null or p_proof_path not like v_a.id::text || '/' || v_uid::text || '/%' then
      raise exception 'proof_required';
    end if;
    insert into public.mission_completions (mission_id, participation_id, activity_id, user_id, group_id, status, proof_path)
    values (v_m.id, v_p.id, v_a.id, v_uid, v_p.group_id, 'pending_review', p_proof_path)
    returning id into v_id;
    perform public.notify_team(v_m.partner_organizer_id, 'mission_proof_submitted',
      jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'mission_id', v_m.id));
    return jsonb_build_object('completion_id', v_id, 'status', 'pending_review', 'mission_title', v_m.title, 'xp', 0, 'completed', false);
  else
    raise exception 'manual_only';
  end if;

  v_eval := public.apply_mission_approval(v_id);
  return v_eval || jsonb_build_object('completion_id', v_id, 'status', 'approved', 'flagged', v_flagged, 'distance_m', v_distance,
    'activity_id', v_a.id, 'activity_title', v_a.title, 'activity_type', v_a.type, 'target_scope', v_a.target_scope,
    'points_balance', public.points_balance(v_uid),
    'total_xp', (select coalesce(sum(amount), 0) from public.xp_ledger where user_id = v_uid));
end;
$$;

-- Tim meninjau bukti foto.
create function public.review_mission_completion(p_completion_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_c public.mission_completions;
  v_m public.activity_missions;
  v_a public.activities;
  v_eval jsonb := '{}'::jsonb;
begin
  select * into v_c from public.mission_completions where id = p_completion_id for update;
  if not found then
    raise exception 'invalid_completion';
  end if;
  select * into v_m from public.activity_missions where id = v_c.mission_id;
  if not (public.is_activity_host_team(v_c.activity_id) or public.is_team_member(v_m.partner_organizer_id)) then
    raise exception 'not_allowed';
  end if;
  if v_c.status <> 'pending_review' then
    raise exception 'completion_not_pending';
  end if;
  select * into v_a from public.activities where id = v_c.activity_id;
  if v_a.status = 'settled' or v_a.status = 'cancelled' then
    raise exception 'activity_locked';
  end if;
  if not p_approve and nullif(btrim(p_note), '') is null then
    raise exception 'note_required';
  end if;
  update public.mission_completions
  set status = case when p_approve then 'approved'::public.completion_status else 'rejected'::public.completion_status end,
      reviewed_by = v_uid, reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = p_completion_id;
  if p_approve then
    v_eval := public.apply_mission_approval(p_completion_id);
    perform public.notify(v_c.user_id, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward,
      'completed', (v_eval ->> 'completed')::boolean));
  else
    perform public.notify(v_c.user_id, 'mission_rejected', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'note', nullif(btrim(p_note), '')));
  end if;
  return v_eval || jsonb_build_object('approved', p_approve);
end;
$$;

-- Tim menandai peserta untuk misi manual.
create function public.mark_missions_manual(p_mission_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_m public.activity_missions;
  v_a public.activities;
  v_p public.participations;
  v_u uuid;
  v_id uuid;
  v_n integer := 0;
begin
  select * into v_m from public.activity_missions where id = p_mission_id;
  if not found or v_m.verification <> 'manual' or not v_m.is_active then
    raise exception 'invalid_mission';
  end if;
  if not (public.is_activity_host_team(v_m.activity_id) or public.is_team_member(v_m.partner_organizer_id)) then
    raise exception 'not_allowed';
  end if;
  select * into v_a from public.activities where id = v_m.activity_id;
  if v_a.status not in ('running', 'ended') then
    raise exception 'activity_not_running';
  end if;
  if v_m.revealed_at is null and v_m.reveal_mode <> 'after_mission' then
    raise exception 'mission_not_revealed';
  end if;
  foreach v_u in array p_user_ids loop
    select * into v_p from public.participations where activity_id = v_a.id and user_id = v_u;
    if not found or v_p.status not in ('registered', 'in_progress') or v_p.payment_status not in ('not_required', 'paid') then
      continue;
    end if;
    if not public.mission_open_for(v_m.id, v_u) then
      continue;
    end if;
    if exists (select 1 from public.mission_completions where mission_id = v_m.id and user_id = v_u and status in ('approved', 'pending_review')) then
      continue;
    end if;
    insert into public.mission_completions (mission_id, participation_id, activity_id, user_id, group_id, status, reviewed_by, reviewed_at)
    values (v_m.id, v_p.id, v_a.id, v_u, v_p.group_id, 'approved', v_uid, now())
    returning id into v_id;
    perform public.apply_mission_approval(v_id);
    perform public.notify(v_u, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

grant execute on function
  public.upsert_mission(uuid, jsonb), public.set_mission_active(uuid, boolean), public.reveal_mission(uuid),
  public.get_mission_qr(uuid), public.get_activity_missions(uuid),
  public.complete_mission(uuid, text, text, text, numeric, numeric),
  public.review_mission_completion(uuid, boolean, text), public.mark_missions_manual(uuid, uuid[])
to authenticated;

-- -----------------------------------------------------------------------------
-- perform_checkin: syarat selesai event lewat evaluate_completion
-- -----------------------------------------------------------------------------

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
  v_points integer := 0;
  v_partner_count integer;
  v_completed boolean := false;
  v_progress integer := 0;
  v_group_progress integer;
  v_target_count integer;
  v_total_xp integer;
  v_present integer;
  v_eval jsonb := '{}'::jsonb;
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

  if v_a.type = 'event' then
    v_base := public.award_xp(v_uid, v_a.xp_base, 'event_checkin', v_a.id, v_checkin_id, null, 'Check-in ' || v_a.title);
  end if;

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
    -- Selesai jika semua misi wajib yang terbuka sudah disetujui (ALUR 9d)
    v_eval := public.evaluate_completion(v_p.id, v_cp.partner_organizer_id, v_checkin_id);
    v_completed := (v_eval ->> 'completed')::boolean;
    v_progress := (v_eval ->> 'progress')::integer;
    v_target_count := 1;
    v_points := (v_eval ->> 'points')::integer;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    v_target_count := coalesce(v_target.target_count, 1);
    v_progress := case when v_target.kind in ('total_checkins', 'distinct_checkpoints')
      then public.checkin_progress(v_a.id, v_target.kind, v_p.id, null) else v_p.progress end;

    if v_a.target_scope = 'individual' then
      if v_target.kind in ('total_checkins', 'distinct_checkpoints') and v_progress >= v_target_count then
        update public.participations set status = 'completed', progress = v_progress, completed_at = now() where id = v_p.id;
        v_base := public.award_challenge_completion(v_uid, v_a, v_checkin_id);
        v_points := public.grant_completion_points(v_uid, v_a, v_cp.partner_organizer_id);
        v_completed := true;
      else
        update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
      end if;
    else
      update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
      if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
        v_group_progress := public.checkin_progress(v_a.id, v_target.kind, null, v_p.group_id);
        if v_group_progress >= v_target_count then
          for v_row in
            select p.id, p.user_id from public.participations p
            where p.activity_id = v_a.id and p.group_id = v_p.group_id and p.status = 'in_progress'
              and exists (select 1 from public.checkins c where c.participation_id = p.id and c.review_status <> 'rejected')
          loop
            update public.participations set status = 'completed', completed_at = now() where id = v_row.id;
            if v_row.user_id = v_uid then
              v_base := public.award_challenge_completion(v_uid, v_a, v_checkin_id);
              v_points := public.grant_completion_points(v_uid, v_a, v_cp.partner_organizer_id);
              v_completed := true;
            else
              perform public.award_challenge_completion(v_row.user_id, v_a, null);
              perform public.grant_completion_points(v_row.user_id, v_a, v_cp.partner_organizer_id);
            end if;
          end loop;
        end if;
      else
        v_group_progress := public.mission_progress(v_a.id, v_target.kind, null, v_p.group_id);
      end if;
    end if;
  end if;

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
    'required_total', coalesce((v_eval ->> 'required_total')::integer, 0),
    'required_done', coalesce((v_eval ->> 'required_done')::integer, 0),
    'xp_base', v_base,
    'xp_first_visit', v_first,
    'xp_collab', v_collab,
    'xp_group', v_group,
    'xp_total', v_base + v_first + v_collab + v_group,
    'points', v_points,
    'points_balance', public.points_balance(v_uid),
    'total_xp', v_total_xp
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

-- Status misi per partisipasi (untuk warga pemilik dan tim).
create view public.v_participation_missions
with (security_invoker = true)
as
select
  p.id as participation_id, p.activity_id, p.user_id, m.id as mission_id, m.title, m.is_required, m.xp_reward, m.verification,
  public.mission_open_for(m.id, p.user_id) as is_revealed,
  (select mc.status from public.mission_completions mc where mc.mission_id = m.id and mc.user_id = p.user_id order by mc.submitted_at desc limit 1) as status,
  (select count(*) from public.activity_missions r where r.activity_id = p.activity_id and r.is_active and r.is_required and public.mission_open_for(r.id, p.user_id)
     and exists (select 1 from public.mission_completions mc where mc.mission_id = r.id and mc.user_id = p.user_id and mc.status = 'approved'))::integer as required_done,
  (select count(*) from public.activity_missions r where r.activity_id = p.activity_id and r.is_active and r.is_required and public.mission_open_for(r.id, p.user_id))::integer as required_total
from public.participations p
join public.activity_missions m on m.activity_id = p.activity_id and m.is_active
where p.user_id = auth.uid() or public.is_activity_team(p.activity_id) or (select public.is_admin());

grant select on public.v_participation_missions to authenticated;

-- Statistik per misi untuk tim.
create view public.v_mission_stats
with (security_invoker = true)
as
select
  m.id as mission_id, m.activity_id,
  (select count(*) from public.mission_completions mc where mc.mission_id = m.id and mc.status = 'approved')::integer as approved,
  (select count(*) from public.mission_completions mc where mc.mission_id = m.id and mc.status = 'pending_review')::integer as pending,
  (select count(*) from public.mission_completions mc where mc.mission_id = m.id and mc.status = 'rejected')::integer as rejected,
  (select count(*) from public.mission_completions mc where mc.mission_id = m.id and mc.status = 'approved' and mc.is_flagged)::integer as flagged,
  (select count(*) from public.participations p where p.activity_id = m.activity_id and p.status in ('registered', 'in_progress', 'completed'))::integer as participants,
  (select count(distinct mc.user_id) from public.mission_completions mc
     join public.activity_missions pr on pr.id = m.prerequisite_mission_id
     where mc.mission_id = pr.id and mc.status = 'approved')::integer as unlocked_for
from public.activity_missions m
where public.is_activity_team(m.activity_id) or (select public.is_admin());

grant select on public.v_mission_stats to authenticated;

-- Bukti foto yang menunggu tinjauan (tim host atau pembuat misi).
create view public.v_mission_review_queue as
select
  mc.id, mc.mission_id, mc.activity_id, mc.user_id, mc.status, mc.proof_path, mc.submitted_at, mc.reviewed_at, mc.review_note,
  m.title as mission_title, m.xp_reward, m.partner_organizer_id, a.title as activity_title,
  pr.nickname::text as nickname, r.name as village_name
from public.mission_completions mc
join public.activity_missions m on m.id = mc.mission_id
join public.activities a on a.id = mc.activity_id
join public.profiles pr on pr.id = mc.user_id
left join public.regions r on r.id = pr.home_village_id
where m.verification = 'photo'
  and (public.is_activity_host_team(mc.activity_id) or public.is_team_member(m.partner_organizer_id) or (select public.is_admin()));

grant select on public.v_mission_review_queue to authenticated;

-- Peserta yang bisa ditandai untuk misi manual (tim).
create view public.v_mission_manual_candidates as
select
  m.id as mission_id, p.activity_id, p.user_id, pr.nickname::text as nickname, r.name as village_name, p.group_id,
  exists (select 1 from public.mission_completions mc where mc.mission_id = m.id and mc.user_id = p.user_id and mc.status = 'approved') as done
from public.activity_missions m
join public.participations p on p.activity_id = m.activity_id and p.status in ('registered', 'in_progress', 'completed')
  and p.payment_status in ('not_required', 'paid')
join public.profiles pr on pr.id = p.user_id
left join public.regions r on r.id = pr.home_village_id
where m.verification = 'manual'
  and (public.is_activity_host_team(m.activity_id) or public.is_team_member(m.partner_organizer_id) or (select public.is_admin()));

grant select on public.v_mission_manual_candidates to authenticated;

-- Progress grup: ikut misi untuk target berbasis misi.
create or replace view public.v_group_progress as
with base as (
  select
    a.id as activity_id,
    g.id as group_id,
    g.name as group_name,
    t.kind,
    t.target_count,
    case when t.kind in ('total_checkins', 'distinct_checkpoints')
      then public.checkin_progress(a.id, t.kind, null, g.id)
      else public.mission_progress(a.id, t.kind, null, g.id) end as progress,
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

-- Dashboard: bukti foto menunggu (host atau pembuat misi).
create or replace view public.v_merchant_dashboard as
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
  (select count(*) from public.mission_completions mc join public.activity_missions m on m.id = mc.mission_id join public.activities a on a.id = mc.activity_id
    where mc.status = 'pending_review' and (a.host_organizer_id = o.id or m.partner_organizer_id = o.id))::integer as mission_proofs_pending,
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

create or replace view public.v_community_dashboard as
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
  (select count(*) from public.mission_completions mc join public.activity_missions m on m.id = mc.mission_id join public.activities a on a.id = mc.activity_id
    where mc.status = 'pending_review' and (a.host_organizer_id = o.id or m.partner_organizer_id = o.id))::integer as mission_proofs_pending,
  (select count(*) from public.community_memberships m where m.community_id = o.id and m.status = 'pending')::integer as pending_requests,
  (select count(*) from public.activity_partners ap where ap.organizer_id = o.id and ap.status = 'invited')::integer as partner_invites_pending
from public.organizers o
where o.type = 'community' and (public.is_team_member(o.id) or (select public.is_admin()));

-- -----------------------------------------------------------------------------
-- Cron
-- -----------------------------------------------------------------------------

-- settle: bukti foto yang masih menunggu saat ditutup otomatis ditolak.
create or replace function public.settle_ended_activities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_row record;
begin
  create temp table if not exists settled_now (id uuid primary key) on commit drop;
  insert into settled_now
    select id from public.activities where status = 'ended' and ends_at <= now() - interval '48 hours';
  for v_row in
    select mc.id, mc.user_id, a.title, m.title as mission_title from public.mission_completions mc
    join settled_now s on s.id = mc.activity_id
    join public.activities a on a.id = mc.activity_id
    join public.activity_missions m on m.id = mc.mission_id
    where mc.status = 'pending_review'
  loop
    update public.mission_completions set status = 'rejected', reviewed_at = now(), review_note = 'Aktivitas ditutup sebelum ditinjau' where id = v_row.id;
    perform public.notify(v_row.user_id, 'mission_rejected', jsonb_build_object('title', v_row.title, 'mission_title', v_row.mission_title, 'note', 'Aktivitas ditutup sebelum bukti ditinjau'));
  end loop;
  update public.activities a set status = 'settled' from settled_now s where a.id = s.id;
  update public.participations p set status = 'not_completed'
  from settled_now s
  where p.activity_id = s.id and p.status in ('registered', 'in_progress');
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

create function public.prune_code_attempts()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_n integer;
begin
  delete from public.mission_code_attempts where attempted_at < now() - interval '1 day';
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

-- Misi terjadwal: buka + notifikasi peserta terdaftar.
create function public.reveal_scheduled_missions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_m record;
  v_row record;
  v_n integer := 0;
begin
  for v_m in
    select m.id, m.title, m.xp_reward, m.activity_id, a.title as activity_title
    from public.activity_missions m
    join public.activities a on a.id = m.activity_id
    where m.reveal_mode = 'scheduled' and m.revealed_at is null and m.is_active and m.reveal_at <= now()
      and a.status in ('published', 'running')
  loop
    update public.activity_missions set revealed_at = now() where id = v_m.id;
    for v_row in
      select p.user_id from public.participations p where p.activity_id = v_m.activity_id and p.status in ('registered', 'in_progress')
    loop
      perform public.notify(v_row.user_id, 'mission_revealed', jsonb_build_object('activity_id', v_m.activity_id, 'title', v_m.activity_title, 'mission_title', v_m.title, 'xp', v_m.xp_reward));
    end loop;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.prune_code_attempts(), public.reveal_scheduled_missions(), public.settle_ended_activities() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('prune_code_attempts', '25 17 * * *', $cron$select public.prune_code_attempts()$cron$);
  perform cron.schedule('reveal_scheduled_missions', '* * * * *', $cron$select public.reveal_scheduled_missions()$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal misi dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Bucket bukti foto misi (privat): activity_id/user_id/<file>
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage tidak tersedia, bucket mission-proofs dilewati';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('mission-proofs', 'mission-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;
  execute $p$
    create policy mission_proofs_write_own on storage.objects
      for insert to authenticated
      with check (bucket_id = 'mission-proofs' and (storage.foldername(name))[2] = auth.uid()::text)
  $p$;
  execute $p$
    create policy mission_proofs_read on storage.objects
      for select to authenticated
      using (bucket_id = 'mission-proofs' and (
        (storage.foldername(name))[2] = auth.uid()::text
        or public.is_activity_team((storage.foldername(name))[1]::uuid)
        or (select public.is_admin())))
  $p$;
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

revoke all on table public.activity_missions, public.mission_completions, public.mission_code_attempts from anon, authenticated;
alter table public.activity_missions enable row level security;
alter table public.mission_completions enable row level security;
alter table public.mission_code_attempts enable row level security;

-- qr_secret dan code_hash tidak pernah bisa dibaca client (grant per kolom).
grant select (id, activity_id, partner_organizer_id, title, description, icon, sort_order, verification, checkpoint_id, xp_reward, is_required,
  available_from, available_until, is_active, reveal_mode, reveal_at, prerequisite_mission_id, show_teaser, revealed_at, locked_at, created_by, created_at, updated_at)
  on public.activity_missions to authenticated;
-- Tim aktivitas (termasuk partner accepted) melihat semua misi; warga lewat get_activity_missions.
create policy activity_missions_select_team on public.activity_missions
  for select to authenticated
  using (public.is_activity_team(activity_id) or (select public.is_admin()));

grant select on public.mission_completions to authenticated;
create policy mission_completions_select on public.mission_completions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or public.is_activity_host_team(activity_id)
    or exists (select 1 from public.activity_missions m where m.id = mission_id and public.is_team_member(m.partner_organizer_id))
    or (select public.is_admin())
  );

grant select on public.mission_code_attempts to authenticated;
create policy mission_code_attempts_admin on public.mission_code_attempts
  for select to authenticated
  using ((select public.is_admin()));
