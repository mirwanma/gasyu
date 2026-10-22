import { Suspense } from "react";
import Link from "next/link";
import { cardClass } from "@/components/styles";
import { getAdminOverview, listActiveVillages, listWeeklyActive } from "@/lib/data/dashboards";
import { countPrizesToDeliver } from "@/lib/data/global-events";
import { formatDate, formatNumber } from "@/lib/format";

// Ringkasan kota untuk admin, mengikuti artboard "Admin · Ringkasan".
// Angka dari v_admin_overview, v_admin_weekly_active, v_village_active_month.
export default function AdminRingkasanPage() {
  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[32px] font-bold">Ringkasan kota</h1>
          <span className="text-[17px] text-fg-soft">Cimahi · pilot · 7 hari terakhir</span>
        </div>
        <Link href="/admin/aktivitas/baru" className="flex h-11 items-center rounded-full bg-primary px-5 text-[17px] font-semibold text-on-primary">
          Buat event Gasyu
        </Link>
      </div>
      <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

// Dipisah dari render supaya aturan "komponen harus murni" terpenuhi.
function daysSince(value: string) {
  return Math.floor((Date.now() - new Date(value).getTime()) / 86400000);
}

function short(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toLocaleString("id-ID", { maximumFractionDigits: 1 })}jt`;
  if (n >= 10_000) return `${Math.round(n / 1000).toLocaleString("id-ID")}rb`;
  return formatNumber(n);
}

async function Overview() {
  const [o, weeks, villages, prizesToDeliver] = await Promise.all([getAdminOverview(), listWeeklyActive(), listActiveVillages(5), countPrizesToDeliver()]);
  if (!o) return <p className="text-[16px] text-fg-soft">Data ringkasan belum tersedia.</p>;
  const delta = o.weekly_active_prev > 0 ? Math.round(((o.weekly_active - o.weekly_active_prev) / o.weekly_active_prev) * 100) : null;
  const maxWeek = Math.max(1, ...weeks.map((w) => w.active_citizens));
  const maxVillage = villages[0]?.avg_xp || 1;
  const pendingDays = o.oldest_pending_activity_at ? daysSince(o.oldest_pending_activity_at) : 0;
  const flagged = o.flagged_checkins + o.open_pattern_flags;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          label="Warga aktif mingguan"
          value={formatNumber(o.weekly_active)}
          sub={delta === null ? `${formatNumber(o.citizens)} warga terdaftar` : `${delta >= 0 ? "+" : ""}${delta}% dari minggu lalu`}
          tone={delta !== null && delta >= 0 ? "success" : "neutral"}
        />
        <Kpi label="Aktivitas berjalan" value={formatNumber(o.running_activities)} sub={`${o.running_events} event · ${o.running_challenges} challenge`} />
        <Kpi label="Penyelenggara aktif" value={`${o.active_merchants} · ${o.active_communities}`} sub="merchant · komunitas" />
        <Kpi label="Poin beredar / ditukar" value={short(o.points_circulating)} sub={`${short(o.points_redeemed_month)} ditukar bulan ini`} />
      </div>

      <div className="flex flex-wrap gap-4">
        <section className={`${cardClass} flex min-w-0 flex-[2_1_420px] flex-col gap-4 p-5`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[20px] font-semibold">Warga aktif per minggu</h2>
            <span className="text-[14px] text-fg-soft">≥1 check-in · 12 minggu terakhir</span>
          </div>
          <div className="flex h-[200px] items-end gap-1.5">
            {weeks.map((w, i) => {
              const last = i === weeks.length - 1;
              return (
                <div key={w.week_start} className="flex flex-1 flex-col items-center justify-end gap-1 self-stretch">
                  {last && <span className="text-[13px] font-bold text-link">{formatNumber(w.active_citizens)}</span>}
                  <div
                    title={`${formatDate(w.week_start)}: ${w.active_citizens} warga`}
                    className={`w-full rounded-t-md ${last ? "bg-primary" : "bg-primary-soft/60"}`}
                    style={{ height: `${Math.max(4, Math.round((w.active_citizens / maxWeek) * 170))}px` }}
                  />
                </div>
              );
            })}
          </div>
          <div className="flex justify-between text-[13px] text-fg-soft">
            <span>{weeks[0] ? formatDate(weeks[0].week_start, { year: undefined }) : ""}</span>
            <span>{weeks.at(-1) ? formatDate(weeks.at(-1)!.week_start, { year: undefined }) : ""}</span>
          </div>
        </section>

        <section className={`${cardClass} flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 p-5`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[20px] font-semibold">Kelurahan teraktif</h2>
            <span className="text-[14px] text-fg-soft">bulan ini</span>
          </div>
          {villages.length === 0 && <span className="text-[16px] text-fg-soft">Belum ada check-in bulan ini.</span>}
          {villages.map((v, i) => (
            <div key={v.village_id} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[16px]">
                <span>
                  <b>{i + 1}</b> {v.name}
                </span>
                <span className="text-fg-soft">
                  {formatNumber(v.avg_xp)} XP · {v.active_citizens} warga
                </span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-track">
                <div className="h-full bg-primary" style={{ width: `${Math.round((v.avg_xp / maxVillage) * 100)}%` }} />
              </div>
            </div>
          ))}
          <span className="text-[14px] text-fg-soft">Rata-rata XP per warga aktif bulan ini. Peringkat resmi (min. 10 warga) di fitur leaderboard.</span>
        </section>
      </div>

      <section className={`${cardClass} flex flex-col gap-3 p-5`}>
        <h2 className="font-display text-[20px] font-semibold">Antrean</h2>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <QueueCard n={o.pending_organizers} title="Penyelenggara menunggu" sub={`${o.pending_merchants} merchant · ${o.pending_organizers - o.pending_merchants} komunitas`} href="/admin/verifikasi" tone="warn" />
          <QueueCard n={o.pending_activities} title="Aktivitas perlu review" sub={o.pending_activities ? `paling lama ${pendingDays} hari` : "tidak ada pengajuan"} href="/admin/aktivitas" tone="primary" />
          <QueueCard n={flagged} title="Check-in & misi ditandai" sub={`${o.flagged_checkins} di luar radius · ${o.open_pattern_flags} pola`} href="/admin/moderasi" tone="hot" />
          <QueueCard n={o.refunds_pending} title="Refund belum ditandai" sub="peserta lunas yang batal atau aktivitasnya dibatalkan" href="/admin/pembayaran" tone="neutral" />
          <QueueCard n={prizesToDeliver} title="Hadiah Event Global perlu dikirim" sub="sudah diklaim pemenang, cek flag lalu kirim" href="/admin/aktivitas?tab=global" tone="primary" />
        </div>
      </section>
    </>
  );
}

function Kpi({ label, value, sub, tone = "neutral" }: { label: string; value: string; sub: string; tone?: "success" | "neutral" }) {
  return (
    <div className={`${cardClass} flex flex-col gap-1.5 p-5`}>
      <span className="text-[16px] text-fg-soft">{label}</span>
      <span className="font-display text-[34px] font-bold leading-none">{value}</span>
      <span className={`text-[14px] font-semibold ${tone === "success" ? "text-success" : "text-fg-soft"}`}>{sub}</span>
    </div>
  );
}

function QueueCard({ n, title, sub, href, tone }: { n: number; title: string; sub: string; href?: string; tone: "warn" | "primary" | "hot" | "neutral" }) {
  const tones = {
    warn: "bg-warn-tint text-warn",
    primary: "bg-primary-tint text-link",
    hot: "bg-hot-tint text-hot",
    neutral: "bg-track text-fg-label",
  };
  const inner = (
    <>
      <span className={`flex size-12 shrink-0 items-center justify-center rounded-[14px] font-display text-[24px] font-bold ${tones[tone]}`}>{n}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[17px] font-semibold">{title}</span>
        <span className="text-[14px] text-fg-soft">{sub}</span>
      </span>
    </>
  );
  const cls = "flex items-center gap-3.5 rounded-[18px] border border-line bg-bg p-4 text-fg";
  return href ? (
    <a href={href} className={cls}>
      {inner}
    </a>
  ) : (
    <div className={`${cls} opacity-70`}>{inner}</div>
  );
}
