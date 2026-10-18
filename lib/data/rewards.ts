import "server-only";
import { createClient } from "@/lib/supabase/server";

export type Reward = {
  id: string;
  organizer_id: string;
  title: string;
  description: string | null;
  image_url: string | null;
  price_points: number;
  stock: number;
  valid_days: number;
  available_until: string | null;
  status: "active" | "inactive";
  organizer: { name: string; slug: string; logo_url: string | null };
  // null = berlaku di semua outlet; jika diisi, nama outlet tempat voucher berlaku (ALUR bagian 16).
  valid_outlet_ids: string[] | null;
  outlet_names: string[] | null;
};

const REWARD_SELECT = "id, organizer_id, title, description, image_url, price_points, stock, valid_days, available_until, status, valid_outlet_ids, organizer:organizers(name, slug, logo_url)";
const normalize = (row: Record<string, unknown>): Reward => ({ ...(row as Reward), organizer: (Array.isArray(row.organizer) ? row.organizer[0] : row.organizer) as Reward["organizer"], outlet_names: null });

// Nama outlet untuk daftar id (outlet merchant terverifikasi terbaca semua pengguna masuk).
async function outletNames(ids: string[]): Promise<Map<string, string>> {
  if (ids.length === 0) return new Map();
  const supabase = await createClient();
  const { data } = await supabase.from("merchant_outlets").select("id, name").in("id", ids);
  return new Map((data ?? []).map((o) => [o.id as string, o.name as string]));
}

async function withOutletNames<T extends { valid_outlet_ids: string[] | null; outlet_names: string[] | null }>(items: T[]): Promise<T[]> {
  const names = await outletNames([...new Set(items.flatMap((r) => r.valid_outlet_ids ?? []))]);
  return items.map((r) => ({ ...r, outlet_names: r.valid_outlet_ids ? r.valid_outlet_ids.map((id) => names.get(id)).filter((n): n is string => !!n) : null }));
}

// Reward aktif dari merchant terverifikasi, untuk Dompet.
export async function listActiveRewards(): Promise<Reward[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("rewards").select(REWARD_SELECT).eq("status", "active").gt("stock", 0).order("price_points");
  return withOutletNames((data ?? []).map(normalize).filter((r) => !r.available_until || new Date(r.available_until) > new Date()));
}

export async function listMerchantRewards(organizerId: string): Promise<Reward[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("rewards").select(REWARD_SELECT).eq("organizer_id", organizerId).order("status").order("created_at", { ascending: false });
  return withOutletNames((data ?? []).map(normalize));
}

export type Wallet = { balance: number; next_expiry_at: string | null; expiring_30d: number };

export async function getWallet(): Promise<Wallet> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_user_points_balance").select("balance, next_expiry_at, expiring_30d").maybeSingle();
  return (data as Wallet | null) ?? { balance: 0, next_expiry_at: null, expiring_30d: 0 };
}

export type Voucher = {
  id: string;
  code: string;
  status: "active" | "used" | "expired" | "refunded";
  expires_at: string;
  used_at: string | null;
  price_points: number;
  reward: { title: string; organizer: { name: string } };
  valid_outlet_ids: string[] | null;
  outlet_names: string[] | null;
};

export async function listMyVouchers(userId: string): Promise<Voucher[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("redemptions")
    .select("id, code, status, expires_at, used_at, price_points, reward:rewards(title, valid_outlet_ids, organizer:organizers(name))")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  const vouchers = (data ?? []).map((row): Voucher => {
    const reward = (Array.isArray(row.reward) ? row.reward[0] : row.reward) as { title: string; valid_outlet_ids: string[] | null; organizer: { name: string } | { name: string }[] } | null;
    const org = reward ? (Array.isArray(reward.organizer) ? reward.organizer[0] : reward.organizer) : null;
    return {
      ...(row as Omit<Voucher, "reward" | "valid_outlet_ids" | "outlet_names">),
      reward: { title: reward?.title ?? "", organizer: { name: org?.name ?? "" } },
      valid_outlet_ids: reward?.valid_outlet_ids ?? null,
      outlet_names: null,
    };
  });
  return withOutletNames(vouchers);
}

export type RedemptionRow = { id: string; reward_id: string; title: string; code: string; status: string; nickname: string; used_at: string | null; created_at: string; outlet_name: string | null; expires_at: string };

// Voucher untuk reward merchant (semua status), terbaru dulu.
export async function listMerchantRedemptions(organizerId: string, opts: { usedToday?: boolean } = {}): Promise<RedemptionRow[]> {
  const supabase = await createClient();
  let q = supabase.from("v_reward_redemptions").select("id, reward_id, title, code, status, nickname, used_at, created_at, outlet_name, expires_at").eq("organizer_id", organizerId);
  if (opts.usedToday) {
    const start = new Date(new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date()) + "T00:00:00+07:00").toISOString();
    q = q.eq("status", "used").gte("used_at", start).order("used_at", { ascending: false });
  } else {
    q = q.order("created_at", { ascending: false }).limit(100);
  }
  const { data } = await q;
  return (data ?? []) as RedemptionRow[];
}

export type ActivityBudget = { activity_id: string; organizer_id: string; budget: number; used: number; remaining: number };

export async function getActivityBudget(activityId: string, organizerId: string): Promise<ActivityBudget | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_activity_budget").select("*").eq("activity_id", activityId).eq("organizer_id", organizerId).maybeSingle();
  return (data as ActivityBudget | null) ?? null;
}

// Ringkasan poin merchant untuk dashboard.
export async function getMerchantPointsSummary(organizerId: string) {
  const supabase = await createClient();
  const [{ data: budgets }, { count: redeemed }, { count: used }] = await Promise.all([
    supabase.from("v_activity_budget").select("budget, used, remaining").eq("organizer_id", organizerId),
    supabase.from("v_reward_redemptions").select("id", { count: "exact", head: true }).eq("organizer_id", organizerId),
    supabase.from("v_reward_redemptions").select("id", { count: "exact", head: true }).eq("organizer_id", organizerId).eq("status", "used"),
  ]);
  const rows = (budgets ?? []) as { budget: number; used: number; remaining: number }[];
  return {
    budget: rows.reduce((s, r) => s + r.budget, 0),
    used: rows.reduce((s, r) => s + r.used, 0),
    remaining: rows.reduce((s, r) => s + r.remaining, 0),
    redeemed: redeemed ?? 0,
    vouchersUsed: used ?? 0,
  };
}
