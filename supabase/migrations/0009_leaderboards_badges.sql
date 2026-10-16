-- 0009_leaderboards_badges.sql — Irisan 9: Leaderboard dan badge
--
-- Isi: badges + seed, user_badges, monthly_village_winners, leaderboard_users(),
--      v_leaderboard_users_month, v_leaderboard_villages_month, get_leaderboard,
--      user_streak_weeks, award_badges (+ trigger tertunda setelah check-in),
--      award_streak (cron Senin), snapshot_monthly_winners (cron bulanan),
--      get_citizen_dashboard diperbarui (badge, streak, peringkat), RLS.
-- Aturan: XP kelurahan memakai snapshot xp_ledger.village_id; warga luar Cimahi
-- tidak masuk peringkat kelurahan; peringkat kelurahan hanya untuk kelurahan
-- dengan warga aktif >= app_settings 'leaderboard.min_active_citizens'.

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.badges (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code ~ '^[a-z_]{3,40}$'),
  name text not null,
  description text not null,
  icon_url text,
  rule jsonb not null default '{}'::jsonb,
  sort_order smallint not null default 0,
  created_at timestamptz not null default now()
);

insert into public.badges (code, name, description, rule, sort_order) values
  ('first_step', 'Langkah Pertama', 'Check-in pertama kamu di Ramein.', '{"type":"checkins","count":1}', 1),
  ('village_explorer', 'Penjelajah Kelurahan', 'Check-in di 5 kelurahan berbeda.', '{"type":"distinct_villages","count":5}', 2),
  ('regular', 'Langganan', 'Check-in di penyelenggara yang sama 5 kali.', '{"type":"same_organizer","count":5}', 3),
  ('collaborator', 'Kolaborator', 'Ikut 3 aktivitas kolaborasi.', '{"type":"collab_activities","count":3}', 4),
  ('consistent', 'Konsisten', 'Check-in 4 minggu berturut-turut.', '{"type":"streak_weeks","count":4}', 5),
  ('one_team', 'Satu Tim', 'Ikut 3 aktivitas sebagai grup.', '{"type":"group_activities","count":3}', 6);

create table public.user_badges (
  user_id uuid not null references public.profiles (id),
  badge_id uuid not null references public.badges (id),
  awarded_at timestamptz not null default now(),
  activity_id uuid references public.activities (id),
  primary key (user_id, badge_id)
);

create index user_badges_user_idx on public.user_badges (user_id, awarded_at desc);

create table public.monthly_village_winners (
  month date not null check (month = date_trunc('month', month)::date),
  village_id uuid not null references public.regions (id),
  rank smallint not null check (rank between 1 and 10),
  avg_xp numeric(10, 1) not null,
  active_citizens integer not null,
  created_at timestamptz not null default now(),
  primary key (month, rank)
);

-- -----------------------------------------------------------------------------
-- Leaderboard
-- -----------------------------------------------------------------------------

-- XP per warga dalam satu bulan (WIB) beserta peringkat kota dan kelurahan.
-- Security definer karena membaca XP semua warga; hanya mengembalikan nickname.
create function public.leaderboard_users(p_month date default null)
returns table (user_id uuid, nickname text, village_id uuid, village_name text, xp_month integer, rank_city integer, rank_village integer)
language sql
stable
security definer
set search_path = ''
as $$
  with m as (
    select date_trunc('month', coalesce(p_month, public.local_today()))::date as start_date
  ), xp as (
    select x.user_id, sum(x.amount)::integer as xp_month
    from public.xp_ledger x, m
    where x.local_date >= m.start_date and x.local_date < (m.start_date + interval '1 month')::date
    group by x.user_id
    having sum(x.amount) > 0
  )
  select
    p.id as user_id,
    p.nickname::text as nickname,
    p.home_village_id as village_id,
    r.name as village_name,
    xp.xp_month,
    dense_rank() over (order by xp.xp_month desc)::integer as rank_city,
    case when p.home_village_id is null then null
      else dense_rank() over (partition by p.home_village_id order by xp.xp_month desc)::integer end as rank_village
  from xp
  join public.profiles p on p.id = xp.user_id
  left join public.regions r on r.id = p.home_village_id
  where p.suspended_at is null and p.deleted_at is null and p.onboarded_at is not null;
$$;

revoke execute on function public.leaderboard_users(date) from public, anon, authenticated;

create view public.v_leaderboard_users_month as
select * from public.leaderboard_users(null);

