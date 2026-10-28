import "server-only";
import { createClient } from "@/lib/supabase/server";
import { formatNumber } from "@/lib/format";
import { filterTerm } from "@/lib/safe-url";

// Pembacaan view dashboard dan moderasi (irisan 8). Angka dihitung di database;
// di sini hanya diteruskan ke halaman.

export type MerchantDashboard = {
  organizer_id: string;
  running_activities: number;
  published_activities: number;
  next_starts_at: string | null;
  draft_activities: number;
  participants: number;
  participants_week: number;
  checkins_today: number;
  new_citizens_30d: number;
  returning_citizens_30d: number;
  payments_pending: number;
  mission_proofs_pending: number;
  partner_invites_pending: number;
  partner_budget_empty: number;
  points_budget: number;
  points_used: number;
  vouchers_redeemed: number;
  vouchers_used: number;
  vouchers_active: number;
};

export type CommunityDashboard = {
  organizer_id: string;
  running_activities: number;
  published_activities: number;
  draft_activities: number;
  awaiting_partner_activities: number;
  participants: number;
  checkins_today: number;
  payments_pending: number;
  mission_proofs_pending: number;
  pending_requests: number;
  partner_invites_pending: number;
};

export type OutletVouchers = { outlet_id: string; outlet_name: string; vouchers_used: number; vouchers_used_30d: number };

export type Reputation = {
  organizer_id: string;
  checkins_90d: number;
  registered_90d: number;
  attended_90d: number;
  completed_90d: number;
  attendance_pct: number | null;
  completion_pct: number | null;
  collabs_90d: number;
  score: number;
};

export type ActivityStats = {
  activity_id: string;
  registered_individual: number;
  registered_group: number;
  groups_count: number;
  attended: number;
  completed: number;
  checkins_today: number;
  checkins_flagged: number;
  new_citizens: number;
  returning_citizens: number;
  payments_pending: number;
};

export type PartnerStats = {
  organizer_id: string;
  role: string;
  organizer_name: string;
  organizer_type: string;
  checkins: number;
  citizens: number;
  vouchers_redeemed: number;
  vouchers_used: number;
  points_budget: number;
};

export async function getMerchantDashboard(organizerId: string): Promise<MerchantDashboard | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_merchant_dashboard").select("*").eq("organizer_id", organizerId).maybeSingle();
  return (data as MerchantDashboard | null) ?? null;
}

export async function getCommunityDashboard(organizerId: string): Promise<CommunityDashboard | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_community_dashboard").select("*").eq("organizer_id", organizerId).maybeSingle();
  return (data as CommunityDashboard | null) ?? null;
}

export async function listOutletVouchers(organizerId: string): Promise<OutletVouchers[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_merchant_outlet_vouchers").select("outlet_id, outlet_name, vouchers_used, vouchers_used_30d").eq("organizer_id", organizerId).order("outlet_name");
  return (data ?? []) as OutletVouchers[];
}

export async function getReputation(organizerId: string): Promise<Reputation | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_organizer_reputation").select("*").eq("organizer_id", organizerId).maybeSingle();
  return (data as Reputation | null) ?? null;
}

export async function getActivityStats(activityId: string): Promise<ActivityStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_activity_stats").select("*").eq("activity_id", activityId).maybeSingle();
  return (data as ActivityStats | null) ?? null;
}

export async function listPartnerStats(activityId: string): Promise<PartnerStats[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_activity_partner_stats").select("*").eq("activity_id", activityId).order("role");
  return (data ?? []) as PartnerStats[];
}

// ---------------------------------------------------------------------------
// Admin
// ---------------------------------------------------------------------------

export type AdminOverview = {
  weekly_active: number;
  weekly_active_prev: number;
  citizens: number;
  running_activities: number;
  running_events: number;
  running_challenges: number;
  active_merchants: number;
  active_communities: number;
  points_circulating: number;
  points_redeemed_month: number;
  pending_organizers: number;
  pending_merchants: number;
  pending_activities: number;
  oldest_pending_activity_at: string | null;
  flagged_checkins: number;
  open_pattern_flags: number;
  refunds_pending: number;
};

