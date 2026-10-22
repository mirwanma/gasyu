import { Suspense } from "react";
import { cardClass } from "@/components/styles";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

const ACTION_LABELS: Record<string, string> = {
  approve_organizer: "Menyetujui penyelenggara",
  reject_organizer: "Menolak penyelenggara",
};

export default function AuditPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] font-bold">Audit</h1>
        <span className="text-[17px] text-fg-soft">Riwayat tindakan admin, 100 terakhir.</span>
      </div>
      <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
        <AuditList />
      </Suspense>
    </>
  );
}

async function AuditList() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("admin_actions")
    .select("id, action, target_table, target_id, note, created_at, admin:profiles!admin_actions_admin_id_fkey(nickname)")
    .order("created_at", { ascending: false })
    .limit(100);
  const rows = (data ?? []) as {
    id: string;
    action: string;
    note: string | null;
    created_at: string;
    admin: { nickname: string } | { nickname: string }[] | null;
  }[];

  return (
    <section className={`${cardClass} overflow-hidden`}>
      {rows.length === 0 && <p className="p-5 text-[16px] text-fg-soft">Belum ada tindakan tercatat.</p>}
      {rows.map((row, i) => {
        const admin = (Array.isArray(row.admin) ? row.admin[0] : row.admin) as { nickname: string } | null;
        return (
          <div key={row.id} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="min-w-[150px] text-[14px] text-fg-soft">{formatDateTime(row.created_at)}</span>
            <span className="min-w-[100px] text-[16px] font-semibold">{admin?.nickname ?? "-"}</span>
            <span className="flex-1 text-[16px]">{ACTION_LABELS[row.action] ?? row.action}</span>
            {row.note && <span className="text-[14px] text-fg-soft">{row.note}</span>}
          </div>
        );
      })}
    </section>
  );
}
