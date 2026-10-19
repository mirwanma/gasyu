-- =============================================================================
-- 0025: perbaikan hasil tinjauan keamanan (Oktober 2026).
--
-- 1. View tidak bisa ditulis lagi oleh anon/authenticated. View dashboard berjalan
--    dengan hak pemilik, jadi tulis lewat view melewati RLS (misalnya menerbitkan
--    aktivitas tanpa persetujuan admin). Sisa izin TRUNCATE dicabut.
-- 2. Partner yang keluar, dikeluarkan, atau dibekukan tidak bisa lagi menyalakan
--    checkpoint/misi, menampilkan QR, meninjau misi, atau memakai budget poinnya.
-- 3. Batas total XP/skor misi menghitung misi yang sudah pernah memberi hasil
--    walau dinonaktifkan; upsert/aktivasi misi mengunci baris aktivitas.
-- 4. Aturan 13: check-in Event Global tidak menambah XP streak dan tidak dihitung
--    di peringkat kelurahan.
-- 5. Privasi: partner tidak membaca koordinat GPS check-in; foto misi hanya untuk
--    host dan partner pemilik misi; identitas pemenang tidak terbuka untuk sponsor;
--    kode voucher aktif tidak terlihat tim; saldo poin hanya untuk pemiliknya.
-- 6. Pembalikan check-in memakai kelurahan pada baris XP asli.
-- 7. Refund voucher oleh tim hanya untuk reward nonaktif, dengan masa berlaku asli.
-- 8. URL gambar wajib https tanpa karakter yang bisa menyisipkan CSS.
-- 9. Kode grup dibatasi 5 percobaan salah per 15 menit; anggota yang dikeluarkan
--    tidak bisa masuk lagi dengan kode lama.
-- 10. Keputusan pemilik proyek: tim tidak boleh menyetujui/menandai misinya sendiri;
--     misi manual hanya untuk peserta yang sudah check-in (kecuali aktivitas tanpa
--     checkpoint); poin dari check-in yang ditandai tertahan sampai disetujui admin;
--     kode misi baru minimal 6 karakter dan tebakan massal per misi masuk Moderasi;
--     admin bisa membalik penyelesaian misi (reverse_mission_completion).
-- =============================================================================

-- Nilai enum baru dipakai di dalam badan fungsi, jadi aman ditambahkan di file yang sama.
alter type public.flag_kind add value if not exists 'code_bruteforce';

insert into public.app_settings (key, value) values
  ('mission.code_min_length', '6'),
  ('mission.code_flag_attempts', '50'),
  ('group.join_max_attempts', '5'),
  ('group.join_window_minutes', '15')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- 1. Izin view dan tabel
-- -----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('v', 'm')
  loop
    execute format('revoke insert, update, delete, truncate, references, trigger on public.%I from anon, authenticated', r.relname);
    execute format('revoke select on public.%I from anon', r.relname);
  end loop;
end;
$$;

revoke all on public.suggestions from anon;
revoke insert, update, delete, truncate, references, trigger on public.suggestions from authenticated;
revoke truncate, references, trigger on public.mission_templates from authenticated;

-- Partner hanya melihat check-in di checkpoint miliknya, tanpa koordinat GPS warga.
revoke select on public.checkins from authenticated;
grant select (id, participation_id, activity_id, user_id, group_id, checkpoint_id, partner_organizer_id, checked_in_at,
  local_date, distance_m, review_status, reviewed_by, reviewed_at, review_note) on public.checkins to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Partner aktif
-- -----------------------------------------------------------------------------
create function public.partner_is_active(p_activity_id uuid, p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.activity_partners ap
    join public.organizers o on o.id = ap.organizer_id
    where ap.activity_id = p_activity_id and ap.organizer_id = p_organizer_id
      and ap.status = 'accepted' and o.status <> 'suspended'
  );
$$;

create function public.check_checkpoint_partner_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active or new.partner_organizer_id <> old.partner_organizer_id)
     and not public.partner_is_active(new.activity_id, new.partner_organizer_id) then
    raise exception 'partner_inactive';
  end if;
  return new;
end;
$$;

create trigger activity_checkpoints_partner_active
  before insert or update of is_active, partner_organizer_id on public.activity_checkpoints
  for each row execute function public.check_checkpoint_partner_active();

create function public.check_mission_partner_active()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.is_active and (tg_op = 'INSERT' or not old.is_active)
     and not public.partner_is_active(new.activity_id, new.partner_organizer_id) then
    raise exception 'partner_inactive';
  end if;
  return new;
end;
$$;

