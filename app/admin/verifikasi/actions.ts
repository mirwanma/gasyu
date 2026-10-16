"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function reviewOrganizer(formData: FormData) {
  const organizerId = String(formData.get("organizer_id"));
  const approve = formData.get("decision") === "approve";
  const note = String(formData.get("note") ?? "").trim();

  if (!approve && !note) {
    redirect(`/admin/verifikasi?pilih=${organizerId}&hasil=catatan`);
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("review_organizer", { p_organizer_id: organizerId, p_approve: approve, p_note: note || null });
  revalidatePath("/admin", "layout");
  redirect(`/admin/verifikasi?hasil=${error ? "gagal" : "ok"}`);
}
