import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { cardClass, tagClass, backLinkClass } from "@/components/styles";
import { getActivityCard } from "@/lib/data/activities";
import { getLeaderboard, listPrizes } from "@/lib/data/global-events";
import { LEADERBOARD_STATUS_LABELS, rankLabel } from "@/lib/global-events";
import { formatNumber } from "@/lib/format";

const STATUS_NOTE = {
  upcoming: "Acara belum mulai. Papan peringkat terisi begitu peserta check-in atau menyelesaikan misi.",
  live: "Acara sedang berjalan. Peringkat berubah setiap ada skor baru.",
  provisional: "Acara sudah berakhir. Panitia memverifikasi bukti selama 48 jam, jadi peringkat masih bisa berubah.",
  final: "Peringkat final. Pemenang sudah ditetapkan dan bisa mengklaim hadiah di halaman Hadiah.",
} as const;

// Papan peringkat Event Global untuk warga (ALUR bagian 22c): 100 besar, posisi saya,
// hanya nickname dan skor. Pengguna yang belum ikut tetap boleh melihat.
export default function PeringkatEventPage({ params }: PageProps<"/aktivitas/[id]/peringkat">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-16 pt-6">
      <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
        <Board params={params} />
      </Suspense>
    </main>
  );
}

async function Board({ params }: Pick<PageProps<"/aktivitas/[id]/peringkat">, "params">) {
  const { id } = await params;
  const card = await getActivityCard(id);
  if (!card || card.reach !== "global") notFound();
  const [board, prizes] = await Promise.all([getLeaderboard(id), listPrizes(id)]);
  if (!board) notFound();
  const prizeFor = (rank: number) => prizes.find((p) => rank >= p.rank_from && rank <= p.rank_to);
  const meInTop = board.rows.some((r) => r.is_me);

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={`/aktivitas/${id}`} className={backLinkClass}>
          <Icon name="back" size={20} stroke={2} />
          Kembali
        </Link>
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="text-[14px] font-bold uppercase tracking-wide text-hot">Papan peringkat</span>
          <h1 className="truncate font-display text-[24px] font-bold leading-tight">{card.title}</h1>
        </div>
        <span className={`${tagClass.base} ${board.status === "live" ? tagClass.hot : board.status === "final" ? tagClass.success : tagClass.neutral}`}>{LEADERBOARD_STATUS_LABELS[board.status]}</span>
      </div>

      <p className="text-[16px] leading-[1.5] text-fg-soft">
        {STATUS_NOTE[board.status]} {formatNumber(board.participants)} peserta punya skor. Skor sama: yang lebih dulu mencapainya di atas.
      </p>

      {board.me && !meInTop && <MeRow rank={board.me.rank} score={board.me.score} />}

      <ol className={`${cardClass} overflow-hidden`}>
        {board.rows.length === 0 && <li className="p-4 text-[16px] text-fg-soft">Belum ada peserta yang punya skor.</li>}
        {board.rows.map((r) => {
          // Sebelum final, tunjukkan hadiah incaran per peringkat; saat final, hadiah yang benar-benar didapat.
          const prize = board.status === "final" ? r.prize_title : prizeFor(r.rank)?.title;
          return (
            <li key={r.rank} className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 ${r.is_me ? "bg-primary-tint/40" : ""}`}>
              <span className={`flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-[18px] font-bold ${r.rank <= 3 ? "bg-hot-tint text-hot" : "text-fg-soft"}`}>{r.rank}</span>
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-[17px] font-semibold">
                  {r.nickname}
                  {r.is_me ? " (kamu)" : ""}
                </span>
                {prize && <span className="truncate text-[13px] text-fg-soft">{prize}</span>}
              </span>
              <span className="font-display text-[18px] font-semibold text-hot">{formatNumber(r.score)}</span>
            </li>
          );
        })}
      </ol>

      {prizes.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[20px] font-semibold">Hadiah</h2>
          <div className={`${cardClass} overflow-hidden`}>
            {prizes.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-3 border-b border-line px-4 py-2.5 text-[16px] last:border-b-0">
                <span className="font-bold text-hot">{rankLabel(p.rank_from, p.rank_to)}</span>
                <span className="min-w-0 flex-1 truncate text-right">{p.title}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {board.status === "final" && (
        <Link href="/hadiah" className="flex h-[52px] items-center justify-center rounded-2xl bg-primary text-[18px] font-semibold text-on-primary">
          Buka halaman Hadiah
        </Link>
      )}
    </>
  );
}

function MeRow({ rank, score }: { rank: number; score: number }) {
  return (
    <div className={`${cardClass} flex items-center gap-3 border-primary/40 bg-primary-tint/40 px-4 py-3`}>
      <span className="flex size-9 shrink-0 items-center justify-center rounded-xl font-display text-[18px] font-bold text-link">{rank}</span>
      <span className="flex-1 text-[17px] font-semibold">Posisi kamu</span>
      <span className="font-display text-[18px] font-semibold text-hot">{formatNumber(score)}</span>
    </div>
  );
}
