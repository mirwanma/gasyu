"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromLocalInput } from "@/lib/activities";
import type { MissionResult } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export type MissionActionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  invalid_template: "Template master misi ini sudah tidak tersedia. Pilih template lain atau isi dari nol.",
  not_allowed: "Kamu tidak punya akses untuk ini.",
  invalid_activity: "Aktivitas tidak ditemukan.",
  invalid_mission: "Misi tidak ditemukan atau sudah nonaktif.",
  activity_locked: "Aktivitas ini sudah ditutup, misi tidak bisa diubah.",
  invalid_mission_xp: "XP misi harus 10–100.",
  mission_total_xp_exceeded: "Total XP semua misi aktif maksimal 500 per aktivitas.",
  mission_checkpoint_required: "Misi scan QR butuh checkpoint.",
  mission_checkpoint_not_owned: "Checkpoint itu bukan milik partner pembuat misi.",
  mission_code_required: "Isi kode rahasia untuk misi kode.",
  invalid_code: "Kode rahasia minimal 3 karakter.",
  mission_reveal_at_required: "Isi jam buka untuk misi terjadwal.",
  mission_prerequisite_required: "Pilih misi prasyarat.",
  mission_prerequisite_other_activity: "Misi prasyarat harus dari aktivitas yang sama.",
  mission_prerequisite_must_be_required: "Misi wajib hanya boleh berprasyarat misi wajib.",
  mission_prerequisite_cycle: "Rantai prasyarat berputar; pilih misi lain.",
  mission_locked: "Sudah ada yang menyelesaikan misi ini: XP, cara verifikasi, dan status wajib terkunci. Nonaktifkan dan buat misi baru jika perlu.",
  mission_cannot_hide: "Misi yang sudah terbuka tidak bisa disembunyikan lagi.",
  invalid_mission_window: "Jendela waktu misi tidak valid.",
  mission_partner_not_accepted: "Partner pembuat misi belum menerima undangan.",
  partner_qr_only: "Partner hanya bisa membuat misi scan QR di checkpoint miliknya.",
  mission_not_manual: "Hanya misi yang dibuka panitia (atau terjadwal) yang bisa dibuka lebih awal.",
  mission_already_revealed: "Misi ini sudah terbuka.",
  activity_not_live: "Misi hanya bisa dibuka saat aktivitas sudah terbit atau berjalan.",
  activity_not_running: "Aktivitas sedang tidak berjalan.",
  not_registered: "Kamu belum terdaftar di aktivitas ini.",
  payment_required: "Pembayaran belum lunas. Misi terbuka setelah panitia mengonfirmasi.",
  mission_not_revealed: "Misi belum dibuka.",
  mission_closed: "Misi ini sedang di luar jendela waktunya.",
  mission_already_done: "Misi ini sudah kamu selesaikan (atau sedang ditinjau).",
  invalid_token: "QR misi tidak berlaku. Minta staf menampilkan QR terbaru.",
  too_many_attempts: "Terlalu banyak percobaan. Coba lagi 15 menit lagi.",
  proof_required: "Unggah foto bukti dulu.",
  manual_only: "Misi ini ditandai oleh panitia.",
  invalid_completion: "Bukti tidak ditemukan.",
  completion_not_pending: "Bukti ini sudah ditinjau.",
  note_required: "Tulis alasan saat menolak.",
  account_inactive: "Akun kamu sedang tidak aktif.",
  title: "Judul misi harus 3–80 karakter.",
  // Event Global
  invalid_mission_score: "Skor misi harus 10–1.000.",
  mission_total_score_exceeded: "Total skor semua misi aktif maksimal 5.000.",
  global_mission_no_xp: "Misi Event Global memakai skor, bukan XP.",
  online_no_qr_mission: "Event online tidak boleh punya misi scan QR.",
};

// Kode yang paling panjang dicocokkan dulu, supaya "invalid_mission_score" tidak terbaca sebagai "invalid_mission".
const msg = (code: string | undefined, fallback: string) => {
  const key = Object.keys(ERRORS)
    .sort((a, b) => b.length - a.length)
    .find((k) => (code ?? "").includes(k));
  return key ? ERRORS[key] : fallback;
};
const basePath = (type: string, id: string) => (type === "admin" ? "/admin/aktivitas/misi" : `/${type === "merchant" ? "merchant" : "komunitas"}/${id}/aktivitas`);
const misiPath = (type: string, id: string, aid: string) => (type === "admin" ? `/admin/aktivitas/misi?aid=${aid}` : `${basePath(type, id)}/${aid}/misi`);

