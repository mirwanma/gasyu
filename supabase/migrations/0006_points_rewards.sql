-- =============================================================================
-- Irisan 6: Poin & reward
-- Isi: enum point_reason/reward_status/redemption_status, point_ledger (insert
--      saja) + point_allocations (FIFO), rewards, redemptions, budget poin partner
--      (set_partner_budget, v_activity_budget), poin penyelesaian di perform_checkin,
--      poin per penyelesaian di create/update_activity, redeem_reward, use_voucher,
--      refund_redemption, kelola reward, cron expire_points/expire_redemptions,
--      v_user_points_balance, v_reward_redemptions, RLS.
-- Sumber: docs/ALUR-SISTEM.md bagian 6, 14b, 16, 18; docs/DESAIN-DATABASE.md bagian 4, 6, 7, 10.
-- Catatan: set_partner_budget dimajukan dari irisan 7 karena poin membutuhkannya.
-- =============================================================================

create type public.point_reason as enum ('activity_reward', 'redemption', 'refund', 'expiry', 'reversal', 'adjustment');
create type public.reward_status as enum ('active', 'inactive');
create type public.redemption_status as enum ('active', 'used', 'expired', 'refunded');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.rewards (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  image_url text,
  price_points integer not null check (price_points > 0),
  stock integer not null default 0 check (stock >= 0),
  valid_days integer not null default 30 check (valid_days between 1 and 365),
  available_until timestamptz,
  status public.reward_status not null default 'active',
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index rewards_organizer_idx on public.rewards (organizer_id, status);
create index rewards_active_idx on public.rewards (status, available_until) where status = 'active';

create trigger rewards_set_updated_at
  before update on public.rewards
  for each row execute function public.set_updated_at();

-- Reward hanya milik merchant.
create function public.check_reward_row()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.organizers where id = new.organizer_id and type = 'merchant') then
    raise exception 'reward_requires_merchant';
  end if;
  return new;
end;
$$;

create trigger rewards_check
  before insert or update of organizer_id on public.rewards
  for each row execute function public.check_reward_row();

create table public.redemptions (
  id uuid primary key default gen_random_uuid(),
  reward_id uuid not null references public.rewards (id),
  user_id uuid not null references public.profiles (id),
  code text not null unique check (code ~ '^[A-Z0-9]{8}$'),
  price_points integer not null check (price_points > 0),
  status public.redemption_status not null default 'active',
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles (id),
  used_outlet_id uuid references public.merchant_outlets (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index redemptions_user_idx on public.redemptions (user_id, status);
create index redemptions_reward_idx on public.redemptions (reward_id, status);
create index redemptions_active_expiry_idx on public.redemptions (expires_at) where status = 'active';

create trigger redemptions_set_updated_at
  before update on public.redemptions
  for each row execute function public.set_updated_at();

create table public.point_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  amount integer not null check (amount <> 0),
  reason public.point_reason not null,
  activity_id uuid references public.activities (id),
  source_organizer_id uuid references public.organizers (id),
  redemption_id uuid references public.redemptions (id),
  expires_at timestamptz,
  note text,
  created_at timestamptz not null default now(),
  constraint point_ledger_credit_expires check (amount < 0 or expires_at is not null)
);

create index point_ledger_user_expiry_idx on public.point_ledger (user_id, expires_at) where amount > 0;
create index point_ledger_user_idx on public.point_ledger (user_id, created_at desc);
create index point_ledger_activity_source_idx on public.point_ledger (activity_id, source_organizer_id) where reason = 'activity_reward';

-- Ledger: hanya insert.
create function public.point_ledger_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'point_ledger_append_only';
end;
$$;

create trigger point_ledger_append_only
  before update or delete on public.point_ledger
  for each row execute function public.point_ledger_guard();

create table public.point_allocations (
  credit_id uuid not null references public.point_ledger (id),
  debit_id uuid not null references public.point_ledger (id),
  amount integer not null check (amount > 0),
  primary key (credit_id, debit_id)
);

create index point_allocations_debit_idx on public.point_allocations (debit_id);

-- -----------------------------------------------------------------------------
-- Saldo dan budget
-- -----------------------------------------------------------------------------

-- Sisa setiap kredit = kredit dikurangi alokasi debit (termasuk kedaluwarsa).
create function public.points_balance(p_user_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)), 0)::integer
  from public.point_ledger c
  where c.user_id = p_user_id and c.amount > 0 and c.expires_at > now();
