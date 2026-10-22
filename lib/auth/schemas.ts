import { z } from "zod";
import { PASSWORD_MAX, PASSWORD_MIN } from "@/lib/password";

// Skema isian halaman masuk dan daftar. Dipakai di server action; pesan
// error-nya langsung ditampilkan ke warga, jadi tulis dengan bahasa ramah.

const email = z
  .string({ error: "Email belum diisi." })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Format email belum benar. Coba cek lagi, ya." }).max(320, "Email terlalu panjang."));

// Kode 6 angka dari email; spasi hasil tempel diabaikan.
const otp = z
  .string({ error: "Kodenya 6 angka. Cek lagi email kamu, ya." })
  .transform((value) => value.replace(/\s/g, ""))
  .pipe(z.string().regex(/^\d{6}$/, "Kodenya 6 angka. Cek lagi email kamu, ya."));

export const emailSchema = z.object({ email });

export const otpSchema = z.object({ email, token: otp });

export const loginSchema = z.object({
  email,
  password: z.string({ error: "Kata sandi belum diisi." }).min(1, "Kata sandi belum diisi."),
});

// Batas nama lengkap sama dengan complete_onboarding di database (1–100 karakter).
export const signupSchema = z.object({
  full_name: z
    .string({ error: "Nama lengkap belum diisi." })
    .trim()
    .min(1, "Nama lengkap belum diisi.")
    .max(100, "Nama lengkap maksimal 100 karakter."),
  email,
  password: z
    .string({ error: "Kata sandi belum diisi." })
    .min(PASSWORD_MIN, `Kata sandi minimal ${PASSWORD_MIN} karakter.`)
    .max(PASSWORD_MAX, `Kata sandi maksimal ${PASSWORD_MAX} karakter.`),
});

// Membaca FormData dengan skema; mengembalikan data bersih atau pesan error pertama.
export function parseForm<T extends z.ZodType>(
  schema: T,
  formData: FormData,
): { ok: true; data: z.output<T> } | { ok: false; error: string } {
  const result = schema.safeParse(Object.fromEntries(formData));
  if (result.success) return { ok: true, data: result.data };
  return { ok: false, error: result.error.issues[0]?.message ?? "Isian belum benar." };
}
