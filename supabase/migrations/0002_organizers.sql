-- =============================================================================
-- Irisan 2: Organizer (merchant dan komunitas)
-- Isi: enum organizer, organizers + profil merchant/komunitas + outlet,
--      tim (organizer_members, organizer_invites), member komunitas,
--      notifications, admin_actions, fungsi registrasi/undangan/keanggotaan/
--      review admin, v_community_member_stats, cron expire_membership_requests,
--      bucket Storage logos (publik) dan organizer-proofs (privat), RLS.
-- Sumber: docs/ALUR-SISTEM.md bagian 4, 5, 12; docs/DESAIN-DATABASE.md bagian 4, 6, 7.
-- Catatan: notifications dibuat di sini (dokumen menaruhnya di irisan 3)
--          karena keanggotaan komunitas sudah mengirim notifikasi.
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;

-- -----------------------------------------------------------------------------
-- Enum
-- -----------------------------------------------------------------------------

create type public.organizer_type as enum ('merchant', 'community', 'platform');
create type public.organizer_status as enum ('pending', 'approved', 'rejected', 'suspended');
create type public.member_role as enum ('owner', 'staff', 'chair', 'officer');
create type public.join_policy as enum ('open', 'approval');
create type public.membership_status as enum ('pending', 'active', 'rejected', 'left', 'removed');

-- -----------------------------------------------------------------------------
-- Tabel
-- -----------------------------------------------------------------------------