export async function getAdminOverview(): Promise<AdminOverview | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_admin_overview").select("*").maybeSingle();
  return (data as AdminOverview | null) ?? null;
}

export async function listWeeklyActive(): Promise<{ week_start: string; active_citizens: number }[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_admin_weekly_active").select("*").order("week_start");
  return (data ?? []) as { week_start: string; active_citizens: number }[];
}

export type DistrictRow = { district_id: string; name: string; city: string; active_citizens: number; avg_xp: number };

// Kecamatan teraktif bulan ini di semua kota yang sudah dibuka: rata-rata Jejak per warga aktif.
export async function listActiveDistricts(limit = 5): Promise<DistrictRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.rpc("leaderboard_districts", { p_month: null, p_city_id: null });
  return (data ?? [])
    .filter((row) => row.active_citizens > 0)
    .map((row) => ({ district_id: row.district_id, name: row.district_name, city: row.city_name, active_citizens: row.active_citizens, avg_xp: Math.round(Number(row.avg_xp)) }))
    .sort((a, b) => b.avg_xp - a.avg_xp || b.active_citizens - a.active_citizens)
    .slice(0, limit);
}

export type ModerationCheckin = {
  id: string;
  user_id: string;
  activity_id: string;
  checked_in_at: string;
  distance_m: number | null;
  review_status: "ok" | "flagged" | "approved" | "rejected";
  reviewed_at: string | null;
  review_note: string | null;
  nickname: string;
  account_created_at: string;
  district_name: string | null;
  activity_title: string;
  activity_type: string;
  checkpoint_name: string;
  radius_m: number;
  partner_name: string;
  xp_awarded: number;
};

export async function listModerationCheckins(mode: "open" | "history"): Promise<ModerationCheckin[]> {
  const supabase = await createClient();
  let query = supabase.from("v_moderation_checkins").select("*").limit(100);
  query = mode === "open" ? query.eq("review_status", "flagged").order("checked_in_at", { ascending: false }) : query.in("review_status", ["approved", "rejected"]).order("reviewed_at", { ascending: false });
  const { data } = await query;
  return (data ?? []) as ModerationCheckin[];
}

export type ModerationFlag = {
  id: string;
  user_id: string;
  checkin_id: string | null;
  kind: "impossible_travel" | "shared_device" | "burst_accounts" | "reviewer_burst" | "code_bruteforce" | "manual";
  detail: Record<string, unknown>;
  status: "open" | "dismissed" | "actioned";
  created_at: string;
  reviewed_at: string | null;
  nickname: string;
  suspended_at: string | null;
  district_name: string | null;
  activity_title: string | null;
  checkpoint_name: string | null;
  partner_name: string | null;
  // Penyelenggara terkait (diisi untuk reviewer_burst).
  organizer_id: string | null;
  organizer_name: string | null;
  organizer_type: "merchant" | "community" | "platform" | null;
};

export async function listModerationFlags(mode: "open" | "history"): Promise<ModerationFlag[]> {
  const supabase = await createClient();
  let query = supabase.from("v_moderation_flags").select("*").limit(100);
  query = mode === "open" ? query.eq("status", "open").order("created_at", { ascending: false }) : query.neq("status", "open").order("reviewed_at", { ascending: false });
  const { data } = await query;
  return (data ?? []) as ModerationFlag[];
}

// Misi yang sudah disetujui dan bisa dibatalkan admin (reverse_mission_completion).
export type ReversibleMission = {
  completion_id: string;
  flag_id: string | null;
  nickname: string;
  mission_title: string;
  activity_title: string;
  at: string;
  distance_m: number | null;
  reward: string;
};

type CompletionRow = {
  id: string;
  status: string;
  submitted_at: string;
  reviewed_at: string | null;
  distance_m: number | null;
  user: { nickname: string } | null;
  mission: { title: string; xp_reward: number; score_reward: number } | null;
  activity: { title: string } | null;
};

const COMPLETION_SELECT =
  "id, status, submitted_at, reviewed_at, distance_m, user:profiles!mission_completions_user_id_fkey(nickname), mission:activity_missions(title, xp_reward, score_reward), activity:activities(title)";

