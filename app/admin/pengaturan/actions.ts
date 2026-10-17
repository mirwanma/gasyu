"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";

export async function updateSetting(formData: FormData) {
  const key = String(formData.get("key"));
  const raw = String(formData.get("value") ?? "").trim();
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    redirect("/admin/pengaturan?hasil=gagal");
  }
  const supabase = await createClient();
  const { error } = await supabase.from("app_settings").update({ value: value as Json }).eq("key", key);
  revalidatePath("/admin/pengaturan");
  redirect(`/admin/pengaturan?hasil=${error ? "gagal" : "ok"}`);
}