$$;

create view public.v_user_points_balance
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
    where c.user_id = p.id and c.amount > 0 and c.expires_at > now() and c.expires_at <= now() + interval '30 days')::integer as expiring_30d
from public.profiles p
where p.id = auth.uid();

grant select on public.v_user_points_balance to authenticated;

-- Budget poin per partner merchant: diisi, terpakai, sisa.
create view public.v_activity_budget as
select
  ap.activity_id,
  ap.organizer_id,
  ap.points_budget as budget,
  coalesce((select sum(l.amount) from public.point_ledger l
    where l.activity_id = ap.activity_id and l.source_organizer_id = ap.organizer_id and l.reason = 'activity_reward'), 0)::integer as used,
  (ap.points_budget - coalesce((select sum(l.amount) from public.point_ledger l
    where l.activity_id = ap.activity_id and l.source_organizer_id = ap.organizer_id and l.reason = 'activity_reward'), 0))::integer as remaining
from public.activity_partners ap
join public.organizers o on o.id = ap.organizer_id
where ap.status = 'accepted' and o.type = 'merchant'
  and (public.is_activity_team(ap.activity_id) or (select public.is_admin()));

grant select on public.v_activity_budget to authenticated;

-- Pemilik merchant partner mengisi budget poin sebelum aktivitas berjalan.
create function public.set_partner_budget(p_partner_id uuid, p_budget integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ap public.activity_partners;
  v_a public.activities;
  v_used integer;
begin
  perform public.active_uid();
  select * into v_ap from public.activity_partners where id = p_partner_id for update;
  if not found or not public.is_team_leader(v_ap.organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.organizers where id = v_ap.organizer_id and type = 'merchant') then
    raise exception 'points_budget_requires_merchant';
  end if;
  select * into v_a from public.activities where id = v_ap.activity_id;
  if v_a.status not in ('draft', 'awaiting_partners', 'in_review', 'published') then
    raise exception 'activity_locked';
  end if;
  if p_budget is null or p_budget < 0 then
    raise exception 'invalid_budget';
  end if;
  select coalesce(sum(amount), 0) into v_used from public.point_ledger
  where activity_id = v_ap.activity_id and source_organizer_id = v_ap.organizer_id and reason = 'activity_reward';
  if p_budget < v_used then
    raise exception 'budget_below_used';
  end if;
  update public.activity_partners set points_budget = p_budget where id = p_partner_id;
end;
$$;

revoke execute on function public.set_partner_budget(uuid, integer), public.points_balance(uuid) from public, anon;
grant execute on function public.set_partner_budget(uuid, integer), public.points_balance(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Kredit, debit FIFO, poin penyelesaian
-- -----------------------------------------------------------------------------

create function public.credit_points(p_user_id uuid, p_amount integer, p_reason public.point_reason, p_activity_id uuid, p_source_organizer_id uuid, p_redemption_id uuid, p_note text)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'credit_requires_positive_amount';
  end if;
  insert into public.point_ledger (user_id, amount, reason, activity_id, source_organizer_id, redemption_id, expires_at, note)
  values (p_user_id, p_amount, p_reason, p_activity_id, p_source_organizer_id, p_redemption_id,
    now() + make_interval(months => public.setting_int('points.expiry_months')), p_note)
  returning id into v_id;
  return v_id;
end;
$$;

-- Debit FIFO: kredit yang paling cepat kedaluwarsa dipakai lebih dulu.
create function public.debit_points(p_user_id uuid, p_amount integer, p_reason public.point_reason, p_redemption_id uuid, p_note text)
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

-- Poin penyelesaian: potong dari partner merchant pemilik checkpoint, lalu partner
-- merchant lain (host lebih dulu). Tanpa budget cukup: tidak ada poin.
create function public.grant_completion_points(p_user_id uuid, p_activity public.activities, p_preferred_organizer_id uuid)
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
        where l.activity_id = ap.activity_id and l.source_organizer_id = ap.organizer_id and l.reason = 'activity_reward'), 0) as remaining
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

