-- =============================================================================
-- Irisan 1: Fondasi
-- Isi: enum dasar, regions + wilayah Cimahi, profiles + trigger auth,
--      app_settings, levels, xp_ledger, award_xp, complete_onboarding, is_admin().
-- Sumber: docs/DESAIN-DATABASE.md bagian 1, 3, 4, 6, 7, 8, 9.
-- =============================================================================

create extension if not exists citext with schema extensions;

-- -----------------------------------------------------------------------------
-- Enum dasar
-- -----------------------------------------------------------------------------

create type public.region_level as enum ('city', 'district', 'village');

create type public.xp_reason as enum (
  'profile_complete',
  'event_checkin',
  'challenge_complete',
  'mission_complete',
  'first_visit_bonus',
  'collab_bonus',
  'group_bonus',
  'streak',
  'reversal',
  'adjustment'
);

-- -----------------------------------------------------------------------------
-- Helper umum
-- -----------------------------------------------------------------------------

-- Tanggal hari ini di WIB. Semua batas harian memakai fungsi ini.
create function public.local_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (now() at time zone 'Asia/Jakarta')::date;
$$;

-- Mengisi updated_at otomatis di tabel yang bisa diedit.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- regions: hierarki kota > kecamatan > kelurahan
-- -----------------------------------------------------------------------------

create table public.regions (
  id uuid primary key default gen_random_uuid(),
  parent_id uuid references public.regions (id),
  level public.region_level not null,
  name text not null check (btrim(name) <> ''),
  code text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  -- kota tidak punya induk; kecamatan dan kelurahan wajib punya induk
  constraint regions_parent_by_level check ((level = 'city') = (parent_id is null)),
  constraint regions_parent_id_name_key unique nulls not distinct (parent_id, name)
);

create index regions_parent_id_idx on public.regions (parent_id);

-- Induk kecamatan harus kota; induk kelurahan harus kecamatan.
create function public.check_region_parent()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_parent_level public.region_level;
begin
  if new.parent_id is null then
    return new;
  end if;

  select level into v_parent_level from public.regions where id = new.parent_id;

  if (new.level = 'district' and v_parent_level <> 'city')
     or (new.level = 'village' and v_parent_level <> 'district') then
    raise exception 'invalid_region_parent';
  end if;

  return new;
end;
$$;

create trigger regions_check_parent
  before insert or update of parent_id, level on public.regions
  for each row execute function public.check_region_parent();

-- Seed wilayah pilot: Kota Cimahi, 3 kecamatan, 15 kelurahan.
-- Kode Kemendagri hanya diisi untuk kota dan kecamatan.
with city as (
  insert into public.regions (level, name, code)
  values ('city', 'Kota Cimahi', '32.77')
  returning id
),
districts as (
  insert into public.regions (parent_id, level, name, code)
  select city.id, 'district', d.name, d.code
  from city,
    (values
      ('Cimahi Selatan', '32.77.01'),
      ('Cimahi Tengah', '32.77.02'),
      ('Cimahi Utara', '32.77.03')
    ) as d (name, code)
  returning id, name
)
insert into public.regions (parent_id, level, name)
select districts.id, 'village', v.village
from districts
join (values
  ('Cimahi Selatan', 'Cibeber'),
  ('Cimahi Selatan', 'Cibeureum'),
  ('Cimahi Selatan', 'Leuwigajah'),
  ('Cimahi Selatan', 'Melong'),
  ('Cimahi Selatan', 'Utama'),
  ('Cimahi Tengah', 'Baros'),
  ('Cimahi Tengah', 'Cigugur Tengah'),
  ('Cimahi Tengah', 'Cimahi'),
  ('Cimahi Tengah', 'Karangmekar'),
  ('Cimahi Tengah', 'Padasuka'),
  ('Cimahi Tengah', 'Setiamanah'),
  ('Cimahi Utara', 'Cibabat'),
  ('Cimahi Utara', 'Cipageran'),
  ('Cimahi Utara', 'Citeureup'),
  ('Cimahi Utara', 'Pasirkaliki')
) as v (district, village) on v.district = districts.name;

