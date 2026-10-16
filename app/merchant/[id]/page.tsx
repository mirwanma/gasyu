import { Suspense } from "react";
import { Kpi, OrganizerShell, StatusBanner, TodoItem } from "@/components/organizer/shell";
import { cardClass } from "@/components/styles";
import { countTodayCheckins } from "@/lib/data/checkins";
import { createClient } from "@/lib/supabase/server";

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
  const supabase = await createClient();
  const [{ count: outlets }, { count: team }, { data: acts }, checkinsToday] = await Promise.all([
    supabase.from("merchant_outlets").select("id", { count: "exact", head: true }).eq("organizer_id", id).eq("is_active", true),
    supabase.from("organizer_members").select("user_id", { count: "exact", head: true }).eq("organizer_id", id),
    supabase.from("v_activity_cards").select("id, status, seats_taken").eq("host_organizer_id", id),
    countTodayCheckins(id),
  ]);
  const activities = (acts ?? []) as { id: string; status: string; seats_taken: number }[];
  const running = activities.filter((a) => a.status === "published" || a.status === "running");
  const drafts = activities.filter((a) => a.status === "draft");
  const participants = activities.reduce((sum, a) => sum + a.seats_taken, 0);
  const base = `/merchant/${id}`;

  return (
    <>
      <StatusBanner org={org as never} base={base} />

      <div className="grid grid-cols-2 gap-2.5">
        <Kpi label="Aktivitas berjalan" value={String(running.length)} sub={activities.length === 0 ? "belum ada aktivitas" : `${activities.length} total`} />
        <Kpi label="Peserta" value={String(participants)} sub="semua aktivitas" />
        <Kpi label="Check-in hari ini" value={String(checkinsToday)} />
        <Kpi label="Outlet aktif" value={String(outlets ?? 0)} sub={`${team ?? 0} anggota tim`} />
      </div>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-[18px] font-semibold">Perlu tindakan</h2>
        {org.status === "rejected" ? (
          <TodoItem n={1} title="Perbaiki data pendaftaran" sub="Lihat catatan tim Ramein" href={`${base}/profil`} />
        ) : (outlets ?? 0) === 0 ? (
          <TodoItem n={1} title="Tambah outlet" sub="Minimal satu outlet aktif" href={`${base}/outlet`} tone="info" />
        ) : drafts.length > 0 ? (
          <TodoItem n={drafts.length} title="Draft belum diajukan" sub="Lengkapi checkpoint lalu ajukan ke tim Ramein" href={`${base}/aktivitas`} />
        ) : (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Tidak ada yang perlu ditindak. Mantap.</p>
        )}
      </section>

      <section className={`${cardClass} flex flex-col gap-3 p-4`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Poin dan voucher</h2>
          <span className="text-[12px] font-semibold text-fg-muted">segera hadir</span>
        </div>
        <p className="text-[13px] leading-[1.5] text-fg-soft">
          Budget poin, voucher, dan mode kasir terbuka setelah fitur aktivitas dan reward dirilis.
        </p>
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
