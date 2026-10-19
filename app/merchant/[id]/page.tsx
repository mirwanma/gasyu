import { Suspense } from "react";
import { Kpi, OrganizerShell, StatusBanner, TodoItem } from "@/components/organizer/shell";
import { SponsoredPrizes } from "@/components/organizer/sponsored-prizes";
import { cardClass } from "@/components/styles";
import { getMerchantDashboard, getReputation, listOutletVouchers } from "@/lib/data/dashboards";
import { formatDate } from "@/lib/format";
import { countNewSuggestions } from "@/lib/data/suggestions";
import { listSponsoredPrizes } from "@/lib/data/global-events";

// Dashboard merchant, mengikuti artboard "Merchant · Dashboard".
// Semua angka dari v_merchant_dashboard, v_merchant_outlet_vouchers, v_organizer_reputation.
export default function MerchantDashboardPage({ params }: PageProps<"/merchant/[id]">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: Pick<PageProps<"/merchant/[id]">, "params">) {
  const { id } = await params;
  return (
    <OrganizerShell organizerId={id} type="merchant" active="Dashboard">
      {({ org }) => <DashboardBody id={id} org={org} />}
    </OrganizerShell>
  );
}

async function DashboardBody({ id, org }: { id: string; org: { status: string; name: string } }) {
  const [d, outlets, rep, newSuggestions, sponsored] = await Promise.all([getMerchantDashboard(id), listOutletVouchers(id), getReputation(id), countNewSuggestions(id), listSponsoredPrizes(id)]);
  const base = `/merchant/${id}`;
  if (!d) {
    return (
      <>
        <StatusBanner org={org as never} base={base} />
        <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Data dashboard belum tersedia.</p>
      </>
    );
  }
  const visitors = d.new_citizens_30d + d.returning_citizens_30d;
  const newPct = visitors > 0 ? Math.round((d.new_citizens_30d / visitors) * 100) : 0;
  const budgetPct = d.points_budget > 0 ? Math.min(100, Math.round((d.points_used / d.points_budget) * 100)) : 0;
  const todos: { n: number; title: string; sub?: string; href: string; tone?: "warn" | "info" | "primary" }[] = [];
  if (org.status === "rejected") todos.push({ n: 1, title: "Perbaiki data pendaftaran", sub: "Lihat catatan tim Gasyu", href: `${base}/profil` });
  if (outlets.length === 0) todos.push({ n: 1, title: "Tambah outlet", sub: "Minimal satu outlet aktif", href: `${base}/outlet`, tone: "info" });
  if (d.payments_pending > 0) todos.push({ n: d.payments_pending, title: "Pembayaran menunggu konfirmasi", sub: "Cek bukti bayar di halaman Peserta aktivitas", href: `${base}/aktivitas`, tone: "warn" });
  if (d.mission_proofs_pending > 0) todos.push({ n: d.mission_proofs_pending, title: "Bukti foto misi", sub: "Tinjau di halaman Misi", href: `${base}/aktivitas`, tone: "info" });
  if (d.partner_invites_pending > 0) todos.push({ n: d.partner_invites_pending, title: "Undangan kolaborasi", sub: "Jawab di menu Kolaborasi", href: `${base}/kolaborasi`, tone: "primary" });
  if (d.partner_budget_empty > 0) todos.push({ n: d.partner_budget_empty, title: "Isi budget poin", sub: "Kamu partner di aktivitas lain tanpa budget poin", href: `${base}/kolaborasi`, tone: "primary" });
  if (d.draft_activities > 0) todos.push({ n: d.draft_activities, title: "Draft belum diajukan", sub: "Lengkapi checkpoint lalu ajukan ke tim Gasyu", href: `${base}/aktivitas` });
  if (newSuggestions > 0) todos.push({ n: newSuggestions, title: "Saran baru dari warga", sub: "Baca dan balas di menu Saran warga", href: `${base}/saran`, tone: "primary" });

  return (
    <>
      <StatusBanner org={org as never} base={base} />

      <div className="grid grid-cols-2 gap-2.5">
        <Kpi
          label="Aktivitas berjalan"
          value={String(d.running_activities)}
          sub={d.published_activities > 0 && d.next_starts_at ? `${d.published_activities} terbit, mulai ${formatDate(d.next_starts_at, { year: undefined })}` : d.running_activities > 0 ? "sedang berlangsung" : d.draft_activities > 0 ? `${d.draft_activities} draft` : "belum ada yang terbit"}
        />
        <Kpi label="Peserta" value={d.participants.toLocaleString("id-ID")} sub={d.participants_week > 0 ? `+${d.participants_week} minggu ini` : "semua aktivitas"} />
        <Kpi label="Check-in hari ini" value={String(d.checkins_today)} sub={`${d.vouchers_active} voucher aktif beredar`} />
        <Kpi label="Warga baru" value={visitors > 0 ? `${newPct}%` : "—"} sub={visitors > 0 ? `${100 - newPct}% pelanggan kembali · 30 hari` : "belum ada check-in 30 hari"} />
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-[18px] font-semibold">Perlu tindakan</h2>
        {todos.length === 0 ? (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Tidak ada yang perlu ditindak. Mantap.</p>
        ) : (
          todos.map((t) => <TodoItem key={t.title} n={t.n} title={t.title} sub={t.sub} href={t.href} tone={t.tone} />)
        )}
      </section>

      <a href={`${base}/reward`} className={`${cardClass} flex flex-col gap-3 p-4 text-fg`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Poin dan voucher</h2>
          <span className="text-[13px] font-semibold text-link">Kelola reward</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-fg-soft">Budget poin terpakai</span>
            <span className="font-semibold">
              {d.points_used.toLocaleString("id-ID")} / {d.points_budget.toLocaleString("id-ID")}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-md bg-track">
            <div className="h-full bg-points" style={{ width: `${budgetPct}%` }} />
          </div>
        </div>
        <div className="flex items-end gap-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[24px] font-bold leading-none">{d.vouchers_redeemed}</span>
            <span className="text-[12px] text-fg-soft">ditukar</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[24px] font-bold leading-none text-success">{d.vouchers_used}</span>
            <span className="text-[12px] text-fg-soft">dipakai</span>
          </div>
          {outlets.length > 0 && (
            <div className="flex min-w-0 flex-col gap-0.5">
              <span className="truncate font-display text-[18px] font-semibold leading-none">{outlets.map((o) => o.vouchers_used).join(" · ")}</span>
              <span className="truncate text-[12px] text-fg-soft">{outlets.map((o) => o.outlet_name.replace(/^(Cabang|Outlet)\s+/i, "")).join(" · ")}</span>
            </div>
          )}
        </div>
      </a>

      <SponsoredPrizes prizes={sponsored} />

      <section className={`${cardClass} flex flex-col gap-2 p-4`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Reputasi 90 hari</h2>
          <span className="font-display text-[22px] font-bold text-link">{rep?.score ?? 0}</span>
        </div>
        <div className="h-2 overflow-hidden rounded-md bg-track">
          <div className="h-full bg-primary" style={{ width: `${rep?.score ?? 0}%` }} />
        </div>
        <span className="text-[13px] text-fg-soft">
          {rep && rep.registered_90d > 0
            ? `Hadir ${rep.attendance_pct ?? 0}% · selesai ${rep.completion_pct ?? 0}% · ${rep.collabs_90d} kolaborasi`
            : "Belum ada aktivitas 90 hari terakhir. Reputasi naik dari tingkat hadir, selesai, dan kolaborasi."}
        </span>
      </section>

      {org.status === "approved" && (
        <a
          href={`${base}/aktivitas/baru`}
          className="fixed bottom-[104px] right-5 z-10 flex h-[52px] items-center gap-2 rounded-full bg-primary px-[18px] text-[15px] font-semibold text-on-primary shadow-[0_8px_20px_rgba(75,79,224,0.3)]"
        >
          + Buat aktivitas
        </a>
      )}
    </>
  );
}
