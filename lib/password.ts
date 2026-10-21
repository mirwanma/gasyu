// Aturan kata sandi akun Gasyu. Penyimpanan dan pengecekan kata sandi dilakukan
// Supabase Auth; di sini hanya cek awal supaya pesannya ramah.
// Samakan dengan Supabase → Authentication → Providers → Email → Minimum password length.
export const PASSWORD_MIN = 8;
// Batas bcrypt di Supabase Auth.
export const PASSWORD_MAX = 72;

// Mengembalikan pesan error, atau undefined jika kata sandi boleh dipakai.
export function checkNewPassword(password: string, confirm: string): string | undefined {
  if (password.length < PASSWORD_MIN) return `Kata sandi minimal ${PASSWORD_MIN} karakter.`;
  if (password.length > PASSWORD_MAX) return `Kata sandi maksimal ${PASSWORD_MAX} karakter.`;
  if (password !== confirm) return "Kedua kata sandi belum sama. Coba ketik ulang.";
  return undefined;
}

// Pesan untuk error kata sandi dari Supabase Auth (kode error ada di `error.code`).
export function passwordErrorMessage(code: string | undefined): string | undefined {
  if (code === "weak_password") {
    return "Kata sandi ini terlalu mudah ditebak atau pernah bocor di situs lain. Pakai kata sandi lain, ya.";
  }
  if (code === "same_password") return "Kata sandi baru harus beda dari yang lama.";
  return undefined;
}
