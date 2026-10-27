"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

// `step` = langkah formulir yang perlu dibuka lagi untuk memperbaiki error.
export type OnboardingState = { error?: string; step?: 1 | 2 | 3 };

// Kode error dari fungsi database complete_onboarding → pesan dan langkah formulir.
const ERRORS: Record<string, { message: string; step: 1 | 2 | 3 }> = {
  invalid_nickname: { message: "Nama panggilan harus 3–20 karakter.", step: 1 },
  nickname_taken: { message: "Nama panggilan ini sudah dipakai. Coba yang lain.", step: 1 },
  invalid_full_name: { message: "Nama lengkap belum diisi.", step: 1 },
  invalid_district: { message: "Kecamatan tidak ditemukan. Pilih lagi, ya.", step: 2 },
  account_inactive: { message: "Akun ini sedang tidak aktif. Hubungi tim Gasyu.", step: 3 },
  not_authenticated: { message: "Sesi kamu habis. Masuk lagi, ya.", step: 3 },
};

export async function completeOnboarding(
  _prev: OnboardingState,
  formData: FormData,
): Promise<OnboardingState> {
  const nickname = String(formData.get("nickname") ?? "").trim();
  const fullName = String(formData.get("full_name") ?? "").trim();
  const district = String(formData.get("district") ?? "");
  const next = safeNext(formData.get("next"));

  if (!district) {
    return { error: "Pilih kota dan kecamatan tempat tinggalmu.", step: 2 };
  }
  if (formData.get("terms") !== "on") {
    return { error: "Setujui syarat & ketentuan dan kebijakan privasi dulu, ya.", step: 3 };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("complete_onboarding", {
    p_nickname: nickname,
    p_full_name: fullName,
    p_district_id: district,
  });

  if (error) {
    if (error.message === "already_onboarded") redirect(next);
    const known = ERRORS[error.message];
    return known
      ? { error: known.message, step: known.step }
      : { error: "Profil belum tersimpan. Coba lagi, ya.", step: 3 };
  }

  redirect(next);
}
