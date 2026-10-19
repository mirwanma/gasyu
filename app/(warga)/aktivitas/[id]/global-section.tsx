import Link from "next/link";
import { Icon } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import type { Leaderboard, Prize } from "@/lib/data/global-events";
import { FULFILLMENT_LABELS, LEADERBOARD_STATUS_LABELS, rankLabel } from "@/lib/global-events";
import { formatNumber } from "@/lib/format";
import { safeImageUrl } from "@/lib/safe-url";

// Bagian khusus Event Global di halaman aktivitas warga (ALUR bagian 22e):
// skor dan posisi saya, cuplikan papan peringkat, dan hadiah per peringkat.
export function GlobalSection({ activityId, board, prizes, joined, claimDays }: { activityId: string; board: Leaderboard | null; prizes: Prize[]; joined: boolean; claimDays: number }) {
  const href = `/aktivitas/${activityId}/peringkat`;
  return (
    <>
      {joined && (
        <section className={`${cardClass} flex items-center gap-4 p-4`}>
          <span className="flex size-14 shrink-0 flex-col items-center justify-center rounded-2xl bg-hot-tint text-hot">
            <span className="text-[10px] font-bold uppercase">Posisi</span>
            <span className="font-display text-[20px] font-bold leading-none">{board?.me ? `#${board.me.rank}` : "–"}</span>
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="font-display text-[22px] font-bold leading-tight">{formatNumber(board?.me?.score ?? 0)} skor</span>
            <span className="text-[12px] text-fg-soft">
              {board?.me ? `dari ${formatNumber(board.participants)} peserta yang punya skor` : "Check-in atau selesaikan misi untuk masuk papan peringkat."}
            </span>
          </span>
        </section>
      )}

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Papan peringkat</h2>
          {board && (
            <span className={`${tagClass.base} ${board.status === "live" ? tagClass.hot : board.status === "final" ? tagClass.success : tagClass.neutral}`}>
              {LEADERBOARD_STATUS_LABELS[board.status]}
            </span>
          )}
        </div>
        <div className={`${cardClass} overflow-hidden`}>
          {!board || board.rows.length === 0 ? (
            <p className="p-4 text-[13px] text-fg-soft">Belum ada peserta yang punya skor. Jadilah yang pertama!</p>
          ) : (
            board.rows.map((r) => (
              <div key={r.rank} className={`flex items-center gap-3 border-b border-line px-4 py-2.5 text-[14px] last:border-b-0 ${r.is_me ? "bg-primary-tint/40" : ""}`}>
                <span className="w-7 font-display font-bold text-fg-soft">#{r.rank}</span>
                <span className="flex-1 font-semibold">{r.nickname}{r.is_me ? " (kamu)" : ""}</span>
                <span className="font-display font-semibold text-hot">{formatNumber(r.score)}</span>
              </div>
            ))
          )}
          <Link href={href} className="flex h-12 items-center justify-center gap-1.5 border-t border-line text-[14px] font-semibold text-link">
            Lihat papan peringkat
            <Icon name="chevron" size={16} stroke={2} />
          </Link>
        </div>
      </section>

      {prizes.length > 0 && (
        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-[18px] font-semibold">Hadiah</h2>
          <div className="flex flex-col gap-2">
            {prizes.map((p) => (
              <div key={p.id} className={`${cardClass} flex gap-3 p-3`}>
                {safeImageUrl(p.image_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element -- gambar hadiah dari bucket publik
                  <img src={safeImageUrl(p.image_url) ?? undefined} alt="" className="size-14 shrink-0 rounded-xl bg-track object-cover" />
                ) : (
                  <span className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-hot-tint text-hot">
                    <Icon name="ticket" size={22} stroke={1.8} />
                  </span>
                )}
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[12px] font-bold text-hot">{rankLabel(p.rank_from, p.rank_to)}</span>
                  <span className="text-[14px] font-semibold">{p.title}</span>
                  {p.description && <span className="text-[12px] leading-[1.5] text-fg-soft">{p.description}</span>}
                  <span className="text-[11px] text-fg-muted">
                    {p.kind === "badge" ? "Badge langsung masuk profil" : FULFILLMENT_LABELS[p.fulfillment]} · skor minimal {formatNumber(p.min_score)}
                    {p.sponsor_name ? ` · Hadiah dari ${p.sponsor_name}` : ""}
                  </span>
                </span>
              </div>
            ))}
          </div>
          <span className="text-[12px] leading-[1.5] text-fg-soft">
            Pemenang ditetapkan 48 jam setelah acara berakhir. Skor sama: yang lebih dulu mencapainya di atas. Setiap peserta maksimal satu hadiah, klaim dalam {claimDays} hari di halaman Hadiah.
          </span>
        </section>
      )}
    </>
  );
}
