-- 0016: Menyerahkan atau mengubah peran anggota tim penyelenggara.
--
-- ALUR-SISTEM bagian 5 dan 12: minimal harus tersisa satu pemilik/ketua, dan
-- ketua tidak bisa keluar sebelum menyerahkan peran ketua. Fungsi ini membuat
-- penyerahan itu mungkin: pemilik/ketua menjadikan anggota lain pemilik/ketua,
-- lalu boleh turun menjadi staf/pengurus atau keluar.
-- Peran mengikuti tipe: merchant owner/staff, komunitas chair/officer
-- (dicek juga oleh trigger check_member_role).

create function public.set_team_role(p_organizer_id uuid, p_user_id uuid, p_role public.member_role)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_org public.organizers;
  v_current public.member_role;
begin
  if not public.is_team_leader(p_organizer_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_org from public.organizers where id = p_organizer_id;
  if (v_org.type = 'merchant' and p_role not in ('owner', 'staff'))
     or (v_org.type = 'community' and p_role not in ('chair', 'officer'))
     or v_org.type = 'platform' then
    raise exception 'invalid_member_role';
  end if;

  select role into v_current from public.organizer_members
  where organizer_id = p_organizer_id and user_id = p_user_id for update;
  if not found then
    raise exception 'not_team_member';
  end if;
  if v_current = p_role then
    return;
  end if;

  -- Menurunkan pemilik/ketua: harus tersisa minimal satu pemilik/ketua lain.
  if v_current in ('owner', 'chair') and p_role in ('staff', 'officer') and not exists (
    select 1 from public.organizer_members
    where organizer_id = p_organizer_id and user_id <> p_user_id and role in ('owner', 'chair')
  ) then
    raise exception 'last_leader_cannot_be_removed';
  end if;

  update public.organizer_members set role = p_role
  where organizer_id = p_organizer_id and user_id = p_user_id;

  if p_user_id <> v_uid then
    perform public.notify(p_user_id, 'team_role_changed', jsonb_build_object(
      'organizer_id', v_org.id, 'organizer_name', v_org.name, 'organizer_type', v_org.type, 'role', p_role));
  end if;
end;
$$;

revoke execute on function public.set_team_role(uuid, uuid, public.member_role) from public, anon;
grant execute on function public.set_team_role(uuid, uuid, public.member_role) to authenticated;
