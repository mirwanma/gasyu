"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadOrganizerFile } from "@/lib/storage";

export type ActionState = { error?: string; success?: string; inviteUrl?: string };

const basePath = (type: string, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;

// ---- Tim ----------------------------------------------------------------

export async function createInvite(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type"));
  const role = type === "merchant" ? "staff" : "officer";
  const origin = String(formData.get("origin") ?? "");

  const supabase = await createClient();
  const { data: token, error } = await supabase.rpc("create_organizer_invite", { p_organizer_id: organizerId, p_role: role });
  if (error || !token) {
    return { error: error?.message === "not_allowed" ? "Hanya pemilik atau ketua yang bisa mengundang." : "Undangan belum dibuat. Coba lagi." };
  }
  revalidatePath(`${basePath(type, organizerId)}/tim`);
  return { inviteUrl: `${origin}/undangan/${token}` };
}

export async function removeTeamMember(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type"));
  const userId = String(formData.get("user_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_team_member", { p_organizer_id: organizerId, p_user_id: userId });
  const path = `${basePath(type, organizerId)}/tim`;
  revalidatePath(path);
  if (error) {
    const code = error.message === "last_leader_cannot_be_removed" ? "terakhir" : "gagal";
    redirect(`${path}?error=${code}`);
  }
  // Keluar sendiri dari tim: kembali ke profil.
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === userId) redirect("/profil");
}

// Pemilik/ketua mengubah peran anggota tim (menyerahkan atau turun peran).
export async function setTeamRole(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type"));
  const userId = String(formData.get("user_id"));
  const rawRole = String(formData.get("role"));
  const role = (["owner", "staff", "chair", "officer"] as const).find((r) => r === rawRole) ?? "staff";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_team_role", { p_organizer_id: organizerId, p_user_id: userId, p_role: role });
  const path = `${basePath(type, organizerId)}/tim`;
  revalidatePath(path);
  if (error) redirect(`${path}?error=${error.message.includes("last_leader") ? "terakhir" : "gagal"}`);
  // Turun sendiri jadi staf/pengurus: halaman Tim tidak lagi bisa dibuka.
  const { data: claims } = await supabase.auth.getClaims();
  if (claims?.claims?.sub === userId && (role === "staff" || role === "officer")) redirect(`${basePath(type, organizerId)}/lainnya`);
  redirect(`${path}?hasil=peran`);
}

// ---- Profil penyelenggara ---------------------------------------------

export async function updateOrganizerProfile(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type"));
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const supabase = await createClient();

  const { error: orgError } = await supabase
    .from("organizers")
    .update({ name: text("name"), description: text("description") || null })
    .eq("id", organizerId);
  if (orgError) return { error: "Nama harus 2–80 karakter." };

  const whatsapp = text("whatsapp").replace(/[^0-9]/g, "").replace(/^62/, "0");
  if (type === "merchant") {
    const { error } = await supabase
      .from("merchant_profiles")
      .update({ whatsapp, merchant_category: text("category"), nib: text("nib") || null })
      .eq("organizer_id", organizerId);
    if (error) return { error: "Nomor WhatsApp atau kategori belum benar." };
  } else {
    const social: Record<string, string> = {};
    if (text("instagram")) social.instagram = text("instagram").replace(/^@/, "");
    if (text("tiktok")) social.tiktok = text("tiktok").replace(/^@/, "");
    const { error } = await supabase
      .from("community_profiles")
      .update({
        whatsapp,
        interest_category: text("category"),
        social_links: social,
        est_members: text("est_members") ? Number(text("est_members")) : null,
        basecamp_address: text("basecamp_address") || null,
        activity_area_district_id: text("area_district") || null,
      })
      .eq("organizer_id", organizerId);
    if (error) return { error: "Nomor WhatsApp atau kategori belum benar." };
    if (text("area_district")) await supabase.from("organizers").update({ district_id: text("area_district") }).eq("id", organizerId);
  }

  const logo = formData.get("logo");
  if (logo instanceof File && logo.size > 0) {
    if (logo.size > 2 * 1024 * 1024) return { error: "Logo terlalu besar, maksimal 2 MB." };
    const url = await uploadOrganizerFile(supabase, "logos", organizerId, "logo", logo);
    if (!url) return { error: "Logo belum terunggah. Pakai PNG, JPG, atau WebP." };
    await supabase.from("organizers").update({ logo_url: url }).eq("id", organizerId);
  }

  const proof = formData.get("proof");
  if (proof instanceof File && proof.size > 0) {
    if (proof.size > 3 * 1024 * 1024) return { error: "Foto bukti terlalu besar, maksimal 3 MB." };
    const path = await uploadOrganizerFile(supabase, "organizer-proofs", organizerId, "bukti", proof);
    if (!path) return { error: "Foto bukti belum terunggah." };
    const table = type === "merchant" ? "merchant_profiles" : "community_profiles";
    await supabase.from(table).update({ proof_url: path }).eq("organizer_id", organizerId);
  }

  revalidatePath(basePath(type, organizerId), "layout");
  return { success: "Profil tersimpan." };
}

export async function resubmitOrganizer(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type"));
  const supabase = await createClient();
  await supabase.rpc("resubmit_organizer", { p_organizer_id: organizerId });
  revalidatePath(basePath(type, organizerId), "layout");
}

// ---- Outlet merchant --------------------------------------------------

export async function addOutlet(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const days = text("days").split(",").filter(Boolean);
  const openingHours = Object.fromEntries(days.map((day) => [day, [text("open_time") || "08:00", text("close_time") || "21:00"]]));
  if (!text("outlet_district")) return { error: "Pilih kota dan kecamatan outlet." };

  const supabase = await createClient();
  const { error } = await supabase.from("merchant_outlets").insert({
    organizer_id: organizerId,
    name: text("outlet_name") || "Outlet",
    address: text("outlet_address"),
    district_id: text("outlet_district"),
    lat: Number(text("outlet_lat")),
    lng: Number(text("outlet_lng")),
    opening_hours: openingHours,
  });
  if (error) return { error: "Alamat atau titik lokasi belum lengkap." };
  revalidatePath(`/merchant/${organizerId}/outlet`);
  return { success: "Outlet ditambahkan." };
}

export async function toggleOutlet(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const outletId = String(formData.get("outlet_id"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  await supabase.from("merchant_outlets").update({ is_active: active }).eq("id", outletId);
  revalidatePath(`/merchant/${organizerId}/outlet`);
}

// ---- Member komunitas -------------------------------------------------

export async function setJoinPolicy(formData: FormData) {
  const communityId = String(formData.get("community_id"));
  const policy = formData.get("policy") === "open" ? "open" : "approval";
  const supabase = await createClient();
  await supabase.rpc("set_join_policy", { p_community_id: communityId, p_policy: policy });
  revalidatePath(`/komunitas/${communityId}/member`);
}

export async function decideMembership(formData: FormData) {
  const communityId = String(formData.get("community_id"));
  const membershipId = String(formData.get("membership_id"));
  const accept = formData.get("decision") === "accept";
  const supabase = await createClient();
  await supabase.rpc("decide_membership", { p_membership_id: membershipId, p_accept: accept });
  revalidatePath(`/komunitas/${communityId}/member`);
  revalidatePath(`/komunitas/${communityId}`);
}

export async function removeMember(formData: FormData) {
  const communityId = String(formData.get("community_id"));
  const membershipId = String(formData.get("membership_id"));
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_member", { p_membership_id: membershipId, p_reason: reason || null });
  revalidatePath(`/komunitas/${communityId}/member`);
  if (error) redirect(`/komunitas/${communityId}/member?tab=aktif&error=${error.message === "cannot_remove_team" ? "tim" : "gagal"}`);
}
