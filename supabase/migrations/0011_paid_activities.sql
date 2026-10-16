-- 0011_paid_activities.sql — Irisan 11: Aktivitas berbayar
--
-- Kolom harga (activities) dan status bayar (participations) sudah ada sejak
-- irisan 3; perform_checkin, complete_mission, dan mark_missions_manual sudah
-- menolak payment_status selain not_required/paid. Irisan ini menambahkan:
--   create_activity/update_activity menerima harga (hanya owner/chair host),
--   submit_payment_proof, confirm_payment, mark_refunded,
--   v_activity_payment_stats, v_admin_refund_queue, v_admin_overview (refund),
--   cron expire_unpaid_participations, bucket payment-proofs (privat),
--   confirm_group_registration menyegarkan batas bayar.
-- Aturan (ALUR bagian 8): uang tidak lewat Ramein; harga >= payment.min_price_idr;
-- batas bayar = join + payment_window_hours, dipotong ke starts_at; harga dan
-- status berbayar terkunci setelah published (trigger di irisan 3).

-- -----------------------------------------------------------------------------
-- Harga di create_activity / update_activity
-- -----------------------------------------------------------------------------

-- Membaca dan memvalidasi harga dari jsonb formulir. Mengembalikan jsonb
-- {is_paid, price_idr, payment_instructions, payment_window_hours} atau null jika
-- formulir tidak menyentuh harga.
create function public.read_pricing(p_data jsonb)
returns jsonb
language plpgsql
stable
set search_path = ''
as $$
declare
  v_paid boolean;
  v_price integer;
  v_instr text;
  v_window integer;
begin
  if not (p_data ? 'is_paid') then
    return null;
  end if;
  v_paid := coalesce((p_data ->> 'is_paid')::boolean, false);
  v_price := nullif(regexp_replace(coalesce(p_data ->> 'price_idr', ''), '[^0-9]', '', 'g'), '')::integer;
  v_instr := nullif(btrim(coalesce(p_data ->> 'payment_instructions', '')), '');
  v_window := coalesce(nullif(p_data ->> 'payment_window_hours', '')::integer, public.setting_int('payment.default_window_hours'));
  if not v_paid then
    return jsonb_build_object('is_paid', false, 'price_idr', null, 'payment_instructions', null, 'payment_window_hours', v_window);
  end if;
  if v_price is null or v_price < public.setting_int('payment.min_price_idr') or v_instr is null then
    raise exception 'invalid_payment';
  end if;
  if v_window < 1 or v_window > 720 then
    raise exception 'invalid_payment_window';
  end if;
  return jsonb_build_object('is_paid', true, 'price_idr', v_price, 'payment_instructions', v_instr, 'payment_window_hours', v_window);
end;
$$;

revoke execute on function public.read_pricing(jsonb) from public, anon, authenticated;

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
  v_pricing jsonb;
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
  -- Harga hanya boleh diatur owner/chair host (admin untuk event Ramein).
  v_pricing := public.read_pricing(p_data);
  if v_pricing is not null and (v_pricing ->> 'is_paid')::boolean
     and not (public.is_team_leader(p_host_organizer_id) or (v_host.type = 'platform' and public.is_admin())) then
    raise exception 'pricing_leader_only';
  end if;

  begin
    insert into public.activities (
      host_organizer_id, type, goal, title, description, scope_region_id, starts_at, ends_at,
      quota, difficulty, join_mode, group_min, group_max, target_scope, residency_rule, audience,
      is_paid, price_idr, payment_instructions, payment_window_hours,
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
      coalesce((v_pricing ->> 'is_paid')::boolean, false),
      (v_pricing ->> 'price_idr')::integer,
      v_pricing ->> 'payment_instructions',
      coalesce((v_pricing ->> 'payment_window_hours')::integer, public.setting_int('payment.default_window_hours')),
      v_uid
    ) returning id into v_id;
  exception
    when check_violation then
      raise exception '%', case
        when sqlerrm like '%activities_title%' then 'invalid_title'
        when sqlerrm like '%activities_time_order%' then 'invalid_time'
        when sqlerrm like '%activities_group_size%' then 'invalid_group_size'
        when sqlerrm like '%activities_residency_scope%' then 'invalid_region'
        when sqlerrm like '%payment%' or sqlerrm like '%price%' then 'invalid_payment'
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
  v_pricing jsonb;
  v_pricing_changed boolean := false;
