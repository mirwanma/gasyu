import { cardClass, tagClass } from "@/components/styles";
import type { SponsoredPrize } from "@/lib/data/global-events";
import { WINNER_STATUS_LABELS, WINNER_STATUS_TONE, rankLabel } from "@/lib/global-events";

// Kartu "Hadiah yang disponsori" di dashboard merchant dan komunitas (ALUR bagian 20a):
// hadiah Event Global yang disediakan penyelenggara ini dan status penyerahannya, tanpa data pemenang.
export function SponsoredPrizes({ prizes }: { prizes: SponsoredPrize[] }) {
  if (prizes.length === 0) return null;
  const toHandOver = prizes.reduce((n, p) => n + p.winners.filter((w) => w.status === "claimed").length, 0);
  const events = [...new Map(prizes.map((p) => [p.activity_id, p.activity_title])).entries()];
  return (
    <section className="flex flex-col gap-2.5">
      <h2 className="font-display text-[18px] font-semibold">Hadiah yang disponsori</h2>
      {toHandOver > 0 && (
        <p className="rounded-2xl bg-warn-tint px-4 py-3 text-[13px] leading-[1.5] text-warn">
          {toHandOver} hadiah sudah diklaim pemenang. Serahkan hadiahnya ke panitia Gasyu; pengiriman ke pemenang diurus panitia.
        </p>
      )}
      {events.map(([activityId, title]) => (
        <div key={activityId} className={`${cardClass} flex flex-col gap-2.5 p-3.5`}>
          <span className="text-[14px] font-semibold leading-[1.3]">{title}</span>
          {prizes.filter((p) => p.activity_id === activityId).map((p) => (
            <div key={p.id} className="flex flex-col gap-1.5 border-t border-line pt-2.5">
              <span className="text-[13px]">
                <b className="text-hot">{rankLabel(p.rank_from, p.rank_to)}</b> · {p.title}
              </span>
              {p.winners.length === 0 ? (
                <span className="text-[12px] text-fg-soft">{p.activity_status === "settled" ? "Tidak ada pemenang yang memenuhi skor minimal." : "Pemenang ditetapkan setelah acara selesai."}</span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {p.winners.map((w) => (
                    <span key={w.rank} className={`${tagClass.base} ${tagClass[WINNER_STATUS_TONE[w.status]]}`}>
                      #{w.rank} · {WINNER_STATUS_LABELS[w.status]}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
      <span className="text-[12px] text-fg-soft">Nama dan alamat pemenang hanya dipegang panitia Gasyu.</span>
    </section>
  );
}
