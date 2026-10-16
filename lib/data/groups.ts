import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { TargetKind } from "@/lib/activities";

export type GroupMember = { user_id: string; nickname: string; village_name: string | null; role: "leader" | "member"; joined_at: string };
export type MyGroup = { id: string; name: string; leader_id: string; invite_code: string; members: GroupMember[]; isLeader: boolean };

// Grup tempat warga aktif, lengkap dengan anggota aktif.
export async function listMyGroups(userId: string): Promise<MyGroup[]> {
  const supabase = await createClient();
  const { data: mine } = await supabase.from("group_members").select("group_id, role").eq("user_id", userId).eq("status", "active");
  const ids = (mine ?? []).map((m) => m.group_id as string);
  if (ids.length === 0) return [];
  const [{ data: groups }, { data: members }] = await Promise.all([
    supabase.from("groups").select("id, name, leader_id, invite_code").in("id", ids).order("name"),
    supabase.from("v_group_members").select("group_id, user_id, nickname, village_name, role, joined_at").in("group_id", ids).eq("status", "active").order("joined_at"),
  ]);
  return (groups ?? []).map((g) => ({
    id: g.id as string,
    name: g.name as string,
    leader_id: g.leader_id as string,
    invite_code: g.invite_code as string,
    isLeader: g.leader_id === userId,
    members: ((members ?? []) as (GroupMember & { group_id: string })[]).filter((m) => m.group_id === g.id),
  }));
}

export type GroupProgress = { activity_id: string; group_id: string; group_name: string; kind: TargetKind; target_count: number; progress: number; contributors: number; members: number; rank: number };

// Progress grup di satu challenge grup (peringkat semua grup), atau semua challenge grup milik satu grup.
export async function listGroupProgress(filter: { activityId?: string; groupIds?: string[] }): Promise<GroupProgress[]> {
  const supabase = await createClient();
  let q = supabase.from("v_group_progress").select("*").order("rank");
  if (filter.activityId) q = q.eq("activity_id", filter.activityId);
  if (filter.groupIds) q = q.in("group_id", filter.groupIds);
  const { data } = await q.limit(50);
  return (data ?? []) as GroupProgress[];
}

export type GroupInvite = { participation_id: string; activity_id: string; title: string; starts_at: string; group_name: string; leader_nickname: string };

// Undangan ikut aktivitas lewat grup yang belum dijawab.
export async function listGroupInvites(userId: string): Promise<GroupInvite[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("participations")
    .select("id, activity_id, group_id, registered_by, activity:activities(title, starts_at), group:groups(name)")
    .eq("user_id", userId)
    .eq("status", "invited");
  const rows = data ?? [];
  const leaderIds = [...new Set(rows.map((r) => r.registered_by as string).filter(Boolean))];
  const { data: leaders } = leaderIds.length ? await supabase.from("v_group_members").select("user_id, nickname").in("user_id", leaderIds) : { data: [] };
  const nick = new Map((leaders ?? []).map((l) => [l.user_id as string, l.nickname as string]));
  return rows.map((r) => {
    const a = (Array.isArray(r.activity) ? r.activity[0] : r.activity) as { title: string; starts_at: string } | null;
    const g = (Array.isArray(r.group) ? r.group[0] : r.group) as { name: string } | null;
    return { participation_id: r.id as string, activity_id: r.activity_id as string, title: a?.title ?? "", starts_at: a?.starts_at ?? "", group_name: g?.name ?? "grup", leader_nickname: nick.get(r.registered_by as string) ?? "ketua grup" };
  });
}
