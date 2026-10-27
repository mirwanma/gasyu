import "server-only";
import { createClient } from "@/lib/supabase/server";

export type CommunityCard = {
  id: string;
  name: string;
  slug: string;
  logoUrl: string | null;
  category: string;
  joinPolicy: "open" | "approval";
  districtName: string | null;
  membershipStatus: "active" | "pending" | null;
};

type Row = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  district: { name: string } | { name: string }[] | null;
  profile: { interest_category: string; join_policy: "open" | "approval" } | { interest_category: string; join_policy: "open" | "approval" }[] | null;
};

function toCard(row: Row, status: CommunityCard["membershipStatus"]): CommunityCard {
  const profile = Array.isArray(row.profile) ? row.profile[0] : row.profile;
  const district = Array.isArray(row.district) ? row.district[0] : row.district;
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    logoUrl: row.logo_url,
    category: profile?.interest_category ?? "other",
    joinPolicy: profile?.join_policy ?? "approval",
    districtName: district?.name ?? null,
    membershipStatus: status,
  };
}

// Komunitas terverifikasi beserta status keanggotaan pengguna (untuk /komunitas-saya).
export async function listCommunities(userId: string): Promise<CommunityCard[]> {
  const supabase = await createClient();
  const [{ data: orgs }, { data: memberships }] = await Promise.all([
    supabase
      .from("organizers")
      .select("id, name, slug, logo_url, district:regions(name), profile:community_profiles(interest_category, join_policy)")
      .eq("type", "community")
      .eq("status", "approved")
      .order("name"),
    supabase.from("community_memberships").select("community_id, status").eq("user_id", userId).in("status", ["active", "pending"]),
  ]);
  const mine = new Map((memberships ?? []).map((m) => [m.community_id as string, m.status as "active" | "pending"]));
  return ((orgs ?? []) as unknown as Row[]).map((row) => toCard(row, mine.get(row.id) ?? null));
}

// Id komunitas tempat pengguna menjadi member aktif (untuk rekomendasi beranda).
export async function listMyCommunityIds(userId: string): Promise<string[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("community_memberships").select("community_id").eq("user_id", userId).eq("status", "active");
  return (data ?? []).map((row) => row.community_id as string);
}
