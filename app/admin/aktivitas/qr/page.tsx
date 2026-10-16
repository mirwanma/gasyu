import { Suspense } from "react";
import Link from "next/link";
import { QrDisplay } from "@/components/organizer/qr-display";
import { cardClass } from "@/components/styles";
import { listTodayCheckins } from "@/lib/data/checkins";
import { createClient } from "@/lib/supabase/server";
import { timeAgo } from "@/lib/format";

// QR checkpoint atas nama Ramein, ditampilkan panitia Ramein (admin).
export default function AdminQrPage({ searchParams }: PageProps<"/admin/aktivitas/qr">) {
  return (
    <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
      <Body searchParams={searchParams} />
    </Suspense>
  );
}

async function Body({ searchParams }: Pick<PageProps<"/admin/aktivitas/qr">, "searchParams">) {
  const { cp } = await searchParams;
  const checkpointId = typeof cp === "string" ? cp : "";
  const supabase = await createClient();
  const { data: checkpoint } = await supabase.from("activity_checkpoints").select("id, name, activity_id, activity:activities(title)").eq("id", checkpointId).maybeSingle();
  if (!checkpoint) return <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Checkpoint tidak ditemukan.</p>;
  const activity = (Array.isArray(checkpoint.activity) ? checkpoint.activity[0] : checkpoint.activity) as { title: string } | null;
  const feed = await listTodayCheckins(checkpointId);
  return (
    <div className="flex max-w-md flex-col gap-4">
      <Link href={`/admin/aktivitas?tab=semua&pilih=${checkpoint.activity_id}`} className="text-[13px] font-semibold text-link">← Kembali ke aktivitas</Link>
      <div className="flex flex-col gap-0.5">
        <h1 className="font-display text-[26px] font-bold">{checkpoint.name}</h1>
        <span className="text-[13px] text-fg-soft">{activity?.title} · QR atas nama Ramein</span>
      </div>
      <QrDisplay checkpointId={checkpointId} />
      <section className={`${cardClass} flex flex-col gap-2 p-3.5`}>
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-bold">Check-in hari ini</span>
          <span className="font-display text-[22px] font-semibold">{feed.length}</span>
        </div>
        {feed.slice(0, 10).map((row) => (
          <div key={row.id} className="flex justify-between text-[13px]">
            <span><b>{row.nickname}</b> <span className="text-fg-soft">{timeAgo(row.checked_in_at)}</span></span>
            <span className={`font-semibold ${row.review_status === "flagged" ? "text-warn" : "text-success"}`}>{row.review_status === "flagged" ? "Di luar radius" : "Di radius"}</span>
          </div>
        ))}
      </section>
    </div>
  );
}
