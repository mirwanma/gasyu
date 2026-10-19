import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusTag } from "@/components/activity-card";
import { Icon } from "@/components/icons";
import { cardClass, smallButton, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { removePrize } from "@/lib/actions/global-events";
import { getActivityCard } from "@/lib/data/activities";
import { listActivityPartners } from "@/lib/data/collab";
import { listPrizeBadges, listPrizes } from "@/lib/data/global-events";
import { FULFILLMENT_LABELS, PRIZE_KIND_LABELS, rankLabel } from "@/lib/global-events";
import { formatNumber } from "@/lib/format";
import { safeImageUrl } from "@/lib/safe-url";
import { PrizeForm } from "./prize-form";

// Admin mengatur hadiah per peringkat Event Global (ALUR bagian 22b dan 22d).
export default function AdminHadiahPage({ searchParams }: PageProps<"/admin/aktivitas/hadiah">) {
  return (
    <div className="flex max-w-3xl flex-col gap-[18px]">
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/admin/aktivitas/hadiah">, "searchParams">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const aid = str(sp.aid);
  if (!aid) notFound();
  const [card, prizes, partners, badges] = await Promise.all([getActivityCard(aid), listPrizes(aid), listActivityPartners(aid), listPrizeBadges()]);
  if (!card || card.reach !== "global") notFound();

  const self = `/admin/aktivitas/hadiah?aid=${aid}`;
  const editing = str(sp.ubah) ? prizes.find((p) => p.id === sp.ubah) : undefined;
  const adding = sp.tambah === "1";
  const closed = ["ended", "settled", "cancelled"].includes(card.status);
  // Sama dengan upsert_activity_prize: hadiah lama terkunci setelah terbit.
  const locked = !["draft", "awaiting_partners", "in_review"].includes(card.status);
  const nextRank = Math.min(100, prizes.reduce((m, p) => Math.max(m, p.rank_to), 0) + 1);
  const sponsors = partners.filter((p) => p.status === "accepted" && p.role !== "host").map((p) => ({ id: p.organizer_id, name: p.organizer_name }));
  const notices: Record<string, string> = { simpan: "Hadiah tersimpan.", hapus: "Hadiah dihapus." };

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={`/admin/aktivitas?tab=semua&pilih=${aid}`} aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
          <Icon name="back" size={20} stroke={2} />
        </Link>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[12px] font-bold uppercase tracking-wide text-fg-soft">Hadiah Event Global</span>
          <h1 className="font-display text-[24px] font-semibold leading-tight">{card.title}</h1>
        </div>
        <StatusTag status={card.status} />
      </div>

      {str(sp.hasil) && notices[str(sp.hasil)!] && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">{notices[str(sp.hasil)!]}</p>}
      {str(sp.error) && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">{str(sp.error)}</p>}

      <p className="rounded-2xl bg-info-tint px-4 py-3 text-[12px] leading-[1.5] text-info">
        Pemenang ditetapkan otomatis saat event selesai (48 jam setelah berakhir), dari skor tertinggi. Setiap peringkat satu pemenang dan setiap peserta maksimal satu hadiah.
        Hadiah yang tidak diklaim dalam batas waktu menjadi hangus dan tidak dialihkan.
      </p>

      {(adding || editing) && !closed && (
        <PrizeForm
          key={editing?.id ?? "baru"}
          activityId={aid}
          initial={editing}
          locked={!!editing && locked}
          nextRank={nextRank}
          sponsors={sponsors}
          badges={badges}
          cancelHref={self}
        />
      )}

      {prizes.length === 0 && !adding && <p className={`${cardClass} p-5 text-[13px] text-fg-soft`}>Belum ada hadiah. Event Global wajib punya minimal satu hadiah sebelum terbit.</p>}
      {prizes.map((p) => (
        <section key={p.id} className={`${cardClass} flex gap-4 p-4`}>
          {safeImageUrl(p.image_url) ? (
            // eslint-disable-next-line @next/next/no-img-element -- gambar hadiah dari bucket publik
            <img src={safeImageUrl(p.image_url) ?? undefined} alt="" className="size-20 shrink-0 rounded-2xl bg-track object-cover" />
          ) : (
            <span className="flex size-20 shrink-0 items-center justify-center rounded-2xl bg-primary-tint text-link">
              <Icon name="ticket" size={28} stroke={1.8} />
            </span>
          )}
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`${tagClass.base} ${tagClass.primary}`}>{rankLabel(p.rank_from, p.rank_to)}</span>
              <span className={`${tagClass.base} ${tagClass.neutral}`}>{PRIZE_KIND_LABELS[p.kind]}</span>
              <span className={`${tagClass.base} ${tagClass.neutral}`}>{FULFILLMENT_LABELS[p.fulfillment]}</span>
            </div>
            <span className="text-[15px] font-semibold">{p.title}</span>
            {p.description && <span className="text-[13px] leading-[1.5] text-fg-label whitespace-pre-line">{p.description}</span>}
            <span className="text-[12px] text-fg-soft">
              Skor minimal {formatNumber(p.min_score)} · Hadiah dari {p.sponsor_name ?? "Gasyu"}
              {p.badge_name ? ` · Badge: ${p.badge_name}` : ""}
              {p.pickup_note ? ` · Ambil: ${p.pickup_note}` : ""}
            </span>
            {!closed && (
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <a href={`${self}&ubah=${p.id}`} className={smallButton.outline}>
                  {locked ? "Ubah deskripsi/gambar" : "Ubah"}
                </a>
                {!locked && (
                  <form action={removePrize}>
                    <input type="hidden" name="activity_id" value={aid} />
                    <input type="hidden" name="prize_id" value={p.id} />
                    <SubmitButton size="small" variant="danger" pendingText="Menghapus…">Hapus</SubmitButton>
                  </form>
                )}
              </div>
            )}
          </div>
        </section>
      ))}

      {!closed && !adding && !editing && (
        <a href={`${self}&tambah=1`} className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-on-primary">
          <Icon name="plus" size={20} stroke={2.2} />
          Tambah hadiah
        </a>
      )}
    </>
  );
}
