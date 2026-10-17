-- 0018: Master misi — katalog template misi yang dikelola admin.
--
-- Tujuan: penyelenggara (terutama UMKM yang baru pertama kali membuat event)
-- tidak mulai dari nol. Admin menyiapkan template misi yang sudah terbukti
-- (judul, instruksi, cara verifikasi, saran XP, kategori), penyelenggara
-- memilihnya saat menambah misi, lalu boleh mengubah isinya.
--
-- Aturan:
-- - Template disalin ke activity_missions (bukan ditautkan). Mengubah atau
--   menonaktifkan template tidak mengubah misi yang sudah dibuat.
-- - activity_missions.template_id mencatat asal misi untuk statistik.
-- - Hanya admin yang membuat, mengubah, dan mengaktifkan/nonaktifkan template
--   (dicatat di admin_actions). Penyelenggara membaca template yang aktif.
-- - Saran XP mengikuti batas mission.xp_min / mission.xp_max di app_settings.
-- - Template bisa dibatasi untuk jenis aktivitas (event/challenge) dan tipe
--   penyelenggara (merchant/komunitas); kosong = untuk semua.

create type public.mission_category as enum (
  'visit', 'purchase', 'social', 'sport', 'environment', 'learning', 'community', 'other'
);

create table public.mission_templates (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 3 and 80),
  description text check (description is null or char_length(description) <= 500),
  organizer_tips text check (organizer_tips is null or char_length(organizer_tips) <= 300),
  category public.mission_category not null default 'other',
  verification public.mission_verification not null,
  xp_reward integer not null,
  is_required boolean not null default true,
  activity_type public.activity_type,            -- null = event dan challenge
  organizer_type public.organizer_type check (organizer_type is null or organizer_type in ('merchant', 'community')),
  is_active boolean not null default true,
  sort_order smallint not null default 0,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index mission_templates_active_idx on public.mission_templates (category, sort_order) where is_active;

create trigger mission_templates_set_updated_at
  before update on public.mission_templates
  for each row execute function public.set_updated_at();

alter table public.mission_templates enable row level security;
revoke all on public.mission_templates from anon;
revoke insert, update, delete on public.mission_templates from authenticated;
grant select on public.mission_templates to authenticated;
create policy mission_templates_select on public.mission_templates
  for select to authenticated using (is_active or (select public.is_admin()));
-- Tidak ada policy insert/update/delete: perubahan lewat fungsi admin.

alter table public.activity_missions
  add column template_id uuid references public.mission_templates (id) on delete set null;
create index activity_missions_template_idx on public.activity_missions (template_id) where template_id is not null;

