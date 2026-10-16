import "server-only";
import { createClient } from "@/lib/supabase/server";

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

export type VillageRow = { village_id: string; name: string; active_citizens: number; avg_xp: number };

// Kelurahan teraktif bulan ini: warga aktif dan rata-rata XP per warga aktif.
export async function listActiveVillages(limit = 5): Promise<VillageRow[]> {
  const supabase = await createClient();
  const monthStart = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()).slice(0, 7) + "-01";
  const [{ data: active }, { data: xp }, { data: regions }] = await Promise.all([
    supabase.from("v_village_active_month").select("village_id, active_citizens"),
    supabase.from("xp_ledger").select("village_id, amount").gte("local_date", monthStart).not("village_id", "is", null),
    supabase.from("regions").select("id, name").eq("level", "village"),
  ]);
  const names = new Map((regions ?? []).map((r) => [r.id as string, r.name as string]));
  const xpByVillage = new Map<string, number>();
  for (const row of xp ?? []) xpByVillage.set(row.village_id as string, (xpByVillage.get(row.village_id as string) ?? 0) + (row.amount as number));
  return (active ?? [])
    .map((row) => ({
      village_id: row.village_id as string,
      name: names.get(row.village_id as string) ?? "?",
      active_citizens: row.active_citizens as number,
      avg_xp: Math.round((xpByVillage.get(row.village_id as string) ?? 0) / Math.max(row.active_citizens as number, 1)),
    }))
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
  village_name: string | null;
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
  kind: "impossible_travel" | "shared_device" | "burst_accounts" | "manual";
  detail: Record<string, unknown>;
  status: "open" | "dismissed" | "actioned";
  created_at: string;
  reviewed_at: string | null;
  nickname: string;
  suspended_at: string | null;
  village_name: string | null;
  activity_title: string | null;
  checkpoint_name: string | null;
  partner_name: string | null;
};

export async function listModerationFlags(mode: "open" | "history"): Promise<ModerationFlag[]> {
  const supabase = await createClient();
  let query = supabase.from("v_moderation_flags").select("*").limit(100);
  query = mode === "open" ? query.eq("status", "open").order("created_at", { ascending: false }) : query.neq("status", "open").order("reviewed_at", { ascending: false });
  const { data } = await query;
  return (data ?? []) as ModerationFlag[];
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
  village_name: string | null;
  total_xp: number;
  checkins: number;
  open_flags: number;
  last_checkin_at: string | null;
};

export async function listAdminUsers(opts: { q?: string; suspended?: boolean } = {}): Promise<AdminUser[]> {
  const supabase = await createClient();
  let query = supabase.from("v_admin_users").select("*").is("deleted_at", null).limit(50);
  if (opts.q) query = query.or(`nickname.ilike.%${opts.q}%,full_name.ilike.%${opts.q}%`);
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
  rank_city: number | null;
  rank_village: number | null;
  village_active_citizens: number | null;
  village_rank: number | null;
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
