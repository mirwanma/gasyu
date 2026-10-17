-- 0014: Saran warga untuk merchant dan komunitas.
--
-- Warga mengirim saran (ide aktivitas, menu, pelayanan, tempat) ke merchant atau
-- komunitas yang sudah terverifikasi. Tim penyelenggara (owner/staff atau
-- chair/officer) membaca, menanggapi, dan mengubah statusnya.
--
-- Aturan:
-- - Hanya warga aktif (sudah onboarding, tidak dibekukan) yang bisa mengirim.
-- - Tujuan harus merchant/komunitas berstatus approved; bukan organizer platform.
-- - Tim tidak bisa mengirim saran ke penyelenggaranya sendiri.
-- - Batas kiriman per warga per penyelenggara per hari (WIB) dari app_settings.
-- - Privasi: tim hanya melihat nickname lewat view; jika warga memilih anonim,
--   tim tidak melihat identitas sama sekali. Tabel mentah hanya bisa dibaca
--   pengirimnya dan admin (admin tetap bisa menindak penyalahgunaan).
-- - Tidak ada XP atau poin untuk saran, supaya tidak memancing spam.
-- - Tulis hanya lewat fungsi security definer.

insert into public.app_settings (key, value) values
  ('suggestion.daily_limit_per_organizer', '3')
on conflict (key) do nothing;

create type public.suggestion_category as enum ('activity', 'product', 'service', 'place', 'other');
create type public.suggestion_status as enum ('new', 'in_progress', 'done', 'archived');