begin
  perform public.active_uid();
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.is_activity_host_team(p_activity_id) then
    raise exception 'not_allowed';
  end if;

  if v_a.status in ('published', 'running') then
    -- Setelah terbit hanya deskripsi, cover, dan instruksi bayar (bukan harga) yang bisa diubah.
    v_pricing := public.read_pricing(p_data);
    if v_pricing is not null and ((v_pricing ->> 'is_paid')::boolean <> v_a.is_paid
       or (v_pricing ->> 'price_idr')::integer is distinct from v_a.price_idr) then
      raise exception 'price_locked_after_publish';
    end if;
    update public.activities
    set description = coalesce(nullif(btrim(p_data ->> 'description'), ''), description),
        cover_url = coalesce(p_data ->> 'cover_url', cover_url),
        payment_instructions = case when is_paid and public.is_activity_host_leader(p_activity_id)
          then coalesce(nullif(btrim(p_data ->> 'payment_instructions'), ''), payment_instructions) else payment_instructions end
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
  v_pricing := public.read_pricing(p_data);
  if v_pricing is not null then
    v_pricing_changed := (v_pricing ->> 'is_paid')::boolean <> v_a.is_paid
      or (v_pricing ->> 'price_idr')::integer is distinct from v_a.price_idr
      or (v_pricing ->> 'payment_instructions') is distinct from v_a.payment_instructions
      or (v_pricing ->> 'payment_window_hours')::integer <> v_a.payment_window_hours;
    if v_pricing_changed and not public.is_activity_host_leader(p_activity_id) then
      raise exception 'pricing_leader_only';
    end if;
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
        is_paid = coalesce((v_pricing ->> 'is_paid')::boolean, is_paid),
        price_idr = case when v_pricing is null then price_idr else (v_pricing ->> 'price_idr')::integer end,
        payment_instructions = case when v_pricing is null then payment_instructions else v_pricing ->> 'payment_instructions' end,
        payment_window_hours = coalesce((v_pricing ->> 'payment_window_hours')::integer, payment_window_hours),
        review_note = null
    where id = p_activity_id;
  exception
    when check_violation then
      raise exception '%', case
        when sqlerrm like '%activities_title%' then 'invalid_title'
        when sqlerrm like '%activities_time_order%' then 'invalid_time'
        when sqlerrm like '%activities_group_size%' then 'invalid_group_size'
        when sqlerrm like '%activities_residency_scope%' then 'invalid_region'
        when sqlerrm like '%payment%' or sqlerrm like '%price%' then 'invalid_payment'
        else 'invalid_activity' end;
    when invalid_datetime_format then
      raise exception 'invalid_time';
  end;

  perform public.upsert_challenge_target(p_activity_id, case when v_type = 'challenge' and not exists (select 1 from public.challenge_targets where activity_id = p_activity_id)
    then p_data || jsonb_build_object('target_count', coalesce(nullif(p_data ->> 'target_count', ''), '1')) else p_data end);
end;
$$;