revoke execute on function
  public.credit_points(uuid, integer, public.point_reason, uuid, uuid, uuid, text),
  public.debit_points(uuid, integer, public.point_reason, uuid, text),
  public.grant_completion_points(uuid, public.activities, uuid)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- perform_checkin: tambah poin saat selesai (event, challenge individu, grup)
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
    update public.participations set status = 'completed', progress = 1, completed_at = now() where id = v_p.id;
    v_completed := true;
    v_progress := 1;
    v_target_count := 1;
    v_points := public.grant_completion_points(v_uid, v_a, v_cp.partner_organizer_id);
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
-- Poin per penyelesaian di create/update_activity (kolom yang sudah ada)
-- -----------------------------------------------------------------------------

create function public.set_points_per_completion(p_activity_id uuid, p_points integer)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.activities;
begin
  perform public.active_uid();
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.is_activity_host_leader(p_activity_id) then
    raise exception 'not_allowed';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners') then
    raise exception 'activity_locked';
  end if;
  if p_points is null or p_points < 0 or p_points > 10000 then
    raise exception 'invalid_points';
  end if;
  update public.activities set points_per_completion = p_points where id = p_activity_id;
end;
$$;

revoke execute on function public.set_points_per_completion(uuid, integer) from public, anon;
grant execute on function public.set_points_per_completion(uuid, integer) to authenticated;

-- -----------------------------------------------------------------------------
-- Reward (merchant) dan voucher (warga, kasir)
-- Kode error: not_allowed, invalid_reward, reward_unavailable, out_of_stock,
--   insufficient_points, invalid_code, voucher_unavailable, invalid_outlet
-- -----------------------------------------------------------------------------

create function public.upsert_reward(p_organizer_id uuid, p_reward_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_id uuid := p_reward_id;
begin
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.organizers where id = p_organizer_id and type = 'merchant' and status = 'approved') then
    raise exception 'not_allowed';
  end if;
  begin
    if v_id is null then
      insert into public.rewards (organizer_id, title, description, image_url, price_points, stock, valid_days, available_until, status, created_by)
      values (
        p_organizer_id,
        btrim(p_data ->> 'title'),
        nullif(btrim(p_data ->> 'description'), ''),
        nullif(p_data ->> 'image_url', ''),
        (p_data ->> 'price_points')::integer,
        coalesce(nullif(p_data ->> 'stock', '')::integer, 0),
        coalesce(nullif(p_data ->> 'valid_days', '')::integer, 30),
        nullif(p_data ->> 'available_until', '')::timestamptz,
        coalesce(nullif(p_data ->> 'status', ''), 'active')::public.reward_status,
        v_uid
      ) returning id into v_id;
    else
      update public.rewards
      set title = coalesce(nullif(btrim(p_data ->> 'title'), ''), title),
          description = case when p_data ? 'description' then nullif(btrim(p_data ->> 'description'), '') else description end,
          image_url = coalesce(nullif(p_data ->> 'image_url', ''), image_url),
          price_points = coalesce(nullif(p_data ->> 'price_points', '')::integer, price_points),
          stock = coalesce(nullif(p_data ->> 'stock', '')::integer, stock),
          valid_days = coalesce(nullif(p_data ->> 'valid_days', '')::integer, valid_days),
          available_until = case when p_data ? 'available_until' then nullif(p_data ->> 'available_until', '')::timestamptz else available_until end,
          status = coalesce(nullif(p_data ->> 'status', ''), status::text)::public.reward_status
      where id = v_id and organizer_id = p_organizer_id;
      if not found then
        raise exception 'invalid_reward';
      end if;
    end if;
  exception
    when check_violation or not_null_violation or invalid_text_representation or invalid_datetime_format then
      raise exception 'invalid_reward';
  end;
  return v_id;
end;
$$;

