import { Suspense } from "react";
import { Kpi, OrganizerShell, StatusBanner, TodoItem } from "@/components/organizer/shell";
import { cardClass } from "@/components/styles";
import { createClient } from "@/lib/supabase/server";

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
  const [{ data: stats }, { data: acts }] = await Promise.all([
    supabase.from("v_community_member_stats").select("*").eq("community_id", id).maybeSingle(),
    supabase.from("v_activity_cards").select("id, status, seats_taken").eq("host_organizer_id", id),
  ]);
  const activities = (acts ?? []) as { id: string; status: string; seats_taken: number }[];
  const running = activities.filter((a) => a.status === "published" || a.status === "running");
  const drafts = activities.filter((a) => a.status === "draft");
  const participants = activities.reduce((sum, a) => sum + a.seats_taken, 0);
  const s = (stats ?? {}) as { active_members?: number; pending_requests?: number; new_members_month?: number; attending_members_30d?: number };
  const active = Number(s.active_members ?? 0);
  const pending = Number(s.pending_requests ?? 0);
  const attendPct = active > 0 ? Math.round((Number(s.attending_members_30d ?? 0) / active) * 100) : 0;
  const base = `/komunitas/${id}`;

  return (
    <>
      <StatusBanner org={org as never} base={base} />

      <div className="grid grid-cols-3 gap-2.5">
        <Kpi cols={3} label="berjalan" value={String(running.length)} />
        <Kpi cols={3} label="peserta" value={String(participants)} />
        <Kpi cols={3} label="check-in hari ini" value="0" />
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
        {pending > 0 && <TodoItem n={pending} title="Permintaan bergabung" href={`${base}/member`} />}
        {org.status === "rejected" && (
          <TodoItem n={1} title="Perbaiki data pendaftaran" sub="Lihat catatan tim Ramein" href={`${base}/profil`} />
        )}
        {drafts.length > 0 && <TodoItem n={drafts.length} title="Draft belum diajukan" sub="Lengkapi checkpoint lalu ajukan" href={`${base}/aktivitas`} tone="info" />}
        {pending === 0 && org.status !== "rejected" && drafts.length === 0 && (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Tidak ada yang perlu ditindak. Mantap.</p>
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
        ) : (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>
            {running.length} berjalan · {drafts.length} draft · {activities.length} total
          </p>
        )}
      </section>
    </>
  );
}