create table public.organizers (
  id uuid primary key default gen_random_uuid(),
  type public.organizer_type not null,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  logo_url text,
  description text check (description is null or char_length(description) <= 1000),
  village_id uuid references public.regions (id),
  status public.organizer_status not null default 'pending',
  review_note text,
  verified_by uuid references public.profiles (id),
  verified_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index organizers_status_idx on public.organizers (status);
create index organizers_type_village_id_idx on public.organizers (type, village_id);

create trigger organizers_set_updated_at
  before update on public.organizers
  for each row execute function public.set_updated_at();

-- Tipe tidak bisa diubah setelah dibuat.
create function public.prevent_organizer_type_change()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.type <> old.type then
    raise exception 'organizer_type_is_immutable';
  end if;
  return new;
end;
$$;

create trigger organizers_type_immutable
  before update of type on public.organizers
  for each row execute function public.prevent_organizer_type_change();

create table public.merchant_profiles (
  organizer_id uuid primary key references public.organizers (id) on delete cascade,
  merchant_category text not null check (
    merchant_category in ('kuliner', 'kopi', 'retail', 'fesyen', 'jasa', 'otomotif', 'kerajinan', 'lainnya')
  ),
  nib text,
  whatsapp text not null check (whatsapp ~ '^0[0-9]{8,14}$'),
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger merchant_profiles_set_updated_at
  before update on public.merchant_profiles
  for each row execute function public.set_updated_at();

create table public.merchant_outlets (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 80),
  address text not null check (char_length(btrim(address)) between 5 and 300),
  village_id uuid references public.regions (id),
  lat numeric(9, 6) not null check (lat between -90 and 90),
  lng numeric(9, 6) not null check (lng between -180 and 180),
  opening_hours jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index merchant_outlets_organizer_id_idx on public.merchant_outlets (organizer_id);
create index merchant_outlets_village_id_idx on public.merchant_outlets (village_id);

create trigger merchant_outlets_set_updated_at
  before update on public.merchant_outlets
  for each row execute function public.set_updated_at();

create table public.community_profiles (
  organizer_id uuid primary key references public.organizers (id) on delete cascade,
  interest_category text not null check (
    interest_category in ('olahraga', 'musik', 'seni', 'hobi', 'sosial', 'lingkungan', 'edukasi', 'keagamaan', 'lainnya')
  ),
  activity_area_village_id uuid references public.regions (id),
  social_links jsonb not null default '{}'::jsonb,
  est_members integer check (est_members is null or est_members >= 0),
  join_policy public.join_policy not null default 'approval',
  basecamp_address text,
  basecamp_lat numeric(9, 6) check (basecamp_lat is null or basecamp_lat between -90 and 90),
  basecamp_lng numeric(9, 6) check (basecamp_lng is null or basecamp_lng between -180 and 180),
  whatsapp text not null check (whatsapp ~ '^0[0-9]{8,14}$'),
  proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger community_profiles_set_updated_at
  before update on public.community_profiles
  for each row execute function public.set_updated_at();

create table public.organizer_members (
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  role public.member_role not null,
  invited_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  primary key (organizer_id, user_id)
);

create index organizer_members_user_id_idx on public.organizer_members (user_id);

create table public.organizer_invites (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  role public.member_role not null check (role in ('staff', 'officer')),
  token text not null unique,
  expires_at timestamptz not null default now() + interval '7 days',
  created_by uuid references public.profiles (id),
  accepted_by uuid references public.profiles (id),
  accepted_at timestamptz,
  created_at timestamptz not null default now()
);

create index organizer_invites_organizer_id_idx on public.organizer_invites (organizer_id);

create table public.community_memberships (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.profiles (id),
  status public.membership_status not null,
  message text check (message is null or char_length(message) <= 200),
  joined_at timestamptz,
  decided_by uuid references public.profiles (id),
  decided_at timestamptz,
  ended_at timestamptz,
  removed_by uuid references public.profiles (id),
  removed_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index community_memberships_one_open_idx
  on public.community_memberships (community_id, user_id)
  where status in ('pending', 'active');
create index community_memberships_community_status_idx on public.community_memberships (community_id, status);
create index community_memberships_user_active_idx on public.community_memberships (user_id) where status = 'active';

create trigger community_memberships_set_updated_at
  before update on public.community_memberships
  for each row execute function public.set_updated_at();

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  kind text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_unread_idx on public.notifications (user_id) where read_at is null;
create index notifications_user_created_idx on public.notifications (user_id, created_at desc);

create table public.admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references public.profiles (id),
  action text not null,
  target_table text,
  target_id uuid,
  note text,
  created_at timestamptz not null default now()
);

create index admin_actions_created_idx on public.admin_actions (created_at desc);

-- -----------------------------------------------------------------------------
-- Trigger penjaga konsistensi
-- -----------------------------------------------------------------------------

-- Peran tim harus cocok dengan tipe organizer; organizer platform dikelola admin
-- tanpa baris tim.
create function public.check_member_role()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_type public.organizer_type;
begin
  select type into v_type from public.organizers where id = new.organizer_id;
  if (v_type = 'merchant' and new.role not in ('owner', 'staff'))
     or (v_type = 'community' and new.role not in ('chair', 'officer'))
     or v_type = 'platform' then
    raise exception 'invalid_member_role';
  end if;
  return new;
end;
$$;

create trigger organizer_members_check_role
  before insert or update on public.organizer_members
  for each row execute function public.check_member_role();

-- Setiap organizer wajib menyisakan minimal satu owner/chair.
create function public.check_last_leader()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Organizer yang sedang dihapus (cascade) boleh kehilangan semua anggotanya.
  if not exists (select 1 from public.organizers where id = old.organizer_id) then
    return old;
  end if;
  if old.role in ('owner', 'chair') and not exists (
    select 1 from public.organizer_members
    where organizer_id = old.organizer_id
      and role in ('owner', 'chair')
      and user_id <> old.user_id
  ) then
    raise exception 'last_leader_cannot_be_removed';
  end if;
  return old;
end;
$$;

create trigger organizer_members_keep_leader
  before delete on public.organizer_members
  for each row execute function public.check_last_leader();

-- Keanggotaan hanya untuk organizer bertipe komunitas; chair/officer selalu member aktif.
create function public.check_membership()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select type from public.organizers where id = new.community_id) <> 'community' then
    raise exception 'membership_requires_community';
  end if;

  if new.status in ('left', 'removed', 'rejected') and exists (
    select 1 from public.organizer_members
    where organizer_id = new.community_id
      and user_id = new.user_id
      and role in ('chair', 'officer')
  ) then
    raise exception 'team_member_must_stay_member';
  end if;

  if new.status = 'active' and new.joined_at is null then
    new.joined_at := now();
  end if;
  if new.status in ('left', 'removed') and new.ended_at is null then
    new.ended_at := now();
  end if;

  return new;
end;
$$;

create trigger community_memberships_check
  before insert or update on public.community_memberships
  for each row execute function public.check_membership();

-- Chair dan officer otomatis menjadi member aktif komunitasnya.
create function public.ensure_team_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.role in ('chair', 'officer') and not exists (
    select 1 from public.community_memberships
    where community_id = new.organizer_id and user_id = new.user_id and status = 'active'
  ) then
    -- Permintaan yang masih pending langsung aktif; jika tidak ada, buat baris baru.
    update public.community_memberships
    set status = 'active', decided_at = now()
    where community_id = new.organizer_id and user_id = new.user_id and status = 'pending';

    if not found then
      insert into public.community_memberships (community_id, user_id, status)
      values (new.organizer_id, new.user_id, 'active');
    end if;
  end if;
  return new;
end;
$$;

create trigger organizer_members_ensure_membership
  after insert or update of role on public.organizer_members
  for each row execute function public.ensure_team_membership();

revoke execute on function public.ensure_team_membership() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Helper akses (dipakai RLS dan fungsi). security definer supaya policy
-- organizer_members tidak memanggil dirinya sendiri.
-- -----------------------------------------------------------------------------

create function public.team_role(p_organizer_id uuid)
returns public.member_role
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.organizer_members
  where organizer_id = p_organizer_id
    and user_id = (select auth.uid());
$$;

create function public.is_team_member(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.team_role(p_organizer_id) is not null;
$$;

create function public.is_team_leader(p_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(public.team_role(p_organizer_id) in ('owner', 'chair'), false);
$$;

revoke execute on function public.team_role(uuid), public.is_team_member(uuid), public.is_team_leader(uuid)
  from public, anon;
grant execute on function public.team_role(uuid), public.is_team_member(uuid), public.is_team_leader(uuid)
  to authenticated;

-- Profil pemanggil yang aktif (sudah onboarding, tidak dibekukan/dihapus).
create function public.active_uid()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  if not exists (
    select 1 from public.profiles
    where id = v_uid and onboarded_at is not null and suspended_at is null and deleted_at is null
  ) then
    raise exception 'account_inactive';
  end if;
  return v_uid;
end;
$$;

-- Kirim notifikasi ke satu warga.
create function public.notify(p_user_id uuid, p_kind text, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, payload) values (p_user_id, p_kind, coalesce(p_payload, '{}'::jsonb));
$$;

-- Kirim notifikasi ke seluruh tim organizer.
create function public.notify_team(p_organizer_id uuid, p_kind text, p_payload jsonb default '{}'::jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.notifications (user_id, kind, payload)
  select user_id, p_kind, coalesce(p_payload, '{}'::jsonb)
  from public.organizer_members
  where organizer_id = p_organizer_id;
$$;

revoke execute on function public.notify(uuid, text, jsonb), public.notify_team(uuid, text, jsonb), public.active_uid()
  from public, anon, authenticated;

-- Slug unik dari nama: huruf kecil, tanda hubung, akhiran angka jika bentrok.
create function public.make_organizer_slug(p_name text)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_base text := trim(both '-' from regexp_replace(lower(p_name), '[^a-z0-9]+', '-', 'g'));
  v_slug text;
  v_n integer := 1;
begin
  if v_base = '' then
    v_base := 'penyelenggara';
  end if;
  v_base := left(v_base, 60);
  v_slug := v_base;
  while exists (select 1 from public.organizers where slug = v_slug) loop
    v_n := v_n + 1;
    v_slug := v_base || '-' || v_n;
  end loop;
  return v_slug;
end;
$$;

-- -----------------------------------------------------------------------------
-- register_organizer: warga mendaftarkan merchant atau komunitas (status pending)
-- Kode error: invalid_type, invalid_name, invalid_whatsapp, invalid_category,
--   invalid_village, outlet_required, invalid_outlet, invalid_join_policy
-- -----------------------------------------------------------------------------

create function public.register_organizer(p_type public.organizer_type, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_id uuid;
  v_name text := btrim(p_data ->> 'name');
  v_whatsapp text := regexp_replace(coalesce(p_data ->> 'whatsapp', ''), '[^0-9]', '', 'g');
  v_village uuid;
  v_outlet jsonb;
  v_outlet_count integer := 0;
begin
  if p_type not in ('merchant', 'community') then
    raise exception 'invalid_type';
  end if;
  if v_name is null or char_length(v_name) not between 2 and 80 then
    raise exception 'invalid_name';
  end if;
  if v_whatsapp = '' then
    raise exception 'invalid_whatsapp';
  end if;
  if v_whatsapp like '62%' then
    v_whatsapp := '0' || substr(v_whatsapp, 3);
  end if;
  if v_whatsapp !~ '^0[0-9]{8,14}$' then
    raise exception 'invalid_whatsapp';
  end if;

  if p_type = 'merchant' then
    if jsonb_typeof(p_data -> 'outlets') <> 'array' or jsonb_array_length(p_data -> 'outlets') = 0 then
      raise exception 'outlet_required';
    end if;
    v_village := nullif(p_data -> 'outlets' -> 0 ->> 'village_id', '')::uuid;
  else
    v_village := nullif(p_data ->> 'activity_area_village_id', '')::uuid;
  end if;

  if v_village is not null and not exists (
    select 1 from public.regions where id = v_village and level = 'village' and is_active
  ) then
    raise exception 'invalid_village';
  end if;

  insert into public.organizers (type, name, slug, description, village_id, created_by)
  values (p_type, v_name, public.make_organizer_slug(v_name), nullif(btrim(p_data ->> 'description'), ''), v_village, v_uid)
  returning id into v_id;

  if p_type = 'merchant' then
    begin
      insert into public.merchant_profiles (organizer_id, merchant_category, nib, whatsapp)
      values (v_id, p_data ->> 'merchant_category', nullif(btrim(p_data ->> 'nib'), ''), v_whatsapp);
    exception when check_violation then
      raise exception 'invalid_category';
    end;

    for v_outlet in select * from jsonb_array_elements(p_data -> 'outlets') loop
      begin
        insert into public.merchant_outlets (organizer_id, name, address, village_id, lat, lng, opening_hours)
        values (
          v_id,
          coalesce(nullif(btrim(v_outlet ->> 'name'), ''), 'Outlet utama'),
          btrim(v_outlet ->> 'address'),
          nullif(v_outlet ->> 'village_id', '')::uuid,
          (v_outlet ->> 'lat')::numeric,
          (v_outlet ->> 'lng')::numeric,
          v_outlet -> 'opening_hours'
        );
      exception when check_violation or not_null_violation or invalid_text_representation then
        raise exception 'invalid_outlet';
      end;
      v_outlet_count := v_outlet_count + 1;
    end loop;

    insert into public.organizer_members (organizer_id, user_id, role) values (v_id, v_uid, 'owner');
  else
    begin
      insert into public.community_profiles (
        organizer_id, interest_category, activity_area_village_id, social_links, est_members,
        join_policy, basecamp_address, basecamp_lat, basecamp_lng, whatsapp
      )
      values (
        v_id,
        p_data ->> 'interest_category',
        v_village,
        coalesce(p_data -> 'social_links', '{}'::jsonb),
        nullif(p_data ->> 'est_members', '')::integer,
        coalesce(nullif(p_data ->> 'join_policy', ''), 'approval')::public.join_policy,
        nullif(btrim(p_data ->> 'basecamp_address'), ''),
        nullif(p_data ->> 'basecamp_lat', '')::numeric,
        nullif(p_data ->> 'basecamp_lng', '')::numeric,
        v_whatsapp
      );
    exception
      when check_violation then raise exception 'invalid_category';
      when invalid_text_representation then raise exception 'invalid_join_policy';
    end;

    -- Trigger ensure_team_membership membuat baris member aktif untuk ketua.
    insert into public.organizer_members (organizer_id, user_id, role) values (v_id, v_uid, 'chair');
  end if;

  return v_id;
end;
$$;

-- Pendaftar yang ditolak mengajukan ulang setelah memperbaiki data.
create function public.resubmit_organizer(p_organizer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.active_uid();
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  update public.organizers
  set status = 'pending', review_note = null
  where id = p_organizer_id and status = 'rejected';
  if not found then
    raise exception 'not_rejected';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tim: undangan dan pencabutan
-- -----------------------------------------------------------------------------

create function public.create_organizer_invite(p_organizer_id uuid, p_role public.member_role)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_type public.organizer_type;
  v_token text;
begin
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  select type into v_type from public.organizers where id = p_organizer_id;
  if (v_type = 'merchant' and p_role <> 'staff') or (v_type = 'community' and p_role <> 'officer') then
    raise exception 'invalid_member_role';
  end if;

  v_token := encode(extensions.gen_random_bytes(24), 'base64');
  v_token := translate(v_token, '+/=', 'xyz');

  insert into public.organizer_invites (organizer_id, role, token, created_by)
  values (p_organizer_id, p_role, v_token, v_uid);

  return v_token;
end;
$$;

create function public.accept_organizer_invite(p_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_invite public.organizer_invites;
begin
  select * into v_invite
  from public.organizer_invites
  where token = p_token
  for update;

  if not found or v_invite.accepted_at is not null or v_invite.expires_at < now() then
    raise exception 'invite_invalid';
  end if;

  if exists (
    select 1 from public.organizer_members
    where organizer_id = v_invite.organizer_id and user_id = v_uid
  ) then
    raise exception 'already_member';
  end if;

  insert into public.organizer_members (organizer_id, user_id, role, invited_by)
  values (v_invite.organizer_id, v_uid, v_invite.role, v_invite.created_by);

  update public.organizer_invites
  set accepted_by = v_uid, accepted_at = now()
  where id = v_invite.id;

  return v_invite.organizer_id;
end;
$$;

-- Owner/chair mencabut anggota tim; anggota biasa boleh mengeluarkan dirinya sendiri.
create function public.remove_team_member(p_organizer_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if p_user_id <> v_uid and not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  -- Trigger keep_leader menolak jika ini owner/chair terakhir.
  delete from public.organizer_members
  where organizer_id = p_organizer_id and user_id = p_user_id;
  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Keanggotaan komunitas
-- -----------------------------------------------------------------------------

create function public.request_membership(p_community_id uuid, p_message text default null)
returns public.membership_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_policy public.join_policy;
  v_last public.community_memberships;
  v_cooldown integer := public.setting_int('membership.rejoin_cooldown_days');
  v_status public.membership_status;
  v_name text;
begin
  select cp.join_policy, o.name into v_policy, v_name
  from public.organizers o
  join public.community_profiles cp on cp.organizer_id = o.id
  where o.id = p_community_id and o.type = 'community' and o.status = 'approved';

  if not found then
    raise exception 'community_unavailable';
  end if;

  if exists (
    select 1 from public.community_memberships
    where community_id = p_community_id and user_id = v_uid and status in ('pending', 'active')
  ) then
    raise exception 'already_requested';
  end if;

  select * into v_last
  from public.community_memberships
  where community_id = p_community_id and user_id = v_uid
  order by created_at desc
  limit 1;

  if found and v_last.status in ('removed', 'rejected')
     and coalesce(v_last.ended_at, v_last.decided_at, v_last.updated_at) > now() - make_interval(days => v_cooldown) then
    raise exception 'rejoin_cooldown';
  end if;

  v_status := case when v_policy = 'open' then 'active'::public.membership_status else 'pending'::public.membership_status end;

  insert into public.community_memberships (community_id, user_id, status, message)
  values (p_community_id, v_uid, v_status, nullif(btrim(p_message), ''));

  if v_status = 'pending' then
    perform public.notify_team(p_community_id, 'membership_requested',
      jsonb_build_object('community_id', p_community_id, 'user_id', v_uid));
  else
    perform public.notify(v_uid, 'membership_approved',
      jsonb_build_object('community_id', p_community_id, 'community_name', v_name));
  end if;

  return v_status;
end;
$$;

create function public.decide_membership(p_membership_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_m public.community_memberships;
  v_name text;
begin
  select * into v_m from public.community_memberships where id = p_membership_id for update;
  if not found or v_m.status <> 'pending' then
    raise exception 'request_not_pending';
  end if;
  if not public.is_team_member(v_m.community_id) then
    raise exception 'not_allowed';
  end if;

  update public.community_memberships
  set status = case when p_accept then 'active'::public.membership_status else 'rejected'::public.membership_status end,
      decided_by = v_uid,
      decided_at = now()
  where id = p_membership_id;

  select name into v_name from public.organizers where id = v_m.community_id;
  perform public.notify(v_m.user_id,
    case when p_accept then 'membership_approved' else 'membership_rejected' end,
    jsonb_build_object('community_id', v_m.community_id, 'community_name', v_name));
end;
$$;

create function public.remove_member(p_membership_id uuid, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_m public.community_memberships;
  v_my_role public.member_role;
  v_target_role public.member_role;
  v_name text;
begin
  select * into v_m from public.community_memberships where id = p_membership_id for update;
  if not found or v_m.status <> 'active' then
    raise exception 'member_not_active';
  end if;

  v_my_role := public.team_role(v_m.community_id);
  if v_my_role is null then
    raise exception 'not_allowed';
  end if;

  select role into v_target_role
  from public.organizer_members
  where organizer_id = v_m.community_id and user_id = v_m.user_id;

  -- Pengurus tidak bisa mengeluarkan ketua atau pengurus lain; ketua tidak bisa dikeluarkan.
  if v_target_role = 'chair' or (v_my_role = 'officer' and v_target_role is not null) then
    raise exception 'cannot_remove_team';
  end if;
  -- Ketua mengeluarkan pengurus: cabut dulu dari tim supaya trigger mengizinkan.
  if v_target_role = 'officer' then
    delete from public.organizer_members
    where organizer_id = v_m.community_id and user_id = v_m.user_id;
  end if;

  update public.community_memberships
  set status = 'removed', removed_by = v_uid, removed_reason = nullif(btrim(p_reason), ''), ended_at = now()
  where id = p_membership_id;

  select name into v_name from public.organizers where id = v_m.community_id;
  perform public.notify(v_m.user_id, 'membership_removed',
    jsonb_build_object('community_id', v_m.community_id, 'community_name', v_name, 'reason', nullif(btrim(p_reason), '')));
end;
$$;

create function public.leave_community(p_community_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if public.team_role(p_community_id) = 'chair' then
    raise exception 'chair_cannot_leave';
  end if;
  -- Pengurus yang keluar sebagai member otomatis keluar dari tim juga.
  delete from public.organizer_members where organizer_id = p_community_id and user_id = v_uid;

  update public.community_memberships
  set status = 'left', ended_at = now()
  where community_id = p_community_id and user_id = v_uid and status in ('active', 'pending');
  if not found then
    raise exception 'not_a_member';
  end if;
end;
$$;

create function public.set_join_policy(p_community_id uuid, p_policy public.join_policy)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.active_uid();
  if public.team_role(p_community_id) is distinct from 'chair' then
    raise exception 'not_allowed';
  end if;
  update public.community_profiles set join_policy = p_policy where organizer_id = p_community_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Admin: verifikasi penyelenggara
-- -----------------------------------------------------------------------------

create function public.review_organizer(p_organizer_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_note text := nullif(btrim(p_note), '');
  v_name text;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if not p_approve and v_note is null then
    raise exception 'note_required';
  end if;

  update public.organizers
  set status = case when p_approve then 'approved'::public.organizer_status else 'rejected'::public.organizer_status end,
      review_note = v_note,
      verified_by = v_uid,
      verified_at = now()
  where id = p_organizer_id and status in ('pending', 'rejected')
  returning name into v_name;
  if not found then
    raise exception 'not_pending';
  end if;

  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, case when p_approve then 'approve_organizer' else 'reject_organizer' end, 'organizers', p_organizer_id, v_note);

  perform public.notify_team(p_organizer_id, 'organizer_verified',
    jsonb_build_object('organizer_id', p_organizer_id, 'organizer_name', v_name, 'approved', p_approve, 'note', v_note));
end;
$$;

-- Tandai notifikasi sudah dibaca (semua, atau satu).
create function public.mark_notifications_read(p_id uuid default null)
returns void
language sql
security definer
set search_path = ''
as $$
  update public.notifications
  set read_at = now()
  where user_id = (select auth.uid())
    and read_at is null
    and (p_id is null or id = p_id);
$$;

revoke execute on function
  public.register_organizer(public.organizer_type, jsonb),
  public.resubmit_organizer(uuid),
  public.create_organizer_invite(uuid, public.member_role),
  public.accept_organizer_invite(text),
  public.remove_team_member(uuid, uuid),
  public.request_membership(uuid, text),
  public.decide_membership(uuid, boolean),
  public.remove_member(uuid, text),
  public.leave_community(uuid),
  public.set_join_policy(uuid, public.join_policy),
  public.review_organizer(uuid, boolean, text),
  public.mark_notifications_read(uuid),
  public.make_organizer_slug(text)
  from public, anon;
grant execute on function
  public.register_organizer(public.organizer_type, jsonb),
  public.resubmit_organizer(uuid),
  public.create_organizer_invite(uuid, public.member_role),
  public.accept_organizer_invite(text),
  public.remove_team_member(uuid, uuid),
  public.request_membership(uuid, text),
  public.decide_membership(uuid, boolean),
  public.remove_member(uuid, text),
  public.leave_community(uuid),
  public.set_join_policy(uuid, public.join_policy),
  public.review_organizer(uuid, boolean, text),
  public.mark_notifications_read(uuid)
  to authenticated;
revoke execute on function public.make_organizer_slug(text) from authenticated;

-- -----------------------------------------------------------------------------
-- View statistik member (attending_members_30d diisi setelah irisan 4 check-in)
-- -----------------------------------------------------------------------------

create view public.v_community_member_stats
with (security_invoker = true)
as
select
  o.id as community_id,
  count(*) filter (where m.status = 'active') as active_members,
  count(*) filter (where m.status = 'pending') as pending_requests,
  count(*) filter (
    where m.status = 'active'
      and m.joined_at >= date_trunc('month', now() at time zone 'Asia/Jakarta') at time zone 'Asia/Jakarta'
  ) as new_members_month,
  0::bigint as attending_members_30d
from public.organizers o
left join public.community_memberships m on m.community_id = o.id
where o.type = 'community'
group by o.id;

-- Jumlah member aktif yang boleh dilihat publik (tanpa membuka baris member).
create function public.community_public_stats(p_community_id uuid)
returns table (active_members bigint)
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)
  from public.community_memberships
  where community_id = p_community_id and status = 'active';
$$;

revoke execute on function public.community_public_stats(uuid) from public, anon;
grant execute on function public.community_public_stats(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Cron: permintaan member yang tidak dijawab 30 hari otomatis ditolak
-- -----------------------------------------------------------------------------

create function public.expire_membership_requests()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_days integer := public.setting_int('membership.request_expiry_days');
  v_count integer;
begin
  with expired as (
    update public.community_memberships
    set status = 'rejected', decided_at = now()
    where status = 'pending' and created_at < now() - make_interval(days => v_days)
    returning user_id, community_id
  ),
  notified as (
    insert into public.notifications (user_id, kind, payload)
    select e.user_id, 'membership_rejected',
      jsonb_build_object('community_id', e.community_id, 'community_name', o.name, 'auto', true)
    from expired e join public.organizers o on o.id = e.community_id
    returning 1
  )
  select count(*) into v_count from notified;
  return v_count;
end;
$$;

revoke execute on function public.expire_membership_requests() from public, anon, authenticated;

do $$
begin
  create extension if not exists pg_cron;
  perform cron.schedule('expire_membership_requests', '5 17 * * *', $cron$select public.expire_membership_requests()$cron$); -- 00.05 WIB
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal expire_membership_requests dilewati: %', sqlerrm;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hak akses tabel + RLS
-- -----------------------------------------------------------------------------

revoke all on table
  public.organizers, public.merchant_profiles, public.merchant_outlets, public.community_profiles,
  public.organizer_members, public.organizer_invites, public.community_memberships,
  public.notifications, public.admin_actions
  from anon, authenticated;

alter table public.organizers enable row level security;
alter table public.merchant_profiles enable row level security;
alter table public.merchant_outlets enable row level security;
alter table public.community_profiles enable row level security;
alter table public.organizer_members enable row level security;
alter table public.organizer_invites enable row level security;
alter table public.community_memberships enable row level security;
alter table public.notifications enable row level security;
alter table public.admin_actions enable row level security;

-- organizers
grant select on public.organizers to authenticated;
grant update (name, description, logo_url, village_id) on public.organizers to authenticated;

create policy organizers_select on public.organizers
  for select to authenticated
  using (status = 'approved' or public.is_team_member(id) or (select public.is_admin()));
create policy organizers_update_team on public.organizers
  for update to authenticated
  using (public.is_team_member(id)) with check (public.is_team_member(id));

-- merchant_profiles
grant select on public.merchant_profiles to authenticated;
grant update (merchant_category, nib, whatsapp, proof_url) on public.merchant_profiles to authenticated;

create policy merchant_profiles_select on public.merchant_profiles
  for select to authenticated
  using (
    exists (select 1 from public.organizers o where o.id = organizer_id and o.status = 'approved')
    or public.is_team_member(organizer_id)
    or (select public.is_admin())
  );
create policy merchant_profiles_update_team on public.merchant_profiles
  for update to authenticated
  using (public.is_team_member(organizer_id)) with check (public.is_team_member(organizer_id));

-- merchant_outlets
grant select, insert, update on public.merchant_outlets to authenticated;

create policy merchant_outlets_select on public.merchant_outlets
  for select to authenticated
  using (
    exists (select 1 from public.organizers o where o.id = organizer_id and o.status = 'approved')
    or public.is_team_member(organizer_id)
    or (select public.is_admin())
  );
create policy merchant_outlets_insert_team on public.merchant_outlets
  for insert to authenticated
  with check (
    public.is_team_member(organizer_id)
    and exists (select 1 from public.organizers o where o.id = organizer_id and o.type = 'merchant')
  );
create policy merchant_outlets_update_team on public.merchant_outlets
  for update to authenticated
  using (public.is_team_member(organizer_id)) with check (public.is_team_member(organizer_id));

-- community_profiles (join_policy hanya lewat set_join_policy)
grant select on public.community_profiles to authenticated;
grant update (interest_category, activity_area_village_id, social_links, est_members,
  basecamp_address, basecamp_lat, basecamp_lng, whatsapp, proof_url) on public.community_profiles to authenticated;

create policy community_profiles_select on public.community_profiles
  for select to authenticated
  using (
    exists (select 1 from public.organizers o where o.id = organizer_id and o.status = 'approved')
    or public.is_team_member(organizer_id)
    or (select public.is_admin())
  );
create policy community_profiles_update_team on public.community_profiles
  for update to authenticated
  using (public.is_team_member(organizer_id)) with check (public.is_team_member(organizer_id));

-- organizer_members: tulis hanya lewat fungsi
grant select on public.organizer_members to authenticated;

create policy organizer_members_select on public.organizer_members
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_member(organizer_id) or (select public.is_admin()));

-- organizer_invites: tulis hanya lewat fungsi
grant select on public.organizer_invites to authenticated;

create policy organizer_invites_select on public.organizer_invites
  for select to authenticated
  using (public.is_team_member(organizer_id) or (select public.is_admin()));

-- community_memberships: tulis hanya lewat fungsi
grant select on public.community_memberships to authenticated;

create policy community_memberships_select on public.community_memberships
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_team_member(community_id) or (select public.is_admin()));

-- notifications: baca milik sendiri; tandai dibaca lewat fungsi
grant select on public.notifications to authenticated;

create policy notifications_select_own on public.notifications
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- admin_actions: admin baca; tulis hanya lewat fungsi
grant select on public.admin_actions to authenticated;

create policy admin_actions_select_admin on public.admin_actions
  for select to authenticated using ((select public.is_admin()));

-- Tim melihat member dan rekan timnya hanya lewat dua view ini: nickname dan
-- kelurahan saja, tidak pernah full_name. View berjalan sebagai pemilik
-- (bukan security_invoker) tetapi disaring dengan is_team_member().
create view public.v_community_members as
select
  m.id, m.community_id, m.user_id, m.status, m.message, m.joined_at, m.decided_at, m.ended_at,
  m.removed_reason, m.created_at,
  p.nickname::text as nickname, r.name as village_name,
  om.role as team_role
from public.community_memberships m
join public.profiles p on p.id = m.user_id
left join public.regions r on r.id = p.home_village_id
left join public.organizer_members om on om.organizer_id = m.community_id and om.user_id = m.user_id
where public.is_team_member(m.community_id) or (select public.is_admin());

create view public.v_organizer_team as
select
  om.organizer_id, om.user_id, om.role, om.created_at,
  p.nickname::text as nickname, p.avatar_url
from public.organizer_members om
join public.profiles p on p.id = om.user_id
where public.is_team_member(om.organizer_id) or (select public.is_admin());

grant select on public.v_community_members, public.v_organizer_team, public.v_community_member_stats to authenticated;

-- Nama panggilan warga lain hanya lewat fungsi ini (tidak pernah full_name).
create function public.public_profile(p_user_id uuid)
returns table (id uuid, nickname text, avatar_url text, village_name text)
language sql
stable
security definer
set search_path = ''
as $$
  select p.id, p.nickname::text, p.avatar_url, r.name
  from public.profiles p
  left join public.regions r on r.id = p.home_village_id
  where p.id = p_user_id and p.deleted_at is null;
$$;

revoke execute on function public.public_profile(uuid) from public, anon;
grant execute on function public.public_profile(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Storage: logos (publik) dan organizer-proofs (privat)
-- Path: <organizer_id>/<nama-file>. Hanya tim organizer yang bisa mengunggah.
-- Dilewati jika skema storage tidak ada (uji lokal).
-- -----------------------------------------------------------------------------

do $$
begin
  if to_regclass('storage.buckets') is null then
    raise notice 'storage tidak tersedia, bucket dilewati';
    return;
  end if;

  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values
    ('logos', 'logos', true, 2097152, array['image/png', 'image/jpeg', 'image/webp']),
    ('organizer-proofs', 'organizer-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
  on conflict (id) do nothing;

  execute $p$
    create policy logos_read_all on storage.objects
      for select to anon, authenticated using (bucket_id = 'logos')
  $p$;
  execute $p$
    create policy logos_write_team on storage.objects
      for insert to authenticated
      with check (bucket_id = 'logos' and public.is_team_member((storage.foldername(name))[1]::uuid))
  $p$;
  execute $p$
    create policy logos_update_team on storage.objects
      for update to authenticated
      using (bucket_id = 'logos' and public.is_team_member((storage.foldername(name))[1]::uuid))
  $p$;
  execute $p$
    create policy proofs_read_team_admin on storage.objects
      for select to authenticated
      using (bucket_id = 'organizer-proofs'
        and (public.is_team_member((storage.foldername(name))[1]::uuid) or (select public.is_admin())))
  $p$;
  execute $p$
    create policy proofs_write_team on storage.objects
      for insert to authenticated
      with check (bucket_id = 'organizer-proofs' and public.is_team_member((storage.foldername(name))[1]::uuid))
  $p$;
  execute $p$
    create policy proofs_update_team on storage.objects
      for update to authenticated
      using (bucket_id = 'organizer-proofs' and public.is_team_member((storage.foldername(name))[1]::uuid))
  $p$;
end;
$$;