-- Anggota grup yang baru mengonfirmasi mendapat batas bayar baru dari saat ini.
create or replace function public.confirm_group_registration(p_participation_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
begin
  select a.* into v_a from public.activities a join public.participations p on p.activity_id = a.id where p.id = p_participation_id;
  update public.participations
  set status = case when p_accept then 'registered'::public.participation_status else 'cancelled'::public.participation_status end,
      payment_due_at = case when p_accept and payment_status = 'unpaid' then public.payment_due_for(v_a) else payment_due_at end
  where id = p_participation_id and user_id = v_uid and status = 'invited';
  if not found then
    raise exception 'cannot_confirm';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Batas waktu bayar: join + payment_window_hours, dipotong ke starts_at;
-- jika aktivitas sudah (hampir) mulai, dipotong ke ends_at supaya pendaftar
-- saat berjalan tetap punya waktu bayar.
-- -----------------------------------------------------------------------------

create function public.payment_due_for(p_activity public.activities)
returns timestamptz
language sql
stable
set search_path = ''
as $$
  select least(now() + make_interval(hours => p_activity.payment_window_hours),
    case when p_activity.starts_at > now() + interval '1 hour' then p_activity.starts_at else p_activity.ends_at end);
$$;

-- Dipasang saat baris masuk ke status unpaid (join, daftar ulang, undangan grup).
create function public.set_payment_due()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a public.activities;
begin
  if new.payment_status = 'unpaid' and (tg_op = 'INSERT' or old.payment_status <> 'unpaid' or old.status in ('cancelled', 'not_completed')) then
    select * into v_a from public.activities where id = new.activity_id;
    new.payment_due_at := public.payment_due_for(v_a);
  end if;
  return new;
end;
$$;

create trigger participations_set_payment_due
  before insert or update of payment_status, status on public.participations
  for each row execute function public.set_payment_due();

-- -----------------------------------------------------------------------------
-- Warga: kirim bukti bayar
-- Kode error: invalid_participation, payment_not_required, payment_already_paid,
--   proof_required, activity_closed
-- -----------------------------------------------------------------------------

create function public.submit_payment_proof(p_participation_id uuid, p_proof_path text)
returns jsonb
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
  if not found or v_p.status not in ('registered', 'in_progress') then
    raise exception 'invalid_participation';
  end if;
  if v_p.payment_status = 'not_required' then
    raise exception 'payment_not_required';
  end if;
  if v_p.payment_status in ('paid', 'refunded') then
    raise exception 'payment_already_paid';
  end if;
  select * into v_a from public.activities where id = v_p.activity_id;
  if v_a.status not in ('published', 'running') then
    raise exception 'activity_closed';
  end if;
  if p_proof_path is null or p_proof_path not like v_a.id::text || '/' || v_uid::text || '/%' then
    raise exception 'proof_required';
  end if;
  update public.participations
  set payment_status = 'awaiting_confirmation', payment_proof_path = p_proof_path, payment_note = null
  where id = p_participation_id;
  perform public.notify_team(v_a.host_organizer_id, 'payment_proof_submitted',
    jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'participation_id', v_p.id, 'user_id', v_uid, 'price_idr', v_a.price_idr));
  return jsonb_build_object('participation_id', v_p.id, 'payment_status', 'awaiting_confirmation');
end;
$$;

-- -----------------------------------------------------------------------------
-- Tim host: konfirmasi lunas / tolak bukti / tandai refund
-- Kode error: not_allowed, invalid_participation, payment_not_required,
--   payment_already_paid, note_required, not_refundable
-- -----------------------------------------------------------------------------

create function public.confirm_payment(p_participation_id uuid, p_paid boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_p public.participations;
  v_a public.activities;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
begin
  select * into v_p from public.participations where id = p_participation_id for update;
  if not found then
    raise exception 'invalid_participation';
  end if;
  if not public.is_activity_host_team(v_p.activity_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_a from public.activities where id = v_p.activity_id;
  if v_p.status not in ('registered', 'in_progress') then
    raise exception 'invalid_participation';
  end if;
  if v_p.payment_status = 'not_required' then
    raise exception 'payment_not_required';
  end if;
  if v_p.payment_status in ('paid', 'refunded') then
    raise exception 'payment_already_paid';
  end if;

  if p_paid then
    update public.participations
    set payment_status = 'paid', payment_confirmed_by = v_uid, payment_confirmed_at = now(), payment_note = v_note
    where id = p_participation_id;
    perform public.notify(v_p.user_id, 'payment_confirmed',
      jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'price_idr', v_a.price_idr));
  else
    if v_note is null then
      raise exception 'note_required';
    end if;
    -- Kembali ke unpaid dengan catatan; beri waktu bayar lagi supaya tidak langsung kedaluwarsa.
    update public.participations
    set payment_status = 'unpaid', payment_note = v_note,
        payment_due_at = greatest(coalesce(payment_due_at, now()), public.payment_due_for(v_a))
    where id = p_participation_id;
    perform public.notify(v_p.user_id, 'payment_rejected',
      jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'note', v_note));
  end if;
  return jsonb_build_object('participation_id', v_p.id, 'payment_status', case when p_paid then 'paid' else 'unpaid' end);
end;
$$;

-- Refund hanya untuk peserta yang sudah bayar lalu batal, atau aktivitasnya dibatalkan.
create function public.mark_refunded(p_participation_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_p public.participations;
  v_a public.activities;
begin
  select * into v_p from public.participations where id = p_participation_id for update;
  if not found then
    raise exception 'invalid_participation';
  end if;
  if not public.is_activity_host_team(v_p.activity_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_a from public.activities where id = v_p.activity_id;
  if v_p.payment_status <> 'paid' or not (v_p.status = 'cancelled' or v_a.status = 'cancelled') then
    raise exception 'not_refundable';
  end if;
  update public.participations
  set payment_status = 'refunded', refunded_at = now(),
      payment_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), payment_note)
  where id = p_participation_id;
  perform public.notify(v_p.user_id, 'payment_refunded',
    jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'price_idr', v_a.price_idr, 'note', nullif(btrim(coalesce(p_note, '')), '')));
  return jsonb_build_object('participation_id', v_p.id, 'payment_status', 'refunded');
