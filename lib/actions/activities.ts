"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { fromLocalInput } from "@/lib/activities";
import { createClient } from "@/lib/supabase/server";
import { uploadOrganizerFile } from "@/lib/storage";

export type ActivityActionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  not_allowed: "Kamu tidak punya akses untuk ini.",
  organizer_unavailable: "Penyelenggara tidak ditemukan.",
  invalid_title: "Judul harus 3–100 karakter.",
  invalid_time: "Cek tanggal dan jam: waktu selesai harus setelah mulai.",
  invalid_region: "Wilayah cakupan belum dipilih atau tidak valid.",
  invalid_group_size: "Ukuran grup harus 2–10 orang.",
  members_only_requires_community_host: "Khusus member hanya untuk aktivitas komunitas.",
  activity_locked: "Aktivitas ini sedang tidak bisa diubah.",
  host_not_approved: "Penyelenggara harus terverifikasi dulu sebelum mengajukan.",
  starts_in_past: "Waktu mulai harus di masa depan.",
  checkpoint_required: "Tambahkan minimal satu checkpoint sebelum mengajukan.",
  points_budget_insufficient: "Budget poin belum cukup untuk poin per penyelesaian.",
  residency_requires_scope: "Pilih wilayah cakupan untuk aturan khusus warga.",
  invalid_payment: "Harga atau instruksi bayar belum lengkap.",
  invalid_outlet: "Outlet tidak ditemukan.",
  invalid_checkpoint: "Nama atau titik lokasi checkpoint belum lengkap.",
  not_in_review: "Aktivitas ini tidak sedang menunggu review.",
  note_required: "Tulis catatan untuk penyelenggara jika menolak.",
  activity_unavailable: "Aktivitas ini belum bisa diikuti.",
  members_only: "Aktivitas ini khusus member komunitas penyelenggara.",
  residents_only: "Aktivitas ini khusus warga wilayah cakupannya.",
  quota_full: "Kuota sudah penuh.",
  already_joined: "Kamu sudah terdaftar di aktivitas ini.",
  join_mode_group: "Aktivitas ini hanya bisa diikuti lewat grup (fitur grup menyusul).",
  cannot_cancel: "Pendaftaran tidak bisa dibatalkan lagi.",
  account_inactive: "Akun kamu sedang tidak aktif.",
  group_target_requires_group_join: "Target grup hanya untuk pendaftaran lewat grup.",
  invalid_target: "Target challenge tidak valid.",
  target_required: "Challenge butuh target (jumlah check-in atau checkpoint).",
  join_mode_individual: "Aktivitas ini hanya bisa diikuti perorangan.",
  not_group_leader: "Hanya ketua grup yang bisa mendaftarkan grup.",
  invalid_group_members: "Pilih anggota yang masih aktif di grup.",
  member_already_joined: "Ada anggota yang sudah terdaftar di aktivitas ini.",
  cannot_confirm: "Undangan ini sudah tidak berlaku.",
};

const msg = (code: string | undefined, fallback: string) => ERRORS[code ?? ""] ?? fallback;
const basePath = (type: string, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;

function readActivityForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const type = text("type") === "challenge" ? "challenge" : "event";
  const joinMode = ["individual", "group", "both"].includes(text("join_mode")) ? text("join_mode") : "individual";
  return {
    type,
    difficulty: type === "challenge" ? text("difficulty") || "easy" : null,
    target_scope: type === "challenge" && text("target_scope") === "group" ? "group" : "individual",
    target_kind: type === "challenge" ? text("target_kind") || "total_checkins" : null,
    target_count: type === "challenge" ? text("target_count") || "1" : null,
    group_min: joinMode === "individual" ? null : text("group_min") || "2",
    group_max: joinMode === "individual" ? null : text("group_max") || "10",
    goal: text("goal") || "awareness",
    title: text("title"),
    description: text("description"),
    scope_region_id: text("scope_region_id") || null,
    starts_at: fromLocalInput(text("starts_at")),
    ends_at: fromLocalInput(text("ends_at")),
    quota: text("quota") || null,
    join_mode: joinMode,
    residency_rule: text("residency_rule") || "open",
    audience: text("audience") || "public",
  };
}

// ---- Penyelenggara -----------------------------------------------------

export async function createActivity(_prev: ActivityActionState, formData: FormData): Promise<ActivityActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type_org"));
  const supabase = await createClient();
  const { data: id, error } = await supabase.rpc("create_activity", { p_host_organizer_id: organizerId, p_data: readActivityForm(formData) });
  if (error || !id) return { error: msg(error?.message, "Aktivitas belum tersimpan. Coba lagi.") };

  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    const url = await uploadOrganizerFile(supabase, "covers", id, "cover", cover);
    if (url) await supabase.rpc("update_activity", { p_activity_id: id, p_data: { cover_url: url } });
  }
  revalidatePath(basePath(type, organizerId), "layout");
  redirect(`${basePath(type, organizerId)}/aktivitas/${id}`);
}

