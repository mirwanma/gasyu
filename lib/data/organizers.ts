import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MemberRole, MyOrganizer, OrganizerStatus, OrganizerType } from "@/lib/organizers";

export * from "@/lib/organizers";

// Merchant dan komunitas tempat pengguna tercatat sebagai tim.
export async function getMyOrganizers(userId: string): Promise<MyOrganizer[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizer_members")
    .select("role, organizer:organizers(id, type, name, slug, logo_url, status)")
    .eq("user_id", userId);

  return (data ?? [])
    .map((row) => {
      const org = row.organizer as unknown as {
        id: string;
        type: OrganizerType;
        name: string;
        slug: string;
        logo_url: string | null;
        status: OrganizerStatus;
      } | null;
      if (!org) return null;
      return {
        id: org.id,
        type: org.type,
        name: org.name,
        slug: org.slug,
        logoUrl: org.logo_url,
        status: org.status,
        role: row.role as MemberRole,
      };
    })
    .filter((row): row is MyOrganizer => row !== null)
    .sort((a, b) => a.name.localeCompare(b.name, "id"));
}

// Organizer tertentu beserta peran pengguna. null jika tidak ada atau bukan tim.
export async function getOrganizerForTeam(organizerId: string, userId: string, type: OrganizerType) {
  const mine = await getMyOrganizers(userId);
  return mine.find((org) => org.id === organizerId && org.type === type) ?? null;
}

// Daftar kelurahan aktif dikelompokkan per kecamatan (untuk formulir).
export async function getVillageOptions() {
  const supabase = await createClient();
  const { data: regions } = await supabase
    .from("regions")
    .select("id, name, level, parent_id")
    .eq("is_active", true)
    .in("level", ["district", "village"])
    .order("name");

  return (regions ?? [])
    .filter((region) => region.level === "district")
    .map((district) => ({
      id: district.id as string,
      name: district.name as string,
      villages: (regions ?? [])
        .filter((region) => region.parent_id === district.id)
        .map((village) => ({ id: village.id as string, name: village.name as string })),
    }));
}
