"use server";

import { revalidatePath } from "next/cache";
import type { CheckinResult } from "@/lib/checkin";
import { getPointsPerCompletion } from "@/lib/data/activities";
import { createClient } from "@/lib/supabase/server";

const ERRORS: Record<string, string> = {
  invalid_checkpoint: "QR ini tidak dikenal atau checkpoint sudah nonaktif.",
  activity_not_running: "Aktivitas ini belum atau sudah tidak berjalan.",
  invalid_token: "QR sudah kedaluwarsa. Minta staf menampilkan QR terbaru.",
  not_registered: "Kamu belum terdaftar di aktivitas ini. Daftar dulu lewat halaman aktivitas.",
  payment_required: "Pembayaran belum dikonfirmasi penyelenggara.",
  already_checked_in_today: "Kamu sudah check-in di aktivitas ini hari ini.",
  account_inactive: "Akun kamu sedang tidak aktif.",
  not_authenticated: "Masuk dulu untuk check-in.",
  not_allowed: "Kamu tidak punya akses ke checkpoint ini.",
  checkpoint_inactive: "Checkpoint ini sedang nonaktif.",
  partner_inactive: "Penyelenggara checkpoint ini sudah tidak aktif di aktivitas ini.",
  activity_not_open: "Aktivitas belum terbit atau sudah selesai.",
};

export type CheckinResponse = { ok: true; result: CheckinResult } | { ok: false; error: string };

// Warga: check-in dari hasil pindai QR. Semua aturan ditegakkan di perform_checkin.
export async function performCheckin(checkpointId: string, token: string, lat: number | null, lng: number | null): Promise<CheckinResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("perform_checkin", {
    p_checkpoint_id: checkpointId,
    p_token: token,
    p_lat: lat,
    p_lng: lng,
  });
  if (error?.message === "not_registered") return { ok: false, error: await notRegisteredMessage(checkpointId) };
  if (error) return { ok: false, error: ERRORS[error.message] ?? "Check-in belum berhasil. Coba lagi." };
  revalidatePath("/");
  revalidatePath("/profil");
  const result = data as CheckinResult;
  return { ok: true, result: { ...result, points_promised: await getPointsPerCompletion(result.activity_id) } };
}

// Database memakai satu kode untuk "belum daftar" dan "sudah selesai"; bedakan dari status partisipasi.
async function notRegisteredMessage(checkpointId: string) {
  const supabase = await createClient();
  const [{ data: cp }, { data: claims }] = await Promise.all([
    supabase.from("activity_checkpoints").select("activity_id").eq("id", checkpointId).maybeSingle(),
    supabase.auth.getClaims(),
  ]);
  const userId = claims?.claims?.sub;
  const { data: p } = cp && userId
    ? await supabase.from("participations").select("status").eq("activity_id", cp.activity_id).eq("user_id", userId).maybeSingle()
    : { data: null };
  if (p?.status === "completed") return "Kamu sudah menyelesaikan aktivitas ini. Check-in lagi tidak diperlukan.";
  if (p?.status === "cancelled") return "Pendaftaranmu di aktivitas ini sudah batal.";
  return ERRORS.not_registered;
}

export type QrResponse =
  | { ok: true; checkpointId: string; token: string; expiresIn: number; rotateSeconds: number; checkpointName: string; activityTitle: string; activityStatus: string }
  | { ok: false; error: string };

// Tim penyelenggara: token QR untuk menit berjalan.
export async function getCheckpointQr(checkpointId: string): Promise<QrResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_checkpoint_qr", { p_checkpoint_id: checkpointId });
  if (error) return { ok: false, error: ERRORS[error.message] ?? "QR belum bisa ditampilkan." };
  const d = data as Record<string, unknown>;
  return {
    ok: true,
    checkpointId: String(d.checkpoint_id),
    token: String(d.token),
    expiresIn: Number(d.expires_in),
    rotateSeconds: Number(d.rotate_seconds),
    checkpointName: String(d.checkpoint_name),
    activityTitle: String(d.activity_title),
    activityStatus: String(d.activity_status),
  };
}
