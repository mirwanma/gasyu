import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { LeaderboardStatus, PrizeFulfillment, PrizeKind, WinnerStatus } from "@/lib/global-events";

export type Prize = {
  id: string;
  activity_id: string;
  rank_from: number;
  rank_to: number;
  title: string;
  description: string | null;
  image_url: string | null;
  kind: PrizeKind;
  fulfillment: PrizeFulfillment;
  badge_id: string | null;
  sponsor_organizer_id: string | null;
  pickup_note: string | null;
  min_score: number;
  sponsor_name: string | null;
  badge_name: string | null;
};

export async function listPrizes(activityId: string): Promise<Prize[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_prizes")
    .select("id, activity_id, rank_from, rank_to, title, description, image_url, kind, fulfillment, badge_id, sponsor_organizer_id, pickup_note, min_score, sponsor:organizers(name), badge:badges(name)")
    .eq("activity_id", activityId)
    .order("rank_from");
  return (data ?? []).map((p) => {
    const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
    const { sponsor, badge, ...rest } = p;
    return { ...(rest as Omit<Prize, "sponsor_name" | "badge_name">), sponsor_name: one(sponsor)?.name ?? null, badge_name: one(badge)?.name ?? null };
  });
}

// Badge eksklusif hadiah yang sudah pernah dibuat admin (bisa dipakai ulang).
export async function listPrizeBadges() {
  const supabase = await createClient();
  const { data } = await supabase.from("badges").select("id, name").eq("rule->>type", "activity_prize").order("name");
  return (data ?? []) as { id: string; name: string }[];
}

export type Winner = {
  id: string;
  prize_id: string;
  user_id: string;
  rank: number;
  score: number;
  status: WinnerStatus;
  claim_deadline: string;
  claimed_at: string | null;
  delivered_at: string | null;
  forfeited_reason: string | null;
  note: string | null;
  nickname: string;
  prize_title: string;
  fulfillment: PrizeFulfillment;
  open_flags: number;
};

// Pemenang untuk admin. Kolom ship_* tidak dibaca di sini; alamat lewat get_winner_shipping.
export async function listWinners(activityId: string): Promise<Winner[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_winners")
    .select("id, prize_id, user_id, rank, score, status, claim_deadline, claimed_at, delivered_at, forfeited_reason, note, prize:activity_prizes(title, fulfillment), user:profiles!activity_winners_user_id_fkey(nickname)")
    .eq("activity_id", activityId)
    .order("rank");
  const rows = data ?? [];
  const userIds = rows.map((r) => r.user_id as string);
  const { data: flags } = userIds.length
    ? await supabase.from("fraud_flags").select("user_id").in("user_id", userIds).eq("status", "open")
    : { data: [] as { user_id: string }[] };
  const flagCount = new Map<string, number>();
  for (const f of flags ?? []) flagCount.set(f.user_id, (flagCount.get(f.user_id) ?? 0) + 1);
  return rows.map((r) => {
    const one = <T,>(v: T | T[] | null) => (Array.isArray(v) ? (v[0] ?? null) : v);
    const { prize, user, ...rest } = r;
    const pz = one(prize) as { title: string; fulfillment: PrizeFulfillment } | null;
    return {
      ...(rest as Omit<Winner, "nickname" | "prize_title" | "fulfillment" | "open_flags">),
      nickname: (one(user) as { nickname: string } | null)?.nickname ?? "?",
      prize_title: pz?.title ?? "?",
      fulfillment: pz?.fulfillment ?? "digital",
      open_flags: flagCount.get(r.user_id as string) ?? 0,
    };
  });
}

export type GlobalEventStats = {
  registrants: number;
  active_participants: number;
  cimahi_participants: number;
  outside_participants: number;
  cities: { name: string; province: string; count: number }[];
  villages: { name: string; count: number }[];
  missions_completed: number;
  avg_score: number | null;
  prizes_pending_claim: number;
  prizes_claimed: number;
  prizes_delivered: number;
  prizes_forfeited: number;
};

export async function getGlobalEventStats(activityId: string): Promise<GlobalEventStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_global_event_stats").select("*").eq("activity_id", activityId).maybeSingle();
  return (data as GlobalEventStats | null) ?? null;
}

export type Leaderboard = {
  status: LeaderboardStatus;
  rows: { rank: number; nickname: string; score: number; is_me: boolean; prize_title: string | null }[];
  me: { rank: number; score: number } | null;
  participants: number;
};

export async function getLeaderboard(activityId: string): Promise<Leaderboard | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_activity_leaderboard", { p_activity_id: activityId, p_limit: 100 });
  if (error || !data) return null;
  return data as unknown as Leaderboard;
}

// Jumlah hadiah yang sudah diklaim dan menunggu dikirim panitia (Ringkasan admin).
export async function countPrizesToDeliver() {
  const supabase = await createClient();
  const { count } = await supabase.from("activity_winners").select("id", { count: "exact", head: true }).eq("status", "claimed");
  return count ?? 0;
}
