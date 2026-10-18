"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/masuk");
}

// Keluar dari semua perangkat (ALUR bagian 3): mencabut semua sesi akun ini, misalnya saat HP hilang.
export async function signOutEverywhere(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut({ scope: "global" });
  // Jika gagal, sesi lain masih aktif: jangan tampilkan pesan berhasil.
  if (error) return { error: "Belum berhasil keluar dari semua perangkat. Periksa koneksi lalu coba lagi." };
  redirect("/masuk?akun=keluar-semua");
}

export async function markNotificationsRead() {
  const supabase = await createClient();
  await supabase.rpc("mark_notifications_read");
  revalidatePath("/notifikasi");
}