create trigger activity_missions_partner_active
  before insert or update of is_active on public.activity_missions
  for each row execute function public.check_mission_partner_active();

-- Dari 0004_checkins.sql (diperbarui di 0025)
create or replace function public.get_checkpoint_qr(p_checkpoint_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cp public.activity_checkpoints;
  v_a public.activities;
  v_rotate integer := public.setting_int('checkin.qr_rotate_seconds');
  v_slot bigint := public.qr_slot();
begin
  perform public.active_uid();
  select * into v_cp from public.activity_checkpoints where id = p_checkpoint_id;
  if not found then
    raise exception 'not_allowed';
  end if;
  -- Hanya tim partner pemilik checkpoint (admin untuk checkpoint atas nama Ramein).
  if not (
    public.is_team_member(v_cp.partner_organizer_id)
    or (public.is_admin() and exists (select 1 from public.organizers o where o.id = v_cp.partner_organizer_id and o.type = 'platform'))
  ) then
    raise exception 'not_allowed';
  end if;
  -- Partner yang sudah keluar, dikeluarkan, atau dibekukan tidak boleh menampilkan QR lagi.
  if not public.partner_is_active(v_cp.activity_id, v_cp.partner_organizer_id) then
    raise exception 'partner_inactive';
  end if;
  if not v_cp.is_active then
    raise exception 'checkpoint_inactive';
  end if;
  select * into v_a from public.activities where id = v_cp.activity_id;
  if v_a.status not in ('published', 'running') then
    raise exception 'activity_not_open';
  end if;

  return jsonb_build_object(
    'checkpoint_id', v_cp.id,
    'token', public.qr_token(v_cp.qr_secret, v_cp.id, v_slot),
    'rotate_seconds', v_rotate,
    'expires_in', v_rotate - (floor(extract(epoch from now()))::bigint % v_rotate),
    'checkpoint_name', v_cp.name,
    'activity_title', v_a.title,
    'activity_status', v_a.status,
    'radius_m', v_cp.radius_m
  );
end;
$$;
-- Dari 0010_missions.sql (diperbarui di 0025)
create or replace function public.get_mission_qr(p_mission_id uuid)
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
  if not public.partner_is_active(v_m.activity_id, v_m.partner_organizer_id) then
    raise exception 'partner_inactive';
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
-- Dari 0007_collaboration.sql (diperbarui di 0025)
create or replace function public.leave_activity(p_partner_id uuid)
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
  -- Misi partner ikut nonaktif (sebelum status berubah, karena trigger misi memeriksa partner).
  update public.activity_missions set is_active = false where activity_id = v_a.id and partner_organizer_id = v_ap.organizer_id and is_active;
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
-- Dari 0008_dashboards.sql (diperbarui di 0025)
create or replace function public.suspend_organizer(p_organizer_id uuid, p_suspend boolean, p_note text default null)
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
    -- Checkpoint dan misi miliknya di aktivitas penyelenggara lain ikut dinonaktifkan.
    update public.activity_checkpoints set is_active = false where partner_organizer_id = p_organizer_id and is_active;
    update public.activity_missions set is_active = false where partner_organizer_id = p_organizer_id and is_active;
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
-- Dari 0008_dashboards.sql (diperbarui di 0025)
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
    where ap.activity_id = p_activity.id and ap.status = 'accepted' and o.type = 'merchant' and o.status <> 'suspended' and ap.points_budget > 0
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

-- -----------------------------------------------------------------------------
-- 3. Batas total misi
-- -----------------------------------------------------------------------------
-- Dari 0022_global_events.sql (diperbarui di 0025)
create or replace function public.check_mission_row()
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
  if v_a.reach = 'global' then
    -- Event Global: skor, bukan XP (ALUR bagian 22b)
    if new.xp_reward <> 0 then
      raise exception 'global_mission_no_xp';
    end if;
    if new.score_reward < public.setting_int('global_event.score_min') or new.score_reward > public.setting_int('global_event.score_max') then
      raise exception 'invalid_mission_score';
    end if;
    if new.verification = 'qr_scan' and v_a.location_mode = 'online' then
      raise exception 'online_no_qr_mission';
    end if;
  else
    if new.score_reward <> 0 then
      raise exception 'regional_mission_no_score';
    end if;
    if new.xp_reward < public.setting_int('mission.xp_min') or new.xp_reward > public.setting_int('mission.xp_max') then
      raise exception 'invalid_mission_xp';
    end if;
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
    if old.locked_at is not null and (new.verification <> old.verification or new.xp_reward <> old.xp_reward or new.score_reward <> old.score_reward
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

  if v_a.reach = 'global' then
    select coalesce(sum(m.score_reward), 0) into v_total from public.activity_missions m
    where m.activity_id = new.activity_id and (m.is_active or m.locked_at is not null) and m.id <> new.id;
    if (new.is_active or new.locked_at is not null) and v_total + new.score_reward > public.setting_int('global_event.max_total_score') then
      raise exception 'mission_total_score_exceeded';
    end if;
  else
    select coalesce(sum(m.xp_reward), 0) into v_total from public.activity_missions m
    where m.activity_id = new.activity_id and (m.is_active or m.locked_at is not null) and m.id <> new.id;
    if (new.is_active or new.locked_at is not null) and v_total + new.xp_reward > public.setting_int('mission.max_total_xp') then
      raise exception 'mission_total_xp_exceeded';
    end if;
  end if;
  return new;
end;
$$;
-- Dari 0022_global_events.sql (diperbarui di 0025)
create or replace function public.upsert_mission(p_activity_id uuid, p_mission jsonb)
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
  v_template uuid := nullif(p_mission ->> 'template_id', '')::uuid;
begin
  select * into v_a from public.activities where id = p_activity_id for update; -- serialisasi cek total XP/skor
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
  if v_verification = 'secret_code' and v_code is not null and char_length(v_code) < public.setting_int('mission.code_min_length') then
    raise exception 'invalid_code';
  end if;

  if v_id is null and v_template is not null
     and not exists (select 1 from public.mission_templates where id = v_template and is_active) then
    raise exception 'invalid_template';
  end if;

  if v_id is null then
    if v_verification = 'secret_code' and v_code is null then
      raise exception 'mission_code_required';
    end if;
    insert into public.activity_missions (activity_id, partner_organizer_id, title, description, icon, sort_order, verification, checkpoint_id, code_hash,
      xp_reward, score_reward, is_required, available_from, available_until, reveal_mode, reveal_at, prerequisite_mission_id, show_teaser, created_by, template_id)
    values (p_activity_id, v_partner, btrim(p_mission ->> 'title'), nullif(btrim(coalesce(p_mission ->> 'description', '')), ''), nullif(p_mission ->> 'icon', ''),
      coalesce((p_mission ->> 'sort_order')::smallint, (select coalesce(max(sort_order), 0) + 1 from public.activity_missions where activity_id = p_activity_id)),
      v_verification, nullif(p_mission ->> 'checkpoint_id', '')::uuid,
      case when v_verification = 'secret_code' then extensions.crypt(lower(v_code), extensions.gen_salt('bf')) end,
      case when v_a.reach = 'global' then 0 else (p_mission ->> 'xp_reward')::integer end,
      case when v_a.reach = 'global' then (p_mission ->> 'score_reward')::integer else 0 end,
      coalesce((p_mission ->> 'is_required')::boolean, true),
      nullif(p_mission ->> 'available_from', '')::timestamptz, nullif(p_mission ->> 'available_until', '')::timestamptz,
      v_reveal, nullif(p_mission ->> 'reveal_at', '')::timestamptz, nullif(p_mission ->> 'prerequisite_mission_id', '')::uuid,
      coalesce((p_mission ->> 'show_teaser')::boolean, true), v_uid, v_template)
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
      xp_reward = case when v_a.reach = 'global' then 0 else coalesce((p_mission ->> 'xp_reward')::integer, xp_reward) end,
      score_reward = case when v_a.reach = 'global' then coalesce((p_mission ->> 'score_reward')::integer, score_reward) else 0 end,
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

create or replace function public.set_mission_active(p_mission_id uuid, p_active boolean)
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
  -- Kunci aktivitas supaya cek total XP/skor misi tidak bisa dibalap.
  perform 1 from public.activities where id = v_m.activity_id for update;
  update public.activity_missions set is_active = p_active where id = p_mission_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Aturan 13: Event Global terpisah dari XP streak dan peringkat kelurahan
-- -----------------------------------------------------------------------------
-- Dari 0009_leaderboards_badges.sql (diperbarui di 0025)
create or replace function public.award_streak()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_week date := date_trunc('week', public.local_today()::timestamp)::date; -- Senin minggu ini
  v_bonus integer := public.setting_int('xp.streak_weekly');
  v_row record;
  v_n integer := 0;
begin
  for v_row in
    select c.user_id
    from public.checkins c
    join public.profiles p on p.id = c.user_id
    join public.activities a on a.id = c.activity_id and a.reach = 'regional'
    where c.review_status <> 'rejected' and c.local_date >= v_week - 14 and c.local_date < v_week
      and p.suspended_at is null and p.deleted_at is null
    group by c.user_id
    having count(distinct date_trunc('week', c.local_date::timestamp)) = 2
       and not exists (select 1 from public.xp_ledger x where x.user_id = c.user_id and x.reason = 'streak' and x.local_date >= v_week)
  loop
    perform public.award_xp(v_row.user_id, v_bonus, 'streak', null, null, null,
      'Bonus streak ' || public.user_streak_weeks(v_row.user_id) || ' minggu');
    perform public.award_badges(v_row.user_id);
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;
-- Dari 0009_leaderboards_badges.sql (diperbarui di 0025)
create or replace function public.user_streak_weeks(p_user_id uuid)
returns integer
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_week date := date_trunc('week', public.local_today()::timestamp)::date;
  v_streak integer := 0;
begin
  if not exists (select 1 from public.checkins c join public.activities a on a.id = c.activity_id and a.reach = 'regional'
      where c.user_id = p_user_id and c.review_status <> 'rejected'
      and c.local_date >= v_week and c.local_date < v_week + 7) then
    v_week := v_week - 7;
  end if;
  loop
    exit when not exists (select 1 from public.checkins c join public.activities a on a.id = c.activity_id and a.reach = 'regional'
      where c.user_id = p_user_id and c.review_status <> 'rejected'
      and c.local_date >= v_week and c.local_date < v_week + 7);
    v_streak := v_streak + 1;
    v_week := v_week - 7;
    exit when v_streak >= 520;
  end loop;
  return v_streak;
end;
$$;
-- Dari 0009_leaderboards_badges.sql (diperbarui di 0025)
create or replace function public.leaderboard_villages(p_month date default null)
returns table (village_id uuid, village_name text, district_name text, xp_total integer, active_citizens integer, avg_xp numeric, rank integer, qualifies boolean)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select date_trunc('month', coalesce(p_month, public.local_today()))::date as start_date,
      public.setting_int('leaderboard.min_active_citizens') as min_active
  ), xp as (
    select x.village_id, sum(x.amount)::integer as xp_total
    from public.xp_ledger x, m
    where x.village_id is not null and x.local_date >= m.start_date and x.local_date < (m.start_date + interval '1 month')::date
    group by x.village_id
  ), act as (
    select pr.home_village_id as village_id, count(distinct c.user_id)::integer as active_citizens
    from public.checkins c
    join public.activities ac on ac.id = c.activity_id and ac.reach = 'regional'
    join public.profiles pr on pr.id = c.user_id, m
    where c.review_status <> 'rejected' and pr.home_village_id is not null
      and c.local_date >= m.start_date and c.local_date < (m.start_date + interval '1 month')::date
    group by pr.home_village_id
  ), base as (
    select r.id as village_id, r.name as village_name, d.name as district_name,
      coalesce(xp.xp_total, 0) as xp_total, coalesce(act.active_citizens, 0) as active_citizens,
      case when coalesce(act.active_citizens, 0) > 0 then round(coalesce(xp.xp_total, 0)::numeric / act.active_citizens, 1) else 0 end as avg_xp,
      coalesce(act.active_citizens, 0) >= (select min_active from m) as qualifies
    from public.regions r
    left join public.regions d on d.id = r.parent_id
    left join xp on xp.village_id = r.id
    left join act on act.village_id = r.id
    where r.level = 'village' and r.is_active
  )
  select village_id, village_name, district_name, xp_total, active_citizens, avg_xp,
    case when qualifies then dense_rank() over (order by case when qualifies then avg_xp end desc nulls last)::integer else null end as rank,
    qualifies
  from base;
$$;

-- -----------------------------------------------------------------------------
-- 5. Privasi
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.objects') is null then
    raise notice 'storage tidak tersedia, policy mission-proofs dilewati';
    return;
  end if;
  -- Foto misi: warga pemilik, tim host, partner pemilik misi itu, dan admin (sama dengan RLS mission_completions).
  execute $p$
    alter policy mission_proofs_read on storage.objects
      using (bucket_id = 'mission-proofs' and (
        (storage.foldername(name))[2] = auth.uid()::text
        or public.is_activity_host_team((storage.foldername(name))[1]::uuid)
        or (select public.is_admin())
        or exists (
          select 1 from public.mission_completions mc
          join public.activity_missions m on m.id = mc.mission_id
          where mc.proof_path = storage.objects.name and public.is_team_member(m.partner_organizer_id))))
  $p$;
end;
$$;

-- Pemenang hanya terlihat oleh dirinya dan admin. Tim sponsor memakai get_sponsored_prizes (tanpa identitas).
alter policy activity_winners_select on public.activity_winners
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create function public.get_sponsored_prizes(p_organizer_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_team_member(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pz.id, 'activity_id', pz.activity_id, 'activity_title', a.title, 'activity_status', a.status,
      'rank_from', pz.rank_from, 'rank_to', pz.rank_to, 'title', pz.title,
      'winners', coalesce((select jsonb_agg(jsonb_build_object('rank', w.rank, 'status', w.status) order by w.rank)
                           from public.activity_winners w where w.prize_id = pz.id), '[]'::jsonb)
    ) order by pz.created_at desc)
    from public.activity_prizes pz
    join public.activities a on a.id = pz.activity_id
    where pz.sponsor_organizer_id = p_organizer_id
  ), '[]'::jsonb);