-- Peringkat kelurahan: rata-rata XP per warga aktif (snapshot village_id di xp_ledger),
-- hanya kelurahan dengan warga aktif >= batas minimum.
create function public.leaderboard_villages(p_month date default null)
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

-- Hanya agregat per kelurahan, boleh dibaca pengguna login (dipakai view di bawah).
revoke execute on function public.leaderboard_villages(date) from public, anon;
grant execute on function public.leaderboard_villages(date) to authenticated;

create view public.v_leaderboard_villages_month as
select village_id, village_name, district_name, xp_total, active_citizens, avg_xp, rank
from public.leaderboard_villages(null)
where rank is not null;

grant select on public.v_leaderboard_villages_month to authenticated;

-- Satu panggilan untuk halaman Peringkat: scope 'village' (kelurahan warga / p_region_id),
-- 'city' (se-kota), atau 'villages' (peringkat kelurahan). Hanya nickname yang dikembalikan.
create function public.get_leaderboard(p_scope text default 'village', p_region_id uuid default null, p_month date default null)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_village uuid;
  v_month date := date_trunc('month', coalesce(p_month, public.local_today()))::date;
  v_rows jsonb;
  v_me jsonb;
  v_total integer;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if p_scope not in ('village', 'city', 'villages') then
    raise exception 'invalid_scope';
  end if;
  select home_village_id into v_village from public.profiles where id = v_uid;
  if p_scope = 'village' then
    v_village := coalesce(p_region_id, v_village);
  end if;

  if p_scope = 'villages' then
    select jsonb_agg(jsonb_build_object('rank', rank, 'village_id', village_id, 'name', village_name, 'district', district_name,
        'avg_xp', avg_xp, 'active_citizens', active_citizens, 'xp_total', xp_total, 'is_mine', village_id = v_village, 'qualifies', qualifies)
        order by (rank is null), rank, avg_xp desc, active_citizens desc)
    into v_rows
    from public.leaderboard_villages(v_month);
    return jsonb_build_object('scope', p_scope, 'month', v_month, 'rows', coalesce(v_rows, '[]'::jsonb),
      'min_active_citizens', public.setting_int('leaderboard.min_active_citizens'),
      'my_village_id', v_village);
  end if;

  if p_scope = 'village' and v_village is null then
    return jsonb_build_object('scope', p_scope, 'month', v_month, 'rows', '[]'::jsonb, 'me', null, 'total', 0, 'village_id', null);
  end if;

  with l as (
    select * from public.leaderboard_users(v_month)
    where p_scope = 'city' or village_id = v_village
  ), ranked as (
    select *, case when p_scope = 'city' then rank_city else rank_village end as rank from l
  )
  select
    (select jsonb_agg(jsonb_build_object('rank', rank, 'nickname', nickname, 'xp', xp_month, 'village', village_name, 'is_me', user_id = v_uid) order by rank, nickname)
       from (select * from ranked order by rank, nickname limit 50) t),
    (select jsonb_build_object('rank', rank, 'nickname', nickname, 'xp', xp_month) from ranked where user_id = v_uid),
    (select count(*) from ranked)
  into v_rows, v_me, v_total;

  return jsonb_build_object('scope', p_scope, 'month', v_month, 'rows', coalesce(v_rows, '[]'::jsonb), 'me', v_me, 'total', v_total,
    'village_id', case when p_scope = 'village' then v_village end,
    'village_name', case when p_scope = 'village' then (select name from public.regions where id = v_village) end);
end;
$$;

grant execute on function public.get_leaderboard(text, uuid, date) to authenticated;

-- -----------------------------------------------------------------------------
-- Streak dan badge
-- -----------------------------------------------------------------------------

-- Jumlah minggu (Senin–Minggu WIB) berturut-turut dengan >= 1 check-in sah,
-- dihitung mundur dari minggu ini (atau minggu lalu jika minggu ini belum ada).
create function public.user_streak_weeks(p_user_id uuid)
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
  if not exists (select 1 from public.checkins c where c.user_id = p_user_id and c.review_status <> 'rejected'
      and c.local_date >= v_week and c.local_date < v_week + 7) then
    v_week := v_week - 7;
  end if;
  loop
    exit when not exists (select 1 from public.checkins c where c.user_id = p_user_id and c.review_status <> 'rejected'
      and c.local_date >= v_week and c.local_date < v_week + 7);
    v_streak := v_streak + 1;
    v_week := v_week - 7;
    exit when v_streak >= 520;
  end loop;
  return v_streak;
