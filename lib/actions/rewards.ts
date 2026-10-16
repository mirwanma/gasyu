"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadOrganizerFile } from "@/lib/storage";

export type RewardActionState = { error?: string; success?: string; code?: string; title?: string; expiresAt?: string };

const ERRORS: Record<string, string> = {
  not_allowed: "Kamu tidak punya akses untuk ini.",
  invalid_reward: "Cek isian reward: judul 3–80 karakter, harga poin > 0, stok ≥ 0.",
  reward_unavailable: "Reward ini sedang tidak tersedia.",
  out_of_stock: "Stok reward habis.",
  insufficient_points: "Poin kamu belum cukup.",
  invalid_code: "Kode voucher tidak ditemukan.",
  voucher_unavailable: "Voucher sudah dipakai, kedaluwarsa, atau di-refund.",
  invalid_outlet: "Pilih outlet yang valid.",
  activity_locked: "Poin tidak bisa diubah setelah aktivitas berjalan.",
  invalid_points: "Poin per penyelesaian harus 0–10.000.",
  invalid_budget: "Budget poin tidak valid.",
  budget_below_used: "Budget tidak boleh lebih kecil dari yang sudah terpakai.",
  points_budget_requires_merchant: "Hanya merchant yang punya budget poin.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};
const msg = (code: string | undefined, fallback: string) => ERRORS[code ?? ""] ?? fallback;

// ---- Merchant: reward ------------------------------------------------------

export async function saveReward(_prev: RewardActionState, formData: FormData): Promise<RewardActionState> {
  const organizerId = String(formData.get("organizer_id"));
  const rewardId = String(formData.get("reward_id") ?? "") || null;
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const supabase = await createClient();
  const data: Record<string, unknown> = {
    title: text("title"),
    description: text("description"),
    price_points: text("price_points"),
    stock: text("stock"),
    valid_days: text("valid_days") || "30",
    available_until: text("available_until") ? `${text("available_until")}T23:59:59+07:00` : "",
    status: text("status") || "active",
  };
  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 2 * 1024 * 1024) return { error: "Gambar terlalu besar, maksimal 2 MB." };
    const url = await uploadOrganizerFile(supabase, "logos", organizerId, `reward-${Date.now()}`, image);
    if (!url) return { error: "Gambar belum terunggah. Pakai PNG, JPG, atau WebP." };
    data.image_url = url;
  }
  const { error } = await supabase.rpc("upsert_reward", { p_organizer_id: organizerId, p_reward_id: rewardId, p_data: data });
  if (error) return { error: msg(error.message, "Reward belum tersimpan.") };
  revalidatePath(`/merchant/${organizerId}/reward`);
  revalidatePath("/dompet");
  return { success: rewardId ? "Reward diperbarui." : "Reward ditambahkan." };
}

export async function setRewardStatus(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const supabase = await createClient();
  await supabase.rpc("upsert_reward", { p_organizer_id: organizerId, p_reward_id: String(formData.get("reward_id")), p_data: { status: String(formData.get("status")) } });
  revalidatePath(`/merchant/${organizerId}/reward`);
  revalidatePath("/dompet");
}

export async function refundRedemption(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const supabase = await createClient();
  await supabase.rpc("refund_redemption", { p_redemption_id: String(formData.get("redemption_id")) });
  revalidatePath(`/merchant/${organizerId}/reward`);
}

// ---- Merchant: poin aktivitas ---------------------------------------------

export async function saveActivityPoints(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const activityId = String(formData.get("activity_id"));
  const partnerId = String(formData.get("partner_id"));
  const supabase = await createClient();
  const points = Number(formData.get("points_per_completion") ?? 0);
  const budget = Number(formData.get("points_budget") ?? 0);
  const path = `/merchant/${organizerId}/aktivitas/${activityId}`;
  const { error: e1 } = await supabase.rpc("set_points_per_completion", { p_activity_id: activityId, p_points: points });
  if (e1) redirect(`${path}?error=${encodeURIComponent(msg(e1.message, "Poin belum tersimpan."))}`);
  const { error: e2 } = await supabase.rpc("set_partner_budget", { p_partner_id: partnerId, p_budget: budget });
  if (e2) redirect(`${path}?error=${encodeURIComponent(msg(e2.message, "Budget belum tersimpan."))}`);
  revalidatePath(path);
  redirect(`${path}?hasil=poin`);
}

// ---- Merchant: kasir ------------------------------------------------------

export type VoucherLookup = {
  redemption_id: string;
  code: string;
  title: string;
  description: string | null;
  nickname: string;
  status: string;
  expires_at: string;
  used_at: string | null;
  valid: boolean;
};
export type KasirState = { error?: string; success?: string; voucher?: VoucherLookup };

export async function lookupVoucher(_prev: KasirState, formData: FormData): Promise<KasirState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lookup_voucher", { p_organizer_id: String(formData.get("organizer_id")), p_code: String(formData.get("code") ?? "") });
  if (error) return { error: msg(error.message, "Voucher belum bisa dicek.") };
  return { voucher: data as VoucherLookup };
}

export async function useVoucher(_prev: KasirState, formData: FormData): Promise<KasirState> {
  const organizerId = String(formData.get("organizer_id"));
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("use_voucher", { p_code: String(formData.get("code") ?? ""), p_outlet_id: String(formData.get("outlet_id")) });
  if (error) return { error: msg(error.message, "Voucher belum bisa dipakai.") };
  revalidatePath(`/merchant/${organizerId}/kasir`);
  const d = data as { title: string; nickname: string };
  return { success: `Voucher "${d.title}" milik ${d.nickname} dipakai.` };
}

// ---- Warga -----------------------------------------------------------------

export async function redeemReward(_prev: RewardActionState, formData: FormData): Promise<RewardActionState> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("redeem_reward", { p_reward_id: String(formData.get("reward_id")) });
  if (error) return { error: msg(error.message, "Belum bisa menukar poin.") };
  revalidatePath("/dompet");
  revalidatePath("/");
  const d = data as { code: string; title: string; expires_at: string };
  return { success: "Voucher berhasil ditukar.", code: d.code, title: d.title, expiresAt: d.expires_at };
}