end;
$$;

-- Kode voucher hanya untuk pemiliknya; kasir mengetik kode yang ditunjukkan warga.
alter policy redemptions_select on public.redemptions
  using (user_id = (select auth.uid()) or (select public.is_admin()));

create or replace view public.v_reward_redemptions as
select
  rd.id, rd.reward_id, r.organizer_id, r.title,
  case when rd.status = 'active' then null else rd.code end as code,
  rd.price_points, rd.status, rd.expires_at, rd.used_at, rd.used_outlet_id, rd.created_at,
  pr.nickname::text as nickname, o.name as outlet_name
from public.redemptions rd
join public.rewards r on r.id = rd.reward_id
join public.profiles pr on pr.id = rd.user_id
left join public.merchant_outlets o on o.id = rd.used_outlet_id
where public.is_team_member(r.organizer_id) or (select public.is_admin());

-- Poin dari check-in yang ditandai (di luar radius) tertahan sampai admin menyetujui.
create function public.point_credit_held(p_user_id uuid, p_activity_id uuid, p_reason public.point_reason)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_reason = 'activity_reward' and p_activity_id is not null and exists (
    select 1 from public.checkins k
    where k.user_id = p_user_id and k.activity_id = p_activity_id and k.review_status = 'flagged'
  );
$$;

