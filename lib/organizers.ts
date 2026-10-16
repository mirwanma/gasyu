// Tipe dan konstanta penyelenggara yang aman dipakai di server maupun client.

export type OrganizerType = "merchant" | "community" | "platform";
export type OrganizerStatus = "pending" | "approved" | "rejected" | "suspended";
export type MemberRole = "owner" | "staff" | "chair" | "officer";

export type MyOrganizer = {
  id: string;
  type: OrganizerType;
  name: string;
  slug: string;
  logoUrl: string | null;
  status: OrganizerStatus;
  role: MemberRole;
};

export const ROLE_LABELS: Record<MemberRole, string> = {
  owner: "pemilik",
  staff: "staf",
  chair: "ketua",
  officer: "pengurus",
};

export const TYPE_LABELS: Record<OrganizerType, string> = {
  merchant: "Merchant",
  community: "Komunitas",
  platform: "Ramein",
};

export const STATUS_LABELS: Record<OrganizerStatus, string> = {
  pending: "Menunggu verifikasi",
  approved: "Terverifikasi",
  rejected: "Perlu perbaikan",
  suspended: "Dibekukan",
};

export const MERCHANT_CATEGORIES = [
  ["kuliner", "Kuliner"],
  ["kopi", "Kopi"],
  ["retail", "Retail"],
  ["fesyen", "Fesyen"],
  ["jasa", "Jasa"],
  ["otomotif", "Otomotif"],
  ["kerajinan", "Kerajinan"],
  ["lainnya", "Lainnya"],
] as const;

export const COMMUNITY_CATEGORIES = [
  ["olahraga", "Olahraga"],
  ["musik", "Musik"],
  ["seni", "Seni"],
  ["hobi", "Hobi"],
  ["sosial", "Sosial"],
  ["lingkungan", "Lingkungan"],
  ["edukasi", "Edukasi"],
  ["keagamaan", "Keagamaan"],
  ["lainnya", "Lainnya"],
] as const;

export function categoryLabel(value: string) {
  const all = [...MERCHANT_CATEGORIES, ...COMMUNITY_CATEGORIES] as readonly (readonly [string, string])[];
  return all.find(([key]) => key === value)?.[1] ?? value;
}
