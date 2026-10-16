import { fromLocalInput } from "@/lib/activities";

// Membaca formulir aktivitas (dipakai penyelenggara dan admin).
export function readActivityForm(formData: FormData) {
  const text = (key: string) => String(formData.get(key) ?? "").trim();
  const type = text("type") === "challenge" ? "challenge" : "event";
  const joinMode = ["individual", "group", "both"].includes(text("join_mode")) ? text("join_mode") : "individual";
  return {
    type,
    difficulty: type === "challenge" ? text("difficulty") || "easy" : null,
    target_scope: type === "challenge" && text("target_scope") === "group" ? "group" : "individual",
    target_kind: type === "challenge" ? text("target_kind") || "total_checkins" : null,
    target_count: type === "challenge" ? text("target_count") || "1" : null,
    group_min: joinMode === "individual" ? null : text("group_min") || "2",
    group_max: joinMode === "individual" ? null : text("group_max") || "10",
    goal: text("goal") || "awareness",
    title: text("title"),
    description: text("description"),
    scope_region_id: text("scope_region_id") || null,
    starts_at: fromLocalInput(text("starts_at")),
    ends_at: fromLocalInput(text("ends_at")),
    quota: text("quota") || null,
    join_mode: joinMode,
    residency_rule: text("residency_rule") || "open",
    audience: text("audience") || "public",
    // Harga (irisan 11): hanya dipakai database jika pengirim owner/chair host.
    is_paid: text("is_paid") === "true",
    price_idr: text("price_idr") || null,
    payment_instructions: text("payment_instructions") || null,
    payment_window_hours: text("payment_window_hours") || null,
  };
}

