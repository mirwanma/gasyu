import { PaymentProofForm } from "./payment-form";
import { Icon } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import { PAYMENT_LABELS, formatPrice, type PaymentStatus } from "@/lib/activities";
import { formatDateTime, whatsappUrl } from "@/lib/format";

// Bagian "Pembayaran" di halaman aktivitas warga (ALUR bagian 8): harga, cara
// bayar dari penyelenggara, status, batas waktu, unggah atau ganti bukti, dan chat panitia.
export function PaymentSection({
  participationId,
  activityId,
  paymentStatus,
  dueAt,
  note,
  priceIdr,
  instructions,
  cancelled,
  hostWhatsapp,
  activityTitle,
}: {
  participationId: string;
  activityId: string;
  paymentStatus: PaymentStatus;
  dueAt: string | null;
  note: string | null;
  priceIdr: number | null;
  instructions: string | null;
  cancelled: boolean;
  hostWhatsapp: string | null;
  activityTitle: string;
}) {
  if (paymentStatus === "not_required") return null;
  const tone: Record<PaymentStatus, keyof typeof tagClass> = { not_required: "neutral", unpaid: "warn", awaiting_confirmation: "info", paid: "success", refunded: "info" };
  const headline =
    paymentStatus === "paid" ? "Lunas. Kamu bisa check-in dan mengerjakan misi."
    : paymentStatus === "awaiting_confirmation" ? "Bukti bayar sedang dicek panitia"
    : paymentStatus === "refunded" ? "Dana sudah dikembalikan penyelenggara."
    : cancelled ? "Pendaftaran dibatalkan karena lewat batas bayar."
    : "Check-in dan misi terbuka setelah lunas";

  const chatUrl = whatsappUrl(hostWhatsapp, `Halo panitia ${activityTitle}, saya peserta yang terdaftar di Gasyu. Mau tanya soal pembayaran.`);

  return (
    <section id="bayar" className={`${cardClass} flex flex-col gap-3 p-4 ${paymentStatus === "paid" ? "border-success/40" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${paymentStatus === "paid" ? "bg-success-tint text-success" : "bg-warn-tint text-warn"}`}>
          <Icon name={paymentStatus === "paid" ? "check" : "wallet"} size={18} stroke={2} />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-2">
            <span className="font-display text-[18px] font-semibold">Pembayaran</span>
            <span className={`${tagClass.base} ${tagClass[tone[paymentStatus]]}`}>{PAYMENT_LABELS[paymentStatus]}</span>
          </span>
          <span className="text-[15px] text-fg-label">{headline}</span>
        </span>
        <span className="text-[16px] font-bold">{formatPrice(priceIdr, true)}</span>
      </div>
      {paymentStatus === "unpaid" && !cancelled && (
        <>
          {instructions && (
            <div className="flex flex-col gap-1 rounded-2xl bg-track/60 p-3">
              <span className="text-[12px] font-bold uppercase tracking-wide text-fg-soft">Cara bayar</span>
              <p className="text-[15px] leading-[1.6] whitespace-pre-line">{instructions}</p>
            </div>
          )}
          {dueAt && <span className="text-[13px] text-warn">Bayar sebelum {formatDateTime(dueAt)}, kalau tidak pendaftaran dibatalkan otomatis.</span>}
          {note && <span className="rounded-xl bg-danger-tint px-3 py-2 text-[13px] text-danger">Bukti sebelumnya ditolak: {note}</span>}
          <span className="text-[13px] leading-[1.5] text-fg-soft">Sudah transfer? Kirim bukti supaya panitia cepat mengonfirmasi. Bayar tunai di lokasi? Panitia yang menandai lunas.</span>
          <PaymentProofForm participationId={participationId} activityId={activityId} retry={!!note} />
        </>
      )}
      {paymentStatus === "awaiting_confirmation" && !cancelled && (
        <>
          <span className="text-[13px] text-fg-soft">Kamu akan dapat notifikasi saat panitia mengonfirmasi. Uang tidak lewat Gasyu. Salah kirim foto? Ganti buktinya selama belum dikonfirmasi.</span>
          <PaymentProofForm participationId={participationId} activityId={activityId} replace />
        </>
      )}
      {chatUrl && (
        <a href={chatUrl} target="_blank" rel="noreferrer" className="flex h-10 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold text-fg">
          <Icon name="chat" size={16} />
          Chat panitia di WhatsApp
        </a>
      )}
    </section>
  );
}
