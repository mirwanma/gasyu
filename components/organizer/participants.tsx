import Link from "next/link";
import { notFound } from "next/navigation";
import { Icon } from "@/components/icons";
import { StatusTag } from "@/components/activity-card";
import { cardClass, chipClass, inputClass, smallButton, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { decidePayment } from "@/lib/actions/payments";
import { PARTICIPATION_LABELS, PAYMENT_LABELS, formatPrice, type ParticipationStatus, type PaymentStatus } from "@/lib/activities";
import { getActivityCard } from "@/lib/data/activities";
import { getPaymentStats } from "@/lib/data/payments";
import { formatDateTime, timeAgo } from "@/lib/format";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

// Halaman "Peserta dan pembayaran" untuk tim host (merchant, komunitas, admin
// untuk event Gasyu), mengikuti artboard "Penyelenggara · Peserta":
// ringkasan status bayar, tab, daftar peserta dengan aksi Lihat bukti / Tolak /
// Lunas / Tandai lunas (bayar di lokasi) / Tandai refund.

export type PesertaQuery = { tab?: string; hasil?: string; error?: string };

type Row = {
  id: string;
  user_id: string;
  nickname: string;
  village_name: string | null;
  status: ParticipationStatus;
  payment_status: PaymentStatus;
  payment_due_at: string | null;
  payment_proof_path: string | null;
  payment_note: string | null;
  payment_confirmed_at: string | null;
  refunded_at: string | null;
  created_at: string;
  group_id: string | null;
};

const PAY_TONE: Record<PaymentStatus, keyof typeof tagClass> = { not_required: "neutral", unpaid: "neutral", awaiting_confirmation: "warn", paid: "success", refunded: "info" };
const TABS: [string, string][] = [
  ["cek", "Cek bukti"],
  ["belum", "Belum bayar"],
  ["lunas", "Lunas"],
  ["refund", "Refund"],
  ["semua", "Semua"],
];

export async function PesertaBody({
  organizerId,
  type,
  aid,
  query,
  selfHref,
  backHref,
}: {
  organizerId: string;
  type: "merchant" | "community" | "admin";
  aid: string;
  query: PesertaQuery;
  selfHref: string;
  backHref: string;
}) {
  const supabase = await createClient();
  const [card, { data }, payStats] = await Promise.all([
    getActivityCard(aid),
    supabase
      .from("v_activity_participants")
      .select("id, user_id, nickname, village_name, status, payment_status, payment_due_at, payment_proof_path, payment_note, payment_confirmed_at, refunded_at, created_at, group_id")
      .eq("activity_id", aid)
      .order("created_at", { ascending: false }),
    getPaymentStats(aid),
  ]);
  if (!card) notFound();
  const isHost = type === "admin" ? card.host_type === "platform" : card.host_organizer_id === organizerId;
  if (!isHost) notFound();
  const rows = (data ?? []) as Row[];
  const sep = selfHref.includes("?") ? "&" : "?";
  const link = (tab: string) => `${selfHref}${sep}tab=${tab}`;
  const activeRows = rows.filter((r) => ["invited", "registered", "in_progress", "completed"].includes(r.status));
  const refundRows = rows.filter((r) => r.payment_status === "refunded" || (r.payment_status === "paid" && (r.status === "cancelled" || card.status === "cancelled")));
  const tab = card.is_paid ? (TABS.some(([k]) => k === query.tab) ? query.tab! : rows.some((r) => r.payment_status === "awaiting_confirmation") ? "cek" : "semua") : "semua";
  const shown =
    tab === "cek" ? activeRows.filter((r) => r.payment_status === "awaiting_confirmation")
    : tab === "belum" ? activeRows.filter((r) => r.payment_status === "unpaid")
    : tab === "lunas" ? activeRows.filter((r) => r.payment_status === "paid")
    : tab === "refund" ? refundRows
    : rows;
  const count = (s: ParticipationStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const summary: [string, number, string][] = card.is_paid && payStats
    ? [
        ["Cek bukti", payStats.awaiting_confirmation, payStats.awaiting_confirmation > 0 ? "text-warn" : "text-fg"],
        ["Belum bayar", payStats.unpaid, "text-fg"],
        ["Lunas", payStats.paid, "text-success"],
        ["Perlu refund", payStats.refund_due, payStats.refund_due > 0 ? "text-danger" : "text-fg-soft"],
      ]
    : [
        ["Terdaftar", count(["invited", "registered", "in_progress"]), "text-fg"],
        ["Selesai", count(["completed"]), "text-success"],
        ["Batal", count(["cancelled", "not_completed"]), "text-fg-soft"],
      ];
  const notices: Record<string, string> = {
    lunas: "Pembayaran ditandai lunas. Peserta diberi tahu dan sudah bisa check-in.",
    tolak: "Bukti ditolak dan peserta diberi tahu. Ia bisa mengirim bukti lagi.",
    refund: "Refund ditandai selesai dan peserta diberi tahu.",
  };
  // Bukti bayar dibaca lewat signed URL berumur pendek (bucket privat).
  const proofs = new Map<string, string | null>();
  await Promise.all(shown.filter((r) => r.payment_proof_path).map(async (r) => proofs.set(r.id, await signedUrl(supabase, "payment-proofs", r.payment_proof_path))));

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={backHref} aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
          <Icon name="back" size={20} stroke={2} />
        </Link>
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="font-display text-[22px] font-semibold leading-tight">{card.is_paid ? "Peserta dan pembayaran" : "Peserta"}</h1>
          <span className="flex items-center gap-2 text-[13px] text-fg-soft">
            <StatusTag status={card.status} /> {card.title} · {formatPrice(card.price_idr, card.is_paid)}{card.is_paid ? " / orang" : ""}
          </span>
        </div>
      </div>
      {query.hasil && notices[query.hasil] && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">{notices[query.hasil]}</p>}
      {query.error && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[15px] font-semibold text-danger">{query.error}</p>}

      <div className={`grid gap-2.5 ${summary.length === 4 ? "grid-cols-4" : "grid-cols-3"}`}>
        {summary.map(([k, v, tone]) => (
          <div key={k} className={`${cardClass} flex flex-col gap-1 p-3`}>
            <span className={`font-display text-[24px] font-semibold ${tone}`}>{v}</span>
            <span className="text-[12px] text-fg-soft">{k}</span>
          </div>
        ))}
      </div>
      {card.is_paid && payStats && (
        <p className="text-[13px] text-fg-soft">
          Perkiraan diterima Rp{payStats.expected_idr.toLocaleString("id-ID")} dari {payStats.paid} peserta lunas (informasi saja, dana tidak lewat Gasyu).
        </p>
      )}

      {card.is_paid && (
        <div className="flex flex-wrap gap-2">
          {TABS.map(([key, label]) => {
            const n = key === "cek" ? activeRows.filter((r) => r.payment_status === "awaiting_confirmation").length : key === "refund" ? refundRows.filter((r) => r.payment_status === "paid").length : 0;
            return (
              <a key={key} href={link(key)} className={`${chipClass.base} ${tab === key ? chipClass.selected : chipClass.idle}`}>
                {label}{n > 0 ? ` · ${n}` : ""}
              </a>
            );
          })}
        </div>
      )}

      {shown.length === 0 ? (
        <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>{rows.length === 0 ? "Belum ada peserta." : "Tidak ada peserta di tab ini."}</p>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {shown.map((r) => {
            const refundDue = r.payment_status === "paid" && (r.status === "cancelled" || card.status === "cancelled");
            const showPay = card.is_paid && r.payment_status !== "not_required";
            const proof = proofs.get(r.id);
            return (
              <div key={r.id} className="flex flex-col gap-2.5 border-b border-line px-4 py-3 last:border-b-0">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-tint text-[15px] font-bold uppercase text-link">{r.nickname.slice(0, 2)}</span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{r.nickname}</span>
                    <span className="text-[13px] text-fg-soft">
                      {r.village_name ?? "Luar Cimahi"} · {r.group_id ? "grup" : "pribadi"} · {timeAgo(r.created_at)}
                      {showPay && r.payment_status === "unpaid" && r.payment_due_at && r.status !== "cancelled" ? ` · batas ${formatDateTime(r.payment_due_at)}` : ""}
                      {showPay && r.payment_status === "paid" && r.payment_confirmed_at ? ` · lunas ${formatDateTime(r.payment_confirmed_at)}` : ""}
                      {r.payment_status === "refunded" && r.refunded_at ? ` · refund ${formatDateTime(r.refunded_at)}` : ""}
                    </span>
                    {showPay && r.payment_note && <span className="text-[12px] text-fg-muted">Catatan: {r.payment_note}</span>}
                  </span>
                  <span className="flex flex-col items-end gap-1">
                    <span className={`${tagClass.base} ${r.status === "completed" ? tagClass.success : r.status === "cancelled" || r.status === "not_completed" ? tagClass.neutral : tagClass.info}`}>
                      {PARTICIPATION_LABELS[r.status]}
                    </span>
                    {showPay && <span className={`${tagClass.base} ${refundDue ? tagClass.hot : tagClass[PAY_TONE[r.payment_status]]}`}>{refundDue ? "Perlu refund" : PAYMENT_LABELS[r.payment_status]}</span>}
                  </span>
                </div>

                {showPay && r.payment_status === "awaiting_confirmation" && ["registered", "in_progress"].includes(r.status) && (
                  <div className="flex flex-col gap-2 rounded-2xl bg-track/50 p-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {proof ? (
                        <a href={proof} target="_blank" rel="noreferrer" className={smallButton.outline}>Lihat bukti</a>
                      ) : (
                        <span className="text-[13px] text-fg-soft">Bukti belum bisa dibuka.</span>
                      )}
                      <form action={decidePayment} className="ml-auto">
                        <input type="hidden" name="participation_id" value={r.id} />
                        <input type="hidden" name="decision" value="paid" />
                        <input type="hidden" name="back" value={link(tab)} />
                        <SubmitButton size="small" variant="dark" pendingText="Menyimpan…">Lunas</SubmitButton>
                      </form>
                    </div>
                    <form action={decidePayment} className="flex gap-2">
                      <input type="hidden" name="participation_id" value={r.id} />
                      <input type="hidden" name="decision" value="reject" />
                      <input type="hidden" name="back" value={link(tab)} />
                      <input name="note" required maxLength={200} placeholder="Alasan menolak (dikirim ke peserta)" aria-label="Alasan menolak" className={`${inputClass} h-10 flex-1 text-[15px]`} />
                      <SubmitButton size="small" variant="danger" pendingText="…">Tolak</SubmitButton>
                    </form>
                  </div>
                )}
                {showPay && r.payment_status === "unpaid" && ["registered", "in_progress"].includes(r.status) && (
                  <form action={decidePayment} className="flex items-center gap-2">
                    <input type="hidden" name="participation_id" value={r.id} />
                    <input type="hidden" name="decision" value="paid" />
                    <input type="hidden" name="note" value="Bayar di lokasi" />
                    <input type="hidden" name="back" value={link(tab)} />
                    <SubmitButton size="small" variant="ghost" pendingText="Menyimpan…">Tandai lunas (bayar di lokasi)</SubmitButton>
                  </form>
                )}
                {refundDue && (
                  <form action={decidePayment} className="flex gap-2">
                    <input type="hidden" name="participation_id" value={r.id} />
                    <input type="hidden" name="decision" value="refund" />
                    <input type="hidden" name="back" value={link(tab)} />
                    <input name="note" maxLength={200} placeholder="Catatan (opsional), mis. transfer kembali 12 Okt" aria-label="Catatan refund" className={`${inputClass} h-10 flex-1 text-[15px]`} />
                    <SubmitButton size="small" variant="dark" pendingText="…">Tandai refund</SubmitButton>
                  </form>
                )}
              </div>
            );
          })}
        </div>
      )}
      {card.is_paid && <p className="text-[13px] text-fg-soft">Peserta yang belum bayar lewat batas waktu dibatalkan otomatis dan kursinya kembali. Peserta lunas yang membatalkan perlu kamu refund di luar aplikasi, lalu tandai di sini.</p>}
    </>
  );
}
