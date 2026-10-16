// Tipe dan label aktivitas yang aman dipakai di server maupun client.

export type ActivityType = "event" | "challenge";
export type ActivityGoal = "awareness" | "visit" | "sales" | "membership";
export type ActivityStatus =
  | "draft"
  | "awaiting_partners"
  | "in_review"
  | "published"
  | "running"
  | "ended"
  | "settled"
  | "cancelled";
export type JoinMode = "individual" | "group" | "both";
export type ResidencyRule = "open" | "residents_only";
export type Audience = "public" | "members_only";
export type ParticipationStatus = "invited" | "registered" | "in_progress" | "completed" | "not_completed" | "cancelled";
export type PaymentStatus = "not_required" | "unpaid" | "awaiting_confirmation" | "paid" | "refunded";

export const GOAL_OPTIONS: [ActivityGoal, string, string][] = [
  ["awareness", "Dikenal", "Memperkenalkan usaha atau komunitas"],
  ["visit", "Kunjungan", "Mendatangkan warga ke lokasi"],
  ["sales", "Penjualan", "Mendorong transaksi"],
  ["membership", "Anggota", "Menambah member atau pelanggan tetap"],
];

export const STATUS_LABELS: Record<ActivityStatus, string> = {
  draft: "Draft",
  awaiting_partners: "Menunggu partner",
  in_review: "Menunggu review",
  published: "Terbit",
  running: "Berjalan",
  ended: "Selesai",
  settled: "Ditutup",
  cancelled: "Dibatalkan",
};

export const STATUS_TONE: Record<ActivityStatus, "neutral" | "warn" | "primary" | "success" | "hot" | "info"> = {
  draft: "neutral",
  awaiting_partners: "warn",
  in_review: "primary",
  published: "info",
  running: "success",
  ended: "neutral",
  settled: "neutral",
  cancelled: "hot",
} as Record<ActivityStatus, "neutral" | "warn" | "primary" | "success" | "hot" | "info">;

export const PARTICIPATION_LABELS: Record<ParticipationStatus, string> = {
  invited: "Menunggu konfirmasi",
  registered: "Terdaftar",
  in_progress: "Sedang ikut",
  completed: "Selesai",
  not_completed: "Tidak selesai",
  cancelled: "Dibatalkan",
};

export const PAYMENT_LABELS: Record<PaymentStatus, string> = {
  not_required: "Gratis",
  unpaid: "Belum bayar",
  awaiting_confirmation: "Cek bukti",
  paid: "Lunas",
  refunded: "Refund",
};

export type Difficulty = "easy" | "medium" | "hard";
export type TargetKind = "total_checkins" | "distinct_checkpoints" | "required_missions" | "missions_completed";
export type TargetScope = "individual" | "group";

export const DIFFICULTY_LABELS: Record<Difficulty, string> = { easy: "Mudah", medium: "Sedang", hard: "Sulit" };
export const TARGET_KIND_LABELS: Record<TargetKind, string> = {
  total_checkins: "Jumlah check-in",
  distinct_checkpoints: "Checkpoint berbeda",
  required_missions: "Semua misi wajib",
  missions_completed: "Jumlah misi selesai",
};
export const JOIN_MODE_LABELS: Record<JoinMode, string> = { individual: "Individu", group: "Grup", both: "Individu atau grup" };

// Teks target challenge, mis. "4 checkpoint berbeda · target grup".
export function targetLabel(kind: TargetKind | null | undefined, count: number | null | undefined, scope: TargetScope | null | undefined) {
  if (!kind) return "";
  const base =
    kind === "total_checkins" ? `${count ?? 1}× check-in`
    : kind === "distinct_checkpoints" ? `${count ?? 1} checkpoint berbeda`
    : kind === "required_missions" ? "semua misi wajib"
    : `${count ?? 1} misi selesai`;
  return scope === "group" ? `${base} · target grup` : base;
}

export function typeLabel(type: ActivityType) {
  return type === "event" ? "Event" : "Challenge";
}

export function formatPrice(priceIdr: number | null | undefined, isPaid: boolean) {
  if (!isPaid || !priceIdr) return "Gratis";
  return `Rp${priceIdr.toLocaleString("id-ID")}`;
}

// Rentang waktu ringkas: "Sab, 25 Okt · 19.00–21.00" atau "1–31 Okt".
export function formatSchedule(startsAt: string, endsAt: string) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const tz = "Asia/Jakarta";
  const day = new Intl.DateTimeFormat("id-ID", { timeZone: tz, weekday: "short", day: "numeric", month: "short" });
  const time = new Intl.DateTimeFormat("id-ID", { timeZone: tz, hour: "2-digit", minute: "2-digit" });
  const dateOnly = new Intl.DateTimeFormat("id-ID", { timeZone: tz, day: "numeric", month: "short" });
  const sameDay = day.format(start) === day.format(end);
  if (sameDay) return `${day.format(start)} · ${time.format(start)}–${time.format(end)}`.replace(/\./g, ".");
  return `${dateOnly.format(start)} – ${dateOnly.format(end)}`;
}

// Nilai datetime-local (WIB) dari ISO, untuk mengisi formulir.
export function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Jakarta",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(iso));
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}

// datetime-local (WIB) → ISO dengan offset +07:00.
export function fromLocalInput(value: string) {
  return value ? `${value}:00+07:00` : "";
}
