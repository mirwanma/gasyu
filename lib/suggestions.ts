// Label saran warga yang aman dipakai di server maupun client.

export type SuggestionCategory = "activity" | "product" | "service" | "place" | "other";
export type SuggestionStatus = "new" | "in_progress" | "done" | "archived";

export const SUGGESTION_CATEGORIES: [SuggestionCategory, string][] = [
  ["activity", "Ide aktivitas"],
  ["product", "Produk atau menu"],
  ["service", "Pelayanan"],
  ["place", "Tempat dan fasilitas"],
  ["other", "Lainnya"],
];

export const CATEGORY_LABELS = Object.fromEntries(SUGGESTION_CATEGORIES) as Record<SuggestionCategory, string>;

export const SUGGESTION_STATUS_LABELS: Record<SuggestionStatus, string> = {
  new: "Baru",
  in_progress: "Ditindaklanjuti",
  done: "Selesai",
  archived: "Diarsipkan",
};

export const SUGGESTION_STATUS_TONE: Record<SuggestionStatus, "warn" | "info" | "success" | "neutral"> = {
  new: "warn",
  in_progress: "info",
  done: "success",
  archived: "neutral",
};