-- -----------------------------------------------------------------------------
-- profiles: satu baris per akun, dibuat otomatis saat auth.users insert
-- -----------------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname extensions.citext unique,
  full_name text,
  avatar_url text,
  home_village_id uuid references public.regions (id), -- null = Luar Cimahi
  home_village_changed_at timestamptz,
  is_admin boolean not null default false,
  terms_accepted_at timestamptz,
  onboarded_at timestamptz,
  suspended_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint profiles_nickname_format check (
    nickname is null
    or (char_length(nickname::text) between 3 and 20 and nickname::text = btrim(nickname::text))
  ),
  constraint profiles_full_name_format check (
    full_name is null
    or (char_length(full_name) between 1 and 100 and full_name = btrim(full_name))
  ),
  -- akun yang sudah onboarding (dan belum dihapus) wajib punya data lengkap
  constraint profiles_onboarded_complete check (
    onboarded_at is null
    or deleted_at is not null
    or (nickname is not null and full_name is not null and terms_accepted_at is not null)
  )
);

create index profiles_home_village_id_idx on public.profiles (home_village_id);

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Membuat baris profiles untuk setiap akun baru.
create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id) values (new.id);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- is_admin(): dipakai di policy RLS
-- -----------------------------------------------------------------------------

create function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select p.is_admin
      from public.profiles p
      where p.id = (select auth.uid())
        and p.suspended_at is null
        and p.deleted_at is null
    ),
    false
  );
$$;

revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- app_settings: angka aturan main yang bisa diubah tanpa deploy
-- -----------------------------------------------------------------------------

