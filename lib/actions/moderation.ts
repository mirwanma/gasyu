"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// Aksi moderasi admin (irisan 8). Semua keputusan dieksekusi fungsi database
// security definer yang memeriksa is_admin(); di sini hanya meneruskan form.

const ERRORS: Record<string, string> = {
  not_allowed: "Hanya admin yang bisa melakukan ini.",
  invalid_checkin: "Check-in tidak ditemukan atau sudah ditinjau.",
  already_rejected: "Check-in ini sudah ditolak sebelumnya.",
  flag_unavailable: "Laporan ini sudah ditinjau.",
  invalid_action: "Tindakan tidak dikenal.",
  cannot_suspend_self: "Kamu tidak bisa membekukan akunmu sendiri.",
  cannot_suspend_admin: "Akun admin tidak bisa dibekukan dari sini.",
  invalid_user: "Pengguna tidak ditemukan.",
  invalid_organizer: "Penyelenggara tidak ditemukan.",
  already_suspended: "Penyelenggara sudah dibekukan.",
  not_suspended: "Penyelenggara tidak sedang dibekukan.",
  note_required: "Tulis alasan pembatalan misi.",
  invalid_completion: "Misi ini sudah dibatalkan atau belum disetujui.",
  invalid_city: "Kota tidak ditemukan.",
};

function message(error: { message: string } | null) {
  if (!error) return null;
  const key = Object.keys(ERRORS).find((k) => error.message.includes(k));
  return key ? ERRORS[key] : "Tindakan gagal. Coba lagi.";
}

function back(path: string, error: { message: string } | null, ok: string) {
  revalidatePath("/admin", "layout");
  const msg = message(error);
  redirect(`${path}${path.includes("?") ? "&" : "?"}${msg ? `error=${encodeURIComponent(msg)}` : `hasil=${ok}`}`);
}

export async function approveCheckin(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_checkin", { p_checkin_id: String(formData.get("checkin_id")), p_note: String(formData.get("note") ?? "") || null });
  back("/admin/moderasi", error, "sah");
}

export async function reverseCheckin(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_checkin", { p_checkin_id: String(formData.get("checkin_id")), p_note: String(formData.get("note") ?? "") || null });
  back("/admin/moderasi", error, "balik");
}

// Batalkan misi yang sudah disetujui: Jejak/skor dibalik dengan baris negatif dan warga diberi tahu.
export async function reverseMission(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("reverse_mission_completion", {
    p_completion_id: String(formData.get("completion_id")),
    p_note: String(formData.get("note") ?? "").trim(),
  });
  back("/admin/moderasi", error, "misi");
}

export async function reviewFlag(formData: FormData) {
  const supabase = await createClient();
  const action = String(formData.get("flag_action"));
  const { error } = await supabase.rpc("review_fraud_flag", { p_flag_id: String(formData.get("flag_id")), p_action: action, p_note: String(formData.get("note") ?? "") || null });
  back("/admin/moderasi", error, action);
}

export async function suspendUser(formData: FormData) {
  const supabase = await createClient();
  const suspend = formData.get("suspend") === "1";
  const { error } = await supabase.rpc("suspend_user", { p_user_id: String(formData.get("user_id")), p_suspend: suspend, p_note: String(formData.get("note") ?? "") || null });
  const kembali = safeNext(formData.get("kembali"), "/admin/pengguna");
  back(kembali, error, suspend ? "beku" : "aktif");
}

export async function suspendOrganizer(formData: FormData) {
  const supabase = await createClient();
  const suspend = formData.get("suspend") === "1";
  const { error } = await supabase.rpc("suspend_organizer", { p_organizer_id: String(formData.get("organizer_id")), p_suspend: suspend, p_note: String(formData.get("note") ?? "") || null });
  back("/admin/pengguna?tab=penyelenggara", error, suspend ? "beku" : "aktif");
}

// Buka atau tutup kota di Gasyu (Jelajah, cakupan aktivitas, dan peringkat).
export async function setCityActive(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_city_active", {
    p_city_id: String(formData.get("city_id")),
    p_active: formData.get("active") === "true",
  });
  back(safeNext(formData.get("back"), "/admin/wilayah"), error, formData.get("active") === "true" ? "kota_dibuka" : "kota_ditutup");
}
