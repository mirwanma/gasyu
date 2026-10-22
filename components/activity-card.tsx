import { LOCATION_MODE_LABELS, formatPrice, formatSchedule, typeLabel, type ActivityStatus, STATUS_LABELS, STATUS_TONE } from "@/lib/activities";
import type { ActivityCard as Card } from "@/lib/data/activities";
import { tagClass } from "@/components/styles";
import { backgroundImage } from "@/lib/safe-url";

// Warna cover cadangan jika penyelenggara belum mengunggah gambar.
const COVERS = [
  "linear-gradient(120deg,var(--color-primary),var(--color-primary-hover))",
  "linear-gradient(120deg,var(--color-success),var(--color-info))",
  "linear-gradient(120deg,var(--color-primary-hover),var(--color-fg-soft))",
  "linear-gradient(120deg,var(--color-success),var(--color-fg-soft))",
];

export function coverStyle(card: { id: string; cover_url: string | null }) {
  const image = backgroundImage(card.cover_url);
  if (image) return image;
  const n = parseInt(card.id.slice(0, 2), 16) || 0;
  return { background: COVERS[n % COVERS.length] };
}

export function cardTag(card: Card): { label: string; tone: keyof typeof tagClass } | null {
  if (card.reach === "global") return { label: "Event Global", tone: "hot" };
  if (card.host_type === "platform") return { label: "Event Gasyu", tone: "primary" };
  if (card.partner_count > 0) return { label: "Kolaborasi", tone: "info" };
  if (card.is_paid) return { label: "Berbayar", tone: "warn" };
  if (card.audience === "members_only") return { label: "Khusus member", tone: "warn" };
  if (card.residency_rule === "residents_only") return { label: "Khusus warga", tone: "success" };
  return null;
}

export function StatusTag({ status }: { status: ActivityStatus }) {
  return <span className={`${tagClass.base} ${tagClass[STATUS_TONE[status]]}`}>{STATUS_LABELS[status]}</span>;
}

// Kartu aktivitas untuk warga (Jelajah, beranda), mengikuti artboard "Warga · Jelajah".
// Event Global: skor dan hadiah utama menggantikan XP dan poin (ALUR bagian 22e).
export function ActivityCard({ card, href, footer, topPrize }: { card: Card; href: string; footer?: React.ReactNode; topPrize?: string | null }) {
  const tag = cardTag(card);
  const isGlobal = card.reach === "global";
  const quota = card.quota ? Math.min(100, Math.round((card.seats_taken / card.quota) * 100)) : 0;
  return (
    <a href={href} className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface text-fg">
      <div className="relative h-[120px]" style={coverStyle(card)}>
        <div className="absolute inset-x-3 top-3 flex items-center justify-between">
          <span className="rounded-full bg-scrim px-3 py-1 text-[12px] font-bold text-cream">
            {isGlobal ? LOCATION_MODE_LABELS[card.location_mode] : typeLabel(card.type)}
            {card.join_mode !== "individual" ? " · grup" : ""}
          </span>
          {tag && <span className={`${tagClass.base} ${tagClass[tag.tone]}`}>{tag.label}</span>}
        </div>
      </div>
      <div className="flex flex-col gap-2.5 p-3.5">
        <div className="flex flex-col gap-0.5">
          <span className="font-display text-[18px] font-semibold leading-tight">{card.title}</span>
          <span className="text-[13px] text-fg-soft">{card.host_name}</span>
          <span className="text-[13px] text-fg-soft">
            {formatSchedule(card.starts_at, card.ends_at)} · {isGlobal ? "terbuka untuk semua kota" : card.join_mode === "individual" ? "individu" : card.join_mode === "both" ? "individu / grup" : `grup ${card.group_min}–${card.group_max} orang`}
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] font-bold">
          {isGlobal ? (
            <span className="min-w-0 truncate text-hot">{topPrize ? `Hadiah: ${topPrize}` : "Skor & hadiah per peringkat"}</span>
          ) : (
            <>
              <span className="text-xp">+{card.xp_base} XP</span>
              <span className="text-success">{card.points_per_completion > 0 ? `+${card.points_per_completion} poin` : "Tanpa poin"}</span>
            </>
          )}
          <span className="ml-auto text-fg-label">{formatPrice(card.price_idr, card.is_paid)}</span>
        </div>
        {card.quota ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-track">
              <div className="h-full rounded-full bg-primary" style={{ width: `${Math.max(quota, 2)}%` }} />
            </div>
            <span className="text-[12px] text-fg-soft tabular-nums">
              {card.seats_taken}/{card.quota.toLocaleString("id-ID")}
            </span>
          </div>
        ) : (
          <span className="text-[12px] text-fg-soft">{card.seats_taken} peserta · tanpa kuota</span>
        )}
        {footer}
      </div>
    </a>
  );
}

// Baris ringkas untuk daftar milik penyelenggara dan admin.
export function ActivityRow({ card, href, selected }: { card: Card; href: string; selected?: boolean }) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 border-b border-line border-l-4 px-4 py-3.5 text-fg ${selected ? "border-l-primary bg-primary-tint/40" : "border-l-transparent"}`}
    >
      <span className="size-12 shrink-0 rounded-xl" style={coverStyle(card)} aria-hidden="true" />
      <span className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="truncate text-[16px] font-semibold">{card.title}</span>
        <span className="text-[13px] text-fg-soft">
          {card.reach === "global" ? "Event Global" : typeLabel(card.type)} · {formatSchedule(card.starts_at, card.ends_at)} · {card.seats_taken} peserta
        </span>
      </span>
      <StatusTag status={card.status} />
    </a>
  );
}
