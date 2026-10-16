import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  nickname: string;
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  homeVillageId: string | null;
  villageName: string | null;
};

// Profil pengguna yang sedang login. Proxy sudah memastikan sesi dan onboarding,
// jadi di sini cukup membaca.
export async function getCurrentUser(): Promise<CurrentUser | null> {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (!userId) return null;

  const { data } = await supabase
    .from("profiles")
    .select("id, nickname, full_name, avatar_url, is_admin, home_village_id, home_village:regions(name)")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;

  const village = data.home_village as { name: string } | { name: string }[] | null;
  return {
    id: data.id,
    nickname: data.nickname ?? "",
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    isAdmin: Boolean(data.is_admin),
    homeVillageId: data.home_village_id,
    villageName: (Array.isArray(village) ? village[0]?.name : village?.name) ?? null,
  };
}

export async function getUnreadCount(userId: string) {
  const supabase = await createClient();
  const { count } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .is("read_at", null);
  return count ?? 0;
}
