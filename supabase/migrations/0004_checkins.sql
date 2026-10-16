-- =============================================================================
-- Irisan 4: Check-in
-- Isi: enum review_status/flag_kind/flag_status, checkins, fraud_flags,
--      FK xp_ledger.checkin_id, get_checkpoint_qr (token HMAC per 60 detik),
--      perform_checkin (event: XP dasar + kunjungan pertama + bonus kolaborasi,
--      batas harian lewat award_xp, flag di luar radius), v_user_xp_total,
--      v_user_level, v_checkpoint_checkins, RLS, policy hapus cover.
-- Sumber: docs/ALUR-SISTEM.md bagian 14 dan 19; docs/DESAIN-DATABASE.md bagian 4, 6, 7.
-- Catatan: progress challenge, bonus grup, poin, misi, dan pembalikan check-in
--          (reverse_checkin) menyusul di irisan 5, 6, 8, dan 10.
-- =============================================================================

create type public.review_status as enum ('ok', 'flagged', 'approved', 'rejected');
create type public.flag_kind as enum ('out_of_radius', 'impossible_travel', 'shared_device', 'burst_accounts', 'manual');
create type public.flag_status as enum ('open', 'dismissed', 'actioned');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.checkins (
  id uuid primary key default gen_random_uuid(),
  participation_id uuid not null references public.participations (id),
  activity_id uuid not null references public.activities (id),
  user_id uuid not null references public.profiles (id),
  group_id uuid,
  checkpoint_id uuid not null references public.activity_checkpoints (id),
  partner_organizer_id uuid not null references public.organizers (id),
  checked_in_at timestamptz not null default now(),
  local_date date not null default public.local_today(),
  lat numeric(9, 6),
  lng numeric(9, 6),
  distance_m integer,
  review_status public.review_status not null default 'ok',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  constraint checkins_one_per_day unique (activity_id, user_id, local_date)
);

create index checkins_partner_time_idx on public.checkins (partner_organizer_id, checked_in_at desc);
create index checkins_flagged_idx on public.checkins (review_status) where review_status = 'flagged';
create index checkins_user_idx on public.checkins (user_id, checked_in_at desc);
create index checkins_checkpoint_idx on public.checkins (checkpoint_id, local_date);

-- Ledger: tidak pernah dihapus; kolom inti tidak boleh diubah (hanya kolom review).
create function public.guard_checkin_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'checkins_append_only';
  end if;
  if new.participation_id <> old.participation_id or new.activity_id <> old.activity_id or new.user_id <> old.user_id
     or new.checkpoint_id <> old.checkpoint_id or new.partner_organizer_id <> old.partner_organizer_id
     or new.checked_in_at <> old.checked_in_at or new.local_date <> old.local_date
     or new.lat is distinct from old.lat or new.lng is distinct from old.lng or new.distance_m is distinct from old.distance_m then
    raise exception 'checkins_core_immutable';
  end if;
  return new;
end;
$$;

create trigger checkins_guard
  before update or delete on public.checkins
  for each row execute function public.guard_checkin_row();

create table public.fraud_flags (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  checkin_id uuid references public.checkins (id),
  mission_completion_id uuid,
  kind public.flag_kind not null,
  detail jsonb not null default '{}'::jsonb,
  status public.flag_status not null default 'open',
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index fraud_flags_open_idx on public.fraud_flags (status, created_at desc);
create index fraud_flags_user_idx on public.fraud_flags (user_id);

-- FK dari xp_ledger yang ditunda sejak irisan 1
alter table public.xp_ledger
  add constraint xp_ledger_checkin_id_fkey foreign key (checkin_id) references public.checkins (id);

-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------

-- Jarak dua koordinat dalam meter (haversine).
create function public.distance_m(p_lat1 numeric, p_lng1 numeric, p_lat2 numeric, p_lng2 numeric)
returns integer
language sql
immutable
set search_path = ''
as $$
  select round(
    2 * 6371000 * asin(sqrt(
      power(sin(radians(p_lat2 - p_lat1) / 2), 2)
      + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2)
    ))
  )::integer;
$$;

-- Nomor slot waktu berjalan (setiap qr_rotate_seconds).
create function public.qr_slot(p_at timestamptz default now())
returns bigint
language sql
stable
set search_path = ''
as $$
  select floor(extract(epoch from p_at) / public.setting_int('checkin.qr_rotate_seconds'))::bigint;
$$;

-- Token QR = HMAC(qr_secret, checkpoint_id:slot), 16 hex pertama.
create function public.qr_token(p_secret bytea, p_checkpoint_id uuid, p_slot bigint)
returns text
language sql
immutable
set search_path = ''
as $$
  select left(encode(extensions.hmac(convert_to(p_checkpoint_id::text || ':' || p_slot::text, 'utf8'), p_secret, 'sha256'), 'hex'), 16);
$$;

revoke execute on function public.distance_m(numeric, numeric, numeric, numeric), public.qr_slot(timestamptz),
  public.qr_token(bytea, uuid, bigint) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- get_checkpoint_qr: tim partner pemilik checkpoint (atau admin untuk host platform)
-- Kode error: not_allowed, checkpoint_inactive, activity_not_open
-- -----------------------------------------------------------------------------

create function public.get_checkpoint_qr(p_checkpoint_id uuid)
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

-- -----------------------------------------------------------------------------
-- perform_checkin: seluruh alur check-in dalam satu transaksi
-- Kode error: invalid_checkpoint, activity_not_running, invalid_token,
--   not_registered, payment_required, already_checked_in_today, account_inactive
-- -----------------------------------------------------------------------------

