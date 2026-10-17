"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

const PARTNER_ROLES = ["host", "cohost", "sponsor"] as const;
// Peran partner dari formulir; nilai tak dikenal jatuh ke cohost (dicek lagi di database).
function partnerRole(formData: FormData): (typeof PARTNER_ROLES)[number] {
  const raw = String(formData.get("role") ?? "");
  return (PARTNER_ROLES as readonly string[]).includes(raw) ? (raw as (typeof PARTNER_ROLES)[number]) : "cohost";
}

export type CollabActionState = { error?: string; success?: string };

const ERRORS: Record<string, string> = {
  not_allowed: "Kamu tidak punya akses untuk ini.",
  activity_locked: "Aktivitas ini sudah berjalan atau selesai.",
  invalid_role: "Peran harus cohost atau sponsor.",
  partner_unavailable: "Penyelenggara itu belum terverifikasi.",
  partner_is_host: "Penyelenggara itu adalah host aktivitas ini.",
  partner_exists: "Penyelenggara itu sudah diundang atau sudah jadi partner.",
  invite_unavailable: "Undangan ini sudah tidak berlaku.",
  points_budget_requires_merchant: "Budget poin hanya untuk merchant.",
  platform_host_required: "Hanya untuk event Gasyu.",
  host_cannot_leave: "Host tidak bisa keluar dari aktivitasnya sendiri.",
  invalid_post: "Cek isian open call: judul, kebutuhan, dan manfaat minimal 3 karakter.",
  post_closed: "Open call ini sudah ditutup.",
  own_post: "Tidak bisa mengajukan ke open call sendiri.",
  already_applied: "Kamu sudah mengajukan ke open call ini.",
  application_unavailable: "Pengajuan ini sudah diputuskan.",
  account_inactive: "Akun kamu sedang tidak aktif.",
};
const msg = (code: string | undefined, fallback: string) => ERRORS[code ?? ""] ?? fallback;
const base = (type: string, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;
const text = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

function revalidateOrg(formData: FormData) {
  const type = text(formData, "type_org");
  const id = text(formData, "organizer_id");
  if (type === "admin") revalidatePath("/admin", "layout");
  else revalidatePath(base(type, id), "layout");
}

export async function invitePartner(_prev: CollabActionState, formData: FormData): Promise<CollabActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("invite_partner", {
    p_activity_id: text(formData, "activity_id"),
    p_organizer_id: text(formData, "partner_organizer_id"),
    p_role: partnerRole(formData),
    p_budget: Number(text(formData, "budget") || 0),
    p_note: text(formData, "note") || null,
  });
  if (error) return { error: msg(error.message, "Undangan belum terkirim.") };
  revalidateOrg(formData);
  return { success: "Undangan terkirim. Partner akan menjawab lewat halaman Kolaborasi." };
}

export async function respondPartnerInvite(_prev: CollabActionState, formData: FormData): Promise<CollabActionState> {
  const supabase = await createClient();
  const accept = formData.get("decision") === "accept";
  const budget = text(formData, "budget");
  const { error } = await supabase.rpc("respond_partner_invite", { p_partner_id: text(formData, "partner_id"), p_accept: accept, p_budget: accept && budget ? Number(budget) : null });
  if (error) return { error: msg(error.message, "Belum bisa menjawab undangan.") };
  revalidateOrg(formData);
  return { success: accept ? "Kamu bergabung sebagai partner." : "Undangan ditolak." };
}

export async function cancelPartnerInvite(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("cancel_partner_invite", { p_partner_id: text(formData, "partner_id") });
  revalidateOrg(formData);
}

export async function leaveActivity(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("leave_activity", { p_partner_id: text(formData, "partner_id") });
  revalidateOrg(formData);
}

export async function setPartnerBudget(_prev: CollabActionState, formData: FormData): Promise<CollabActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_partner_budget", { p_partner_id: text(formData, "partner_id"), p_budget: Number(text(formData, "budget") || 0) });
  if (error) return { error: msg(error.message, "Budget belum tersimpan.") };
  revalidateOrg(formData);
  return { success: "Budget poin tersimpan." };
}

export async function adminAddPartner(_prev: CollabActionState, formData: FormData): Promise<CollabActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("admin_add_partner", {
    p_activity_id: text(formData, "activity_id"),
    p_organizer_id: text(formData, "partner_organizer_id"),
    p_role: partnerRole(formData),
    p_note: text(formData, "note") || null,
  });
  if (error) return { error: msg(error.message, "Partner belum ditambahkan.") };
  revalidatePath("/admin", "layout");
  return { success: "Partner ditambahkan dan diberi tahu." };
}

export async function createCollabPost(_prev: CollabActionState, formData: FormData): Promise<CollabActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_collab_post", {
    p_organizer_id: text(formData, "organizer_id"),
    p_data: {
      kind: text(formData, "kind") || "collab",
      activity_id: text(formData, "activity_id") || null,
      title: text(formData, "title"),
      needs: text(formData, "needs"),
      benefits: text(formData, "benefits"),
      category: text(formData, "category") || null,
      region_id: text(formData, "region_id") || null,
      deadline: text(formData, "deadline") ? `${text(formData, "deadline")}T23:59:59+07:00` : null,
    },
  });
  if (error) return { error: msg(error.message, "Open call belum tersimpan.") };
  revalidateOrg(formData);
  return { success: "Open call dibuka di papan kolaborasi." };
}

export async function closeCollabPost(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("close_collab_post", { p_post_id: text(formData, "post_id") });
  revalidateOrg(formData);
}

export async function applyOpenCall(_prev: CollabActionState, formData: FormData): Promise<CollabActionState> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("apply_open_call", {
    p_post_id: text(formData, "post_id"),
    p_organizer_id: text(formData, "organizer_id"),
    p_role: partnerRole(formData),
    p_budget: Number(text(formData, "budget") || 0),
    p_contribution: text(formData, "contribution") || null,
    p_message: text(formData, "message") || null,
  });
  if (error) return { error: msg(error.message, "Pengajuan belum terkirim.") };
  revalidateOrg(formData);
  return { success: "Pengajuan terkirim. Pembuat open call akan meninjau." };
}

export async function withdrawApplication(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("withdraw_application", { p_application_id: text(formData, "application_id") });
  revalidateOrg(formData);
}

export async function decideApplication(formData: FormData) {
  const supabase = await createClient();
  await supabase.rpc("decide_application", { p_application_id: text(formData, "application_id"), p_accept: formData.get("decision") === "accept" });
  revalidateOrg(formData);
}
