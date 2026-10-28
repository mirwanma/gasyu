import "server-only";
import type { CitizenMissionList, CompletionStatus, MissionReveal, MissionVerification } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";

// Pembacaan misi (irisan 10). Kolom qr_secret dan code_hash tidak pernah dipilih.

const MISSION_COLUMNS =
  "id, activity_id, partner_organizer_id, title, description, icon, sort_order, verification, checkpoint_id, xp_reward, score_reward, is_required, available_from, available_until, is_active, reveal_mode, reveal_at, prerequisite_mission_id, show_teaser, revealed_at, locked_at, created_at";

export type TeamMission = {
  id: string;
  activity_id: string;
  partner_organizer_id: string;
  title: string;
  description: string | null;
  icon: string | null;
  sort_order: number;
  verification: MissionVerification;
  checkpoint_id: string | null;
  xp_reward: number;
  score_reward: number;
  is_required: boolean;
  available_from: string | null;
  available_until: string | null;
  is_active: boolean;
  reveal_mode: MissionReveal;
  reveal_at: string | null;
  prerequisite_mission_id: string | null;
  show_teaser: boolean;
  revealed_at: string | null;
  locked_at: string | null;
  created_at: string;
  partner_name: string;
  checkpoint_name: string | null;
  stats: { approved: number; pending: number; rejected: number; flagged: number; participants: number; unlocked_for: number };
};

export async function listTeamMissions(activityId: string): Promise<TeamMission[]> {
  const supabase = await createClient();
  const [{ data: missions }, { data: stats }, { data: partners }, { data: checkpoints }] = await Promise.all([
    supabase.from("activity_missions").select(MISSION_COLUMNS).eq("activity_id", activityId).order("sort_order").order("created_at"),
    supabase.from("v_mission_stats").select("*").eq("activity_id", activityId),
    supabase.from("activity_partners").select("organizer_id, organizer:organizers(name)").eq("activity_id", activityId),
    supabase.from("activity_checkpoints").select("id, name").eq("activity_id", activityId),
  ]);
  const statMap = new Map((stats ?? []).map((s) => [s.mission_id as string, s]));
  const nameMap = new Map((partners ?? []).map((p) => [p.organizer_id as string, ((Array.isArray(p.organizer) ? p.organizer[0] : p.organizer) as { name: string } | null)?.name ?? "?"]));
  const cpMap = new Map((checkpoints ?? []).map((c) => [c.id as string, c.name as string]));
  return (missions ?? []).map((m) => {
    const s = statMap.get(m.id as string) as Record<string, number> | undefined;
    return {
      ...(m as unknown as Omit<TeamMission, "partner_name" | "checkpoint_name" | "stats">),
      partner_name: nameMap.get(m.partner_organizer_id as string) ?? "?",
      checkpoint_name: m.checkpoint_id ? (cpMap.get(m.checkpoint_id as string) ?? null) : null,
      stats: {
        approved: s?.approved ?? 0,
        pending: s?.pending ?? 0,
        rejected: s?.rejected ?? 0,
        flagged: s?.flagged ?? 0,
        participants: s?.participants ?? 0,
        unlocked_for: s?.unlocked_for ?? 0,
      },
    };
  });
}

export async function getCitizenMissions(activityId: string): Promise<CitizenMissionList | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_missions", { p_activity_id: activityId });
  if (error || !data) return null;
  return data as CitizenMissionList;
}

export type ReviewItem = {
  id: string;
  mission_id: string;
  activity_id: string;
  user_id: string;
  status: CompletionStatus;
  proof_path: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  review_note: string | null;
  mission_title: string;
  xp_reward: number;
  activity_title: string;
  nickname: string;
  district_name: string | null;
};

export async function listReviewQueue(activityId: string, mode: "pending" | "history" = "pending"): Promise<ReviewItem[]> {
  const supabase = await createClient();
  let query = supabase.from("v_mission_review_queue").select("*").eq("activity_id", activityId).limit(100);
  query = mode === "pending" ? query.eq("status", "pending_review").order("submitted_at") : query.neq("status", "pending_review").order("reviewed_at", { ascending: false });
  const { data } = await query;
  return (data ?? []) as ReviewItem[];
}

// eligible = boleh ditandai: sudah check-in (jika aktivitas punya checkpoint) dan bukan akun penanda sendiri.
// self = akun yang sedang membuka halaman ini.
export type ManualCandidate = { user_id: string; nickname: string; district_name: string | null; group_id: string | null; done: boolean; eligible: boolean; self: boolean };

export async function listManualCandidates(missionId: string): Promise<ManualCandidate[]> {
  const supabase = await createClient();
  const [{ data }, { data: claims }] = await Promise.all([
    supabase.from("v_mission_manual_candidates").select("user_id, nickname, district_name, group_id, done, eligible").eq("mission_id", missionId).order("nickname"),
    supabase.auth.getClaims(),
  ]);
  const uid = claims?.claims?.sub;
  return (data ?? []).map((c) => ({ ...c, eligible: c.eligible ?? false, self: c.user_id === uid })) as ManualCandidate[];
}

// Jumlah bukti foto menunggu per aktivitas untuk tim (badge di daftar aktivitas).
export async function countPendingProofs(activityId: string) {
  const supabase = await createClient();
  const { count } = await supabase.from("v_mission_review_queue").select("id", { count: "exact", head: true }).eq("activity_id", activityId).eq("status", "pending_review");
  return count ?? 0;
}
