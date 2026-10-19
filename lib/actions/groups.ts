"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type GroupActionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  invalid_group_name: "Nama grup harus 3–30 karakter.",
  group_full: "Grup sudah penuh (maksimal 10 anggota).",
  too_many_groups: "Kamu sudah ada di 3 grup. Keluar dari salah satu dulu.",
  invalid_invite_code: "Kode undangan tidak ditemukan.",
  already_in_group: "Kamu sudah jadi anggota grup ini.",
  not_group_member: "Kamu bukan anggota grup ini.",
  not_group_leader: "Hanya ketua grup yang bisa melakukan ini.",
  cannot_remove_leader: "Ketua tidak bisa mengeluarkan dirinya sendiri. Serahkan peran ketua dulu.",
  activity_unavailable: "Aktivitas ini belum bisa diikuti.",
  join_mode_individual: "Aktivitas ini hanya bisa diikuti perorangan.",
  invalid_group_members: "Pilih anggota yang masih aktif di grup.",
  invalid_group_size: "Jumlah anggota tidak sesuai batas grup aktivitas ini.",
  quota_full: "Kuota tidak cukup untuk semua anggota.",
  member_already_joined: "Ada anggota yang sudah terdaftar di aktivitas ini.",
  members_only: "Semua anggota harus member aktif komunitas penyelenggara.",
  residents_only: "Semua anggota harus warga wilayah cakupan.",
  cannot_confirm: "Undangan ini sudah tidak berlaku.",
  account_inactive: "Akun kamu sedang tidak aktif.",
  too_many_attempts: "Terlalu banyak kode salah. Coba lagi 15 menit lagi.",
  removed_from_group: "Kamu sudah dikeluarkan dari grup ini.",
};
const msg = (code: string | undefined, fallback: string) => ERRORS[code ?? ""] ?? fallback;

export async function createGroup(_prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_group", { p_name: String(formData.get("name") ?? "") });
  if (error) return { error: msg(error.message, "Grup belum dibuat.") };
  revalidatePath("/grup");
  return { success: "Grup dibuat. Bagikan kodenya ke teman." };
}

export async function joinGroup(_prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("join_group", { p_invite_code: String(formData.get("code") ?? "") });
  if (error) return { error: msg(error.message, "Belum bisa bergabung.") };
  // Kode salah tidak dilempar sebagai error supaya percobaannya tetap tercatat.
  if (!data) return { error: ERRORS.invalid_invite_code };
  revalidatePath("/grup");
  return { success: "Kamu bergabung ke grup." };
}

export async function leaveGroup(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("leave_group", { p_group_id: String(formData.get("group_id")) });
  revalidatePath("/grup");
}

export async function removeGroupMember(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("remove_group_member", { p_group_id: String(formData.get("group_id")), p_user_id: String(formData.get("user_id")) });
  revalidatePath("/grup");
}

export async function transferGroupLeader(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("transfer_group_leader", { p_group_id: String(formData.get("group_id")), p_user_id: String(formData.get("user_id")) });
  revalidatePath("/grup");
}

export async function regenerateInviteCode(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("regenerate_invite_code", { p_group_id: String(formData.get("group_id")) });
  revalidatePath("/grup");
}

// Ketua mendaftarkan grup ke aktivitas; anggota yang dipilih diundang.
export async function registerGroup(_prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const activityId = String(formData.get("activity_id"));
  const groupId = String(formData.get("group_id"));
  const memberIds = formData.getAll("member_ids").map(String);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("register_group", { p_activity_id: activityId, p_group_id: groupId, p_member_ids: memberIds });
  if (error) return { error: msg(error.message, "Grup belum terdaftar.") };
  revalidatePath(`/aktivitas/${activityId}`);
  revalidatePath("/");
  revalidatePath("/grup");
  return { success: `Grup terdaftar. ${Number(data) - 1} anggota diundang untuk konfirmasi.` };
}

export async function confirmGroupRegistration(_prev: GroupActionState, formData: FormData): Promise<GroupActionState> {
  const activityId = String(formData.get("activity_id"));
  const accept = formData.get("decision") === "accept";
  const supabase = await createClient();
  const { error } = await supabase.rpc("confirm_group_registration", { p_participation_id: String(formData.get("participation_id")), p_accept: accept });
  if (error) return { error: msg(error.message, "Belum bisa menjawab undangan.") };
  revalidatePath(`/aktivitas/${activityId}`);
  revalidatePath("/");
  revalidatePath("/grup");
  return { success: accept ? "Kamu terdaftar bersama grup." : "Undangan ditolak." };
}
