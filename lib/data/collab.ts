import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { ActivityStatus } from "@/lib/activities";

export type PartnerRow = {
  id: string;
  activity_id: string;
  organizer_id: string;
  role: "host" | "cohost" | "sponsor";
  source: "creator" | "invite" | "open_call" | "admin";
  status: "invited" | "accepted" | "declined" | "removed";
  points_budget: number;
  contribution_note: string | null;
  responded_at: string | null;
  created_at: string;
  organizer_name: string;
  organizer_type: "merchant" | "community" | "platform";
  organizer_slug: string;
  organizer_logo_url: string | null;
  activity_title: string;
  activity_status: ActivityStatus;
  starts_at: string;
  ends_at: string;
  host_organizer_id: string;
  host_name: string;
  host_type: "merchant" | "community" | "platform";
};

// Semua partner satu aktivitas (termasuk yang diundang/ditolak), host dulu.
export async function listActivityPartners(activityId: string): Promise<PartnerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_activity_partners").select("*").eq("activity_id", activityId).order("created_at");
  return ((data ?? []) as PartnerRow[]).sort((a, b) => (a.role === "host" ? -1 : b.role === "host" ? 1 : 0));
}

// Keterlibatan satu penyelenggara sebagai partner (bukan host).
export async function listMyPartnerships(organizerId: string): Promise<PartnerRow[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_activity_partners")
    .select("*")
    .eq("organizer_id", organizerId)
    .neq("role", "host")
    .in("status", ["invited", "accepted"])
    .order("starts_at", { ascending: false });
  return (data ?? []) as PartnerRow[];
}

// Penyelenggara terverifikasi lain, untuk memilih partner.
export async function listApprovedOrganizers(excludeId?: string) {
  const supabase = await createClient();
  const { data } = await supabase.from("organizers").select("id, name, type, district:regions(name)").eq("status", "approved").neq("type", "platform").order("name");
  return (data ?? [])
    .filter((o) => o.id !== excludeId)
    .map((o) => ({ id: o.id as string, name: o.name as string, type: o.type as "merchant" | "community", district: ((Array.isArray(o.district) ? o.district[0] : o.district) as { name: string } | null)?.name ?? null }));
}

export type CollabPost = {
  id: string;
  organizer_id: string;
  activity_id: string | null;
  kind: "collab" | "sponsor";
  title: string;
  needs: string;
  benefits: string;
  category: string | null;
  region_id: string | null;
  deadline: string | null;
  status: "open" | "closed";
  created_at: string;
  organizer: { name: string; type: "merchant" | "community"; logo_url: string | null };
  region: { name: string } | null;
  activity: { title: string } | null;
};

const POST_SELECT = "id, organizer_id, activity_id, kind, title, needs, benefits, category, region_id, deadline, status, created_at, organizer:organizers(name, type, logo_url), region:regions(name), activity:activities(title)";
const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
const normalizePost = (row: Record<string, unknown>): CollabPost => ({
  ...(row as CollabPost),
  organizer: one(row.organizer as CollabPost["organizer"] | CollabPost["organizer"][] | null) as CollabPost["organizer"],
  region: one(row.region as { name: string } | { name: string }[] | null),
  activity: one(row.activity as { title: string } | { title: string }[] | null),
});

// Papan: open call terbuka milik penyelenggara lain.
export async function listOpenPosts(organizerId: string, filter: { kind?: string; regionId?: string } = {}): Promise<CollabPost[]> {
  const supabase = await createClient();
  let q = supabase.from("collab_posts").select(POST_SELECT).eq("status", "open").neq("organizer_id", organizerId).order("created_at", { ascending: false }).limit(50);
  if (filter.kind === "collab" || filter.kind === "sponsor") q = q.eq("kind", filter.kind);
  if (filter.regionId) q = q.eq("region_id", filter.regionId);
  const { data } = await q;
  return (data ?? []).map(normalizePost).filter((p) => !p.deadline || new Date(p.deadline) > new Date());
}

export type Application = {
  id: string;
  post_id: string;
  organizer_id: string;
  proposed_role: "cohost" | "sponsor";
  proposed_points_budget: number;
  contribution: string | null;
  message: string | null;
  status: "pending" | "accepted" | "rejected" | "withdrawn";
  created_at: string;
  organizer: { name: string; type: "merchant" | "community"; logo_url: string | null };
  post: { title: string; organizer_id: string; activity_id: string | null; organizer: { name: string } };
};

const APP_SELECT = "id, post_id, organizer_id, proposed_role, proposed_points_budget, contribution, message, status, created_at, organizer:organizers(name, type, logo_url), post:collab_posts(title, organizer_id, activity_id, organizer:organizers(name))";
const normalizeApp = (row: Record<string, unknown>): Application => {
  const post = one(row.post as Record<string, unknown> | Record<string, unknown>[] | null) ?? {};
  return {
    ...(row as Application),
    organizer: one(row.organizer as Application["organizer"] | Application["organizer"][] | null) as Application["organizer"],
    post: { ...(post as Application["post"]), organizer: one(post.organizer as { name: string } | { name: string }[] | null) ?? { name: "" } },
  };
};

// Open call milik penyelenggara beserta pengajuannya.
export async function listMyPosts(organizerId: string): Promise<{ posts: CollabPost[]; applications: Application[] }> {
  const supabase = await createClient();
  const { data: posts } = await supabase.from("collab_posts").select(POST_SELECT).eq("organizer_id", organizerId).order("created_at", { ascending: false });
  const ids = (posts ?? []).map((p) => p.id as string);
  const { data: apps } = ids.length ? await supabase.from("collab_applications").select(APP_SELECT).in("post_id", ids).order("created_at", { ascending: false }) : { data: [] };
  return { posts: (posts ?? []).map(normalizePost), applications: (apps ?? []).map((a) => normalizeApp(a as Record<string, unknown>)) };
}

// Pengajuan yang dikirim penyelenggara ini.
export async function listMyApplications(organizerId: string): Promise<Application[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("collab_applications").select(APP_SELECT).eq("organizer_id", organizerId).order("created_at", { ascending: false });
  return (data ?? []).map((a) => normalizeApp(a as Record<string, unknown>));
}