-- -----------------------------------------------------------------------------
-- Admin: buat atau ubah template
-- -----------------------------------------------------------------------------
create function public.upsert_mission_template(p_template_id uuid, p_data jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_id uuid := p_template_id;
  v_title text := btrim(coalesce(p_data ->> 'title', ''));
  v_desc text := nullif(btrim(coalesce(p_data ->> 'description', '')), '');
  v_tips text := nullif(btrim(coalesce(p_data ->> 'organizer_tips', '')), '');
  v_xp integer;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if char_length(v_title) not between 3 and 80 then
    raise exception 'invalid_title';
  end if;
  begin
    v_xp := (p_data ->> 'xp_reward')::integer;
  exception when others then
    raise exception 'invalid_xp';
  end;
  if v_xp is null or v_xp < public.setting_int('mission.xp_min') or v_xp > public.setting_int('mission.xp_max') then
    raise exception 'invalid_xp';
  end if;

  if v_id is null then
    insert into public.mission_templates (title, description, organizer_tips, category, verification, xp_reward, is_required,
      activity_type, organizer_type, sort_order, created_by)
    values (v_title, v_desc, v_tips,
      coalesce(nullif(p_data ->> 'category', ''), 'other')::public.mission_category,
      (p_data ->> 'verification')::public.mission_verification,
      v_xp, coalesce((p_data ->> 'is_required')::boolean, true),
      nullif(p_data ->> 'activity_type', '')::public.activity_type,
      nullif(p_data ->> 'organizer_type', '')::public.organizer_type,
      coalesce((p_data ->> 'sort_order')::smallint, 0), v_uid)
    returning id into v_id;
    insert into public.admin_actions (admin_id, action, target_table, target_id, note)
    values (v_uid, 'create_mission_template', 'mission_templates', v_id, v_title);
  else
    update public.mission_templates set
      title = v_title,
      description = v_desc,
      organizer_tips = v_tips,
      category = coalesce(nullif(p_data ->> 'category', ''), 'other')::public.mission_category,
      verification = (p_data ->> 'verification')::public.mission_verification,
      xp_reward = v_xp,
      is_required = coalesce((p_data ->> 'is_required')::boolean, true),
      activity_type = nullif(p_data ->> 'activity_type', '')::public.activity_type,
      organizer_type = nullif(p_data ->> 'organizer_type', '')::public.organizer_type,
      sort_order = coalesce((p_data ->> 'sort_order')::smallint, sort_order)
    where id = v_id;
    if not found then
      raise exception 'invalid_template';
    end if;
    insert into public.admin_actions (admin_id, action, target_table, target_id, note)
    values (v_uid, 'update_mission_template', 'mission_templates', v_id, v_title);
  end if;
  return v_id;
end;
$$;

create function public.set_mission_template_active(p_template_id uuid, p_active boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  update public.mission_templates set is_active = p_active where id = p_template_id;
  if not found then
    raise exception 'invalid_template';
  end if;
  insert into public.admin_actions (admin_id, action, target_table, target_id)
  values (v_uid, case when p_active then 'activate_mission_template' else 'deactivate_mission_template' end, 'mission_templates', p_template_id);
end;
$$;

revoke execute on function public.upsert_mission_template(uuid, jsonb), public.set_mission_template_active(uuid, boolean) from public, anon;
grant execute on function public.upsert_mission_template(uuid, jsonb), public.set_mission_template_active(uuid, boolean) to authenticated;

-- -----------------------------------------------------------------------------
-- Statistik pemakaian template (admin saja)
-- -----------------------------------------------------------------------------
create view public.v_mission_template_stats as
select
  t.id as template_id,
  (select count(*) from public.activity_missions m where m.template_id = t.id)::integer as missions,
  (select count(distinct m.activity_id) from public.activity_missions m where m.template_id = t.id)::integer as activities,
  (select count(*) from public.mission_completions mc
     join public.activity_missions m on m.id = mc.mission_id
     where m.template_id = t.id and mc.status = 'approved')::integer as completions,
  (select count(*) from public.activity_missions m
     join public.participations p on p.activity_id = m.activity_id
     where m.template_id = t.id and p.status in ('registered', 'in_progress', 'completed', 'not_completed'))::integer as participant_slots,
  (select max(m.created_at) from public.activity_missions m where m.template_id = t.id) as last_used_at
from public.mission_templates t
where (select public.is_admin());

grant select on public.v_mission_template_stats to authenticated;

-- -----------------------------------------------------------------------------
-- upsert_mission (0010) diganti: menerima template_id saat membuat misi baru
-- -----------------------------------------------------------------------------
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

  if v_id is null and v_template is not null
     and not exists (select 1 from public.mission_templates where id = v_template and is_active) then
    raise exception 'invalid_template';
  end if;

  if v_id is null then
    if v_verification = 'secret_code' and v_code is null then
      raise exception 'mission_code_required';
    end if;
    insert into public.activity_missions (activity_id, partner_organizer_id, title, description, icon, sort_order, verification, checkpoint_id, code_hash,
      xp_reward, is_required, available_from, available_until, reveal_mode, reveal_at, prerequisite_mission_id, show_teaser, created_by, template_id)
    values (p_activity_id, v_partner, btrim(p_mission ->> 'title'), nullif(btrim(coalesce(p_mission ->> 'description', '')), ''), nullif(p_mission ->> 'icon', ''),
      coalesce((p_mission ->> 'sort_order')::smallint, (select coalesce(max(sort_order), 0) + 1 from public.activity_missions where activity_id = p_activity_id)),
      v_verification, nullif(p_mission ->> 'checkpoint_id', '')::uuid,
      case when v_verification = 'secret_code' then extensions.crypt(lower(v_code), extensions.gen_salt('bf')) end,
      (p_mission ->> 'xp_reward')::integer, coalesce((p_mission ->> 'is_required')::boolean, true),
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

-- -----------------------------------------------------------------------------
-- Template awal (hanya jika katalog masih kosong)
-- -----------------------------------------------------------------------------
insert into public.mission_templates (title, description, organizer_tips, category, verification, xp_reward, is_required, activity_type, organizer_type, sort_order)
select * from (values
  ('Mampir ke booth atau outlet', 'Datang ke booth/outlet kami dan pindai QR misi yang ditunjukkan petugas.', 'Tampilkan QR misi di HP atau tablet petugas. QR berganti tiap 60 detik, jadi jangan dicetak.', 'visit'::public.mission_category, 'qr_scan'::public.mission_verification, 20, true, null::public.activity_type, null::public.organizer_type, 1),
  ('Datang lebih awal', 'Pindai QR misi di meja registrasi sebelum acara dimulai.', 'Atur jendela waktu misi (tersedia dari/sampai) supaya hanya berlaku sebelum acara mulai.', 'visit', 'qr_scan', 20, false, 'event', null, 2),
  ('Kode rahasia di struk belanja', 'Belanja minimal satu item, lalu ketik kode rahasia yang tertera di struk.', 'Cetak atau tulis kodenya di struk. Ganti kode di misi kalau sudah tersebar.', 'purchase', 'secret_code', 30, false, null, 'merchant', 3),
  ('Coba menu baru', 'Pesan menu baru kami dan ketik kode yang diberikan kasir.', 'Kasir menyebutkan kode saat menyerahkan pesanan.', 'purchase', 'secret_code', 30, false, null, 'merchant', 4),
  ('Foto bersama di lokasi', 'Unggah foto kamu di lokasi acara. Wajah atau papan nama lokasi harus terlihat jelas.', 'Tinjau foto di tab Tinjau foto. Tolak foto yang bukan di lokasi.', 'social', 'photo', 20, false, null, null, 5),
  ('Ulasan di media sosial', 'Unggah tangkapan layar ulasan atau story kamu yang menandai akun kami.', 'Sebutkan akun media sosial yang harus ditandai di instruksi.', 'social', 'photo', 30, false, null, null, 6),
  ('Selesaikan rute', 'Selesaikan seluruh rute sampai garis finis. Panitia menandai peserta yang finis.', 'Tandai peserta yang finis lewat tombol Tandai di halaman Misi.', 'sport', 'manual', 50, true, 'event', 'community', 7),
  ('Ikut sesi sampai selesai', 'Ikuti workshop atau kelas dari awal sampai akhir. Panitia menandai yang hadir penuh.', 'Tandai peserta setelah sesi selesai, bukan di awal.', 'learning', 'manual', 40, true, 'event', null, 8),
  ('Jawab kuis di akhir acara', 'Jawab kuis dari panitia. Yang menjawab benar ditandai panitia.', 'Buka misi manual saat kuis dimulai supaya warga tahu misinya.', 'learning', 'manual', 30, false, 'event', null, 9),
  ('Bawa tumbler atau tas belanja sendiri', 'Unggah foto tumbler atau tas belanja yang kamu bawa ke lokasi.', 'Cocok dipadukan dengan diskon untuk pembawa tumbler.', 'environment', 'photo', 20, false, null, null, 10),
  ('Pungut sampah di sekitar lokasi', 'Kumpulkan sampah di sekitar lokasi, lalu unggah foto kantong sampahnya.', 'Siapkan kantong sampah dan titik kumpul.', 'environment', 'photo', 40, false, null, 'community', 11),
  ('Ajak teman baru', 'Datang bersama teman yang baru pertama kali ikut. Panitia menandai kalian berdua.', 'Cocok untuk challenge atau event komunitas yang ingin menambah member.', 'community', 'manual', 30, false, null, 'community', 12)
) as v(title, description, organizer_tips, category, verification, xp_reward, is_required, activity_type, organizer_type, sort_order)
where not exists (select 1 from public.mission_templates);
