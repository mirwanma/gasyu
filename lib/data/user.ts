import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  nickname: string;
  fullName: string | null;
  avatarUrl: string | null;
  isAdmin: boolean;
  homeDistrictId: string | null;
  // "Cimahi Tengah, Kota Cimahi"; null untuk akun lama yang belum mengisi kecamatan.
  regionLabel: string | null;
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
    .select("id, nickname, full_name, avatar_url, is_admin, home_district_id, district:regions(name, city:parent_id(name))")
    .eq("id", userId)
    .maybeSingle();
  if (!data) return null;

  const one = <T,>(v: T | T[] | null | undefined) => (Array.isArray(v) ? v[0] : v) ?? null;
  const district = one(data.district as { name: string; city: { name: string } | { name: string }[] | null } | { name: string; city: { name: string } | { name: string }[] | null }[] | null);
  const city = one(district?.city);
  return {
    id: data.id,
    nickname: data.nickname ?? "",
    fullName: data.full_name,
    avatarUrl: data.avatar_url,
    isAdmin: Boolean(data.is_admin),
    homeDistrictId: data.home_district_id,
    regionLabel: district ? [district.name, city?.name].filter(Boolean).join(", ") : null,
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