export async function updateActivity(_prev: ActivityActionState, formData: FormData): Promise<ActivityActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type_org"));
  const activityId = String(formData.get("activity_id"));
  const supabase = await createClient();
  const data: Record<string, unknown> = readActivityForm(formData);
  if (!formData.has("title")) {
    // Formulir ringkas (setelah terbit): hanya deskripsi dan cover.
    for (const key of Object.keys(data)) if (key !== "description") delete data[key];
  }
  const cover = formData.get("cover");
  if (cover instanceof File && cover.size > 0) {
    if (cover.size > 3 * 1024 * 1024) return { error: "Cover terlalu besar, maksimal 3 MB." };
    const url = await uploadOrganizerFile(supabase, "covers", activityId, "cover", cover);
    if (!url) return { error: "Cover belum terunggah. Pakai PNG, JPG, atau WebP." };
    data.cover_url = url;
  }
  const { error } = await supabase.rpc("update_activity", { p_activity_id: activityId, p_data: data });
  if (error) return { error: msg(error.message, "Perubahan belum tersimpan.") };
  revalidatePath(`${basePath(type, organizerId)}/aktivitas/${activityId}`);
  return { success: "Tersimpan." };
}

export async function addCheckpoint(_prev: ActivityActionState, formData: FormData): Promise<ActivityActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type_org"));
  const activityId = String(formData.get("activity_id"));
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const supabase = await createClient();
  const data = text("outlet_id")
    ? { outlet_id: text("outlet_id"), name: text("name") || null, radius_m: text("radius_m") || null }
    : { name: text("name"), address: text("address"), lat: text("lat"), lng: text("lng"), radius_m: text("radius_m") || null };
  const { error } = await supabase.rpc("add_checkpoint", { p_activity_id: activityId, p_data: data });
  if (error) return { error: msg(error.message, "Checkpoint belum tersimpan.") };
  revalidatePath(`${basePath(type, organizerId)}/aktivitas/${activityId}`);
  return { success: "Checkpoint ditambahkan." };
}

export async function toggleCheckpoint(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type_org"));
  const activityId = String(formData.get("activity_id"));
  const supabase = await createClient();
  await supabase.rpc("set_checkpoint_active", { p_checkpoint_id: String(formData.get("checkpoint_id")), p_active: formData.get("active") === "true" });
  revalidatePath(`${basePath(type, organizerId)}/aktivitas/${activityId}`);
}

export async function changeActivityStatus(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const type = String(formData.get("type_org"));
  const activityId = String(formData.get("activity_id"));
  const action = String(formData.get("action"));
  const supabase = await createClient();
  let error: { message: string } | null = null;
  if (action === "submit") ({ error } = await supabase.rpc("submit_activity", { p_activity_id: activityId }));
  else if (action === "withdraw") ({ error } = await supabase.rpc("withdraw_activity", { p_activity_id: activityId }));
  else if (action === "cancel") ({ error } = await supabase.rpc("cancel_activity", { p_activity_id: activityId, p_reason: String(formData.get("reason") ?? "") || null }));
  const path = `${basePath(type, organizerId)}/aktivitas/${activityId}`;
  revalidatePath(path);
  revalidatePath(basePath(type, organizerId), "layout");
  redirect(error ? `${path}?error=${encodeURIComponent(msg(error.message, "Gagal mengubah status."))}` : `${path}?hasil=${action}`);
}

// ---- Warga -------------------------------------------------------------

export async function joinActivity(_prev: ActivityActionState, formData: FormData): Promise<ActivityActionState> {
  const activityId = String(formData.get("activity_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("join_activity", { p_activity_id: activityId });
  if (error) return { error: msg(error.message, "Belum bisa mendaftar. Coba lagi.") };
  revalidatePath(`/aktivitas/${activityId}`);
  revalidatePath("/");
  return { success: "Kamu terdaftar." };
}

export async function cancelParticipation(_prev: ActivityActionState, formData: FormData): Promise<ActivityActionState> {
  const activityId = String(formData.get("activity_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_participation", { p_participation_id: String(formData.get("participation_id")) });
  if (error) return { error: msg(error.message, "Belum bisa membatalkan.") };
  revalidatePath(`/aktivitas/${activityId}`);
  revalidatePath("/");
  return { success: "Pendaftaran dibatalkan." };
}

// ---- Admin -------------------------------------------------------------

export async function reviewActivity(formData: FormData) {
  const activityId = String(formData.get("activity_id"));
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim();
  if (!approve && !note) redirect(`/admin/aktivitas?pilih=${activityId}&hasil=catatan`);
  const supabase = await createClient();
  const { error } = await supabase.rpc("review_activity", { p_activity_id: activityId, p_approve: approve, p_note: note || null });
  revalidatePath("/admin", "layout");
  redirect(`/admin/aktivitas?hasil=${error ? "gagal" : "ok"}`);
}

export async function adminCancelActivity(formData: FormData) {
  const activityId = String(formData.get("activity_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("cancel_activity", { p_activity_id: activityId, p_reason: String(formData.get("reason") ?? "") || null });
  revalidatePath("/admin", "layout");
  const tab = formData.get("tab") === "review" ? "review" : "semua";
  redirect(`/admin/aktivitas?tab=${tab}&pilih=${activityId}${error ? "&hasil=gagal" : ""}`);
}
