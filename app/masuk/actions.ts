"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { checkNewPassword, passwordErrorMessage } from "@/lib/password";
import { safeNext } from "@/lib/safe-next";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
  sentAt?: number; // waktu kode terakhir dikirim, untuk mengulang hitung mundur
};

export type PasswordLoginState = {
  email?: string;
  error?: string;
  unconfirmed?: boolean; // akun sudah daftar tapi kodenya belum dimasukkan
};

export type SignupState = {
  step: "form" | "confirm" | "code"; // confirm: akun ada, tinggal kirim kode konfirmasi
  email?: string;
  error?: string;
  sentAt?: number;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const ALREADY_REGISTERED =
  "Email ini sudah terdaftar. Masuk saja, atau pakai Lupa kata sandi kalau belum pernah membuat kata sandi.";

const readEmail = (formData: FormData) => String(formData.get("email") ?? "").trim().toLowerCase();
const readToken = (formData: FormData) => String(formData.get("token") ?? "").replace(/\s/g, "");

// Langkah 1 dan 2 login email: kirim kode OTP, lalu cocokkan kode.
// mode=reset (halaman Lupa kata sandi) tidak membuat akun baru.
export async function loginWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");
  const email = readEmail(formData);
  const next = safeNext(formData.get("next"));
  const isReset = formData.get("mode") === "reset";
  const supabase = await createClient();

  if (!EMAIL_PATTERN.test(email)) {
    return { step: "email", error: "Format email belum benar. Coba cek lagi, ya." };
  }

  if (intent === "send") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: !isReset },
    });
    if (error) {
      const message =
        isReset && error.code === "otp_disabled"
          ? "Email ini belum terdaftar di Gasyu. Daftar dulu, ya."
          : friendlyAuthError(error.status);
      return { step: "email", email, error: message };
    }
    return { step: "code", email, sentAt: Date.now() };
  }

  const sentAt = Number(formData.get("sent_at")) || undefined;
  const token = readToken(formData);
  if (!/^\d{6}$/.test(token)) {
    return { step: "code", email, sentAt, error: "Kodenya 6 angka. Cek lagi email kamu, ya." };
  }

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    const message =
      error.status === 429
        ? friendlyAuthError(429)
        : "Kode salah atau sudah kedaluwarsa. Coba lagi, atau minta kode baru.";
    return { step: "code", email, sentAt, error: message };
  }

  // Proxy akan mengarahkan ke onboarding jika profil belum lengkap.
  redirect(next);
}

// Masuk dengan email + kata sandi.
export async function loginWithPassword(
  _prev: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  const email = readEmail(formData);
  const password = String(formData.get("password") ?? "");
  const next = safeNext(formData.get("next"));

  if (!EMAIL_PATTERN.test(email)) {
    return { email, error: "Format email belum benar. Coba cek lagi, ya." };
  }
  if (!password) return { email, error: "Kata sandi belum diisi." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    if (error.code === "email_not_confirmed") {
      return {
        email,
        unconfirmed: true,
        error: "Email ini belum dikonfirmasi. Masukkan kode 6 angka yang kami kirim saat daftar.",
      };
    }
    if (error.status === 429) return { email, error: friendlyAuthError(429) };
    if (error.code === "invalid_credentials") {
      return {
        email,
        error:
          "Email atau kata sandi salah. Kalau dulu kamu masuk pakai kode email atau Google, buat kata sandi lewat Lupa kata sandi.",
      };
    }
    return { email, error: "Lagi ada gangguan saat masuk. Coba lagi sebentar lagi, ya." };
  }

  // Proxy akan mengarahkan ke onboarding jika profil belum lengkap.
  redirect(next);
}

// Daftar akun baru dengan email + kata sandi, lalu konfirmasi email dengan kode 6 angka.
// intent: signup (buat akun), resend (kirim ulang kode), verify (cocokkan kode).
export async function signUpWithPassword(prev: SignupState, formData: FormData): Promise<SignupState> {
  const intent = formData.get("intent");
  const email = readEmail(formData);
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  if (!EMAIL_PATTERN.test(email)) {
    return { step: "form", error: "Format email belum benar. Coba cek lagi, ya." };
  }

  if (intent === "signup") {
    const password = String(formData.get("password") ?? "");
    const invalid = checkNewPassword(password, String(formData.get("password_confirm") ?? ""));
    if (invalid) return { step: "form", email, error: invalid };

    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      if (error.code === "user_already_exists") return { step: "form", email, error: ALREADY_REGISTERED };
      const message = passwordErrorMessage(error.code) ?? friendlyAuthError(error.status);
      return { step: "form", email, error: message };
    }
    // Supabase tidak memberi tahu langsung bahwa email sudah dipakai; tandanya identities kosong.
    if (data.user && data.user.identities?.length === 0) {
      return { step: "form", email, error: ALREADY_REGISTERED };
    }
    // Jika "Confirm email" dimatikan di Supabase, sesi langsung jadi.
    if (data.session) redirect(next);
    return { step: "code", email, sentAt: Date.now() };
  }

  if (intent === "resend") {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      const step = prev.step === "code" ? "code" : "confirm";
      return { step, email, sentAt: prev.sentAt, error: friendlyAuthError(error.status) };
    }
    return { step: "code", email, sentAt: Date.now() };
  }

  const sentAt = Number(formData.get("sent_at")) || undefined;
  const token = readToken(formData);
  if (!/^\d{6}$/.test(token)) {
    return { step: "code", email, sentAt, error: "Kodenya 6 angka. Cek lagi email kamu, ya." };
  }

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    const message =
      error.status === 429
        ? friendlyAuthError(429)
        : "Kode salah atau sudah kedaluwarsa. Coba lagi, atau minta kode baru.";
    return { step: "code", email, sentAt, error: message };
  }

  // Akun baru selalu belum onboarding, jadi proxy akan membawanya ke onboarding dulu.
  redirect(next);
}

export async function loginWithGoogle(formData: FormData) {
  const next = safeNext(formData.get("next"));
  const origin = (await headers()).get("origin") ?? "";
  const supabase = await createClient();

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}` },
  });

  if (error || !data.url) {
    redirect(`/masuk?next=${encodeURIComponent(next)}&error=google`);
  }
  redirect(data.url);
}

function friendlyAuthError(status?: number) {
  if (status === 429) return "Terlalu banyak percobaan. Tunggu 15 menit, lalu coba lagi.";
  return "Lagi ada gangguan saat mengirim kode. Coba lagi sebentar lagi, ya.";
}
