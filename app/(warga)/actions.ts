"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/notifikasi");
}