end;
$$;

grant execute on function public.user_streak_weeks(uuid) to authenticated;

-- Kelurahan sebuah checkpoint: dari outlet, atau dari kelurahan partner.
create function public.checkpoint_village(p_checkpoint_id uuid)
returns uuid
language sql
stable
set search_path = ''
as $$
  select coalesce(mo.village_id, o.village_id)
  from public.activity_checkpoints cp
  left join public.merchant_outlets mo on mo.id = cp.outlet_id
  join public.organizers o on o.id = cp.partner_organizer_id
  where cp.id = p_checkpoint_id;
$$;

-- Cek semua aturan badge untuk satu warga; beri yang belum dimiliki + notifikasi.
create function public.award_badges(p_user_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_b record;
  v_ok boolean;
  v_count integer;
  v_awarded integer := 0;
  v_activity uuid;
begin
  for v_b in
    select b.* from public.badges b
    where not exists (select 1 from public.user_badges ub where ub.user_id = p_user_id and ub.badge_id = b.id)
    order by b.sort_order
  loop
    v_ok := false; v_activity := null;
    v_count := coalesce((v_b.rule ->> 'count')::integer, 1);
    case v_b.rule ->> 'type'
      when 'checkins' then
        select count(*) >= v_count, max(c.activity_id::text)::uuid into v_ok, v_activity
        from public.checkins c where c.user_id = p_user_id and c.review_status <> 'rejected';
      when 'distinct_villages' then
        select count(distinct public.checkpoint_village(c.checkpoint_id)) >= v_count into v_ok
        from public.checkins c where c.user_id = p_user_id and c.review_status <> 'rejected'
          and public.checkpoint_village(c.checkpoint_id) is not null;
      when 'same_organizer' then
        select exists (
          select 1 from public.checkins c where c.user_id = p_user_id and c.review_status <> 'rejected'
          group by c.partner_organizer_id having count(*) >= v_count
        ) into v_ok;
      when 'collab_activities' then
        select count(*) >= v_count into v_ok from (
          select distinct c.activity_id from public.checkins c
          where c.user_id = p_user_id and c.review_status <> 'rejected'
            and (select count(*) from public.activity_partners ap where ap.activity_id = c.activity_id and ap.status = 'accepted') > 1
        ) t;
      when 'streak_weeks' then
        v_ok := public.user_streak_weeks(p_user_id) >= v_count;
      when 'group_activities' then
        select count(*) >= v_count into v_ok from (
          select distinct c.activity_id from public.checkins c
          where c.user_id = p_user_id and c.review_status <> 'rejected' and c.group_id is not null
        ) t;
      else
        v_ok := false;
    end case;

    if v_ok then
      insert into public.user_badges (user_id, badge_id, activity_id) values (p_user_id, v_b.id, v_activity)
      on conflict do nothing;
      if found then
        v_awarded := v_awarded + 1;
        perform public.notify(p_user_id, 'badge_awarded', jsonb_build_object('badge_code', v_b.code, 'badge_name', v_b.name));
      end if;
    end if;
  end loop;
  return v_awarded;
end;
$$;

revoke execute on function public.award_badges(uuid) from public, anon, authenticated;

-- Dicek setelah check-in: trigger tertunda sampai akhir transaksi supaya XP dan
-- progress dari perform_checkin sudah tercatat.
create function public.checkins_award_badges()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.award_badges(new.user_id);
  return null;
end;
$$;

create constraint trigger checkins_award_badges
  after insert on public.checkins
  deferrable initially deferred
  for each row execute function public.checkins_award_badges();

-- Cron Senin: +XP streak untuk warga yang check-in di minggu lalu dan minggu sebelumnya
-- (berturut-turut). Sekali per minggu per warga.
create function public.award_streak()
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

-- Cron tanggal 1: simpan juara kelurahan bulan lalu (maks. 10 besar yang memenuhi syarat).
create function public.snapshot_monthly_winners()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_month date := (date_trunc('month', public.local_today()) - interval '1 month')::date;
  v_n integer;
begin
  insert into public.monthly_village_winners (month, village_id, rank, avg_xp, active_citizens)
  select v_month, village_id, rank, avg_xp, active_citizens
  from public.leaderboard_villages(v_month)
  where rank is not null and rank <= 10
  on conflict (month, rank) do nothing;
  get diagnostics v_n = row_count;
  return v_n;
end;
$$;

revoke execute on function public.award_streak(), public.snapshot_monthly_winners() from public, anon, authenticated;

do $$
begin
  perform cron.schedule('award_streak', '10 17 * * 0', $cron$select public.award_streak()$cron$);           -- Senin 00:10 WIB
  perform cron.schedule('snapshot_monthly_winners', '15 17 * * *', $cron$select case when extract(day from (now() at time zone 'Asia/Jakarta')) = 1 then public.snapshot_monthly_winners() else 0 end$cron$); -- 00:15 WIB, hanya tgl 1
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal leaderboard dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Beranda warga: tambah badge, streak, peringkat yang konsisten dengan get_leaderboard
-- -----------------------------------------------------------------------------

create or replace function public.get_citizen_dashboard()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_month_start date := date_trunc('month', public.local_today())::date;
  v_village uuid;
  v_total_xp integer;
  v_level record;
  v_rank record;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select home_village_id into v_village from public.profiles where id = v_uid;
  select coalesce(sum(amount), 0) into v_total_xp from public.xp_ledger where user_id = v_uid;
  select l.level, l.name, l.min_xp, (select min(n.min_xp) from public.levels n where n.min_xp > v_total_xp) as next_min_xp
  into v_level
  from public.levels l where l.min_xp <= v_total_xp order by l.min_xp desc limit 1;
  select xp_month, rank_city, rank_village into v_rank from public.leaderboard_users(null) where user_id = v_uid;

  return jsonb_build_object(
    'total_xp', v_total_xp,
    'xp_month', coalesce(v_rank.xp_month, 0),
    'level', v_level.level,
    'level_name', v_level.name,
    'level_min_xp', v_level.min_xp,
    'next_min_xp', v_level.next_min_xp,
    'streak_weeks', public.user_streak_weeks(v_uid),
    'points_balance', public.points_balance(v_uid),
    'points_expiring_30d', (select coalesce(sum(c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0)), 0)
      from public.point_ledger c where c.user_id = v_uid and c.amount > 0 and c.expires_at > now() and c.expires_at <= now() + interval '30 days'),
    'active_vouchers', (select count(*) from public.redemptions r where r.user_id = v_uid and r.status = 'active'),
    'unread_notifications', (select count(*) from public.notifications n where n.user_id = v_uid and n.read_at is null),
    'rank_city', v_rank.rank_city,
    'rank_village', v_rank.rank_village,
    'village_active_citizens', (select v.active_citizens from public.v_village_active_month v where v.village_id = v_village),
    'village_rank', (select rank from public.leaderboard_villages(null) where village_id = v_village),
    'badges', coalesce((
      select jsonb_agg(jsonb_build_object('code', b.code, 'name', b.name, 'awarded_at', ub.awarded_at) order by ub.awarded_at desc)
      from public.user_badges ub join public.badges b on b.id = ub.badge_id where ub.user_id = v_uid
    ), '[]'::jsonb),
    'badge_total', (select count(*) from public.badges),
    'my_activities', coalesce((
      select jsonb_agg(jsonb_build_object(
        'activity_id', p.activity_id, 'title', a.title, 'type', a.type, 'status', p.status, 'progress', p.progress,
        'payment_status', p.payment_status, 'starts_at', a.starts_at, 'ends_at', a.ends_at, 'activity_status', a.status,
        'group_id', p.group_id) order by a.starts_at)
      from public.participations p join public.activities a on a.id = p.activity_id
      where p.user_id = v_uid and p.status in ('invited', 'registered', 'in_progress') and a.status in ('published', 'running')
    ), '[]'::jsonb)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- RLS
-- -----------------------------------------------------------------------------

revoke all on table public.badges, public.user_badges, public.monthly_village_winners from anon, authenticated;
alter table public.badges enable row level security;
alter table public.user_badges enable row level security;
alter table public.monthly_village_winners enable row level security;

grant select on public.badges to authenticated;
create policy badges_select on public.badges for select to authenticated using (true);
grant insert, update on public.badges to authenticated;
create policy badges_admin_write on public.badges for insert to authenticated with check ((select public.is_admin()));
create policy badges_admin_update on public.badges for update to authenticated using ((select public.is_admin()));

-- Badge warga publik (tampil di profil); hanya fungsi server yang menulis.
grant select on public.user_badges to authenticated;
create policy user_badges_select on public.user_badges for select to authenticated using (true);

grant select on public.monthly_village_winners to authenticated;
create policy monthly_village_winners_select on public.monthly_village_winners for select to authenticated using (true);
