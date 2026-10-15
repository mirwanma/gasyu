"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export type LoginState = {
  step: "email" | "code";
  email?: string;
  error?: string;
  sentAt?: number; // waktu kode terakhir dikirim, untuk mengulang hitung mundur
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Langkah 1 dan 2 login email: kirim kode OTP, lalu cocokkan kode.
export async function loginWithEmail(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const intent = formData.get("intent");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeNext(formData.get("next"));
  const supabase = await createClient();

  if (!EMAIL_PATTERN.test(email)) {
    return { step: "email", error: "Format email belum benar. Coba cek lagi, ya." };
  }

  if (intent === "send") {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { shouldCreateUser: true },
    });
    if (error) {
      return { step: "email", email, error: friendlyAuthError(error.status) };
    }
    return { step: "code", email, sentAt: Date.now() };
  }

  const sentAt = Number(formData.get("sent_at")) || undefined;
  const token = String(formData.get("token") ?? "").replace(/\s/g, "");
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
