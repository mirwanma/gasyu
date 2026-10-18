// Label tampilan Event Global (ALUR bagian 22). Aturan tetap di database.
export type PrizeKind = "physical" | "voucher" | "badge" | "other";
export type PrizeFulfillment = "pickup" | "shipping" | "digital";
export type WinnerStatus = "pending_claim" | "claimed" | "delivered" | "forfeited";
export type LeaderboardStatus = "upcoming" | "live" | "provisional" | "final";

export const PRIZE_KIND_LABELS: Record<PrizeKind, string> = {
  physical: "Barang",
  voucher: "Voucher atau tiket",
  badge: "Badge eksklusif",
  other: "Lainnya",
};

export const FULFILLMENT_LABELS: Record<PrizeFulfillment, string> = {
  pickup: "Ambil di lokasi",
  shipping: "Dikirim ke alamat",
  digital: "Digital",
};

export const WINNER_STATUS_LABELS: Record<WinnerStatus, string> = {
  pending_claim: "Belum diklaim",
  claimed: "Perlu dikirim",
  delivered: "Terkirim",
  forfeited: "Hangus",
};

export const WINNER_STATUS_TONE: Record<WinnerStatus, "warn" | "primary" | "success" | "neutral"> = {
  pending_claim: "warn",
  claimed: "primary",
  delivered: "success",
  forfeited: "neutral",
};

export const LEADERBOARD_STATUS_LABELS: Record<LeaderboardStatus, string> = {
  upcoming: "Belum mulai",
  live: "Live",
  provisional: "Sementara",
  final: "Final",
};

// "Juara 1", "Peringkat 2–3".
export function rankLabel(from: number, to: number) {
  if (from === to) return from <= 3 ? `Juara ${from}` : `Peringkat ${from}`;
  return `Peringkat ${from}–${to}`;
}
