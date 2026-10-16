"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function acceptInvite(formData: FormData) {
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data: organizerId, error } = await supabase.rpc("accept_organizer_invite", { p_token: token });

  if (error) {
    const code = error.message === "already_member" ? "member" : "invalid";
    redirect(`/undangan/${encodeURIComponent(token)}?error=${code}`);
  }

  const { data: org } = await supabase.from("organizers").select("type").eq("id", organizerId).maybeSingle();
  redirect(`/${org?.type === "merchant" ? "merchant" : "komunitas"}/${organizerId}`);
}
