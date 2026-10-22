"use client";

import { useActionState, useEffect, useState } from "react";
import QRCode from "qrcode";
import { redeemReward, type RewardActionState } from "@/lib/actions/rewards";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

// Tombol tukar poin dengan konfirmasi satu langkah; setelah berhasil menampilkan kode voucher.
export function RedeemButton({ rewardId, price, balance, title }: { rewardId: string; price: number; balance: number; title: string }) {
  const [state, action] = useActionState<RewardActionState, FormData>(redeemReward, {});
  const [confirm, setConfirm] = useState(false);
  const enough = balance >= price;

  if (state.code) {
    return (
      <div className="flex flex-col gap-1.5 rounded-xl bg-success-tint p-3 text-success">
        <span className="text-[13px] font-bold">Voucher kamu</span>
        <span className="font-display text-[18px] font-semibold tracking-[0.12em]">{state.code}</span>
        <span className="text-[12px]">Tunjukkan kode ini di kasir. Lihat semua voucher di tab Voucher saya.</span>
      </div>
    );
  }
  return (
    <form action={action} className="flex flex-col gap-2">
      <input type="hidden" name="reward_id" value={rewardId} />
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      {confirm ? (
        <div className="flex flex-col gap-2">
          <span className="text-[13px] text-fg-label">
            Tukar {price} poin untuk {title}? Poin tidak bisa dikembalikan.
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={() => setConfirm(false)} className="flex h-10 items-center justify-center rounded-xl border border-line-strong text-[15px] font-semibold text-fg">
              Batal
            </button>
            <SubmitButton size="small" variant="dark" pendingText="Menukar…">
              Ya, tukar
            </SubmitButton>
          </div>
        </div>
      ) : (
        <button type="button" disabled={!enough} onClick={() => setConfirm(true)} className="flex h-10 items-center justify-center rounded-xl bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-50">
          {enough ? "Tukar" : `Kurang ${price - balance} poin`}
        </button>
      )}
    </form>
  );
}

// QR berisi kode voucher, untuk dipindai kasir.
export function VoucherQr({ code, size = 78 }: { code: string; size?: number }) {
  const [src, setSrc] = useState<string>();
  useEffect(() => {
    QRCode.toDataURL(code, { margin: 1, width: size * 3, color: { dark: "#1A1A1A", light: "#FFFFFF" } }).then(setSrc).catch(() => undefined);
  }, [code, size]);
  return (
    <span role="img" aria-label="QR voucher" className="flex shrink-0 items-center justify-center overflow-hidden rounded-xl bg-cream p-1.5" style={{ width: size, height: size }}>
      {/* eslint-disable-next-line @next/next/no-img-element -- data URL yang dibuat di browser */}
      {src ? <img src={src} alt="" className="size-full" /> : null}
    </span>
  );
}
