import "server-only";
import { createClient } from "@/lib/supabase/server";

// Leaderboard dan badge (irisan 9). Peringkat dihitung fungsi database `get_leaderboard`
// yang hanya mengembalikan nickname warga lain.

// Peringkat per kota dan kecamatan; kota yang belum dibuka mengembalikan city_active = false.
export type LeaderRow = { rank: number; nickname: string; xp: number; district: string | null; is_me: boolean };
export type DistrictRow = { rank: number | null; district_id: string; name: string; avg_xp: number; active_citizens: number; xp_total: number; is_mine: boolean; qualifies: boolean };

export type UserLeaderboard = {
  scope: "district" | "city";
  month: string;
  rows: LeaderRow[];
  me: { rank: number; nickname: string; xp: number } | null;
  total: number;
  district_id: string | null;
  district_name: string | null;
  city_id: string | null;
  city_name: string | null;
  city_active: boolean;
};

export type DistrictLeaderboard = {
  scope: "districts";
  month: string;
  rows: DistrictRow[];
  min_active_citizens: number;
  my_district_id: string | null;
  city_id: string | null;
  city_name: string | null;
  city_active: boolean;
};

export async function getUserLeaderboard(scope: "district" | "city", month?: string): Promise<UserLeaderboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_scope: scope, p_region_id: null, p_month: month ?? null });
  if (error || !data) return null;
  return data as UserLeaderboard;
}

export async function getDistrictLeaderboard(month?: string): Promise<DistrictLeaderboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_leaderboard", { p_scope: "districts", p_region_id: null, p_month: month ?? null });
  if (error || !data) return null;
  return data as DistrictLeaderboard;
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

export type MonthlyWinner = { month: string; rank: number; avg_xp: number; active_citizens: number; district: { name: string } | null };

// Juara kecamatan bulanan di satu kota.
export async function listMonthlyWinners(cityId: string, limit = 3): Promise<MonthlyWinner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("monthly_district_winners")
    .select("month, rank, avg_xp, active_citizens, district:regions!monthly_district_winners_district_id_fkey(name)")
    .eq("city_id", cityId)
    .order("month", { ascending: false })
    .order("rank")
    .limit(limit);
  return (data ?? []).map((row) => ({ ...row, district: (Array.isArray(row.district) ? row.district[0] : row.district) as { name: string } | null })) as MonthlyWinner[];
}
