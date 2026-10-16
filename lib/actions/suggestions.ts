"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Aksi saran warga. Aturan (batas harian, privasi, hak tim) ditegakkan oleh
// fungsi database submit_suggestion dan respond_suggestion.

export type SuggestionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  invalid_organizer: "Penyelenggara ini belum bisa menerima saran.",
  own_organizer: "Kamu tim penyelenggara ini, jadi tidak bisa memberi saran ke diri sendiri.",
  invalid_suggestion: "Tulis saran 10 sampai 1.000 karakter.",
  suggestion_limit: "Kamu sudah mencapai batas saran ke penyelenggara ini hari ini. Coba lagi besok.",
  not_allowed: "Kamu tidak punya akses untuk ini.",
  invalid_status: "Status tidak valid.",
  suggestion_not_found: "Saran tidak ditemukan.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};

const msg = (code: string | undefined, fallback: string) => {
  const key = Object.keys(ERRORS).find((k) => (code ?? "").includes(k));
  return key ? ERRORS[key] : fallback;
};

const CATEGORIES = ["activity", "product", "service", "place", "other"];
const STATUSES = ["in_progress", "done", "archived"];

// Warga mengirim saran dari profil publik /m/<slug> atau /k/<slug>.
export async function sendSuggestion(_prev: SuggestionState, formData: FormData): Promise<SuggestionState> {
  const organizerId = String(formData.get("organizer_id") ?? "");
  const path = String(formData.get("path") ?? "/saran");
  const categoryRaw = String(formData.get("category") ?? "other");
  const category = CATEGORIES.includes(categoryRaw) ? categoryRaw : "other";
  const body = String(formData.get("body") ?? "").trim();
  const anonymous = formData.get("anonymous") === "on";
  if (body.length < 10) return { error: ERRORS.invalid_suggestion };

  const supabase = await createClient();
  const { error } = await supabase.rpc("submit_suggestion", {
    p_organizer_id: organizerId,
    p_category: category,
    p_body: body,
    p_is_anonymous: anonymous,
  });
  if (error) return { error: msg(error.message, "Saran gagal dikirim. Coba lagi.") };
  revalidatePath(path);
  revalidatePath("/saran");
  return { success: "Terima kasih. Saranmu sudah sampai ke tim mereka." };
}

// Tim penyelenggara mengubah status dan/atau membalas saran.
export async function respondSuggestion(formData: FormData) {
  const id = String(formData.get("suggestion_id") ?? "");
  const statusRaw = String(formData.get("status") ?? "");
  const status = STATUSES.includes(statusRaw) ? statusRaw : "in_progress";
  const replyRaw = formData.get("reply");
  const reply = replyRaw === null ? null : String(replyRaw);
  const backTo = String(formData.get("back") ?? "/");

  const supabase = await createClient();
  const { error } = await supabase.rpc("respond_suggestion", { p_suggestion_id: id, p_status: status, p_reply: reply });
  revalidatePath(backTo.split("?")[0]);
  const sep = backTo.includes("?") ? "&" : "?";
  redirect(`${backTo}${sep}${error ? `error=${encodeURIComponent(msg(error.message, "Tindakan gagal. Coba lagi."))}` : `hasil=${status}`}`);
}