create table public.app_settings (
  key text primary key,
  value jsonb not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger app_settings_set_updated_at
  before update on public.app_settings
  for each row execute function public.set_updated_at();

insert into public.app_settings (key, value) values
  ('xp.event_checkin', '100'),
  ('xp.challenge', '{"easy":150,"medium":250,"hard":400}'),
  ('xp.first_visit_bonus', '50'),
  ('xp.collab_bonus_pct', '25'),
  ('xp.group_bonus_pct', '20'),
  ('xp.group_bonus_min_members', '3'),
  ('xp.profile_complete', '50'),
  ('xp.streak_weekly', '50'),
  ('xp.daily_cap', '1000'),
  ('points.expiry_months', '6'),
  ('checkin.radius_m_default', '150'),
  ('checkin.qr_rotate_seconds', '60'),
  ('leaderboard.min_active_citizens', '10'),
  ('group.min_size', '2'),
  ('group.max_size', '10'),
  ('group.max_groups_per_user', '3'),
  ('membership.request_expiry_days', '30'),
  ('membership.rejoin_cooldown_days', '30'),
  ('mission.xp_min', '10'),
  ('mission.xp_max', '100'),
  ('mission.max_total_xp', '500'),
  ('mission.code_max_attempts', '5'),
  ('mission.code_window_minutes', '15'),
  ('payment.min_price_idr', '1000'),
  ('payment.default_window_hours', '24');

-- Membaca angka bulat dari app_settings. Gagal keras jika kunci tidak ada,
-- supaya aturan tidak diam-diam memakai angka nol.
create function public.setting_int(p_key text)
returns integer
language plpgsql
stable
set search_path = ''
as $$
declare
  v_value integer;
begin
  select (value #>> '{}')::integer into v_value
  from public.app_settings
  where key = p_key;

  if v_value is null then
    raise exception 'missing_setting: %', p_key;
  end if;

  return v_value;
end;
$$;

-- -----------------------------------------------------------------------------
-- levels: tabel referensi level warga
-- -----------------------------------------------------------------------------

create table public.levels (
  level smallint primary key check (level > 0),
  name text not null,
  min_xp integer not null unique check (min_xp >= 0),
  created_at timestamptz not null default now()
);

insert into public.levels (level, name, min_xp) values
  (1, 'Warga Baru', 0),
  (2, 'Penjelajah', 500),
  (3, 'Penggerak', 1500),
  (4, 'Jawara', 4000),
  (5, 'Legenda Cimahi', 10000);

-- -----------------------------------------------------------------------------
-- xp_ledger: semua perubahan XP. Hanya insert.
-- -----------------------------------------------------------------------------

create table public.xp_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  amount integer not null check (amount <> 0),
  reason public.xp_reason not null,
  -- foreign key ketiga kolom ini ditambahkan di irisan 3, 4, dan 10
  activity_id uuid,
  checkin_id uuid,
  mission_completion_id uuid,
  village_id uuid references public.regions (id), -- snapshot kelurahan saat XP diberikan
  local_date date not null default public.local_today(),
  note text,
  created_at timestamptz not null default now()
);

create index xp_ledger_user_id_local_date_idx on public.xp_ledger (user_id, local_date);
create index xp_ledger_village_id_created_at_idx on public.xp_ledger (village_id, created_at);
-- XP lengkapi profil hanya sekali per akun
create unique index xp_ledger_profile_complete_once_idx
  on public.xp_ledger (user_id) where reason = 'profile_complete';

-- Ledger tidak boleh diubah atau dihapus; koreksi ditulis sebagai baris negatif.
create function public.prevent_ledger_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'ledger_is_append_only';
end;
$$;

create trigger xp_ledger_append_only
  before update or delete on public.xp_ledger
  for each row execute function public.prevent_ledger_change();

-- Memberi XP positif dengan batas harian (xp.daily_cap, WIB).
-- Hanya dipanggil dari fungsi database lain, tidak pernah dari client.
-- Mengembalikan XP yang benar-benar diberikan (bisa lebih kecil, atau 0).
create function public.award_xp(
  p_user_id uuid,
  p_amount integer,
  p_reason public.xp_reason,
  p_activity_id uuid default null,
  p_checkin_id uuid default null,
  p_mission_completion_id uuid default null,
  p_note text default null
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := public.local_today();
  v_cap integer := public.setting_int('xp.daily_cap');
  v_used integer;
  v_award integer;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'award_xp_requires_positive_amount';
  end if;

  -- Kunci per warga supaya dua pemberian bersamaan tidak menembus batas harian.
  perform pg_advisory_xact_lock(hashtextextended('xp:' || p_user_id::text, 0));

  select coalesce(sum(amount), 0) into v_used
  from public.xp_ledger
  where user_id = p_user_id
    and local_date = v_today
    and amount > 0;

  v_award := least(p_amount, greatest(v_cap - v_used, 0));

  if v_award > 0 then
    insert into public.xp_ledger (
      user_id, amount, reason, activity_id, checkin_id, mission_completion_id,
      village_id, local_date, note
    )
    select
      p_user_id, v_award, p_reason, p_activity_id, p_checkin_id, p_mission_completion_id,
      p.home_village_id, v_today,
      case
        when v_award < p_amount then concat_ws(' · ', p_note, 'dipotong batas XP harian')
        else p_note
      end
    from public.profiles p
    where p.id = p_user_id;
  end if;

  return v_award;
end;
$$;

revoke execute on function public.award_xp(uuid, integer, public.xp_reason, uuid, uuid, uuid, text)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- complete_onboarding: warga mengisi profil pertama kali (+XP profile_complete)
-- Kode error (dipetakan ke pesan ramah di aplikasi):
--   not_authenticated, account_inactive, already_onboarded, invalid_nickname,
--   invalid_full_name, invalid_village, nickname_taken
-- -----------------------------------------------------------------------------

create function public.complete_onboarding(
  p_nickname text,
  p_full_name text,
  p_village_id uuid -- null = Luar Cimahi
)
returns integer -- XP yang diberikan
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.profiles;
  v_nickname text := btrim(p_nickname);
  v_full_name text := btrim(p_full_name);
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_profile from public.profiles where id = v_uid for update;

  if not found or v_profile.deleted_at is not null or v_profile.suspended_at is not null then
    raise exception 'account_inactive';
  end if;

  if v_profile.onboarded_at is not null then
    raise exception 'already_onboarded';
  end if;

  if v_nickname is null or char_length(v_nickname) not between 3 and 20 then
    raise exception 'invalid_nickname';
  end if;

  if v_full_name is null or char_length(v_full_name) not between 1 and 100 then
    raise exception 'invalid_full_name';
  end if;

  -- Kelurahan harus aktif dan kotanya juga sudah dibuka.
  if p_village_id is not null and not exists (
    select 1
    from public.regions v
    join public.regions d on d.id = v.parent_id
    join public.regions c on c.id = d.parent_id
    where v.id = p_village_id
      and v.level = 'village'
      and v.is_active and d.is_active and c.is_active
  ) then
    raise exception 'invalid_village';
  end if;

  if exists (
    select 1 from public.profiles
    where nickname = v_nickname::extensions.citext and id <> v_uid
  ) then
    raise exception 'nickname_taken';
  end if;

  begin
    update public.profiles
    set nickname = v_nickname,
        full_name = v_full_name,
        home_village_id = p_village_id,
        terms_accepted_at = now(),
        onboarded_at = now()
    where id = v_uid;
  exception
    when unique_violation then
      raise exception 'nickname_taken';
  end;

  return public.award_xp(v_uid, public.setting_int('xp.profile_complete'), 'profile_complete');
end;
$$;

revoke execute on function public.complete_onboarding(text, text, uuid) from public, anon;
grant execute on function public.complete_onboarding(text, text, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Hak akses tabel (grant) + Row Level Security
-- Semua akses dimulai dari nol, lalu dibuka seperlunya.
-- -----------------------------------------------------------------------------

revoke all on table public.regions, public.profiles, public.app_settings,
  public.levels, public.xp_ledger from anon, authenticated;

alter table public.regions enable row level security;
alter table public.profiles enable row level security;
alter table public.app_settings enable row level security;
alter table public.levels enable row level security;
alter table public.xp_ledger enable row level security;

-- regions: semua orang baca; admin tambah dan ubah
grant select on public.regions to anon, authenticated;
grant insert, update on public.regions to authenticated;

create policy regions_select_all on public.regions
  for select to anon, authenticated using (true);
create policy regions_insert_admin on public.regions
  for insert to authenticated with check ((select public.is_admin()));
create policy regions_update_admin on public.regions
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- profiles: warga baca dan ubah kolom aman miliknya; admin baca semua.
-- Kolom is_admin, suspended_at, onboarded_at, home_village_id, dan
-- home_village_changed_at hanya bisa diubah lewat fungsi atau SQL.
grant select on public.profiles to authenticated;
grant update (nickname, full_name, avatar_url) on public.profiles to authenticated;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = (select auth.uid()));
create policy profiles_select_admin on public.profiles
  for select to authenticated using ((select public.is_admin()));
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
create policy profiles_update_admin on public.profiles
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- app_settings: semua orang baca; admin ubah
grant select on public.app_settings to anon, authenticated;
grant update (value) on public.app_settings to authenticated;

create policy app_settings_select_all on public.app_settings
  for select to anon, authenticated using (true);
create policy app_settings_update_admin on public.app_settings
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- levels: semua orang baca; admin tambah dan ubah
grant select on public.levels to anon, authenticated;
grant insert, update on public.levels to authenticated;

create policy levels_select_all on public.levels
  for select to anon, authenticated using (true);
create policy levels_insert_admin on public.levels
  for insert to authenticated with check ((select public.is_admin()));
create policy levels_update_admin on public.levels
  for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));

-- xp_ledger: warga baca miliknya; admin baca semua; tulis hanya lewat fungsi
grant select on public.xp_ledger to authenticated;

create policy xp_ledger_select_own on public.xp_ledger
  for select to authenticated using (user_id = (select auth.uid()));
create policy xp_ledger_select_admin on public.xp_ledger
  for select to authenticated using ((select public.is_admin()));