create table public.suggestions (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references public.organizers (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  category public.suggestion_category not null default 'other',
  body text not null check (char_length(body) between 10 and 1000),
  is_anonymous boolean not null default false,
  status public.suggestion_status not null default 'new',
  reply text check (reply is null or char_length(reply) between 1 and 1000),
  replied_at timestamptz,
  replied_by uuid references public.profiles (id) on delete set null,
  status_changed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index suggestions_organizer_idx on public.suggestions (organizer_id, status, created_at desc);
create index suggestions_user_idx on public.suggestions (user_id, created_at desc);

create trigger suggestions_set_updated_at
  before update on public.suggestions
  for each row execute function public.set_updated_at();

alter table public.suggestions enable row level security;

-- Baca tabel mentah: hanya pengirim dan admin. Tim membaca lewat view di bawah.
grant select on public.suggestions to authenticated;
create policy suggestions_select_own on public.suggestions
  for select to authenticated using (user_id = (select auth.uid()));
create policy suggestions_select_admin on public.suggestions
  for select to authenticated using ((select public.is_admin()));
-- Tidak ada policy insert/update/delete: semua perubahan lewat fungsi.

-- -----------------------------------------------------------------------------
-- View untuk tim: identitas disembunyikan jika anonim, tidak pernah full_name.
-- Berjalan sebagai pemilik view, disaring dengan is_team_member().
-- -----------------------------------------------------------------------------
create view public.v_organizer_suggestions as
select
  s.id, s.organizer_id, s.category, s.body, s.is_anonymous, s.status,
  s.reply, s.replied_at, s.status_changed_at, s.created_at, s.updated_at,
  case when s.is_anonymous then null else s.user_id end as user_id,
  case when s.is_anonymous then null else p.nickname::text end as nickname,
  case when s.is_anonymous then null else r.name end as village_name,
  rp.nickname::text as replied_by_nickname
from public.suggestions s
join public.profiles p on p.id = s.user_id
left join public.regions r on r.id = p.home_village_id
left join public.profiles rp on rp.id = s.replied_by
where public.is_team_member(s.organizer_id) or (select public.is_admin());

grant select on public.v_organizer_suggestions to authenticated;

-- -----------------------------------------------------------------------------
-- Warga mengirim saran
-- -----------------------------------------------------------------------------
create function public.submit_suggestion(
  p_organizer_id uuid,
  p_category public.suggestion_category,
  p_body text,
  p_is_anonymous boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_org public.organizers;
  v_body text := btrim(coalesce(p_body, ''));
  v_today_count integer;
  v_id uuid;
begin
  select * into v_org from public.organizers where id = p_organizer_id;
  if not found or v_org.type not in ('merchant', 'community') or v_org.status <> 'approved' then
    raise exception 'invalid_organizer';
  end if;
  if exists (select 1 from public.organizer_members where organizer_id = p_organizer_id and user_id = v_uid) then
    raise exception 'own_organizer';
  end if;
  if char_length(v_body) < 10 or char_length(v_body) > 1000 then
    raise exception 'invalid_suggestion';
  end if;

  select count(*) into v_today_count
  from public.suggestions
  where user_id = v_uid
    and organizer_id = p_organizer_id
    and (created_at at time zone 'Asia/Jakarta')::date = public.local_today();
  if v_today_count >= public.setting_int('suggestion.daily_limit_per_organizer') then
    raise exception 'suggestion_limit';
  end if;

  insert into public.suggestions (organizer_id, user_id, category, body, is_anonymous)
  values (p_organizer_id, v_uid, coalesce(p_category, 'other'), v_body, coalesce(p_is_anonymous, false))
  returning id into v_id;

  perform public.notify_team(p_organizer_id, 'suggestion_received', jsonb_build_object(
    'suggestion_id', v_id,
    'organizer_id', v_org.id,
    'organizer_name', v_org.name,
    'organizer_type', v_org.type,
    'category', coalesce(p_category, 'other')
  ));
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tim menanggapi: ubah status dan/atau tulis balasan untuk warga.
-- p_reply null = balasan tidak diubah; string kosong = balasan dihapus.
-- -----------------------------------------------------------------------------
create function public.respond_suggestion(
  p_suggestion_id uuid,
  p_status public.suggestion_status,
  p_reply text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_s public.suggestions;
  v_org public.organizers;
  v_reply text;
  v_reply_changed boolean := false;
  v_status_changed boolean;
begin
  select * into v_s from public.suggestions where id = p_suggestion_id for update;
  if not found then
    raise exception 'suggestion_not_found';
  end if;
  if not public.is_team_member(v_s.organizer_id) then
    raise exception 'not_allowed';
  end if;
  if p_status is null or p_status = 'new' then
    raise exception 'invalid_status';
  end if;

  v_reply := v_s.reply;
  if p_reply is not null then
    v_reply := nullif(btrim(p_reply), '');
    if v_reply is not null and char_length(v_reply) > 1000 then
      raise exception 'invalid_suggestion';
    end if;
    v_reply_changed := v_reply is distinct from v_s.reply;
  end if;
  v_status_changed := p_status <> v_s.status;

  if not v_reply_changed and not v_status_changed then
    return;
  end if;

  update public.suggestions
  set status = p_status,
      status_changed_at = case when v_status_changed then now() else status_changed_at end,
      reply = v_reply,
      replied_at = case when v_reply_changed then (case when v_reply is null then null else now() end) else replied_at end,
      replied_by = case when v_reply_changed then (case when v_reply is null then null else v_uid end) else replied_by end
  where id = p_suggestion_id;

  -- Warga diberi tahu jika ada balasan baru atau saran mulai ditindaklanjuti/selesai.
  -- Mengarsipkan tanpa balasan tidak mengirim notifikasi.
  if (v_reply_changed and v_reply is not null) or (v_status_changed and p_status in ('in_progress', 'done')) then
    select * into v_org from public.organizers where id = v_s.organizer_id;
    perform public.notify(v_s.user_id, 'suggestion_answered', jsonb_build_object(
      'suggestion_id', v_s.id,
      'organizer_name', v_org.name,
      'organizer_slug', v_org.slug,
      'organizer_type', v_org.type,
      'status', p_status,
      'has_reply', v_reply is not null
    ));
  end if;
end;
$$;

revoke execute on function public.submit_suggestion(uuid, public.suggestion_category, text, boolean),
  public.respond_suggestion(uuid, public.suggestion_status, text)
  from public, anon;
grant execute on function public.submit_suggestion(uuid, public.suggestion_category, text, boolean),
  public.respond_suggestion(uuid, public.suggestion_status, text)
  to authenticated;
