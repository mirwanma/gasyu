import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { SuggestionCategory, SuggestionStatus } from "@/lib/suggestions";

export type MySuggestion = {
  id: string;
  category: SuggestionCategory;
  body: string;
  is_anonymous: boolean;
  status: SuggestionStatus;
  reply: string | null;
  replied_at: string | null;
  created_at: string;
  organizer: { name: string; slug: string; type: "merchant" | "community"; logo_url: string | null } | null;
};

export type TeamSuggestion = {
  id: string;
  category: SuggestionCategory;
  body: string;
  is_anonymous: boolean;
  status: SuggestionStatus;
  reply: string | null;
  replied_at: string | null;
  replied_by_nickname: string | null;
  nickname: string | null;
  village_name: string | null;
  created_at: string;
};

// Saran yang dikirim warga ini (tabel mentah, RLS: hanya miliknya).
export async function listMySuggestions(userId: string): Promise<MySuggestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("suggestions")
    .select("id, category, body, is_anonymous, status, reply, replied_at, created_at, organizer:organizers(name, slug, type, logo_url)")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(100);
  return ((data ?? []) as unknown as (Omit<MySuggestion, "organizer"> & { organizer: MySuggestion["organizer"] | MySuggestion["organizer"][] })[]).map((row) => ({
    ...row,
    organizer: Array.isArray(row.organizer) ? (row.organizer[0] ?? null) : row.organizer,
  }));
}

// Saran untuk satu penyelenggara, lewat view tim (identitas anonim disembunyikan).
export async function listOrganizerSuggestions(organizerId: string): Promise<TeamSuggestion[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("v_organizer_suggestions")
    .select("id, category, body, is_anonymous, status, reply, replied_at, replied_by_nickname, nickname, village_name, created_at")
    .eq("organizer_id", organizerId)
    .order("created_at", { ascending: false })
    .limit(300);
  return (data ?? []) as TeamSuggestion[];
}

// Jumlah saran berstatus baru, untuk menu dan dashboard.
export async function countNewSuggestions(organizerId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("v_organizer_suggestions")
    .select("id", { count: "exact", head: true })
    .eq("organizer_id", organizerId)
    .eq("status", "new");
  return count ?? 0;
}