create or replace function public.points_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)), 0)::integer
  from public.point_ledger c
  where c.user_id = p_user_id and c.amount > 0 and c.expires_at > now()
    and not public.point_credit_held(c.user_id, c.activity_id, c.reason)
    -- Saldo hanya untuk pemiliknya dan admin (tanpa sesi: dipanggil cron/fungsi internal).
    and (p_user_id = (select auth.uid()) or (select auth.uid()) is null or (select public.is_admin()));
$$;

create function public.points_held(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)), 0)::integer
  from public.point_ledger c
  where c.user_id = p_user_id and c.amount > 0 and c.expires_at > now()
    and public.point_credit_held(c.user_id, c.activity_id, c.reason)
    and (p_user_id = (select auth.uid()) or (select public.is_admin()));
$$;

create or replace view public.v_user_points_balance
with (security_invoker = true)
as
select
  p.id as user_id,
  public.points_balance(p.id) as balance,
  (select min(c.expires_at) from public.point_ledger c
    where c.user_id = p.id and c.amount > 0 and c.expires_at > now()
      and c.amount > coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)) as next_expiry_at,
  (select coalesce(sum(c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)), 0)
    from public.point_ledger c
    where c.user_id = p.id and c.amount > 0 and c.expires_at > now() and c.expires_at <= now() + interval '30 days')::integer as expiring_30d,
  public.points_held(p.id) as held
