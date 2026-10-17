"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadOrganizerFile } from "@/lib/storage";
import type { Json } from "@/lib/supabase/types";

export type RegisterState = { error?: string };

const ERRORS: Record<string, string> = {
  invalid_name: "Nama harus 2–80 karakter.",
  invalid_whatsapp: "Nomor WhatsApp belum benar. Tulis seperti 08xxxxxxxxxx.",
  invalid_category: "Pilih salah satu kategori.",
  invalid_village: "Kelurahan tidak ditemukan.",
  outlet_required: "Isi minimal satu outlet.",
  invalid_outlet: "Alamat atau titik lokasi outlet belum lengkap.",
  invalid_join_policy: "Pilih cara bergabung member.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};

const MAX_LOGO = 2 * 1024 * 1024;
const MAX_PROOF = 5 * 1024 * 1024;

export async function registerOrganizer(_prev: RegisterState, formData: FormData): Promise<RegisterState> {
  const type = formData.get("type") === "community" ? "community" : "merchant";
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const logo = formData.get("logo");
  const proof = formData.get("proof");

  if (!text("category")) return { error: ERRORS.invalid_category };
  if (logo instanceof File && logo.size > MAX_LOGO) return { error: "Logo terlalu besar, maksimal 2 MB." };
  if (!(proof instanceof File) || proof.size === 0) return { error: "Unggah foto untuk verifikasi dulu, ya." };
  if (proof.size > MAX_PROOF) return { error: "Foto bukti terlalu besar, maksimal 5 MB." };

  let data: Record<string, unknown>;
  if (type === "merchant") {
    const days = text("days").split(",").filter(Boolean);
    const openingHours = Object.fromEntries(days.map((day) => [day, [text("open_time") || "08:00", text("close_time") || "21:00"]]));
    data = {
      name: text("name"),
      whatsapp: text("whatsapp"),
      merchant_category: text("category"),
      nib: text("nib"),
      description: text("description"),
      outlets: [
        {
          name: text("outlet_name"),
          address: text("outlet_address"),
          village_id: text("outlet_village") || null,
          lat: text("outlet_lat"),
          lng: text("outlet_lng"),
          opening_hours: openingHours,
        },
      ],
    };
  } else {
    const social: Record<string, string> = {};
    if (text("instagram")) social.instagram = text("instagram").replace(/^@/, "");
    if (text("tiktok")) social.tiktok = text("tiktok").replace(/^@/, "");
    data = {
      name: text("name"),
      whatsapp: text("whatsapp"),
      interest_category: text("category"),
      description: text("description"),
      activity_area_village_id: text("area_village") || null,
      social_links: social,
      est_members: text("est_members") || null,
      join_policy: text("join_policy") || "approval",
      basecamp_address: text("basecamp_address"),
    };
  }

  const supabase = await createClient();
  const { data: organizerId, error } = await supabase.rpc("register_organizer", { p_type: type, p_data: data as Json });
  if (error || !organizerId) {
    return { error: ERRORS[error?.message ?? ""] ?? "Pendaftaran belum tersimpan. Coba lagi, ya." };
  }

  // Unggah berkas setelah organizer ada, karena path Storage memakai id-nya.
  const uploads: string[] = [];
  const proofPath = await uploadOrganizerFile(supabase, "organizer-proofs", organizerId, "bukti", proof);
  if (!proofPath) uploads.push("foto bukti");
  const logoUrl = logo instanceof File && logo.size > 0 ? await uploadOrganizerFile(supabase, "logos", organizerId, "logo", logo) : null;
  if (logo instanceof File && logo.size > 0 && !logoUrl) uploads.push("logo");

  if (logoUrl) await supabase.from("organizers").update({ logo_url: logoUrl }).eq("id", organizerId);
  if (proofPath) {
    const table = type === "merchant" ? "merchant_profiles" : "community_profiles";
    await supabase.from(table).update({ proof_url: proofPath }).eq("organizer_id", organizerId);
  }

  const base = type === "merchant" ? `/merchant/${organizerId}` : `/komunitas/${organizerId}`;
  redirect(uploads.length > 0 ? `${base}/profil?unggah=gagal` : base);
}