create function public.perform_checkin(p_checkpoint_id uuid, p_token text, p_lat numeric default null, p_lng numeric default null)
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
  v_slot bigint := public.qr_slot();
  v_distance integer;
  v_flagged boolean := false;
  v_checkin_id uuid;
  v_base integer := 0;
  v_first integer := 0;
  v_collab integer := 0;
  v_partner_count integer;
  v_completed boolean := false;
  v_total_xp integer;
begin
  select * into v_cp from public.activity_checkpoints where id = p_checkpoint_id and is_active;
  if not found then
    raise exception 'invalid_checkpoint';
  end if;

  select * into v_a from public.activities where id = v_cp.activity_id for update;
  -- Cron berjalan tiap 5 menit; event yang sudah waktunya dianggap berjalan.
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
    -- Tanpa lokasi: tetap diterima tetapi ditandai untuk ditinjau.
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

  -- XP dasar: event dapat saat check-in; challenge saat selesai (irisan 5).
  if v_a.type = 'event' then
    v_base := public.award_xp(v_uid, v_a.xp_base, 'event_checkin', v_a.id, v_checkin_id, null, 'Check-in ' || v_a.title);

    -- Kunjungan pertama ke penyelenggara ini
    if not exists (
      select 1 from public.checkins
      where user_id = v_uid and partner_organizer_id = v_cp.partner_organizer_id and id <> v_checkin_id
    ) then
      select * into v_partner from public.organizers where id = v_cp.partner_organizer_id;
      v_first := public.award_xp(v_uid, public.setting_int('xp.first_visit_bonus'), 'first_visit_bonus', v_a.id, v_checkin_id, null,
        'Kunjungan pertama ke ' || v_partner.name);
    end if;

    -- Bonus kolaborasi: lebih dari satu partner accepted
    select count(*) into v_partner_count from public.activity_partners where activity_id = v_a.id and status = 'accepted';
    if v_partner_count > 1 then
      v_collab := public.award_xp(v_uid, round(v_a.xp_base * public.setting_int('xp.collab_bonus_pct') / 100.0)::integer, 'collab_bonus', v_a.id, v_checkin_id, null,
        'Bonus kolaborasi ' || v_a.title);
    end if;

    -- Event tanpa misi: selesai saat check-in (misi wajib menyusul di irisan 10).
    update public.participations set status = 'completed', progress = 1, completed_at = now() where id = v_p.id;
    v_completed := true;
  else
    update public.participations set status = 'in_progress', progress = progress + 1 where id = v_p.id;
  end if;

  select coalesce(sum(amount), 0) into v_total_xp from public.xp_ledger where user_id = v_uid;

  return jsonb_build_object(
    'checkin_id', v_checkin_id,
    'activity_id', v_a.id,
    'activity_title', v_a.title,
    'activity_type', v_a.type,
    'checkpoint_name', v_cp.name,
    'partner_name', (select name from public.organizers where id = v_cp.partner_organizer_id),
    'distance_m', v_distance,
    'flagged', v_flagged,
    'completed', v_completed,
    'xp_base', v_base,
    'xp_first_visit', v_first,
    'xp_collab', v_collab,
    'xp_total', v_base + v_first + v_collab,
    'total_xp', v_total_xp
  );
end;
$$;

revoke execute on function public.get_checkpoint_qr(uuid), public.perform_checkin(uuid, text, numeric, numeric) from public, anon;
grant execute on function public.get_checkpoint_qr(uuid), public.perform_checkin(uuid, text, numeric, numeric) to authenticated;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

create view public.v_user_xp_total
with (security_invoker = true)
as
select user_id, sum(amount)::integer as total_xp
from public.xp_ledger
group by user_id;

create view public.v_user_level
with (security_invoker = true)
as
select
  t.user_id,
  t.total_xp,
  l.level,
  l.name as level_name,
  (select min(min_xp) from public.levels n where n.min_xp > t.total_xp) as next_min_xp
from public.v_user_xp_total t
join lateral (
  select level, name from public.levels where min_xp <= t.total_xp order by min_xp desc limit 1
) l on true;

grant select on public.v_user_xp_total, public.v_user_level to authenticated;

-- Umpan check-in untuk tim partner pemilik checkpoint (nickname saja) dan admin.
create view public.v_checkpoint_checkins as
select
  c.id, c.activity_id, c.checkpoint_id, c.partner_organizer_id, c.checked_in_at, c.local_date,
  c.distance_m, c.review_status, c.group_id,
  pr.nickname::text as nickname, r.name as village_name
from public.checkins c
join public.profiles pr on pr.id = c.user_id
left join public.regions r on r.id = pr.home_village_id
where public.is_team_member(c.partner_organizer_id) or (select public.is_admin());

grant select on public.v_checkpoint_checkins to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

revoke all on table public.checkins, public.fraud_flags from anon, authenticated;
alter table public.checkins enable row level security;
alter table public.fraud_flags enable row level security;

grant select on public.checkins to authenticated;
-- Warga baca miliknya; tim partner baca check-in di checkpoint miliknya; admin semua.
create policy checkins_select on public.checkins
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_member(partner_organizer_id) or (select public.is_admin()));

grant select on public.fraud_flags to authenticated;
create policy fraud_flags_select_admin on public.fraud_flags
  for select to authenticated
  using ((select public.is_admin()));

-- Cover: tim host boleh menghapus (mengganti) cover miliknya.
do $$
begin
  if to_regclass('storage.objects') is null then
    return;
  end if;
  execute $p$
    create policy covers_delete_host on storage.objects
      for delete to authenticated
      using (bucket_id = 'covers' and public.is_activity_host_team((storage.foldername(name))[1]::uuid))
  $p$;
end;
$$;
