"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  clearLoginFailures,
  loginWaitSeconds,
  recordLoginFailure,
  tooManyAttemptsMessage,
} from "@/lib/auth/rate-limit";
import { emailSchema, loginSchema, otpSchema, parseForm, signupSchema } from "@/lib/auth/schemas";
import { passwordErrorMessage } from "@/lib/password";
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
  fullName?: string;
  error?: string;
  sentAt?: number;
};

const ALREADY_REGISTERED =
  "Email ini sudah terdaftar. Masuk saja, atau pakai Lupa kata sandi kalau belum pernah membuat kata sandi.";

// Email untuk mengisi ulang form saat ada error (belum tentu formatnya benar).
const readEmail = (formData: FormData) => String(formData.get("email") ?? "").trim().toLowerCase();

type Client = Awaited<ReturnType<typeof createClient>>;

// Cocokkan kode 6 angka dari email. Kode salah dihitung ke pembatas per email.
// Mengembalikan pesan error, atau undefined jika berhasil (sesi sudah dibuat).
async function verifyEmailCode(supabase: Client, formData: FormData): Promise<string | undefined> {
  const parsed = parseForm(otpSchema, formData);
  if (!parsed.ok) return parsed.error;
  const { email, token } = parsed.data;

  const wait = await loginWaitSeconds(supabase, email);
  if (wait > 0) return tooManyAttemptsMessage(wait);

  const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
  if (error) {
    if (error.status === 429) return friendlyAuthError(429);
    const lockedFor = await recordLoginFailure(supabase, email);
    if (lockedFor > 0) return tooManyAttemptsMessage(lockedFor);
    return "Kode salah atau sudah kedaluwarsa. Coba lagi, atau minta kode baru.";
  }
  await clearLoginFailures(supabase);
  return undefined;
}

// Langkah 1 dan 2 login email: kirim kode OTP, lalu cocokkan kode.
// mode=reset (halaman Lupa kata sandi) tidak membuat akun baru.
export async function loginWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");
  const next = safeNext(formData.get("next"));
  const isReset = formData.get("mode") === "reset";
  const supabase = await createClient();

  const parsed = parseForm(emailSchema, formData);
  if (!parsed.ok) return { step: "email", email: readEmail(formData), error: parsed.error };
  const { email } = parsed.data;

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
  const error = await verifyEmailCode(supabase, formData);
  if (error) return { step: "code", email, sentAt, error };

  // Proxy akan mengarahkan ke onboarding jika profil belum lengkap.
  redirect(next);
}

// Masuk dengan email + kata sandi.
export async function loginWithPassword(
  _prev: PasswordLoginState,
  formData: FormData,
): Promise<PasswordLoginState> {
  const next = safeNext(formData.get("next"));
  const parsed = parseForm(loginSchema, formData);
  if (!parsed.ok) return { email: readEmail(formData), error: parsed.error };
  const { email, password } = parsed.data;

  const supabase = await createClient();
  const wait = await loginWaitSeconds(supabase, email);
  if (wait > 0) return { email, error: tooManyAttemptsMessage(wait) };

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
      const lockedFor = await recordLoginFailure(supabase, email);
      if (lockedFor > 0) return { email, error: tooManyAttemptsMessage(lockedFor) };
      return {
        email,
        error:
          "Email atau kata sandi salah. Kalau dulu kamu masuk pakai kode email atau Google, buat kata sandi lewat Lupa kata sandi.",
      };
    }
    return { email, error: "Lagi ada gangguan saat masuk. Coba lagi sebentar lagi, ya." };
  }

  await clearLoginFailures(supabase);
  // Proxy akan mengarahkan ke onboarding jika profil belum lengkap.
  redirect(next);
}

// Daftar akun baru dengan nama lengkap, email, dan kata sandi, lalu konfirmasi
// email dengan kode 6 angka.
// intent: signup (buat akun), resend (kirim ulang kode), verify (cocokkan kode).
export async function signUpWithPassword(prev: SignupState, formData: FormData): Promise<SignupState> {
  const intent = formData.get("intent");
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  if (intent === "signup") {
    const parsed = parseForm(signupSchema, formData);
    if (!parsed.ok) {
      return {
        step: "form",
        email: readEmail(formData),
        fullName: String(formData.get("full_name") ?? ""),
        error: parsed.error,
      };
    }
    const { email, password, full_name: fullName } = parsed.data;

    // Nama lengkap disimpan di metadata akun, lalu mengisi otomatis form onboarding.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) {
      if (error.code === "user_already_exists") return { step: "form", email, fullName, error: ALREADY_REGISTERED };
      const message = passwordErrorMessage(error.code) ?? friendlyAuthError(error.status);
      return { step: "form", email, fullName, error: message };
    }
    // Supabase tidak memberi tahu langsung bahwa email sudah dipakai; tandanya identities kosong.
    if (data.user && data.user.identities?.length === 0) {
      return { step: "form", email, fullName, error: ALREADY_REGISTERED };
    }
    // Jika "Confirm email" dimatikan di Supabase, sesi langsung jadi.
    if (data.session) redirect(next);
    return { step: "code", email, sentAt: Date.now() };
  }

  const parsed = parseForm(emailSchema, formData);
  if (!parsed.ok) return { step: "form", error: parsed.error };
  const { email } = parsed.data;

  if (intent === "resend") {
    const { error } = await supabase.auth.resend({ type: "signup", email });
    if (error) {
      const step = prev.step === "code" ? "code" : "confirm";
      return { step, email, sentAt: prev.sentAt, error: friendlyAuthError(error.status) };
    }
    return { step: "code", email, sentAt: Date.now() };
  }

  const sentAt = Number(formData.get("sent_at")) || undefined;
  const error = await verifyEmailCode(supabase, formData);
  if (error) return { step: "code", email, sentAt, error };

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