end;
$$;

grant execute on function
  public.submit_payment_proof(uuid, text), public.confirm_payment(uuid, boolean, text), public.mark_refunded(uuid, text)
to authenticated;

-- -----------------------------------------------------------------------------
-- cancel_activity: peserta lunas yang sudah selesai juga diberi tahu refund,
-- dan tim host diberi tahu jumlah refund yang harus diurus.
-- -----------------------------------------------------------------------------

create or replace function public.cancel_activity(p_activity_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_admin boolean := public.is_admin();
  v_refunds integer;
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
    jsonb_build_object('activity_id', p_activity_id, 'title', v_a.title, 'reason', nullif(btrim(p_reason), ''), 'price_idr', v_a.price_idr)
  from public.participations
  where activity_id = p_activity_id and (status in ('invited', 'registered', 'in_progress') or payment_status = 'paid');

  update public.participations set status = 'cancelled'
  where activity_id = p_activity_id and status in ('invited', 'registered', 'in_progress');

  select count(*) into v_refunds from public.participations where activity_id = p_activity_id and payment_status = 'paid';
  if v_refunds > 0 then
    perform public.notify_team(v_a.host_organizer_id, 'payment_refund_due',
      jsonb_build_object('activity_id', p_activity_id, 'title', v_a.title, 'count', v_refunds, 'price_idr', v_a.price_idr));
  end if;

  if v_admin then
    insert into public.admin_actions (admin_id, action, target_table, target_id, note)
    values (v_uid, 'cancel_activity', 'activities', p_activity_id, nullif(btrim(p_reason), ''));
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Cron: pendaftar yang lewat batas bayar dibatalkan (kursi kuota kembali).
-- awaiting_confirmation tidak disentuh supaya bukti yang sudah dikirim tetap ditinjau.
-- -----------------------------------------------------------------------------

create function public.expire_unpaid_participations()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_n integer := 0;
begin
  for v_row in
    select p.id, p.user_id, a.id as activity_id, a.title, a.price_idr
    from public.participations p
    join public.activities a on a.id = p.activity_id
    where p.payment_status = 'unpaid' and p.status in ('registered', 'in_progress')
      and p.payment_due_at is not null and p.payment_due_at <= now()
      and a.status in ('published', 'running')
  loop
    update public.participations set status = 'cancelled', payment_note = 'Lewat batas waktu bayar' where id = v_row.id;
    perform public.notify(v_row.user_id, 'payment_expired',
      jsonb_build_object('activity_id', v_row.activity_id, 'title', v_row.title, 'price_idr', v_row.price_idr));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

revoke execute on function public.expire_unpaid_participations() from public, anon, authenticated;

create index if not exists participations_payment_due_idx on public.participations (payment_due_at) where payment_status = 'unpaid';
create index if not exists participations_awaiting_idx on public.participations (activity_id) where payment_status = 'awaiting_confirmation';

do $$
begin
  perform cron.schedule('expire_unpaid_participations', '*/5 * * * *', $cron$select public.expire_unpaid_participations()$cron$);
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal kedaluwarsa bayar dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- View
-- -----------------------------------------------------------------------------

-- Per aktivitas berbayar: jumlah per status bayar dan perkiraan nilai (informasi saja).
create view public.v_activity_payment_stats as
select
  a.id as activity_id, a.host_organizer_id, a.title, a.status, a.price_idr,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'unpaid' and p.status in ('invited', 'registered', 'in_progress'))::integer as unpaid,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'awaiting_confirmation' and p.status in ('registered', 'in_progress'))::integer as awaiting_confirmation,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'paid')::integer as paid,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'refunded')::integer as refunded,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'paid' and (p.status = 'cancelled' or a.status = 'cancelled'))::integer as refund_due,
  ((select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'paid') * coalesce(a.price_idr, 0))::bigint as expected_idr
from public.activities a
where a.is_paid and (public.is_activity_host_team(a.id) or (select public.is_admin()));

grant select on public.v_activity_payment_stats to authenticated;

