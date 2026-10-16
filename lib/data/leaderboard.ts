import "server-only";
import { createClient } from "@/lib/supabase/server";

// Leaderboard dan badge (irisan 9). Peringkat dihitung fungsi database `get_leaderboard`
// yang hanya mengembalikan nickname warga lain.

export type LeaderRow = { rank: number; nickname: string; xp: number; village: string | null; is_me: boolean };
export type VillageRow = { rank: number | null; village_id: string; name: string; district: string | null; avg_xp: number; active_citizens: number; xp_total: number; is_mine: boolean; qualifies: boolean };

export type UserLeaderboard = {
  scope: "village" | "city";
  month: string;
  rows: LeaderRow[];
  me: { rank: number; nickname: string; xp: number } | null;
  total: number;
  village_id: string | null;
  village_name: string | null;
};

export type VillageLeaderboard = {
  scope: "villages";
  month: string;
  rows: VillageRow[];
  min_active_citizens: number;
  my_village_id: string | null;
};

export async function getUserLeaderboard(scope: "village" | "city", month?: string): Promise<UserLeaderboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_scope: scope, p_region_id: null, p_month: month ?? null });
  if (error || !data) return null;
  return data as UserLeaderboard;
}

export async function getVillageLeaderboard(month?: string): Promise<VillageLeaderboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_scope: "villages", p_region_id: null, p_month: month ?? null });
  if (error || !data) return null;
  return data as VillageLeaderboard;
}

export type Badge = { id: string; code: string; name: string; description: string; sort_order: number };
export type UserBadge = { badge_id: string; awarded_at: string };

export async function listBadges(): Promise<Badge[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("badges").select("id, code, name, description, sort_order").order("sort_order");
  return (data ?? []) as Badge[];
}

export async function listUserBadges(userId: string): Promise<UserBadge[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("user_badges").select("badge_id, awarded_at").eq("user_id", userId);
  return (data ?? []) as UserBadge[];
}

export type MonthlyWinner = { month: string; rank: number; avg_xp: number; active_citizens: number; village: { name: string } | null };

export async function listMonthlyWinners(limit = 3): Promise<MonthlyWinner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_village_winners")
    .select("month, rank, avg_xp, active_citizens, village:regions(name)")
    .order("month", { ascending: false })
    .order("rank")
    .limit(limit);
  return (data ?? []).map((row) => ({ ...row, village: (Array.isArray(row.village) ? row.village[0] : row.village) as { name: string } | null })) as MonthlyWinner[];
}
