"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

// Aksi admin untuk master misi. Hak admin dan batas Jejak dicek ulang di
// upsert_mission_template dan set_mission_template_active.

export type TemplateState = { error?: string };

const ERRORS: Record<string, string> = {
  not_allowed: "Hanya admin yang bisa mengelola master misi.",
  invalid_title: "Judul template harus 3–80 karakter.",
  invalid_xp: "Jejak di luar batas yang diizinkan (lihat mission.xp_min dan mission.xp_max di Pengaturan).",
  invalid_template: "Template tidak ditemukan.",
};

const msg = (code: string | undefined, fallback: string) => {
  const key = Object.keys(ERRORS).find((k) => (code ?? "").includes(k));
  return key ? ERRORS[key] : fallback;
};

export async function saveMissionTemplate(_prev: TemplateState, formData: FormData): Promise<TemplateState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const id = text("template_id") || null;
  const data = {
    title: text("title"),
    description: text("description"),
    organizer_tips: text("organizer_tips"),
    category: text("category") || "other",
    verification: text("verification") || "manual",
    xp_reward: Number(text("xp_reward") || 0),
    is_required: formData.get("is_required") === "on",
    activity_type: text("activity_type"),
    organizer_type: text("organizer_type"),
    sort_order: Number(text("sort_order") || 0),
  };
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_mission_template", { p_template_id: id, p_data: data as Json });
  if (error) return { error: msg(error.message, "Template belum tersimpan. Coba lagi.") };
  revalidatePath("/admin/misi");
  redirect(`/admin/misi?hasil=${id ? "ubah" : "tambah"}`);
}

export async function toggleMissionTemplate(formData: FormData) {
  const supabase = await createClient();
  const active = formData.get("active") === "true";
  const { error } = await supabase.rpc("set_mission_template_active", { p_template_id: String(formData.get("template_id")), p_active: active });
  revalidatePath("/admin/misi");
  redirect(error ? `/admin/misi?error=${encodeURIComponent(msg(error.message, "Gagal mengubah status template."))}` : `/admin/misi?hasil=${active ? "aktif" : "nonaktif"}`);
}
