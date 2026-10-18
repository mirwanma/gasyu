import "server-only";
import { createClient } from "@/lib/supabase/server";

// Data pembayaran (irisan 11). Angka dari view yang sudah difilter tim host/admin di database.

export type PaymentStats = {
  activity_id: string;
  host_organizer_id: string;
  title: string;
  status: string;
  price_idr: number | null;
  unpaid: number;
  awaiting_confirmation: number;
  paid: number;
  refunded: number;
  refund_due: number;
  expected_idr: number;
};

export async function getPaymentStats(activityId: string): Promise<PaymentStats | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_activity_payment_stats").select("*").eq("activity_id", activityId).maybeSingle();
  return (data as PaymentStats | null) ?? null;
}

export type RefundQueueRow = {
  activity_id: string;
  title: string;
  activity_status: string;
  price_idr: number | null;
  cancelled_at: string;
  host_organizer_id: string;
  host_name: string;
  host_type: "merchant" | "community" | "platform";
  host_whatsapp: string | null;
  refund_due: number;
  refunded: number;
  oldest_due_at: string | null;
};

// Antrean refund untuk admin: aktivitas yang masih punya peserta lunas belum di-refund.
export async function listRefundQueue(): Promise<RefundQueueRow[]> {
  const supabase = await createClient();
  const { data } = await supabase.from("v_admin_refund_queue").select("*").order("oldest_due_at", { ascending: true });
  return (data ?? []) as RefundQueueRow[];
}

// Instruksi bayar untuk warga yang sudah mendaftar (kolom activities terbaca semua pengguna masuk).
export async function getPaymentInstructions(activityId: string): Promise<{ payment_instructions: string | null; payment_window_hours: number } | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("activities").select("payment_instructions, payment_window_hours").eq("id", activityId).maybeSingle();
  return (data as { payment_instructions: string | null; payment_window_hours: number } | null) ?? null;
}

// Nomor WhatsApp panitia untuk tombol "Chat panitia" (ALUR bagian 8): nomor host dari profil
// merchant/komunitas; event Gasyu memakai payment.gasyu_whatsapp, lalu support.whatsapp.
export async function getHostWhatsapp(hostId: string, hostType: "merchant" | "community" | "platform"): Promise<string | null> {
  const supabase = await createClient();
  if (hostType === "platform") {
    const { data } = await supabase.from("app_settings").select("key, value").in("key", ["payment.gasyu_whatsapp", "support.whatsapp"]);
    const text = (k: string) => {
      const v = data?.find((r) => r.key === k)?.value;
      return typeof v === "string" ? v.trim() : "";
    };
    return text("payment.gasyu_whatsapp") || text("support.whatsapp") || null;
  }
  const table = hostType === "merchant" ? "merchant_profiles" : "community_profiles";
  const { data } = await supabase.from(table).select("whatsapp").eq("organizer_id", hostId).maybeSingle();
  return (data?.whatsapp as string | undefined) ?? null;
}