from public.profiles p
where p.id = auth.uid();

-- Dari 0006_points_rewards.sql (diperbarui di 0025)
create or replace function public.debit_points(p_user_id uuid, p_amount integer, p_reason public.point_reason, p_redemption_id uuid, p_note text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_debit uuid;
  v_left integer := p_amount;
  v_row record;
  v_take integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'debit_requires_positive_amount';
  end if;
  perform pg_advisory_xact_lock(hashtextextended('points:' || p_user_id::text, 0));
  if public.points_balance(p_user_id) < p_amount then
    raise exception 'insufficient_points';
  end if;
  insert into public.point_ledger (user_id, amount, reason, redemption_id, note)
  values (p_user_id, -p_amount, p_reason, p_redemption_id, p_note)
  returning id into v_debit;
  for v_row in
    select c.id, c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0) as remaining
    from public.point_ledger c
    where c.user_id = p_user_id and c.amount > 0 and c.expires_at > now()
      and not public.point_credit_held(c.user_id, c.activity_id, c.reason)
    order by c.expires_at, c.created_at
  loop
    exit when v_left <= 0;
    if v_row.remaining <= 0 then
      continue;
    end if;
    v_take := least(v_row.remaining, v_left);
    insert into public.point_allocations (credit_id, debit_id, amount) values (v_row.id, v_debit, v_take);
    v_left := v_left - v_take;
  end loop;
  if v_left > 0 then
    raise exception 'insufficient_points';
  end if;
  return v_debit;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Pembalikan check-in: kelurahan asli
