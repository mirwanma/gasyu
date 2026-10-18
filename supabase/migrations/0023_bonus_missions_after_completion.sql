-- 0023: misi bonus tetap bisa dikerjakan setelah warga berstatus selesai (ALUR bagian 9d:
-- misi bonus selalu opsional dan menambah XP). Sebelumnya, begitu event selesai (misalnya check-in
-- tanpa misi wajib), semua misi bonus ditolak.
--
-- Diubah: complete_mission, mark_missions_manual, get_activity_missions (can_work), reveal_mission dan
-- reveal_scheduled_missions (notifikasi juga ke warga yang sudah selesai; payload ikut skor untuk Event
-- Global). Batas XP harian, satu misi sekali per warga, dan poin penyelesaian (sekali) tidak berubah.
-- Warga batal atau tidak selesai tetap ditolak.

create or replace function public.complete_mission(p_mission_id uuid, p_token text default null, p_code text default null, p_proof_path text default null, p_lat numeric default null, p_lng numeric default null)
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
  -- Warga yang sudah selesai tetap boleh mengerjakan misi bonus (ALUR bagian 9d).
  if not found or v_p.status not in ('registered', 'in_progress', 'completed') then
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

create or replace function public.mark_missions_manual(p_mission_id uuid, p_user_ids uuid[])
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
    if not found or v_p.status not in ('registered', 'in_progress', 'completed') or v_p.payment_status not in ('not_required', 'paid') then
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
    perform public.notify(v_u, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward, 'score', v_m.score_reward));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.get_activity_missions(p_activity_id uuid)
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
  v_can_work := v_a.status = 'running' and v_p.id is not null and v_p.status in ('registered', 'in_progress', 'completed')
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
        'verification', v_m.verification, 'xp_reward', v_m.xp_reward, 'score_reward', v_m.score_reward, 'is_required', v_m.is_required,
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
      v_items := v_items || jsonb_build_object('id', v_m.id, 'open', false, 'xp_reward', v_m.xp_reward, 'score_reward', v_m.score_reward, 'is_required', v_m.is_required, 'hint', v_hint);
    end if;
  end loop;

  return jsonb_build_object('reach', v_a.reach, 'missions', v_items, 'required_total', v_req_total, 'required_done', v_req_done, 'can_work', v_can_work,
    'participation_status', v_p.status, 'payment_status', v_p.payment_status);
end;
$$;

create or replace function public.reveal_mission(p_mission_id uuid)
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
    select p.user_id from public.participations p where p.activity_id = v_m.activity_id and p.status in ('registered', 'in_progress', 'completed')
  loop
    perform public.notify(v_row.user_id, 'mission_revealed', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward, 'score', v_m.score_reward));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.reveal_scheduled_missions()
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
    select m.id, m.title, m.xp_reward, m.score_reward, m.activity_id, a.title as activity_title
    from public.activity_missions m
    join public.activities a on a.id = m.activity_id
    where m.reveal_mode = 'scheduled' and m.revealed_at is null and m.is_active and m.reveal_at <= now()
      and a.status in ('published', 'running')
  loop
    update public.activity_missions set revealed_at = now() where id = v_m.id;
    for v_row in
      select p.user_id from public.participations p where p.activity_id = v_m.activity_id and p.status in ('registered', 'in_progress', 'completed')
    loop
      perform public.notify(v_row.user_id, 'mission_revealed', jsonb_build_object('activity_id', v_m.activity_id, 'title', v_m.activity_title, 'mission_title', v_m.title, 'xp', v_m.xp_reward, 'score', v_m.score_reward));
    end loop;
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
