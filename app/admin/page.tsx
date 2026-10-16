import { Suspense } from "react";
import { cardClass } from "@/components/styles";
import { formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

export default function AdminRingkasanPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Ringkasan kota</h1>
        <span className="text-[14px] text-fg-soft">Cimahi · pilot</span>
      </div>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Overview />
      </Suspense>
    </>
  );
}

async function Overview() {
  const supabase = await createClient();
  const weekAgo = weekAgoIso();
  const [citizens, weeklyActive, merchants, communities, pending, villages] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).not("onboarded_at", "is", null).is("deleted_at", null),
    supabase.from("xp_ledger").select("user_id").gte("created_at", weekAgo),
    supabase.from("organizers").select("id", { count: "exact", head: true }).eq("type", "merchant").eq("status", "approved"),
    supabase.from("organizers").select("id", { count: "exact", head: true }).eq("type", "community").eq("status", "approved"),
    supabase.from("organizers").select("id, type").eq("status", "pending"),
    supabase.from("profiles").select("home_village_id, village:regions(name)").not("home_village_id", "is", null).not("onboarded_at", "is", null),
  ]);

  const activeUsers = new Set((weeklyActive.data ?? []).map((row) => row.user_id)).size;
  const pendingMerchants = (pending.data ?? []).filter((o) => o.type === "merchant").length;
  const pendingCommunities = (pending.data ?? []).length - pendingMerchants;

  const perVillage = new Map<string, number>();
  for (const row of villages.data ?? []) {
    const village = (Array.isArray(row.village) ? row.village[0] : row.village) as { name: string } | null;
    if (village) perVillage.set(village.name, (perVillage.get(village.name) ?? 0) + 1);
  }
  const topVillages = [...perVillage.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxVillage = topVillages[0]?.[1] ?? 1;

  return (
    <>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi label="Warga terdaftar" value={formatNumber(citizens.count ?? 0)} sub="sudah onboarding" />
        <Kpi label="Warga aktif mingguan" value={formatNumber(activeUsers)} sub="dapat XP 7 hari terakhir" />
        <Kpi label="Penyelenggara aktif" value={`${merchants.count ?? 0} · ${communities.count ?? 0}`} sub="merchant · komunitas" />
        <Kpi label="Aktivitas berjalan" value="0" sub="fitur aktivitas menyusul" />
      </div>

      <div className="flex flex-wrap gap-4">
        <section className={`${cardClass} flex min-w-0 flex-[2_1_420px] flex-col gap-3 p-5`}>
          <h2 className="font-display text-[18px] font-semibold">Antrean</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <QueueCard
              n={(pending.data ?? []).length}
              title="Penyelenggara menunggu"
              sub={`${pendingMerchants} merchant · ${pendingCommunities} komunitas`}
              href="/admin/verifikasi"
              tone="warn"
            />
            <QueueCard n={0} title="Aktivitas perlu review" sub="fitur menyusul" tone="primary" />
            <QueueCard n={0} title="Check-in & misi ditandai" sub="fitur menyusul" tone="hot" />
            <QueueCard n={0} title="Refund belum ditandai" sub="fitur menyusul" tone="neutral" />
          </div>
        </section>

        <section className={`${cardClass} flex min-w-0 flex-[1_1_300px] flex-col gap-3.5 p-5`}>
          <h2 className="font-display text-[18px] font-semibold">Warga per kelurahan</h2>
          {topVillages.length === 0 && <span className="text-[13px] text-fg-soft">Belum ada warga Cimahi yang mendaftar.</span>}
          {topVillages.map(([name, count], i) => (
            <div key={name} className="flex flex-col gap-1.5">
              <div className="flex justify-between text-[13px]">
                <span>
                  <b>{i + 1}</b> {name}
                </span>
                <span className="text-fg-soft">{count} warga</span>
              </div>
              <div className="h-2 overflow-hidden rounded-md bg-track">
                <div className="h-full bg-primary" style={{ width: `${Math.round((count / maxVillage) * 100)}%` }} />
              </div>
            </div>
          ))}
          <span className="text-[12px] text-fg-soft">Peringkat XP per kelurahan menyusul di fitur leaderboard.</span>
        </section>
      </div>
    </>
  );
}

// Dipisah dari render supaya aturan "komponen harus murni" terpenuhi.
function weekAgoIso() {
  return new Date(Date.now() - 7 * 86400000).toISOString();
}

function Kpi({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className={`${cardClass} flex flex-col gap-1.5 p-5`}>
      <span className="text-[13px] text-fg-soft">{label}</span>
      <span className="font-display text-[32px] font-bold leading-none">{value}</span>
      <span className="text-[12px] font-semibold text-fg-soft">{sub}</span>
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
      <span className={`flex size-12 items-center justify-center rounded-[14px] font-display text-[20px] font-bold ${tones[tone]}`}>{n}</span>
      <span className="flex flex-col gap-0.5">
        <span className="text-[14px] font-semibold">{title}</span>
        <span className="text-[12px] text-fg-soft">{sub}</span>
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