-- -----------------------------------------------------------------------------
-- Dari 0022_global_events.sql (diperbarui di 0025)
create or replace function public.reverse_checkin(p_checkin_id uuid, p_note text default null)
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
  v_score integer := 0;
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
    select v_c.user_id, -sum(x.amount), 'reversal', v_c.activity_id, p_checkin_id, x.village_id, 'Check-in ditolak admin'
    from public.xp_ledger x
    where x.checkin_id = p_checkin_id and x.reason <> 'reversal'
    group by x.village_id
    having sum(x.amount) > 0;
    v_xp := v_amount;
  end if;

  -- Skor Event Global yang terikat ke check-in ini dibalik dengan baris negatif.
  select coalesce(sum(amount), 0) into v_score from public.activity_score_ledger where checkin_id = p_checkin_id;
  if v_score > 0 then
    insert into public.activity_score_ledger (activity_id, user_id, amount, reason, checkin_id, occurred_at, note)
    values (v_c.activity_id, v_c.user_id, -v_score, 'reversal', p_checkin_id, now(), 'Check-in ditolak admin');
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
    jsonb_build_object('activity_id', v_a.id, 'activity_title', v_a.title, 'xp', v_xp, 'points', v_points, 'score', v_score, 'note', nullif(btrim(p_note), '')));

  return jsonb_build_object('xp_reversed', v_xp, 'points_reversed', v_points, 'score_reversed', v_score);
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Refund voucher
-- -----------------------------------------------------------------------------
create or replace function public.refund_redemption(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_rd public.redemptions;
  v_r public.rewards;
  v_expires timestamptz;
begin
  select * into v_rd from public.redemptions where id = p_redemption_id for update;
  if not found then
    raise exception 'invalid_code';
  end if;
  select * into v_r from public.rewards where id = v_rd.reward_id;
  if not (public.is_admin() or public.is_team_leader(v_r.organizer_id)) then
    raise exception 'not_allowed';
  end if;
  -- ALUR bagian 16: refund hanya jika reward dinonaktifkan sebelum voucher dipakai (admin selalu boleh).
  if not public.is_admin() and v_r.status <> 'inactive' then
    raise exception 'reward_still_active';
  end if;
  if v_rd.status <> 'active' then
    raise exception 'voucher_unavailable';
  end if;
  update public.redemptions set status = 'refunded' where id = v_rd.id;
  update public.rewards set stock = stock + 1 where id = v_r.id;
  -- Poin kembali dengan masa berlaku poin asal (paling awal), supaya refund tidak memperpanjang poin.
  select min(c.expires_at) into v_expires
  from public.point_allocations al
  join public.point_ledger d on d.id = al.debit_id
  join public.point_ledger c on c.id = al.credit_id
  where d.redemption_id = v_rd.id and d.amount < 0;
  insert into public.point_ledger (user_id, amount, reason, source_organizer_id, redemption_id, expires_at, note)
  values (v_rd.user_id, v_rd.price_points, 'refund', v_r.organizer_id, v_rd.id,
    coalesce(v_expires, now() + make_interval(months => public.setting_int('points.expiry_months'))), 'Refund: ' || v_r.title);
  perform public.notify(v_rd.user_id, 'voucher_refunded', jsonb_build_object('redemption_id', v_rd.id, 'title', v_r.title, 'points', v_rd.price_points));
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. URL gambar
-- -----------------------------------------------------------------------------
alter table public.activities add constraint activities_cover_url_safe
  check (cover_url is null or cover_url ~ '^https://[^[:space:]"''()<>\\]+$');
alter table public.rewards add constraint rewards_image_url_safe
  check (image_url is null or image_url ~ '^https://[^[:space:]"''()<>\\]+$');
alter table public.organizers add constraint organizers_logo_url_safe
  check (logo_url is null or logo_url ~ '^https://[^[:space:]"''()<>\\]+$');
alter table public.activity_prizes add constraint activity_prizes_image_url_safe
  check (image_url is null or image_url ~ '^https://[^[:space:]"''()<>\\]+$');

-- -----------------------------------------------------------------------------
-- 9. Kode grup
-- -----------------------------------------------------------------------------
create table public.group_join_attempts (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  attempted_at timestamptz not null default now()
);
create index group_join_attempts_user_idx on public.group_join_attempts (user_id, attempted_at);
alter table public.group_join_attempts enable row level security;
revoke all on table public.group_join_attempts from anon, authenticated;
-- Tanpa policy: hanya dibaca dan ditulis join_group (security definer).

create or replace function public.join_group(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_g public.groups;
  v_m public.group_members;
  v_attempts integer;
begin
  select count(*) into v_attempts from public.group_join_attempts
  where user_id = v_uid and attempted_at > now() - make_interval(mins => public.setting_int('group.join_window_minutes'));
  if v_attempts >= public.setting_int('group.join_max_attempts') then
    raise exception 'too_many_attempts';
  end if;
  select * into v_g from public.groups where invite_code = upper(btrim(coalesce(p_invite_code, '')));
  if not found then
    -- Dicatat lalu dikembalikan null (bukan exception) supaya log percobaan tersimpan.
    insert into public.group_join_attempts (user_id) values (v_uid);
    return null;
  end if;
  select * into v_m from public.group_members where group_id = v_g.id and user_id = v_uid;
  if found and v_m.status = 'active' then
    raise exception 'already_in_group';
  end if;
  if found and v_m.status = 'removed' then
    raise exception 'removed_from_group';
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

-- -----------------------------------------------------------------------------
-- 10. Keputusan pemilik proyek: misi, poin tertahan, kode misi, balik misi
-- -----------------------------------------------------------------------------
create function public.manual_mark_eligible(p_activity_id uuid, p_participation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select not exists (select 1 from public.activity_checkpoints cp where cp.activity_id = p_activity_id)
    or exists (select 1 from public.checkins c where c.participation_id = p_participation_id and c.review_status <> 'rejected');
$$;

-- Dari 0022_global_events.sql (diperbarui di 0025)
create or replace function public.review_mission_completion(p_completion_id uuid, p_approve boolean, p_note text default null)
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
  if not (public.is_activity_host_team(v_c.activity_id)
          or (public.is_team_member(v_m.partner_organizer_id) and public.partner_is_active(v_m.activity_id, v_m.partner_organizer_id))) then
    raise exception 'not_allowed';
  end if;
  -- Anggota tim tidak boleh meninjau bukti misinya sendiri.
  if v_c.user_id = v_uid then
    raise exception 'self_review_not_allowed';
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
    perform public.check_reviewer_burst(v_uid, v_a.id,
      case when public.is_team_member(v_m.partner_organizer_id) then v_m.partner_organizer_id else v_a.host_organizer_id end);
    perform public.notify(v_c.user_id, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward, 'score', v_m.score_reward,
      'completed', (v_eval ->> 'completed')::boolean));
  else
    perform public.notify(v_c.user_id, 'mission_rejected', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'note', nullif(btrim(p_note), '')));
  end if;
  return v_eval || jsonb_build_object('approved', p_approve);
end;
$$;
-- Dari 0023_bonus_missions_after_completion.sql (diperbarui di 0025)
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
  if not (public.is_activity_host_team(v_m.activity_id)
          or (public.is_team_member(v_m.partner_organizer_id) and public.partner_is_active(v_m.activity_id, v_m.partner_organizer_id))) then
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
    -- Tidak boleh menandai diri sendiri.
    if v_u = v_uid then
      continue;
    end if;
    select * into v_p from public.participations where activity_id = v_a.id and user_id = v_u;
    if not found or v_p.status not in ('registered', 'in_progress', 'completed') or v_p.payment_status not in ('not_required', 'paid') then
      continue;
    end if;
    if not public.mission_open_for(v_m.id, v_u) then
      continue;
    end if;
    -- Hanya peserta yang sudah check-in (kecuali aktivitas tanpa checkpoint, misalnya Event Global online).
    if not public.manual_mark_eligible(v_a.id, v_p.id) then
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

create or replace view public.v_mission_manual_candidates as
select
  m.id as mission_id, p.activity_id, p.user_id, pr.nickname::text as nickname, r.name as village_name, p.group_id,
  exists (select 1 from public.mission_completions mc where mc.mission_id = m.id and mc.user_id = p.user_id and mc.status = 'approved') as done,
  (p.user_id <> (select auth.uid()) and public.manual_mark_eligible(p.activity_id, p.id)) as eligible
from public.activity_missions m
join public.participations p on p.activity_id = m.activity_id and p.status in ('registered', 'in_progress', 'completed')
  and p.payment_status in ('not_required', 'paid')
join public.profiles pr on pr.id = p.user_id
left join public.regions r on r.id = pr.home_village_id
where m.verification = 'manual'
  and (public.is_activity_host_team(m.activity_id) or public.is_team_member(m.partner_organizer_id) or (select public.is_admin()));

create function public.check_code_bruteforce(p_mission_id uuid, p_activity_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window integer := public.setting_int('mission.code_window_minutes');
  v_n integer;
begin
  select count(*) into v_n from public.mission_code_attempts
  where mission_id = p_mission_id and attempted_at > now() - make_interval(mins => v_window);
  if v_n >= public.setting_int('mission.code_flag_attempts') and not exists (
    select 1 from public.fraud_flags f
    where f.kind = 'code_bruteforce' and f.status = 'open' and f.detail ->> 'mission_id' = p_mission_id::text
  ) then
    insert into public.fraud_flags (user_id, kind, detail)
    values (p_user_id, 'code_bruteforce', jsonb_build_object('mission_id', p_mission_id, 'activity_id', p_activity_id,
      'attempts', v_n, 'window_minutes', v_window));
  end if;
end;
$$;

-- Dari 0023_bonus_missions_after_completion.sql (diperbarui di 0025)
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
      perform public.check_code_bruteforce(v_m.id, v_a.id, v_uid);
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

create function public.reverse_mission_completion(p_completion_id uuid, p_note text)
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
  v_xp integer := 0;
  v_score integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if nullif(btrim(p_note), '') is null then
    raise exception 'note_required';
  end if;
  select * into v_c from public.mission_completions where id = p_completion_id for update;
  if not found or v_c.status <> 'approved' then
    raise exception 'invalid_completion';
  end if;
  select * into v_m from public.activity_missions where id = v_c.mission_id;
  select * into v_a from public.activities where id = v_c.activity_id;

  update public.mission_completions
  set status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = btrim(p_note)
  where id = p_completion_id;

  -- XP misi dibalik per kelurahan pada baris asli.
  select coalesce(sum(amount), 0) into v_xp from public.xp_ledger where mission_completion_id = p_completion_id and reason <> 'reversal';
  if v_xp > 0 then
    insert into public.xp_ledger (user_id, amount, reason, activity_id, mission_completion_id, village_id, note)
    select v_c.user_id, -sum(x.amount), 'reversal', v_c.activity_id, p_completion_id, x.village_id, 'Misi dibatalkan admin'
    from public.xp_ledger x
    where x.mission_completion_id = p_completion_id and x.reason <> 'reversal'
    group by x.village_id
    having sum(x.amount) > 0;
  end if;

  -- Skor Event Global dibalik dengan baris negatif.
  select coalesce(sum(amount), 0) into v_score from public.activity_score_ledger where mission_completion_id = p_completion_id;
  if v_score > 0 then
    insert into public.activity_score_ledger (activity_id, user_id, amount, reason, mission_completion_id, occurred_at, note)
    values (v_c.activity_id, v_c.user_id, -v_score, 'reversal', p_completion_id, now(), 'Misi dibatalkan admin');
  end if;

  update public.fraud_flags set status = 'actioned', reviewed_by = v_uid, reviewed_at = now()
  where mission_completion_id = p_completion_id and status = 'open';
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'reverse_mission_completion', 'mission_completions', p_completion_id, btrim(p_note));
  perform public.notify(v_c.user_id, 'mission_reversed', jsonb_build_object(
    'activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_xp, 'score', v_score, 'note', btrim(p_note)));
  return jsonb_build_object('xp_reversed', v_xp, 'score_reversed', v_score);
end;
$$;

-- -----------------------------------------------------------------------------
-- Hak eksekusi fungsi baru
-- -----------------------------------------------------------------------------
revoke execute on function
  public.partner_is_active(uuid, uuid),
  public.check_checkpoint_partner_active(),
  public.check_mission_partner_active(),
  public.point_credit_held(uuid, uuid, public.point_reason),
  public.check_code_bruteforce(uuid, uuid, uuid)
from public, anon, authenticated;

-- Dipanggil di view v_mission_manual_candidates; izin fungsi di view diperiksa atas nama pemanggil.
revoke execute on function public.manual_mark_eligible(uuid, uuid) from public, anon;
grant execute on function public.manual_mark_eligible(uuid, uuid) to authenticated;

revoke execute on function
  public.get_sponsored_prizes(uuid),
  public.points_held(uuid),
  public.reverse_mission_completion(uuid, text)
from public, anon;
grant execute on function
  public.get_sponsored_prizes(uuid),
  public.points_held(uuid),
  public.reverse_mission_completion(uuid, text)
to authenticated;
