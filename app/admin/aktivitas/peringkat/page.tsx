import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusTag } from "@/components/activity-card";
import { Icon } from "@/components/icons";
import { cardClass, tagClass, textareaClass, backLinkClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { forfeitPrize, markPrizeDelivered } from "@/lib/actions/global-events";
import { getActivityCard } from "@/lib/data/activities";
import { getGlobalEventStats, getLeaderboard, listWinners, type Winner } from "@/lib/data/global-events";
import { LEADERBOARD_STATUS_LABELS, WINNER_STATUS_LABELS, WINNER_STATUS_TONE } from "@/lib/global-events";
import { formatDateTime, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Admin: papan peringkat, statistik peserta, dan pengiriman hadiah Event Global (ALUR bagian 22c–22d).
export default function AdminPeringkatPage({ searchParams }: PageProps<"/admin/aktivitas/peringkat">) {
  return (
    <div className="flex max-w-5xl flex-col gap-[18px]">
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/admin/aktivitas/peringkat">, "searchParams">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const aid = str(sp.aid);
  if (!aid) notFound();
  const [card, board, stats, winners] = await Promise.all([getActivityCard(aid), getLeaderboard(aid), getGlobalEventStats(aid), listWinners(aid)]);
  if (!card || card.reach !== "global") notFound();
  const notices: Record<string, string> = { terkirim: "Hadiah ditandai terkirim dan pemenang diberi tahu.", hangus: "Hadiah dinyatakan hangus dan pemenang diberi tahu." };
  const hasil = str(sp.hasil);

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={`/admin/aktivitas?tab=semua&pilih=${aid}`} className={backLinkClass}>
          <Icon name="back" size={20} stroke={2} />
          Kembali
        </Link>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] font-bold uppercase tracking-wide text-fg-soft">Peringkat & pemenang</span>
          <h1 className="font-display text-[26px] font-semibold leading-tight">{card.title}</h1>
        </div>
        <StatusTag status={card.status} />
      </div>

      {hasil && notices[hasil] && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">{notices[hasil]}</p>}
      {str(sp.error) && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[15px] font-semibold text-danger">{str(sp.error)}</p>}

      {stats && <Stats stats={stats} />}

      <div className="flex flex-wrap items-start gap-5">
        <section className={`${cardClass} min-w-0 flex-[1_1_340px] overflow-hidden`}>
          <div className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
            <h2 className="text-[16px] font-bold">Papan peringkat</h2>
            {board && (
              <span className={`${tagClass.base} ${board.status === "final" ? tagClass.success : board.status === "live" ? tagClass.hot : tagClass.neutral}`}>
                {LEADERBOARD_STATUS_LABELS[board.status]} · {formatNumber(board.participants)} peserta
              </span>
            )}
          </div>
          {board?.status === "provisional" && <p className="border-b border-line bg-warn-tint px-4 py-2.5 text-[13px] text-warn">Masa verifikasi 48 jam: tinjau bukti foto dan check-in yang ditandai sebelum pemenang ditetapkan.</p>}
          {!board || board.rows.length === 0 ? (
            <p className="p-5 text-[15px] text-fg-soft">Belum ada peserta yang punya skor.</p>
          ) : (
            <ol className="max-h-[640px] overflow-y-auto">
              {board.rows.map((r) => (
                <li key={r.rank} className="flex items-center gap-3 border-b border-line px-4 py-2.5 text-[15px] last:border-b-0">
                  <span className="w-8 text-right font-display font-semibold text-fg-soft">{r.rank}</span>
                  <span className="flex-1 font-semibold">{r.nickname}</span>
                  {r.prize_title && <span className="hidden text-[13px] text-fg-soft sm:inline">{r.prize_title}</span>}
                  <span className="font-display font-semibold text-info">{formatNumber(r.score)}</span>
                </li>
              ))}
            </ol>
          )}
        </section>

        <section className={`${cardClass} flex min-w-0 flex-[1.3_1_420px] flex-col overflow-hidden`}>
          <div className="border-b border-line px-4 py-3">
            <h2 className="text-[16px] font-bold">Pemenang & pengiriman hadiah</h2>
            <span className="text-[13px] text-fg-soft">Pemenang ditetapkan otomatis saat status selesai (settled). Cek flag kecurangan sebelum mengirim.</span>
          </div>
          {winners.length === 0 ? (
            <p className="p-5 text-[15px] text-fg-soft">{card.status === "settled" ? "Tidak ada peserta yang memenuhi skor minimal hadiah." : "Pemenang muncul di sini setelah event selesai."}</p>
          ) : (
            winners.map((w) => <WinnerRow key={w.id} w={w} aid={aid} openShipping={str(sp.alamat) === w.id} />)
          )}
        </section>
      </div>
    </>
  );
}

function Stats({ stats }: { stats: NonNullable<Awaited<ReturnType<typeof getGlobalEventStats>>> }) {
  const total = stats.cimahi_participants + stats.outside_participants;
  const kpis: [string, string, string][] = [
    ["Pendaftar", formatNumber(stats.registrants), `${formatNumber(stats.active_participants)} punya skor`],
    ["Warga Cimahi", formatNumber(stats.cimahi_participants), total ? `${Math.round((stats.cimahi_participants / total) * 100)}% peserta` : "-"],
    ["Luar Cimahi", formatNumber(stats.outside_participants), total ? `${Math.round((stats.outside_participants / total) * 100)}% peserta` : "-"],
    ["Misi selesai", formatNumber(stats.missions_completed), stats.avg_score !== null ? `rata-rata skor ${formatNumber(stats.avg_score)}` : "belum ada skor"],
  ];
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {kpis.map(([label, value, sub]) => (
          <div key={label} className={`${cardClass} flex flex-col gap-1 p-4`}>
            <span className="text-[13px] font-semibold text-fg-soft">{label}</span>
            <span className="font-display text-[28px] font-bold leading-tight">{value}</span>
            <span className="text-[13px] text-fg-soft">{sub}</span>
          </div>
        ))}
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Breakdown title="Kota asal peserta luar Cimahi" rows={stats.cities.map((c) => [`${c.name}`, c.count, c.province])} empty="Belum ada peserta luar Cimahi yang mengisi kota asal." />
        <Breakdown title="Kelurahan peserta Cimahi" rows={stats.villages.map((v) => [v.name, v.count, ""])} empty="Belum ada peserta warga Cimahi." />
      </div>
      {stats.prizes_pending_claim + stats.prizes_claimed + stats.prizes_delivered + stats.prizes_forfeited > 0 && (
        <p className="text-[13px] text-fg-soft">
          Hadiah: {stats.prizes_pending_claim} belum diklaim · {stats.prizes_claimed} perlu dikirim · {stats.prizes_delivered} terkirim · {stats.prizes_forfeited} hangus
        </p>
      )}
    </>
  );
}

function Breakdown({ title, rows, empty }: { title: string; rows: [string, number, string][]; empty: string }) {
  const max = Math.max(1, ...rows.map((r) => r[1]));
  return (
    <section className={`${cardClass} flex flex-col gap-2.5 p-4`}>
      <h3 className="text-[15px] font-bold">{title}</h3>
      {rows.length === 0 && <span className="text-[13px] text-fg-soft">{empty}</span>}
      {rows.slice(0, 10).map(([name, count, sub]) => (
        <div key={`${name}-${sub}`} className="flex flex-col gap-1">
          <span className="flex items-baseline justify-between gap-2 text-[15px]">
            <span className="font-semibold">
              {name} {sub && <span className="text-[12px] font-normal text-fg-soft">{sub}</span>}
            </span>
            <span className="font-display font-semibold">{formatNumber(count)}</span>
          </span>
          <span className="h-1.5 rounded-full bg-track">
            <span className="block h-1.5 rounded-full bg-primary" style={{ width: `${Math.round((count / max) * 100)}%` }} />
          </span>
        </div>
      ))}
      {rows.length > 10 && <span className="text-[12px] text-fg-muted">+{rows.length - 10} lainnya</span>}
    </section>
  );
}

async function WinnerRow({ w, aid, openShipping }: { w: Winner; aid: string; openShipping: boolean }) {
  // Alamat hanya dibaca saat admin membukanya (get_winner_shipping), tidak ikut daftar.
  const shipping = openShipping && w.fulfillment === "shipping" && w.status !== "pending_claim" ? await loadShipping(w.id) : null;
  const self = `/admin/aktivitas/peringkat?aid=${aid}`;
  return (
    <div className="flex flex-col gap-2 border-b border-line px-4 py-3 last:border-b-0">
      <div className="flex flex-wrap items-center gap-2">
        <span className="w-8 font-display text-[16px] font-semibold text-fg-soft">#{w.rank}</span>
        <span className="flex min-w-0 flex-1 flex-col">
          <span className="text-[15px] font-semibold">
            {w.nickname} <span className="text-[13px] font-normal text-fg-soft">· skor {formatNumber(w.score)}</span>
          </span>
          <span className="text-[13px] text-fg-soft">{w.prize_title}</span>
        </span>
        {w.open_flags > 0 && (
          <a href={`/admin/pengguna?q=${encodeURIComponent(w.nickname)}`} className={`${tagClass.base} ${tagClass.hot}`}>
            {w.open_flags} flag terbuka
          </a>
        )}
        <span className={`${tagClass.base} ${tagClass[WINNER_STATUS_TONE[w.status]]}`}>{WINNER_STATUS_LABELS[w.status]}</span>
      </div>
      <span className="pl-10 text-[13px] text-fg-soft">
        {w.status === "pending_claim" && `Batas klaim ${formatDateTime(w.claim_deadline)}`}
        {w.status === "claimed" && w.claimed_at && `Diklaim ${formatDateTime(w.claimed_at)}`}
        {w.status === "delivered" && w.delivered_at && `Terkirim ${formatDateTime(w.delivered_at)}${w.note ? ` · ${w.note}` : ""}`}
        {w.status === "forfeited" && `Hangus${w.forfeited_reason ? ` · ${w.forfeited_reason}` : ""}`}
      </span>
      {w.fulfillment === "shipping" && w.status !== "pending_claim" && w.status !== "forfeited" && (
        <div className="pl-10">
          {shipping ? (
            <div className="flex flex-col gap-0.5 rounded-xl bg-track px-3 py-2 text-[13px] text-fg-label">
              <span className="font-semibold">{shipping.name ?? "-"} · {shipping.phone ?? "-"}</span>
              <span className="whitespace-pre-line">{shipping.address ?? (w.status === "delivered" ? "Alamat sudah dihapus otomatis setelah terkirim." : "-")}</span>
              <a href={self} className="font-semibold text-link">Tutup</a>
            </div>
          ) : (
            <a href={`${self}&alamat=${w.id}`} className="text-[13px] font-semibold text-link">Lihat data pengiriman</a>
          )}
        </div>
      )}
      {(w.status === "claimed" || w.status === "pending_claim") && (
        <div className="flex flex-wrap gap-3 pl-10">
          {w.status === "claimed" && (
            <details>
              <summary className="cursor-pointer list-none text-[15px] font-semibold text-link">Tandai terkirim…</summary>
              <form action={markPrizeDelivered} className="mt-2 flex flex-col gap-2">
                <input type="hidden" name="activity_id" value={aid} />
                <input type="hidden" name="winner_id" value={w.id} />
                <textarea name="note" rows={2} maxLength={300} className={textareaClass} placeholder="Nomor resi atau catatan serah terima (opsional)" />
                <SubmitButton size="small" variant="dark" pendingText="Menyimpan…" className="self-start">Tandai terkirim</SubmitButton>
              </form>
            </details>
          )}
          <details>
            <summary className="cursor-pointer list-none text-[15px] font-semibold text-danger">Nyatakan hangus…</summary>
            <form action={forfeitPrize} className="mt-2 flex flex-col gap-2">
              <input type="hidden" name="activity_id" value={aid} />
              <input type="hidden" name="winner_id" value={w.id} />
              <textarea name="reason" rows={2} required maxLength={300} className={textareaClass} placeholder="Alasan, misalnya terbukti memakai akun ganda (dikirim ke pemenang)" />
              <SubmitButton size="small" variant="danger" pendingText="Menyimpan…" className="self-start">Ya, hangus</SubmitButton>
            </form>
          </details>
        </div>
      )}
    </div>
  );
}

async function loadShipping(winnerId: string) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("get_winner_shipping", { p_winner_id: winnerId });
  return (data as { name: string | null; phone: string | null; address: string | null } | null) ?? null;
}
