import { Suspense } from "react";
import Link from "next/link";
import { OrganizerAvatar } from "@/components/avatar";
import { cardClass, tagClass } from "@/components/styles";
import { listRefundQueue } from "@/lib/data/payments";
import { formatDateTime, timeAgo } from "@/lib/format";

// Admin · Pembayaran: aktivitas dibatalkan (atau peserta batal) yang masih punya
// peserta lunas belum di-refund. Uang tidak lewat Gasyu, jadi admin hanya
// memantau dan menghubungi penyelenggara; tim host yang menandai refund.
export default function PembayaranPage() {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Pembayaran</h1>
        <span className="text-[14px] text-fg-soft">Refund yang belum ditandai penyelenggara. Gasyu tidak memegang uang; hubungi penyelenggara jika peserta mengeluh.</span>
      </div>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Queue />
      </Suspense>
    </>
  );
}

async function Queue() {
  const rows = await listRefundQueue();
  const total = rows.reduce((s, r) => s + r.refund_due, 0);
  return (
    <>
      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className={`font-display text-[26px] font-semibold ${total > 0 ? "text-danger" : "text-fg"}`}>{total}</span>
          <span className="text-[12px] text-fg-soft">peserta lunas belum di-refund</span>
        </div>
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="font-display text-[26px] font-semibold">{rows.length}</span>
          <span className="text-[12px] text-fg-soft">aktivitas terkait</span>
        </div>
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="font-display text-[26px] font-semibold">
            Rp{rows.reduce((s, r) => s + r.refund_due * (r.price_idr ?? 0), 0).toLocaleString("id-ID")}
          </span>
          <span className="text-[12px] text-fg-soft">perkiraan nilai (informasi saja)</span>
        </div>
      </div>

      {rows.length === 0 ? (
        <p className={`${cardClass} p-5 text-[13px] text-fg-soft`}>Tidak ada refund yang tertunda.</p>
      ) : (
        <section className={`${cardClass} overflow-hidden`}>
          {rows.map((r) => (
            <div key={r.activity_id} className="flex flex-wrap items-center gap-3 border-b border-line px-5 py-4 last:border-b-0">
              <OrganizerAvatar name={r.host_name} type={r.host_type} logoUrl={null} size={40} />
              <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{r.title}</span>
                <span className="text-[12px] text-fg-soft">
                  {r.host_name} · {r.activity_status === "cancelled" ? `aktivitas dibatalkan ${timeAgo(r.cancelled_at)}` : "peserta membatalkan"} · Rp{(r.price_idr ?? 0).toLocaleString("id-ID")} / orang
                  {r.oldest_due_at ? ` · menunggu sejak ${formatDateTime(r.oldest_due_at)}` : ""}
                </span>
              </span>
              <span className="flex flex-col items-end gap-1">
                <span className={`${tagClass.base} ${tagClass.hot}`}>{r.refund_due} belum refund</span>
                {r.refunded > 0 && <span className={`${tagClass.base} ${tagClass.success}`}>{r.refunded} sudah</span>}
              </span>
              <span className="flex gap-2">
                {r.host_whatsapp && (
                  <a href={`https://wa.me/62${r.host_whatsapp.replace(/^0/, "")}`} target="_blank" rel="noreferrer" className="flex h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-[12px] font-semibold text-fg">
                    Hubungi host
                  </a>
                )}
                {r.host_type === "platform" ? (
                  <Link href={`/admin/aktivitas/peserta?aid=${r.activity_id}&tab=refund`} className="flex h-9 items-center rounded-full bg-fg px-3 text-[12px] font-semibold text-bg">
                    Tandai refund
                  </Link>
                ) : (
                  <Link href={`/admin/aktivitas?tab=semua&pilih=${r.activity_id}`} className="flex h-9 items-center rounded-full border border-line-strong bg-surface px-3 text-[12px] font-semibold text-fg">
                    Lihat aktivitas
                  </Link>
                )}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