-- Kode voucher 8 karakter tanpa huruf/angka yang mirip.
create function public.new_voucher_code()
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
    for i in 1..8 loop
      v_code := v_code || substr(v_chars, 1 + floor(random() * length(v_chars))::integer, 1);
    end loop;
    exit when not exists (select 1 from public.redemptions where code = v_code);
  end loop;
  return v_code;
end;
$$;

revoke execute on function public.new_voucher_code() from public, anon, authenticated;

create function public.redeem_reward(p_reward_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_r public.rewards;
  v_id uuid;
  v_code text;
  v_expires timestamptz;
begin
  select * into v_r from public.rewards where id = p_reward_id for update;
  if not found or v_r.status <> 'active' or (v_r.available_until is not null and v_r.available_until < now())
     or not exists (select 1 from public.organizers where id = v_r.organizer_id and status = 'approved') then
    raise exception 'reward_unavailable';
  end if;
  if v_r.stock <= 0 then
    raise exception 'out_of_stock';
  end if;
  v_code := public.new_voucher_code();
  v_expires := now() + make_interval(days => v_r.valid_days);
  insert into public.redemptions (reward_id, user_id, code, price_points, expires_at)
  values (p_reward_id, v_uid, v_code, v_r.price_points, v_expires)
  returning id into v_id;
  perform public.debit_points(v_uid, v_r.price_points, 'redemption', v_id, 'Tukar: ' || v_r.title);
  update public.rewards set stock = stock - 1 where id = p_reward_id;
  return jsonb_build_object('redemption_id', v_id, 'code', v_code, 'expires_at', v_expires, 'title', v_r.title, 'balance', public.points_balance(v_uid));
end;
$$;

-- Kasir: cek voucher tanpa memakainya.
create function public.lookup_voucher(p_organizer_id uuid, p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rd public.redemptions;
  v_r public.rewards;
  v_nick text;
begin
  perform public.active_uid();
  if not public.is_team_member(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  select rd.* into v_rd from public.redemptions rd
  join public.rewards r on r.id = rd.reward_id
  where rd.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) and r.organizer_id = p_organizer_id;
  if not found then
    raise exception 'invalid_code';
  end if;
  select * into v_r from public.rewards where id = v_rd.reward_id;
  select nickname into v_nick from public.profiles where id = v_rd.user_id;
  return jsonb_build_object(
    'redemption_id', v_rd.id, 'code', v_rd.code, 'title', v_r.title, 'description', v_r.description,
    'nickname', v_nick, 'status', v_rd.status, 'expires_at', v_rd.expires_at, 'used_at', v_rd.used_at,
    'valid', v_rd.status = 'active' and v_rd.expires_at > now()
  );
end;
$$;

create function public.use_voucher(p_code text, p_outlet_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_rd public.redemptions;
  v_r public.rewards;
  v_nick text;
begin
  select rd.* into v_rd from public.redemptions rd
  where rd.code = upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g')) for update;
  if not found then
    raise exception 'invalid_code';
  end if;
  select * into v_r from public.rewards where id = v_rd.reward_id;
  if not public.is_team_member(v_r.organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.merchant_outlets where id = p_outlet_id and organizer_id = v_r.organizer_id) then
    raise exception 'invalid_outlet';
  end if;
  if v_rd.status <> 'active' or v_rd.expires_at <= now() then
    raise exception 'voucher_unavailable';
  end if;
  update public.redemptions set status = 'used', used_at = now(), used_by = v_uid, used_outlet_id = p_outlet_id where id = v_rd.id;
  select nickname into v_nick from public.profiles where id = v_rd.user_id;
  return jsonb_build_object('redemption_id', v_rd.id, 'title', v_r.title, 'nickname', v_nick);
end;
$$;

create function public.refund_redemption(p_redemption_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_rd public.redemptions;
  v_r public.rewards;
begin
  select * into v_rd from public.redemptions where id = p_redemption_id for update;
  if not found then
    raise exception 'invalid_code';
  end if;
  select * into v_r from public.rewards where id = v_rd.reward_id;
  if not (public.is_admin() or public.is_team_leader(v_r.organizer_id)) then
    raise exception 'not_allowed';
  end if;
  if v_rd.status <> 'active' then
    raise exception 'voucher_unavailable';
  end if;
  update public.redemptions set status = 'refunded' where id = v_rd.id;
  update public.rewards set stock = stock + 1 where id = v_r.id;
  perform public.credit_points(v_rd.user_id, v_rd.price_points, 'refund', null, v_r.organizer_id, v_rd.id, 'Refund: ' || v_r.title);
  perform public.notify(v_rd.user_id, 'voucher_refunded', jsonb_build_object('redemption_id', v_rd.id, 'title', v_r.title, 'points', v_rd.price_points));
end;
$$;

revoke execute on function
  public.upsert_reward(uuid, uuid, jsonb), public.redeem_reward(uuid), public.lookup_voucher(uuid, text),
  public.use_voucher(text, uuid), public.refund_redemption(uuid)
  from public, anon;
grant execute on function
  public.upsert_reward(uuid, uuid, jsonb), public.redeem_reward(uuid), public.lookup_voucher(uuid, text),
  public.use_voucher(text, uuid), public.refund_redemption(uuid)
  to authenticated;

-- -----------------------------------------------------------------------------
-- Cron: kedaluwarsa poin dan voucher (harian 00.05 WIB = 17.05 UTC)
-- -----------------------------------------------------------------------------

create function public.expire_points()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_debit uuid;
  v_count integer := 0;
begin
  for v_row in
    select c.id, c.user_id, c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0) as remaining
    from public.point_ledger c
    where c.amount > 0 and c.expires_at <= now()
  loop
    if v_row.remaining > 0 then
      insert into public.point_ledger (user_id, amount, reason, note)
      values (v_row.user_id, -v_row.remaining, 'expiry', 'Poin kedaluwarsa')
      returning id into v_debit;
      insert into public.point_allocations (credit_id, debit_id, amount) values (v_row.id, v_debit, v_row.remaining);
      v_count := v_count + 1;
    end if;
  end loop;
  return v_count;
end;
$$;

create function public.expire_redemptions()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  update public.redemptions set status = 'expired' where status = 'active' and expires_at <= now();
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke execute on function public.expire_points(), public.expire_redemptions() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('expire_points', '5 17 * * *', $cron$select public.expire_points()$cron$);
  perform cron.schedule('expire_redemptions', '6 17 * * *', $cron$select public.expire_redemptions()$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal poin dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

-- Voucher yang ditukar untuk reward merchant (tim merchant dan admin): nickname saja.
create view public.v_reward_redemptions as
select
  rd.id, rd.reward_id, r.organizer_id, r.title, rd.code, rd.price_points, rd.status, rd.expires_at, rd.used_at, rd.used_outlet_id, rd.created_at,
  pr.nickname::text as nickname, o.name as outlet_name
from public.redemptions rd
join public.rewards r on r.id = rd.reward_id
join public.profiles pr on pr.id = rd.user_id
left join public.merchant_outlets o on o.id = rd.used_outlet_id
where public.is_team_member(r.organizer_id) or (select public.is_admin());

grant select on public.v_reward_redemptions to authenticated;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

revoke all on table public.rewards, public.redemptions, public.point_ledger, public.point_allocations from anon, authenticated;
alter table public.rewards enable row level security;
alter table public.redemptions enable row level security;
alter table public.point_ledger enable row level security;
alter table public.point_allocations enable row level security;

-- Reward aktif terlihat semua warga; semua reward terlihat tim merchant dan admin.
grant select on public.rewards to authenticated;
create policy rewards_select on public.rewards
  for select to authenticated
  using (status = 'active' or public.is_team_member(organizer_id) or (select public.is_admin()));

grant select on public.redemptions to authenticated;
create policy redemptions_select on public.redemptions
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or exists (select 1 from public.rewards r where r.id = reward_id and public.is_team_member(r.organizer_id))
    or (select public.is_admin())
  );

grant select on public.point_ledger to authenticated;
create policy point_ledger_select on public.point_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

grant select on public.point_allocations to authenticated;
create policy point_allocations_select on public.point_allocations
  for select to authenticated
  using (
    exists (select 1 from public.point_ledger l where l.id = credit_id and (l.user_id = (select auth.uid()) or (select public.is_admin())))
  );
