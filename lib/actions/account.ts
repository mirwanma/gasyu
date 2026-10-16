"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

// Aksi akun warga. Aturan (unik, 90 hari, syarat hapus akun) ditegakkan oleh
// fungsi database update_my_profile, change_home_village, delete_my_account.

export type AccountState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  invalid_nickname: "Nama panggilan harus 3–20 karakter.",
  nickname_taken: "Nama panggilan ini sudah dipakai. Coba yang lain.",
  invalid_full_name: "Nama lengkap belum diisi.",
  same_village: "Itu sudah kelurahan kamu sekarang.",
  village_change_too_soon: "Kelurahan baru bisa diganti lagi setelah batas waktunya lewat.",
  invalid_village: "Kelurahan tidak ditemukan. Pilih lagi, ya.",
  confirmation_required: "Ketik HAPUS untuk mengonfirmasi.",
  admin_account: "Akun admin tidak bisa dihapus dari aplikasi. Hubungi tim Gasyu.",
  transfer_leadership_first: "Kamu satu-satunya pemilik atau ketua di merchant/komunitas. Jadikan anggota tim lain pemilik/ketua lewat menu Tim dulu.",
  active_paid_participation: "Kamu masih punya pembayaran lunas atau menunggu konfirmasi di aktivitas yang belum selesai. Batalkan atau tunggu aktivitasnya selesai dulu.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};

const msg = (code: string | undefined, fallback: string) => {
  const key = Object.keys(ERRORS).find((k) => (code ?? "").includes(k));
  return key ? ERRORS[key] : fallback;
};

export async function updateProfile(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_my_profile", {
    p_nickname: String(formData.get("nickname") ?? ""),
    p_full_name: String(formData.get("full_name") ?? ""),
  });
  if (error) return { error: msg(error.message, "Profil gagal disimpan. Coba lagi.") };
  revalidatePath("/profil");
  revalidatePath("/");
  return { success: "Profil tersimpan." };
}

export async function changeVillage(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const raw = String(formData.get("village") ?? "");
  if (!raw) return { error: "Pilih kelurahan dulu." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("change_home_village", { p_village_id: raw === "luar" ? null : raw });
  if (error) return { error: msg(error.message, "Kelurahan gagal diganti. Coba lagi.") };
  revalidatePath("/profil");
  revalidatePath("/");
  return { success: "Kelurahan asal sudah diganti." };
}

export async function deleteAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account", { p_confirm: String(formData.get("confirm") ?? "") });
  if (error) return { error: msg(error.message, "Akun gagal dihapus. Coba lagi.") };
  await supabase.auth.signOut();
  redirect("/masuk?akun=dihapus");
}
