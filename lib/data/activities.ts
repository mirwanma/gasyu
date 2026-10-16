import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityStatus, ActivityType, Audience, JoinMode, PaymentStatus, ParticipationStatus, ResidencyRule } from "@/lib/activities";

export type ActivityCard = {
  id: string;
  host_organizer_id: string;
  type: ActivityType;
  goal: string;
  title: string;
  description: string | null;
  cover_url: string | null;
  scope_region_id: string | null;
  starts_at: string;
  ends_at: string;
  quota: number | null;
  difficulty: string | null;
  xp_base: number;
  points_per_completion: number;
  join_mode: JoinMode;
  residency_rule: ResidencyRule;
  audience: Audience;
  is_paid: boolean;
  price_idr: number | null;
  status: ActivityStatus;
  published_at: string | null;
  host_name: string;
  host_type: "merchant" | "community" | "platform";
  host_slug: string;
  host_logo_url: string | null;
  scope_region_name: string | null;
  scope_region_level: string | null;
  seats_taken: number;
  partner_count: number;
};

export type Checkpoint = {
  id: string;
  partner_organizer_id: string;
  outlet_id: string | null;
  name: string;
  address: string | null;
  lat: number;
  lng: number;
  radius_m: number;
  is_active: boolean;
};

export type Participation = {
  id: string;
  activity_id: string;
  status: ParticipationStatus;
  payment_status: PaymentStatus;
  payment_due_at: string | null;
  progress: number;
};

export async function getActivityCard(id: string): Promise<ActivityCard | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_activity_cards").select("*").eq("id", id).maybeSingle();
  return (data as ActivityCard | null) ?? null;
}

// Daftar aktivitas publik untuk Jelajah, terbaru dulu.
export async function listPublicActivities(opts: { filter?: string; q?: string } = {}): Promise<ActivityCard[]> {
  const supabase = await createClient();
  let query = supabase
    .from("v_activity_cards")
    .select("*")
    .in("status", ["published", "running"])
    .order("starts_at", { ascending: true })
    .limit(50);
  if (opts.filter === "event" || opts.filter === "challenge") query = query.eq("type", opts.filter);
  if (opts.filter === "gratis") query = query.eq("is_paid", false);
  if (opts.filter === "berbayar") query = query.eq("is_paid", true);
  if (opts.filter === "member") query = query.eq("audience", "members_only");
  if (opts.q) query = query.or(`title.ilike.%${opts.q.replace(/[%,]/g, "")}%,host_name.ilike.%${opts.q.replace(/[%,]/g, "")}%`);
  const { data } = await query;
  return (data ?? []) as ActivityCard[];
}

// Aktivitas milik satu penyelenggara (semua status), terbaru dulu.
export async function listOrganizerActivities(organizerId: string): Promise<ActivityCard[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_activity_cards")
    .select("*")
    .eq("host_organizer_id", organizerId)
    .order("starts_at", { ascending: false })
    .limit(100);
  return (data ?? []) as ActivityCard[];
}

export async function getCheckpoints(activityId: string): Promise<Checkpoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_checkpoints")
    .select("id, partner_organizer_id, outlet_id, name, address, lat, lng, radius_m, is_active")
    .eq("activity_id", activityId)
    .order("created_at");
  return (data ?? []) as Checkpoint[];
}

export async function getMyParticipation(activityId: string, userId: string): Promise<Participation | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("participations")
    .select("id, activity_id, status, payment_status, payment_due_at, progress")
    .eq("activity_id", activityId)
    .eq("user_id", userId)
    .maybeSingle();
  return (data as Participation | null) ?? null;
}

// Aktivitas yang diikuti warga (belum dibatalkan), untuk beranda.
export async function listMyActivities(userId: string) {
  const supabase = await createClient();
  const { data: parts } = await supabase
    .from("participations")
    .select("id, activity_id, status, payment_status, progress")
    .eq("user_id", userId)
    .in("status", ["invited", "registered", "in_progress", "completed"]);
  const ids = (parts ?? []).map((p) => p.activity_id);
  if (ids.length === 0) return [];
  const { data: cards } = await supabase.from("v_activity_cards").select("*").in("id", ids).order("starts_at");
  const byId = new Map((parts ?? []).map((p) => [p.activity_id, p as Participation]));
  return ((cards ?? []) as ActivityCard[]).map((card) => ({ card, participation: byId.get(card.id)! }));
}

export async function getPartners(activityId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_partners")
    .select("id, role, status, points_budget, organizer:organizers(id, name, type, slug, logo_url)")
    .eq("activity_id", activityId)
    .eq("status", "accepted");
  return (data ?? []).map((row) => {
    const org = row.organizer as unknown as { id: string; name: string; type: "merchant" | "community" | "platform"; slug: string; logo_url: string | null };
    return { id: row.id as string, role: row.role as "host" | "cohost" | "sponsor", pointsBudget: row.points_budget as number, organizer: org };
  });
}
