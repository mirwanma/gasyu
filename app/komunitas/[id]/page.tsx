import { Suspense } from "react";
import { StatusTag } from "@/components/activity-card";
import { Kpi, OrganizerShell, StatusBanner, TodoItem } from "@/components/organizer/shell";
import { cardClass } from "@/components/styles";
import { formatSchedule } from "@/lib/activities";
import { listOrganizerActivities } from "@/lib/data/activities";
import { getCommunityDashboard } from "@/lib/data/dashboards";
import { createClient } from "@/lib/supabase/server";

// Dashboard komunitas, mengikuti artboard "Komunitas · Dashboard".
// Angka dari v_community_dashboard dan v_community_member_stats.
export default function KomunitasDashboardPage({ params }: PageProps<"/komunitas/[id]">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Dashboard params={params} />
    </Suspense>
  );
}

async function Dashboard({ params }: Pick<PageProps<"/komunitas/[id]">, "params">) {
  const { id } = await params;
  return (
    <OrganizerShell organizerId={id} type="community" active="Dashboard">
      {({ org }) => <DashboardBody id={id} org={org} />}
    </OrganizerShell>
  );
}

async function DashboardBody({ id, org }: { id: string; org: { status: string } }) {
  const supabase = await createClient();
  const [{ data: stats }, d, activities] = await Promise.all([
    supabase.from("v_community_member_stats").select("*").eq("community_id", id).maybeSingle(),
    getCommunityDashboard(id),
    listOrganizerActivities(id),
  ]);
  const s = (stats ?? {}) as { active_members?: number; pending_requests?: number; new_members_month?: number; attending_members_30d?: number };
  const active = Number(s.active_members ?? 0);
  const pending = Number(s.pending_requests ?? 0);
  const attendPct = active > 0 ? Math.round((Number(s.attending_members_30d ?? 0) / active) * 100) : 0;
  const base = `/komunitas/${id}`;
  const upcoming = activities.filter((a) => !["ended", "settled", "cancelled"].includes(a.status)).slice(0, 3);

  const todos: { n: number; title: string; sub?: string; href: string; tone?: "warn" | "info" | "primary" }[] = [];
  if (pending > 0) todos.push({ n: pending, title: "Permintaan bergabung", href: `${base}/member` });
  if (org.status === "rejected") todos.push({ n: 1, title: "Perbaiki data pendaftaran", sub: "Lihat catatan tim Ramein", href: `${base}/profil` });
  if (d && d.payments_pending > 0) todos.push({ n: d.payments_pending, title: "Pembayaran menunggu konfirmasi", sub: "Cek bukti bayar di halaman Peserta", href: `${base}/aktivitas` });
  if (d && d.mission_proofs_pending > 0) todos.push({ n: d.mission_proofs_pending, title: "Bukti foto misi", href: `${base}/aktivitas`, tone: "info" });
  if (d && d.partner_invites_pending > 0) todos.push({ n: d.partner_invites_pending, title: "Undangan kolaborasi", sub: "Jawab di menu Kolaborasi", href: `${base}/kolaborasi`, tone: "primary" });
  if (d && d.awaiting_partner_activities > 0) todos.push({ n: d.awaiting_partner_activities, title: "Menunggu jawaban partner", sub: "Aktivitas belum bisa diajukan ke tim Ramein", href: `${base}/aktivitas`, tone: "info" });
  if (d && d.draft_activities > 0) todos.push({ n: d.draft_activities, title: "Draft belum diajukan", sub: "Lengkapi checkpoint lalu ajukan", href: `${base}/aktivitas`, tone: "info" });

  return (
    <>
      <StatusBanner org={org as never} base={base} />

      <div className="grid grid-cols-3 gap-2.5">
        <Kpi cols={3} label="berjalan" value={String(d?.running_activities ?? 0)} />
        <Kpi cols={3} label="peserta" value={(d?.participants ?? 0).toLocaleString("id-ID")} />
        <Kpi cols={3} label="check-in hari ini" value={String(d?.checkins_today ?? 0)} />
      </div>

      <a href={`${base}/member`} className={`${cardClass} flex flex-col gap-3 p-4 text-fg`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Member</h2>
          <span className="text-[13px] font-semibold text-link">Kelola</span>
        </div>
        <div className="flex items-end gap-[18px]">
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[32px] font-bold leading-none">{active}</span>
            <span className="text-[12px] text-fg-soft">member aktif</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[20px] font-semibold leading-none text-success">+{Number(s.new_members_month ?? 0)}</span>
            <span className="text-[12px] text-fg-soft">bulan ini</span>
          </div>
          <div className="flex flex-col gap-0.5">
            <span className="font-display text-[20px] font-semibold leading-none text-warn">{pending}</span>
            <span className="text-[12px] text-fg-soft">menunggu</span>
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[12px]">
            <span className="text-fg-soft">Member hadir 30 hari terakhir</span>
            <span className="font-semibold">{attendPct}%</span>
          </div>
          <div className="h-2 overflow-hidden rounded-md bg-track">
            <div className="h-full bg-hot" style={{ width: `${attendPct}%` }} />
          </div>
        </div>
      </a>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-[18px] font-semibold">Perlu tindakan</h2>
        {todos.length === 0 ? (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Tidak ada yang perlu ditindak. Mantap.</p>
        ) : (
          todos.map((t) => <TodoItem key={t.title} n={t.n} title={t.title} sub={t.sub} href={t.href} tone={t.tone} />)
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Aktivitas</h2>
          <a href={`${base}/aktivitas`} className="text-[13px] font-semibold text-link">
            Kelola
          </a>
        </div>
        {activities.length === 0 ? (
          <a href={`${base}/aktivitas/baru`} className={`${cardClass} block p-4 text-[13px] text-fg-soft`}>
            Belum ada aktivitas. Buat event pertama untuk member dan warga.
          </a>
        ) : upcoming.length === 0 ? (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Semua aktivitas sudah selesai. {activities.length} total.</p>
        ) : (
          upcoming.map((a) => (
            <a key={a.id} href={`${base}/aktivitas/${a.id}`} className={`${cardClass} flex flex-col gap-1 p-3.5 text-fg`}>
              <div className="flex items-start justify-between gap-2">
                <span className="text-[14px] font-semibold leading-[1.3]">{a.title}</span>
                {a.audience === "members_only" ? <span className="inline-flex items-center rounded-[10px] bg-hot-tint px-2 py-[3px] text-[11px] font-bold text-hot">Khusus member</span> : <StatusTag status={a.status} />}
              </div>
              <span className="text-[12px] text-fg-soft">
                {formatSchedule(a.starts_at, a.ends_at)} · {a.seats_taken} {a.status === "running" ? "peserta" : "terdaftar"}
                {a.partner_count > 0 ? ` · ${a.partner_count} partner` : ""}
                {a.is_paid ? "" : " · gratis"}
              </span>
            </a>
          ))
        )}
      </section>
    </>
  );
}
