-- 0020: voucher berlaku di outlet tertentu dan deteksi peninjau yang menyetujui terlalu cepat
-- (ALUR-SISTEM bagian 16 dan 19).
--
-- Isi:
--   * rewards.valid_outlet_ids (null = semua outlet) + trigger outlet milik merchant yang sama dan aktif;
--     upsert_reward menerima daftar outlet; use_voucher menolak outlet lain (outlet_not_valid).
--   * flag_kind reviewer_burst, fraud_flags.organizer_id, check_reviewer_burst dipanggil
--     review_mission_completion. Persetujuan tetap berlaku; flag hanya peringatan untuk admin.
--   * v_moderation_flags menampilkan penyelenggara dan aktivitas flag peninjau.
--   * app_settings: fraud.reviewer_burst_count, fraud.reviewer_burst_minutes, payment.gasyu_whatsapp.
--
-- Catatan: nilai enum baru tidak boleh dipakai di transaksi yang sama dengan ALTER TYPE, jadi
-- indeks flag peninjau memakai organizer_id is not null (hanya reviewer_burst yang mengisinya).

alter type public.flag_kind add value if not exists 'reviewer_burst';

insert into public.app_settings (key, value) values
  ('fraud.reviewer_burst_count', '50'),
  ('fraud.reviewer_burst_minutes', '10'),
  ('payment.gasyu_whatsapp', '""')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Voucher per outlet
-- -----------------------------------------------------------------------------

alter table public.rewards add column valid_outlet_ids uuid[];
alter table public.rewards add constraint rewards_valid_outlets_not_empty
  check (valid_outlet_ids is null or cardinality(valid_outlet_ids) > 0);

-- Setiap outlet harus milik merchant yang sama dan aktif. Hanya dicek saat daftar outlet berubah,
-- supaya reward lama tetap bisa diedit walaupun salah satu outletnya kemudian dinonaktifkan.
create function public.check_reward_outlets()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.valid_outlet_ids is null then
    return new;
  end if;
  if tg_op = 'UPDATE' and new.valid_outlet_ids is not distinct from old.valid_outlet_ids then
    return new;
  end if;
  if exists (
    select 1 from unnest(new.valid_outlet_ids) as x(outlet_id)
    where not exists (
      select 1 from public.merchant_outlets o
      where o.id = x.outlet_id and o.organizer_id = new.organizer_id and o.is_active
    )
  ) then
    raise exception 'invalid_outlet';
  end if;
  return new;
end;
$$;

create trigger rewards_check_outlets
  before insert or update of valid_outlet_ids on public.rewards
  for each row execute function public.check_reward_outlets();

create or replace function public.upsert_reward(p_organizer_id uuid, p_reward_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_id uuid := p_reward_id;
  v_outlets uuid[];
begin
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.organizers where id = p_organizer_id and type = 'merchant' and status = 'approved') then
    raise exception 'not_allowed';
  end if;
  -- valid_outlet_ids: null/absen = semua outlet; array = outlet tertentu (minimal satu).
  if jsonb_typeof(p_data -> 'valid_outlet_ids') = 'array' then
    if jsonb_array_length(p_data -> 'valid_outlet_ids') = 0 then
      raise exception 'outlets_required';
    end if;
    begin
      select array_agg(distinct value::uuid) into v_outlets from jsonb_array_elements_text(p_data -> 'valid_outlet_ids');
    exception when invalid_text_representation then
      raise exception 'invalid_outlet';
    end;
  end if;
  begin
    if v_id is null then
      insert into public.rewards (organizer_id, title, description, image_url, price_points, stock, valid_days, available_until, status, created_by, valid_outlet_ids)
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
        v_uid,
        v_outlets
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
          status = coalesce(nullif(p_data ->> 'status', ''), status::text)::public.reward_status,
          valid_outlet_ids = case when p_data ? 'valid_outlet_ids' then v_outlets else valid_outlet_ids end
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