function toReversible(c: CompletionRow, flagId: string | null): ReversibleMission {
  const score = c.mission?.score_reward ?? 0;
  return {
    completion_id: c.id,
    flag_id: flagId,
    nickname: c.user?.nickname ?? "?",
    mission_title: c.mission?.title ?? "Misi",
    activity_title: c.activity?.title ?? "",
    at: c.reviewed_at ?? c.submitted_at,
    distance_m: c.distance_m,
    reward: score > 0 ? `${formatNumber(score)} skor` : `${c.mission?.xp_reward ?? 0} Jejak`,
  };
}

// Misi scan QR yang dikerjakan di luar radius checkpoint dan belum diputuskan admin.
export async function listFlaggedMissions(): Promise<ReversibleMission[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("fraud_flags")
    .select(`id, completion:mission_completions(${COMPLETION_SELECT})`)
    .eq("kind", "out_of_radius")
    .eq("status", "open")
    .not("mission_completion_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as { id: string; completion: CompletionRow | null }[])
    .filter((f) => f.completion?.status === "approved")
    .map((f) => toReversible(f.completion!, f.id));
}

// Bukti foto yang disetujui peninjau dalam jendela laporan "peninjau terlalu cepat".
export async function listBurstApprovals(flag: ModerationFlag): Promise<ReversibleMission[]> {
  const supabase = await createClient();
  const minutes = Number((flag.detail as { window_minutes?: number }).window_minutes ?? 10);
  const end = new Date(flag.created_at).getTime();
  const { data } = await supabase
    .from("mission_completions")
    .select(COMPLETION_SELECT)
    .eq("reviewed_by", flag.user_id)
    .eq("status", "approved")
    .not("proof_path", "is", null)
    .gte("reviewed_at", new Date(end - (minutes + 1) * 60_000).toISOString())
    .lte("reviewed_at", new Date(end + 60_000).toISOString())
    .order("reviewed_at", { ascending: false })
    .limit(50);
  return ((data ?? []) as unknown as CompletionRow[]).map((c) => toReversible(c, null));
}

export type AdminUser = {
  id: string;
  nickname: string;
  full_name: string | null;
  is_admin: boolean;
  onboarded_at: string | null;
  suspended_at: string | null;
  deleted_at: string | null;
  created_at: string;
  district_name: string | null;
  total_xp: number;
  checkins: number;
  open_flags: number;
  last_checkin_at: string | null;
};

export async function listAdminUsers(opts: { q?: string; suspended?: boolean } = {}): Promise<AdminUser[]> {
  const supabase = await createClient();
  let query = supabase.from("v_admin_users").select("*").is("deleted_at", null).limit(50);
  const q = opts.q ? filterTerm(opts.q) : "";
  if (q) query = query.or(`nickname.ilike.%${q}%,full_name.ilike.%${q}%`);
  if (opts.suspended) query = query.not("suspended_at", "is", null);
  const { data } = await query.order("created_at", { ascending: false });
  return (data ?? []) as AdminUser[];
}

// ---------------------------------------------------------------------------
// Warga
// ---------------------------------------------------------------------------

export type CitizenDashboard = {
  total_xp: number;
  xp_month: number;
  level: number;
  level_name: string;
  level_min_xp: number;
  next_min_xp: number | null;
  points_balance: number;
  points_expiring_30d: number;
  active_vouchers: number;
  unread_notifications: number;
  streak_weeks: number;
  district_id: string | null;
  district_name: string | null;
  city_id: string | null;
  city_name: string | null;
  city_active: boolean;
  rank_city: number | null;
  rank_district: number | null;
  district_active_citizens: number | null;
  district_rank: number | null;
  badges: { code: string; name: string; awarded_at: string }[];
  badge_total: number;
  my_activities: { activity_id: string; title: string; type: string; status: string; progress: number }[];
};

export async function getCitizenDashboard(): Promise<CitizenDashboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_citizen_dashboard");
  if (error || !data) return null;
  return data as CitizenDashboard;
}
