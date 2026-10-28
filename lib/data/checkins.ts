import "server-only";
import { createClient } from "@/lib/supabase/server";

export type QrCheckpoint = {
  id: string;
  name: string;
  radius_m: number;
  is_active: boolean;
  activity: { id: string; title: string; status: string; starts_at: string; ends_at: string };
};

// Checkpoint milik penyelenggara di aktivitas yang terbit atau berjalan (untuk halaman QR).
export async function listQrCheckpoints(organizerId: string): Promise<QrCheckpoint[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("activity_checkpoints")
    .select("id, name, radius_m, is_active, activity:activities!inner(id, title, status, starts_at, ends_at)")
    .eq("partner_organizer_id", organizerId)
    .eq("is_active", true)
    .in("activity.status", ["published", "running"])
    .order("name");
  return (data ?? [])
    .map((row) => ({ ...row, activity: (Array.isArray(row.activity) ? row.activity[0] : row.activity) as QrCheckpoint["activity"] }))
    .filter((row) => row.activity)
    .sort((a, b) => a.activity.starts_at.localeCompare(b.activity.starts_at)) as QrCheckpoint[];
}

export type CheckinFeedRow = { id: string; nickname: string; district_name: string | null; checked_in_at: string; distance_m: number | null; review_status: string };

// Check-in hari ini (WIB) di satu checkpoint, terbaru dulu.
export async function listTodayCheckins(checkpointId: string): Promise<CheckinFeedRow[]> {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const { data } = await supabase
    .from("v_checkpoint_checkins")
    .select("id, nickname, district_name, checked_in_at, distance_m, review_status")
    .eq("checkpoint_id", checkpointId)
    .eq("local_date", today)
    .order("checked_in_at", { ascending: false })
    .limit(50);
  return (data ?? []) as CheckinFeedRow[];
}

// Jumlah check-in hari ini di semua checkpoint milik penyelenggara (dashboard).
export async function countTodayCheckins(organizerId: string) {
  const supabase = await createClient();
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date());
  const { count } = await supabase
    .from("checkins")
    .select("id", { count: "exact", head: true })
    .eq("partner_organizer_id", organizerId)
    .eq("local_date", today);
  return count ?? 0;
}