// ---- Tim penyelenggara -----------------------------------------------------

export async function saveMission(_prev: MissionActionState, formData: FormData): Promise<MissionActionState> {
  const type = String(formData.get("type_org"));
  const organizerId = String(formData.get("organizer_id"));
  const activityId = String(formData.get("activity_id"));
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const mission: Record<string, unknown> = {
    id: text("mission_id") || null,
    template_id: text("template_id") || null,
    partner_organizer_id: text("partner_organizer_id") || null,
    title: text("title"),
    description: text("description"),
    verification: text("verification"),
    checkpoint_id: text("checkpoint_id") || null,
    code: text("code") || null,
    xp_reward: Number(text("xp_reward") || 0),
    score_reward: Number(text("score_reward") || 0),
    is_required: formData.get("is_required") === "on",
    reveal_mode: text("reveal_mode") || "on_publish",
    reveal_at: text("reveal_at") ? fromLocalInput(text("reveal_at")) : null,
    prerequisite_mission_id: text("prerequisite_mission_id") || null,
    show_teaser: formData.get("show_teaser") === "on",
    available_from: text("available_from") ? fromLocalInput(text("available_from")) : null,
    available_until: text("available_until") ? fromLocalInput(text("available_until")) : null,
  };
  if (!mission.id) delete mission.partner_organizer_id;
  const supabase = await createClient();
  const { error } = await supabase.rpc("upsert_mission", { p_activity_id: activityId, p_mission: mission as Json });
  if (error) return { error: msg(error.message, "Misi belum tersimpan.") };
  revalidatePath(misiPath(type, organizerId, activityId));
  return { success: mission.id ? "Misi diperbarui." : "Misi ditambahkan." };
}

export async function toggleMission(formData: FormData) {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_mission_active", { p_mission_id: String(formData.get("mission_id")), p_active: formData.get("active") === "true" });
  const path = misiPath(String(formData.get("type_org")), String(formData.get("organizer_id")), String(formData.get("activity_id")));
  revalidatePath(path);
  redirect(error ? `${path}${path.includes("?") ? "&" : "?"}error=${encodeURIComponent(msg(error.message, "Gagal mengubah misi."))}` : path);
}

export async function revealMission(formData: FormData) {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("reveal_mission", { p_mission_id: String(formData.get("mission_id")) });
  const path = misiPath(String(formData.get("type_org")), String(formData.get("organizer_id")), String(formData.get("activity_id")));
  revalidatePath(path);
  const sep = path.includes("?") ? "&" : "?";
  redirect(error ? `${path}${sep}error=${encodeURIComponent(msg(error.message, "Misi belum bisa dibuka."))}` : `${path}${sep}hasil=buka&n=${data ?? 0}`);
}

export async function markManual(formData: FormData) {
  const supabase = await createClient();
  const userIds = formData.getAll("user_id").map(String);
  const path = misiPath(String(formData.get("type_org")), String(formData.get("organizer_id")), String(formData.get("activity_id")));
  const sep = path.includes("?") ? "&" : "?";
  if (userIds.length === 0) redirect(`${path}${sep}error=${encodeURIComponent("Pilih minimal satu peserta.")}`);
  const { data, error } = await supabase.rpc("mark_missions_manual", { p_mission_id: String(formData.get("mission_id")), p_user_ids: userIds });
  revalidatePath(path);
  redirect(error ? `${path}${sep}error=${encodeURIComponent(msg(error.message, "Gagal menandai peserta."))}` : `${path}${sep}hasil=tandai&n=${data ?? 0}`);
}

