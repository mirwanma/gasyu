import { Suspense } from "react";
import { RedeemButton, VoucherQr } from "./wallet-client";
import { OrganizerAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { cardClass } from "@/components/styles";
import { getWallet, listActiveRewards, listMyVouchers } from "@/lib/data/rewards";
import { getCurrentUser } from "@/lib/data/user";
import { formatDate } from "@/lib/format";

const VOUCHER_LABELS = { active: "VOUCHER AKTIF", used: "SUDAH DIPAKAI", expired: "KEDALUWARSA", refunded: "DI-REFUND" };

// Dompet poin dan voucher warga, mengikuti artboard "Warga · Dompet poin & voucher".
export default function DompetPage({ searchParams }: PageProps<"/dompet">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <h1 className="font-display text-[26px] font-bold">Dompet</h1>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Wallet searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Dompet" />
    </>
  );
}

async function Wallet({ searchParams }: Pick<PageProps<"/dompet">, "searchParams">) {
  const sp = await searchParams;
  const tab = sp.tab === "voucher" ? "voucher" : "tukar";
  const user = await getCurrentUser();
  if (!user) return null;
  const [wallet, rewards, vouchers] = await Promise.all([getWallet(), listActiveRewards(), listMyVouchers(user.id)]);
  const active = vouchers.filter((v) => v.status === "active");

  return (
    <>
      <section className="flex flex-col gap-2.5 rounded-3xl bg-linear-135 from-[#8E2A5C] to-hero-from p-5 text-[#F3F4FA]">
        <span className="text-[13px] text-[#F3DDEA]">Saldo poin</span>
        <span className="font-display text-[40px] font-bold leading-none tabular-nums">{wallet.balance.toLocaleString("id-ID")}</span>
        <span className="text-[12px] text-[#F3DDEA]">
          {wallet.expiring_30d > 0 && wallet.next_expiry_at
            ? `${wallet.expiring_30d} poin kedaluwarsa ${formatDate(wallet.next_expiry_at)} · dipakai lebih dulu`
            : wallet.next_expiry_at
              ? `Poin berlaku 6 bulan · terdekat ${formatDate(wallet.next_expiry_at)}`
              : "Dapatkan poin dengan menyelesaikan aktivitas merchant"}
        </span>
      </section>

      <div role="tablist" className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-[5px]">
        {([["tukar", "Tukar poin"], ["voucher", `Voucher saya${active.length ? ` · ${active.length}` : ""}`]] as const).map(([value, label]) => (
          <a key={value} role="tab" aria-selected={tab === value} href={`/dompet${value === "voucher" ? "?tab=voucher" : ""}`} className={`flex h-10 items-center justify-center rounded-xl text-[14px] font-semibold ${tab === value ? "bg-fg text-bg" : "text-fg-label"}`}>
            {label}
          </a>
        ))}
      </div>

      {tab === "voucher" ? (
        vouchers.length === 0 ? (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada voucher. Tukar poin di tab Tukar poin.</p>
        ) : (
          vouchers.map((v) => (
            <section key={v.id} className={`${cardClass} flex items-center gap-3.5 p-4 ${v.status === "active" ? "" : "opacity-60"}`}>
              {v.status === "active" ? <VoucherQr code={v.code} /> : <span className="size-[78px] shrink-0 rounded-xl bg-track" />}
              <div className="flex flex-1 flex-col gap-1">
                <span className={`text-[11px] font-bold ${v.status === "active" ? "text-success" : "text-fg-muted"}`}>{VOUCHER_LABELS[v.status]}</span>
                <span className="text-[15px] font-semibold">{v.reward.title}</span>
                <span className="font-display text-[18px] font-semibold tracking-[0.12em]">{v.code.slice(0, 4)} {v.code.slice(4)}</span>
                <span className="text-[12px] text-fg-soft">
                  {v.reward.organizer.name} · {v.status === "used" && v.used_at ? `dipakai ${formatDate(v.used_at)}` : `berlaku s.d. ${formatDate(v.expires_at)}`}
                </span>
              </div>
            </section>
          ))
        )
      ) : (
        <>
          {active[0] && (
            <section className={`${cardClass} flex items-center gap-3.5 p-4`}>
              <VoucherQr code={active[0].code} />
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[11px] font-bold text-success">VOUCHER AKTIF</span>
                <span className="text-[15px] font-semibold">{active[0].reward.title}</span>
                <span className="font-display text-[18px] font-semibold tracking-[0.12em]">{active[0].code.slice(0, 4)} {active[0].code.slice(4)}</span>
                <span className="text-[12px] text-fg-soft">
                  {active[0].reward.organizer.name} · berlaku s.d. {formatDate(active[0].expires_at)}
                </span>
              </div>
            </section>
          )}
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[19px] font-semibold">Bisa ditukar</h2>
            <span className="text-[13px] text-fg-soft">dari merchant Cimahi</span>
          </div>
          {rewards.length === 0 ? (
            <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada reward yang bisa ditukar. Merchant akan menambahkannya segera.</p>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {rewards.map((r) => (
                <div key={r.id} className={`${cardClass} flex flex-col overflow-hidden`}>
                  <div className="flex h-[92px] items-center justify-center bg-accent-merchant" style={r.image_url ? { backgroundImage: `url(${r.image_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
                    {!r.image_url && <OrganizerAvatar name={r.organizer.name} type="merchant" logoUrl={r.organizer.logo_url} size={44} />}
                  </div>
                  <div className="flex flex-1 flex-col gap-1 p-3">
                    <span className="text-[14px] font-semibold leading-[1.3]">{r.title}</span>
                    <span className="text-[11px] text-fg-soft">{r.organizer.name}</span>
                    {r.description && <span className="text-[11px] leading-[1.4] text-fg-soft">{r.description}</span>}
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="font-display text-[15px] font-semibold text-points">{r.price_points} poin</span>
                      <span className="text-[11px] text-fg-muted">Sisa {r.stock}</span>
                    </div>
                    <div className="pt-1.5">
                      <RedeemButton rewardId={r.id} price={r.price_points} balance={wallet.balance} title={r.title} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </>
  );
}