-- Antrean refund untuk admin: aktivitas dibatalkan (atau peserta batal) yang masih punya peserta paid.
create view public.v_admin_refund_queue as
select
  a.id as activity_id, a.title, a.status as activity_status, a.price_idr, a.updated_at as cancelled_at,
  o.id as host_organizer_id, o.name as host_name, o.type as host_type, coalesce(mp.whatsapp, cp.whatsapp) as host_whatsapp,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'paid' and (p.status = 'cancelled' or a.status = 'cancelled'))::integer as refund_due,
  (select count(*) from public.participations p where p.activity_id = a.id and p.payment_status = 'refunded')::integer as refunded,
  (select min(p.updated_at) from public.participations p where p.activity_id = a.id and p.payment_status = 'paid' and (p.status = 'cancelled' or a.status = 'cancelled')) as oldest_due_at
from public.activities a
join public.organizers o on o.id = a.host_organizer_id
left join public.merchant_profiles mp on mp.organizer_id = o.id
left join public.community_profiles cp on cp.organizer_id = o.id
where a.is_paid
  and exists (select 1 from public.participations p where p.activity_id = a.id and p.payment_status = 'paid' and (p.status = 'cancelled' or a.status = 'cancelled'))
  and (select public.is_admin());

grant select on public.v_admin_refund_queue to authenticated;

-- Ringkasan admin: refund yang belum ditandai dihitung per peserta (aktivitas atau peserta dibatalkan).
create or replace view public.v_admin_overview as
select
  (select count(distinct c.user_id) from public.checkins c where c.checked_in_at >= now() - interval '7 days' and c.review_status <> 'rejected')::integer as weekly_active,
  (select count(distinct c.user_id) from public.checkins c where c.checked_in_at >= now() - interval '14 days' and c.checked_in_at < now() - interval '7 days' and c.review_status <> 'rejected')::integer as weekly_active_prev,
  (select count(*) from public.profiles p where p.onboarded_at is not null and p.deleted_at is null)::integer as citizens,
  (select count(*) from public.activities a where a.status in ('published', 'running'))::integer as running_activities,
  (select count(*) from public.activities a where a.status in ('published', 'running') and a.type = 'event')::integer as running_events,
  (select count(*) from public.activities a where a.status in ('published', 'running') and a.type = 'challenge')::integer as running_challenges,
  (select count(*) from public.organizers o where o.type = 'merchant' and o.status = 'approved')::integer as active_merchants,
  (select count(*) from public.organizers o where o.type = 'community' and o.status = 'approved')::integer as active_communities,
  (select coalesce(sum(c.amount - coalesce((select sum(al.amount) from public.point_allocations al where al.credit_id = c.id), 0)), 0)
    from public.point_ledger c where c.amount > 0 and c.expires_at > now())::integer as points_circulating,
  (select coalesce(sum(-l.amount), 0) from public.point_ledger l
    where l.reason = 'redemption' and l.created_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta')::integer as points_redeemed_month,
  (select count(*) from public.organizers o where o.status = 'pending')::integer as pending_organizers,
  (select count(*) from public.organizers o where o.status = 'pending' and o.type = 'merchant')::integer as pending_merchants,
  (select count(*) from public.activities a where a.status = 'in_review')::integer as pending_activities,
  (select min(a.updated_at) from public.activities a where a.status = 'in_review') as oldest_pending_activity_at,
  (select count(*) from public.checkins c where c.review_status = 'flagged')::integer as flagged_checkins,
  (select count(*) from public.fraud_flags f where f.status = 'open' and f.kind <> 'out_of_radius')::integer as open_pattern_flags,
  (select count(*) from public.participations p join public.activities a on a.id = p.activity_id
    where p.payment_status = 'paid' and (p.status = 'cancelled' or a.status = 'cancelled'))::integer as refunds_pending
where (select public.is_admin());

-- -----------------------------------------------------------------------------
-- Bucket bukti bayar (privat): activity_id/user_id/<file>
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage tidak tersedia, bucket payment-proofs dilewati';
    return;
  end if;
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values ('payment-proofs', 'payment-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;
  execute $p$
    create policy payment_proofs_write_own on storage.objects
      for insert to authenticated
      with check (bucket_id = 'payment-proofs' and (storage.foldername(name))[2] = auth.uid()::text)
  $p$;
  execute $p$
    create policy payment_proofs_read on storage.objects
      for select to authenticated
      using (bucket_id = 'payment-proofs' and (
        (storage.foldername(name))[2] = auth.uid()::text
        or public.is_activity_host_team((storage.foldername(name))[1]::uuid)
        or (select public.is_admin())))
  $p$;
end;
$$;
