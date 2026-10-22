import type { createClient } from "@/lib/supabase/server";

// Pembatas percobaan masuk per email (migrasi 0027). Angka batasnya ada di
// app_settings: auth.login_max_failures dan auth.login_window_minutes.

type Client = Awaited<ReturnType<typeof createClient>>;

// Sisa detik tunggu untuk email ini; 0 berarti boleh mencoba.
// Jika pemeriksaan gagal (misalnya database sibuk), login tetap dilanjutkan:
// batas bawaan Supabase Auth masih berlaku sebagai lapisan kedua.
export async function loginWaitSeconds(supabase: Client, email: string) {
  const { data, error } = await supabase.rpc("auth_login_wait_seconds", { p_email: email });
  return error ? 0 : (data ?? 0);
}

// Catat satu kali gagal; mengembalikan sisa detik tunggu jika email sekarang terkunci.
export async function recordLoginFailure(supabase: Client, email: string) {
  const { data, error } = await supabase.rpc("auth_login_failed", { p_email: email });
  return error ? 0 : (data ?? 0);
}

// Setelah berhasil masuk: hapus hitungan gagal untuk akun yang baru masuk.
export async function clearLoginFailures(supabase: Client) {
  await supabase.rpc("auth_login_succeeded");
}

export function tooManyAttemptsMessage(seconds: number) {
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return `Terlalu banyak percobaan untuk email ini. Tunggu ${minutes} menit, lalu coba lagi.`;
}
