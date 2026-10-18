"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { uploadOrganizerFile } from "@/lib/storage";
import type { Json } from "@/lib/supabase/types";

// Aksi admin Event Global: hadiah per peringkat dan pengiriman hadiah (ALUR bagian 22d).
export type PrizeActionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  not_allowed: "Kamu tidak punya akses untuk ini.",
  invalid_prize: "Data hadiah belum lengkap. Cek judul (3–100 karakter), rentang peringkat, dan skor minimal.",
  invalid_prize_rank: "Rentang peringkat tidak valid (maksimal sampai peringkat 100).",
  prize_rank_overlap: "Rentang peringkat ini bertumpuk dengan hadiah lain.",
  prize_locked_after_publish: "Hadiah yang sudah ada terkunci setelah terbit. Hanya deskripsi dan gambar yang bisa diubah; hadiah baru tetap bisa ditambah.",
  prize_requires_global: "Hadiah per peringkat hanya untuk Event Global.",
  prize_sponsor_not_partner: "Penyedia hadiah harus partner yang sudah bergabung di event ini.",
  invalid_prize_badge: "Pilih atau buat badge untuk hadiah badge.",
  invalid_badge: "Nama badge 3–60 karakter dan deskripsinya 3–200 karakter.",
  activity_locked: "Event ini sudah ditutup.",
  prize_not_claimed: "Hadiah ini belum diklaim pemenang atau sudah diproses.",
  prize_not_forfeitable: "Hadiah ini sudah terkirim atau sudah hangus.",
  note_required: "Tulis alasan hadiah dinyatakan hangus.",
};

// Kode yang paling panjang dicocokkan dulu, supaya "invalid_prize_rank" tidak terbaca sebagai "invalid_prize".
const msg = (code: string | undefined, fallback: string) => {
  const key = Object.keys(ERRORS)
    .sort((a, b) => b.length - a.length)
    .find((k) => (code ?? "").includes(k));
  return key ? ERRORS[key] : fallback;
};
const hadiahPath = (aid: string) => `/admin/aktivitas/hadiah?aid=${aid}`;
const peringkatPath = (aid: string) => `/admin/aktivitas/peringkat?aid=${aid}`;

export async function savePrize(_prev: PrizeActionState, formData: FormData): Promise<PrizeActionState> {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const activityId = text("activity_id");
  const prizeId = text("prize_id") || null;
  const locked = text("locked") === "1";
  const supabase = await createClient();

  const prize: Record<string, unknown> = { id: prizeId, description: text("description") };
  if (!locked) {
    const kind = text("kind");
    let badgeId = text("badge_id") || null;
    if (kind === "badge" && badgeId === "baru") {
      const { data, error } = await supabase.rpc("create_prize_badge", { p_name: text("badge_name"), p_description: text("badge_description") });
      if (error || !data) return { error: msg(error?.message, "Badge belum tersimpan.") };
      badgeId = data as string;
    }
    Object.assign(prize, {
      rank_from: text("rank_from"),
      rank_to: text("rank_to") || text("rank_from"),
      title: text("title"),
      kind,
      fulfillment: kind === "badge" ? "digital" : text("fulfillment"),
      badge_id: kind === "badge" ? badgeId : null,
      sponsor_organizer_id: text("sponsor_organizer_id") || null,
      pickup_note: text("fulfillment") === "pickup" && kind !== "badge" ? text("pickup_note") : null,
      min_score: text("min_score") || "1",
    });
  }

  const { data: savedId, error } = await supabase.rpc("upsert_activity_prize", { p_activity_id: activityId, p_prize: prize as Json });
  if (error || !savedId) return { error: msg(error?.message, "Hadiah belum tersimpan.") };

  const image = formData.get("image");
  if (image instanceof File && image.size > 0) {
    if (image.size > 3 * 1024 * 1024) return { error: "Hadiah tersimpan, tetapi gambar lebih dari 3 MB sehingga tidak diunggah." };
    const url = await uploadOrganizerFile(supabase, "covers", activityId, `prize-${savedId}`, image);
    if (!url) return { error: "Hadiah tersimpan, tetapi gambar gagal diunggah (pakai PNG, JPG, atau WebP)." };
    await supabase.rpc("upsert_activity_prize", { p_activity_id: activityId, p_prize: { id: savedId as string, image_url: url } });
  }
  revalidatePath("/admin/aktivitas", "layout");
  redirect(`${hadiahPath(activityId)}&hasil=simpan`);
}

export async function removePrize(formData: FormData) {
  const activityId = String(formData.get("activity_id"));
  const supabase = await createClient();
  const { error } = await supabase.rpc("remove_activity_prize", { p_prize_id: String(formData.get("prize_id")) });
  revalidatePath("/admin/aktivitas", "layout");
  redirect(`${hadiahPath(activityId)}${error ? `&error=${encodeURIComponent(msg(error.message, "Hadiah belum terhapus."))}` : "&hasil=hapus"}`);
}

export async function markPrizeDelivered(formData: FormData) {
  const activityId = String(formData.get("activity_id"));
  const note = String(formData.get("note") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_prize_delivered", { p_winner_id: String(formData.get("winner_id")), p_note: note || undefined });
  revalidatePath("/admin", "layout");
  redirect(`${peringkatPath(activityId)}${error ? `&error=${encodeURIComponent(msg(error.message, "Status belum tersimpan."))}` : "&hasil=terkirim"}`);
}

export async function forfeitPrize(formData: FormData) {
  const activityId = String(formData.get("activity_id"));
  const reason = String(formData.get("reason") ?? "").trim();
  const supabase = await createClient();
  const { error } = await supabase.rpc("forfeit_prize", { p_winner_id: String(formData.get("winner_id")), p_reason: reason });
  revalidatePath("/admin", "layout");
  redirect(`${peringkatPath(activityId)}${error ? `&error=${encodeURIComponent(msg(error.message, "Status belum tersimpan."))}` : "&hasil=hangus"}`);
}
