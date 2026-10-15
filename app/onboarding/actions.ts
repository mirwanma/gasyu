"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { OUTSIDE_CIMAHI } from "./constants";

export type OnboardingState = { error?: string };

// Kode error dari fungsi database complete_onboarding → pesan untuk warga.
const ERROR_MESSAGES: Record<string, string> = {
  invalid_nickname: "Nama panggilan harus 3–20 karakter.",
  invalid_full_name: "Nama lengkap belum diisi.",
  invalid_village: "Kelurahan tidak ditemukan. Pilih lagi dari daftar, ya.",
  nickname_taken: "Nama panggilan ini sudah dipakai. Coba yang lain.",
  already_onboarded: "Profil kamu sudah lengkap.",
  account_inactive: "Akun ini sedang tidak aktif. Hubungi tim Ramein.",
  not_authenticated: "Sesi kamu habis. Masuk lagi, ya.",
};

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const village = String(formData.get("village") ?? "");
  const next = safeNext(formData.get("next"));

  if (formData.get("terms") !== "on") {
    return { error: "Setujui syarat & ketentuan dan kebijakan privasi dulu, ya." };
  }
  if (!village) {
    return { error: "Pilih kelurahan asal kamu, atau Luar Cimahi." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_nickname: nickname,
    p_full_name: fullName,
    p_village_id: village === OUTSIDE_CIMAHI ? null : village,
  });

  if (error) {
    if (error.message === "already_onboarded") redirect(next);
    return { error: ERROR_MESSAGES[error.message] ?? "Profil belum tersimpan. Coba lagi, ya." };
  }

  redirect(next);
}