create or replace function public.use_voucher(p_code text, p_outlet_id uuid)
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
  if v_r.valid_outlet_ids is not null and not (p_outlet_id = any (v_r.valid_outlet_ids)) then
    raise exception 'outlet_not_valid';
  end if;
  update public.redemptions set status = 'used', used_at = now(), used_by = v_uid, used_outlet_id = p_outlet_id where id = v_rd.id;
  select nickname into v_nick from public.profiles where id = v_rd.user_id;
  return jsonb_build_object('redemption_id', v_rd.id, 'title', v_r.title, 'nickname', v_nick);
end;
$$;

-- -----------------------------------------------------------------------------
-- Peninjau terlalu cepat (reviewer_burst)
-- -----------------------------------------------------------------------------

alter table public.fraud_flags add column organizer_id uuid references public.organizers (id);
create index fraud_flags_organizer_idx on public.fraud_flags (organizer_id) where organizer_id is not null;
create index mission_completions_reviewer_idx on public.mission_completions (reviewed_by, reviewed_at)
  where status = 'approved' and proof_path is not null;

-- Satu flag per peninjau per jendela waktu jika ia menyetujui >= fraud.reviewer_burst_count bukti
-- foto dalam fraud.reviewer_burst_minutes menit.
create function public.check_reviewer_burst(p_reviewer uuid, p_activity_id uuid, p_organizer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer := public.setting_int('fraud.reviewer_burst_count');
  v_minutes integer := public.setting_int('fraud.reviewer_burst_minutes');
  v_since timestamptz := now() - make_interval(mins => v_minutes);
  v_n integer;
begin
  select count(*) into v_n from public.mission_completions
  where reviewed_by = p_reviewer and status = 'approved' and proof_path is not null and reviewed_at > v_since;
  if v_n < v_count then
    return;
  end if;
  if exists (
    select 1 from public.fraud_flags
    where user_id = p_reviewer and kind::text = 'reviewer_burst' and created_at > v_since
  ) then
    return;
  end if;
  insert into public.fraud_flags (user_id, organizer_id, kind, detail)
  values (p_reviewer, p_organizer_id, 'reviewer_burst'::text::public.flag_kind, jsonb_build_object(
    'activity_id', p_activity_id,
    'activity_title', (select title from public.activities where id = p_activity_id),
    'approvals', v_n,
    'window_minutes', v_minutes
  ));
end;
$$;

revoke execute on function public.check_reviewer_burst(uuid, uuid, uuid) from public, anon, authenticated;

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
    perform public.check_reviewer_burst(v_uid, v_a.id,
      case when public.is_team_member(v_m.partner_organizer_id) then v_m.partner_organizer_id else v_a.host_organizer_id end);
    perform public.notify(v_c.user_id, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward,
      'completed', (v_eval ->> 'completed')::boolean));
  else
    perform public.notify(v_c.user_id, 'mission_rejected', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'note', nullif(btrim(p_note), '')));
  end if;
  return v_eval || jsonb_build_object('approved', p_approve);
end;
$$;

-- Daftar flag untuk admin: tambah penyelenggara, dan aktivitas dari detail jika flag tidak terkait check-in.
create or replace view public.v_moderation_flags as
select
  f.id, f.user_id, f.checkin_id, f.kind, f.detail, f.status, f.created_at, f.reviewed_at,
  pr.nickname::text as nickname, pr.suspended_at, r.name as village_name,
  a.title as activity_title, cp.name as checkpoint_name, o.name as partner_name,
  f.organizer_id, fo.name as organizer_name, fo.type as organizer_type
from public.fraud_flags f
join public.profiles pr on pr.id = f.user_id
left join public.regions r on r.id = pr.home_village_id
left join public.checkins c on c.id = f.checkin_id
left join public.activities a on a.id = coalesce(c.activity_id, (f.detail ->> 'activity_id')::uuid)
left join public.activity_checkpoints cp on cp.id = c.checkpoint_id
left join public.organizers o on o.id = c.partner_organizer_id
left join public.organizers fo on fo.id = f.organizer_id
where f.kind <> 'out_of_radius' and (select public.is_admin());
