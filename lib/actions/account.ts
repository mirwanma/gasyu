"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { checkNewPassword, passwordErrorMessage } from "@/lib/password";
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
  invalid_avatar: "Foto gagal disimpan. Coba unggah lagi.",
};

const AVATAR_TYPES: Record<string, string> = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
const AVATAR_MAX = 2 * 1024 * 1024;

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

// Hapus semua file di folder avatars milik pengguna, kecuali yang disebut.
async function clearAvatarFiles(supabase: Awaited<ReturnType<typeof createClient>>, userId: string, keep?: string) {
  const { data } = await supabase.storage.from("avatars").list(userId, { limit: 100 });
  const names = (data ?? []).map((f) => `${userId}/${f.name}`).filter((p) => p !== keep);
  if (names.length > 0) await supabase.storage.from("avatars").remove(names);
}

export async function uploadAvatar(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) return { error: "Pilih foto dulu." };
  const ext = AVATAR_TYPES[file.type];
  if (!ext) return { error: "Format foto harus JPG, PNG, atau WebP." };
  if (file.size > AVATAR_MAX) return { error: "Ukuran foto maksimal 2 MB." };

  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesi habis. Masuk lagi." };
  const path = `${auth.user.id}/avatar-${Date.now()}.${ext}`;
  const { error: upErr } = await supabase.storage.from("avatars").upload(path, file, { contentType: file.type });
  if (upErr) return { error: "Foto gagal diunggah. Coba lagi." };
  const url = supabase.storage.from("avatars").getPublicUrl(path).data.publicUrl;
  const { error } = await supabase.rpc("set_my_avatar", { p_url: url });
  if (error) {
    await supabase.storage.from("avatars").remove([path]);
    return { error: msg(error.message, "Foto gagal disimpan. Coba lagi.") };
  }
  await clearAvatarFiles(supabase, auth.user.id, path);
  revalidatePath("/profil");
  revalidatePath("/");
  return { success: "Foto profil tersimpan." };
}

export async function removeAvatar(): Promise<AccountState> {
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Sesi habis. Masuk lagi." };
  const { error } = await supabase.rpc("set_my_avatar", { p_url: null });
  if (error) return { error: msg(error.message, "Foto gagal dihapus. Coba lagi.") };
  await clearAvatarFiles(supabase, auth.user.id);
  revalidatePath("/profil");
  revalidatePath("/");
  return { success: "Foto profil dihapus." };
}

export async function deleteAccount(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("delete_my_account", { p_confirm: String(formData.get("confirm") ?? "") });
  if (error) return { error: msg(error.message, "Akun gagal dihapus. Coba lagi.") };
  // Foto profil ikut dihapus dari penyimpanan.
  const { data: auth } = await supabase.auth.getUser();
  if (auth.user) await clearAvatarFiles(supabase, auth.user.id);
  await supabase.auth.signOut();
  redirect("/masuk?akun=dihapus");
}

// Buat atau ganti kata sandi akun yang sedang masuk (juga dipakai setelah Lupa kata sandi).
export async function setPassword(_prev: AccountState, formData: FormData): Promise<AccountState> {
  const password = String(formData.get("password") ?? "");
  const invalid = checkNewPassword(password, String(formData.get("password_confirm") ?? ""));
  if (invalid) return { error: invalid };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    if (error.code === "reauthentication_needed") {
      return { error: "Demi keamanan, keluar lalu masuk lagi pakai kode email, kemudian ganti kata sandi di sini." };
    }
    return { error: passwordErrorMessage(error.code) ?? "Kata sandi gagal disimpan. Coba lagi sebentar lagi." };
  }
  return { success: "Kata sandi tersimpan. Lain kali kamu bisa masuk dengan email dan kata sandi ini." };
}
