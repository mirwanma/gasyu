"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export type JoinState = { error?: string };

const ERRORS: Record<string, string> = {
  already_requested: "Kamu sudah mengajukan permintaan atau sudah jadi member.",
  rejoin_cooldown: "Kamu baru bisa meminta bergabung lagi 30 hari setelah ditolak atau dikeluarkan.",
  community_unavailable: "Komunitas ini belum bisa menerima member.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};

export async function requestMembership(_prev: JoinState, formData: FormData): Promise<JoinState> {
  const communityId = String(formData.get("community_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const message = String(formData.get("message") ?? "").trim();

  const supabase = await createClient();
  const { error } = await supabase.rpc("request_membership", {
    p_community_id: communityId,
    p_message: message || null,
  });
  if (error) {
    return { error: ERRORS[error.message] ?? "Permintaan belum terkirim. Coba lagi, ya." };
  }

  revalidatePath(`/k/${slug}`);
  revalidatePath("/profil");
  return {};
}

export async function leaveCommunity(formData: FormData) {
  const communityId = String(formData.get("community_id") ?? "");
  const slug = String(formData.get("slug") ?? "");
  const supabase = await createClient();
  await supabase.rpc("leave_community", { p_community_id: communityId });
  revalidatePath(`/k/${slug}`);
  revalidatePath("/profil");
}
