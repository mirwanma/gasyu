import { Suspense } from "react";
import Link from "next/link";
import { ClaimForm } from "./claim-form";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import { getMyShipping, listMyPrizes, type MyPrize } from "@/lib/data/global-events";
import { getCurrentUser } from "@/lib/data/user";
import { FULFILLMENT_LABELS, WINNER_STATUS_TONE, rankLabel } from "@/lib/global-events";
import { formatDateTime, formatNumber } from "@/lib/format";

const STATUS_LABELS: Record<MyPrize["status"], string> = {
  pending_claim: "Perlu diklaim",
  claimed: "Sedang diproses",
  delivered: "Sudah diterima",
  forfeited: "Hangus",
};

// Hadiah Event Global milik warga (ALUR bagian 22e): status, batas klaim, dan klaim.
export default function HadiahPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
            <Icon name="back" size={20} stroke={2} />
          </Link>
          <h1 className="font-display text-[26px] font-bold">Hadiah</h1>
        </div>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Prizes />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Beranda" />
    </>
  );
}

async function Prizes() {
  const user = await getCurrentUser();
  if (!user) return null;
  const prizes = await listMyPrizes(user.id);
  if (prizes.length === 0) {
    return (
      <div className={`${cardClass} flex flex-col gap-1.5 p-4`}>
        <span className="text-[15px] font-semibold">Belum ada hadiah</span>
        <span className="text-[13px] leading-[1.5] text-fg-soft">
          Hadiah dari Event Global muncul di sini saat kamu masuk peringkat pemenang. Lihat Event Global yang sedang dibuka di Jelajah.
        </span>
        <Link href="/jelajah?filter=global" className="text-[13px] font-semibold text-link">Lihat Event Global</Link>
      </div>
    );
  }
  return (
    <div className="flex flex-col gap-3.5">
      {prizes.map((p) => (
        <PrizeCard key={p.id} p={p} />
      ))}
    </div>
  );
}

async function PrizeCard({ p }: { p: MyPrize }) {
  const isBadge = p.prize.kind === "badge";
  const shipping = p.prize.fulfillment === "shipping" && !isBadge;
  // Hanya pemenang dan admin yang bisa membaca alamat, lewat get_winner_shipping.
  const myShipping = shipping && p.status !== "pending_claim" && p.status !== "forfeited" ? await getMyShipping(p.id) : null;
  const expired = p.status === "pending_claim" && isPast(p.claim_deadline);
  return (
    <section className={`${cardClass} flex flex-col gap-3 p-4 ${p.status === "forfeited" ? "opacity-70" : ""}`}>
      <div className="flex gap-3">
        {p.prize.image_url ? (
          // eslint-disable-next-line @next/next/no-img-element -- gambar hadiah dari bucket publik
          <img src={p.prize.image_url} alt="" className="size-16 shrink-0 rounded-2xl bg-track object-cover" />
        ) : (
          <span className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-hot-tint text-hot">
            <Icon name="ticket" size={26} stroke={1.8} />
          </span>
        )}
        <span className="flex min-w-0 flex-1 flex-col gap-0.5">
          <span className="text-[12px] font-bold text-hot">
            {rankLabel(p.rank, p.rank)} · skor {formatNumber(p.score)}
          </span>
          <span className="text-[15px] font-semibold leading-tight">{p.prize.title}</span>
          <Link href={`/aktivitas/${p.activity_id}/peringkat`} className="truncate text-[12px] text-link">{p.activity_title}</Link>
        </span>
        <span className={`${tagClass.base} ${tagClass[WINNER_STATUS_TONE[p.status]]} self-start`}>{isBadge && p.status === "delivered" ? "Masuk profil" : STATUS_LABELS[p.status]}</span>
      </div>
      {p.prize.description && <p className="text-[13px] leading-[1.5] text-fg-label">{p.prize.description}</p>}
      <span className="text-[12px] text-fg-soft">
        {isBadge ? "Badge eksklusif" : FULFILLMENT_LABELS[p.prize.fulfillment]}
        {p.prize.sponsor_name ? ` · Hadiah dari ${p.prize.sponsor_name}` : ""}
      </span>

      {p.status === "pending_claim" && !expired && (
        <>
          <p className="rounded-xl bg-warn-tint px-3 py-2 text-[12px] font-semibold text-warn">Klaim sebelum {formatDateTime(p.claim_deadline)}. Lewat batas ini hadiah hangus.</p>
          {p.prize.fulfillment === "pickup" && p.prize.pickup_note && <PickupNote note={p.prize.pickup_note} />}
          <ClaimForm winnerId={p.id} shipping={shipping} />
        </>
      )}
      {expired && <p className="rounded-xl bg-track px-3 py-2 text-[12px] text-fg-label">Batas klaim sudah lewat.</p>}
      {p.status === "claimed" && (
        <>
          <p className="rounded-xl bg-primary-tint px-3 py-2 text-[12px] text-link">
            Diklaim {p.claimed_at ? formatDateTime(p.claimed_at) : ""}. {shipping ? "Panitia Gasyu sedang menyiapkan pengiriman." : "Ambil hadiah sesuai petunjuk di bawah."}
          </p>
          {p.prize.fulfillment === "pickup" && p.prize.pickup_note && <PickupNote note={p.prize.pickup_note} />}
        </>
      )}
      {myShipping && (myShipping.address || myShipping.name) && (
        <div className="flex flex-col gap-0.5 rounded-xl bg-track px-3 py-2 text-[12px] text-fg-label">
          <span className="font-semibold">Dikirim ke: {myShipping.name} · {myShipping.phone}</span>
          <span className="whitespace-pre-line">{myShipping.address}</span>
        </div>
      )}
      {p.status === "delivered" && !isBadge && (
        <p className="rounded-xl bg-success-tint px-3 py-2 text-[12px] text-success">
          Hadiah diserahkan {p.delivered_at ? formatDateTime(p.delivered_at) : ""}{p.note ? ` · ${p.note}` : ""}.
        </p>
      )}
      {p.status === "forfeited" && <p className="rounded-xl bg-track px-3 py-2 text-[12px] text-fg-label">Hadiah hangus{p.forfeited_reason ? `: ${p.forfeited_reason}` : ""}.</p>}
    </section>
  );
}

// Dipisah dari render supaya aturan "komponen harus murni" terpenuhi.
function isPast(value: string) {
  return new Date(value).getTime() < Date.now();
}

function PickupNote({ note }: { note: string }) {
  return (
    <div className="flex items-start gap-2 rounded-xl border border-line px-3 py-2 text-[12px] leading-[1.5] text-fg-label">
      <Icon name="pin" size={16} stroke={2} className="mt-0.5 shrink-0 text-link" />
      <span>
        <b>Cara ambil:</b> {note}
      </span>
    </div>
  );
}