export async function reviewCompletion(formData: FormData) {
  const supabase = await createClient();
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim();
  const path = misiPath(String(formData.get("type_org")), String(formData.get("organizer_id")), String(formData.get("activity_id")));
  const sep = path.includes("?") ? "&" : "?";
  if (!approve && !note) redirect(`${path}${sep}tab=tinjau&error=${encodeURIComponent(ERRORS.note_required)}`);
  const { error } = await supabase.rpc("review_mission_completion", { p_completion_id: String(formData.get("completion_id")), p_approve: approve, p_note: note || null });
  revalidatePath(path);
  redirect(error ? `${path}${sep}tab=tinjau&error=${encodeURIComponent(msg(error.message, "Keputusan belum tersimpan."))}` : `${path}${sep}tab=tinjau&hasil=${approve ? "setuju" : "tolak"}`);
}

export type MissionQrResponse =
  | { ok: true; missionId: string; token: string; expiresIn: number; rotateSeconds: number; missionTitle: string; activityTitle: string; revealed: boolean }
  | { ok: false; error: string };

export async function getMissionQr(missionId: string): Promise<MissionQrResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_mission_qr", { p_mission_id: missionId });
  if (error) return { ok: false, error: msg(error.message, "QR misi belum bisa ditampilkan.") };
  const d = data as Record<string, unknown>;
  return {
    ok: true,
    missionId: String(d.mission_id),
    token: String(d.token),
    expiresIn: Number(d.expires_in),
    rotateSeconds: Number(d.rotate_seconds),
    missionTitle: String(d.mission_title),
    activityTitle: String(d.activity_title),
    revealed: Boolean(d.revealed),
  };
}

// ---- Warga ---------------------------------------------------------------

export type MissionResponse = { ok: true; result: MissionResult } | { ok: false; error: string };

export async function completeMissionQr(missionId: string, token: string, lat: number | null, lng: number | null): Promise<MissionResponse> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_mission", { p_mission_id: missionId, p_token: token, p_code: null, p_proof_path: null, p_lat: lat, p_lng: lng });
  if (error) return { ok: false, error: msg(error.message, "Misi belum tercatat. Coba lagi.") };
  revalidatePath("/");
  return { ok: true, result: data as MissionResult };
}

export async function submitMissionCode(_prev: MissionActionState, formData: FormData): Promise<MissionActionState> {
  const missionId = String(formData.get("mission_id"));
  const activityId = String(formData.get("activity_id"));
  const code = String(formData.get("code") ?? "").trim();
  if (!code) return { error: "Ketik kode dulu." };
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("complete_mission", { p_mission_id: missionId, p_token: null, p_code: code, p_proof_path: null, p_lat: null, p_lng: null });
  if (error) return { error: msg(error.message, "Kode belum bisa diperiksa. Coba lagi.") };
  const r = data as MissionResult;
  if (r.status === "wrong_code") return { error: `Kode salah. Sisa percobaan: ${r.attempts_left ?? 0}.` };
  revalidatePath(`/aktivitas/${activityId}`);
  revalidatePath("/");
  if (r.reach === "global") return { success: `Misi "${r.mission_title}" selesai: +${(r.mission_score ?? 0).toLocaleString("id-ID")} skor event` };
  return { success: `Misi "${r.mission_title}" selesai: +${r.mission_xp ?? 0} XP${r.completed ? " · aktivitas selesai!" : ""}` };
}

export async function submitMissionPhoto(_prev: MissionActionState, formData: FormData): Promise<MissionActionState> {
  const missionId = String(formData.get("mission_id"));
  const activityId = String(formData.get("activity_id"));
  const file = formData.get("proof");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih foto dulu." };
  if (file.size > 5 * 1024 * 1024) return { error: "Ukuran foto maksimal 5 MB." };
  const ext = ({ "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" } as Record<string, string>)[file.type];
  if (!ext) return { error: "Format foto harus JPG, PNG, atau WebP." };
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesi habis. Masuk lagi." };
  const path = `${activityId}/${auth.user.id}/${missionId}-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("mission-proofs").upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Foto gagal diunggah. Coba lagi." };
  const { error } = await supabase.rpc("complete_mission", { p_mission_id: missionId, p_token: null, p_code: null, p_proof_path: path, p_lat: null, p_lng: null });
  if (error) return { error: msg(error.message, "Foto terunggah, tetapi misi belum tercatat.") };
  revalidatePath(`/aktivitas/${activityId}`);
  return { success: "Foto terkirim. Tunggu panitia meninjau." };
}
