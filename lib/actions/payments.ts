"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Aksi pembayaran (irisan 11). Semua keputusan dieksekusi fungsi database
// security definer (submit_payment_proof, confirm_payment, mark_refunded).

export type PaymentActionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  not_allowed: "Kamu tidak punya akses untuk ini.",
  invalid_participation: "Pendaftaran tidak ditemukan atau sudah tidak aktif.",
  payment_not_required: "Aktivitas ini gratis.",
  payment_already_paid: "Pembayaran ini sudah lunas.",
  proof_required: "Unggah foto bukti bayar dulu.",
  activity_closed: "Aktivitas sudah tidak menerima pembayaran.",
  note_required: "Tulis alasan saat menolak bukti.",
  not_refundable: "Hanya peserta lunas yang batal (atau aktivitas dibatalkan) yang bisa ditandai refund.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};

const msg = (code: string | undefined, fallback: string) => {
  const key = Object.keys(ERRORS).find((k) => (code ?? "").includes(k));
  return key ? ERRORS[key] : fallback;
};

// ---- Warga -----------------------------------------------------------------

export async function submitPaymentProof(_prev: PaymentActionState, formData: FormData): Promise<PaymentActionState> {
  const participationId = String(formData.get("participation_id"));
  const activityId = String(formData.get("activity_id"));
  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih foto bukti bayar dulu." };
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran foto maksimal 5 MB." };
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[file.type];
  if (!ext) return { error: "Format foto harus JPG, PNG, atau WebP." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesi habis. Masuk lagi." };
  const { data: before } = await supabase.from("participations").select("payment_proof_path").eq("id", participationId).maybeSingle();
  const path = `${activityId}/${auth.user.id}/bayar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("payment-proofs").upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Foto gagal diunggah. Coba lagi." };
  const { error } = await supabase.rpc("submit_payment_proof", { p_participation_id: participationId, p_proof_path: path });
  if (error) return { error: msg(error.message, "Bukti terunggah, tetapi belum tercatat. Coba lagi.") };
  // Bukti lama yang sudah diganti tidak dibutuhkan lagi (policy hanya mengizinkan file yang tidak tercatat).
  if (before?.payment_proof_path && before.payment_proof_path !== path) {
    await supabase.storage.from("payment-proofs").remove([before.payment_proof_path]);
  }
  revalidatePath(`/aktivitas/${activityId}`);
  revalidatePath("/");
  return { success: "Bukti terkirim. Panitia akan mengeceknya." };
}

// ---- Tim host / admin ------------------------------------------------------

function back(path: string, error: { message: string } | null, ok: string) {
  const sep = path.includes("?") ? "&" : "?";
  redirect(`${path}${sep}${error ? `error=${encodeURIComponent(msg(error.message, "Tindakan gagal. Coba lagi."))}` : `hasil=${ok}`}`);
}

// Formulir: participation_id, decision (paid | reject | refund), note, back (URL halaman peserta).
export async function decidePayment(formData: FormData) {
  const participationId = String(formData.get("participation_id"));
  const decision = String(formData.get("decision"));
  const note = String(formData.get("note") ?? "").trim() || null;
  const backTo = String(formData.get("back") ?? "/");
  const supabase = await createClient();
  let error: { message: string } | null = null;
  let ok = "lunas";
  if (decision === "paid") ({ error } = await supabase.rpc("confirm_payment", { p_participation_id: participationId, p_paid: true, p_note: note }));
  else if (decision === "reject") {
    ({ error } = await supabase.rpc("confirm_payment", { p_participation_id: participationId, p_paid: false, p_note: note }));
    ok = "tolak";
  } else if (decision === "refund") {
    ({ error } = await supabase.rpc("mark_refunded", { p_participation_id: participationId, p_note: note }));
    ok = "refund";
  } else error = { message: "invalid_action" };
  revalidatePath(backTo.split("?")[0]);
  revalidatePath("/admin", "layout");
  back(backTo, error, ok);
}
