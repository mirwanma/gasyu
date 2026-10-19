"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

// Warga mengklaim hadiah Event Global (ALUR bagian 22d). Aturan klaim ditegakkan di claim_prize.
export type ClaimState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  invalid_winner: "Hadiah ini tidak ditemukan di akunmu.",
  prize_not_claimable: "Hadiah ini sudah diklaim atau sudah tidak berlaku.",
  claim_expired: "Batas waktu klaim sudah lewat.",
  invalid_shipping: "Lengkapi nama penerima, nomor HP (contoh 0812…), dan alamat lengkap minimal 10 karakter.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};

export async function claimPrize(_prev: ClaimState, formData: FormData): Promise<ClaimState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const shipping = formData.has("ship_address") ? { name: text("ship_name"), phone: text("ship_phone"), address: text("ship_address") } : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("claim_prize", { p_winner_id: text("winner_id"), p_shipping: shipping ?? undefined });
  if (error) return { error: ERRORS[error.message] ?? "Klaim belum berhasil. Coba lagi." };
  revalidatePath("/hadiah");
  revalidatePath("/");
  return { success: shipping ? "Hadiah diklaim. Panitia Gasyu akan mengirimnya ke alamatmu." : "Hadiah diklaim. Ikuti petunjuk pengambilan di bawah." };
}
