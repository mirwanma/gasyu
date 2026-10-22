"use client";

import { useActionState, useState } from "react";
import { lookupVoucher, useVoucher, type KasirState } from "@/lib/actions/rewards";
import { Icon } from "@/components/icons";
import { cardClass, inputClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

type Outlet = { id: string; name: string };

// Mode kasir: ketik kode voucher → cek → pakai, mengikuti artboard "Merchant · Mode kasir".
export function KasirForm({ organizerId, outlets }: { organizerId: string; outlets: Outlet[] }) {
  const [lookupState, lookupAction] = useActionState<KasirState, FormData>(lookupVoucher, {});
  const [useState_, useAction] = useActionState<KasirState, FormData>(useVoucher, {});
  const [outletId, setOutletId] = useState(outlets[0]?.id ?? "");
  const [code, setCode] = useState("");
  const voucher = lookupState.voucher;
  const outletName = outlets.find((o) => o.id === outletId)?.name ?? "-";
  // Voucher yang dibatasi outlet hanya bisa dipakai di outlet yang termasuk (ALUR bagian 16).
  const outletOk = !voucher?.valid_outlet_ids || voucher.valid_outlet_ids.includes(outletId);
  const usable = !!voucher?.valid && outletOk;
  const validNames = voucher?.valid_outlet_ids ? outlets.filter((o) => voucher.valid_outlet_ids!.includes(o.id)).map((o) => o.name) : [];

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[26px] font-bold">Kasir</h1>
        <label className="flex h-10 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[15px] font-semibold">
          Outlet:
          <select value={outletId} onChange={(e) => setOutletId(e.target.value)} className="bg-transparent font-semibold outline-none" aria-label="Outlet">
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </label>
      </div>

      <form action={lookupAction} className={`${cardClass} flex flex-col gap-3 p-4`}>
        <input type="hidden" name="organizer_id" value={organizerId} />
        <label htmlFor="kode" className="text-[15px] font-semibold">Kode voucher dari warga</label>
        <input id="kode" name="code" value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} required minLength={8} maxLength={9} autoCapitalize="characters" autoComplete="off" placeholder="K7MP X4RD" className={`${inputClass} h-[60px] border-primary text-center font-display text-[28px] font-semibold tracking-[0.16em]`} />
        <ErrorMessage message={lookupState.error} />
        <SubmitButton pendingText="Mengecek…" variant="ghost">
          <Icon name="search" size={18} stroke={2} />
          Cek voucher
        </SubmitButton>
      </form>

      {useState_.success ? (
        <SuccessMessage message={useState_.success} />
      ) : voucher ? (
        <section className={`flex flex-col gap-3 rounded-[20px] border p-4 ${usable ? "border-success/40 bg-success-tint" : "border-danger/40 bg-danger-tint"}`}>
          <div className="flex items-center gap-2.5">
            <span className={`flex size-9 items-center justify-center rounded-full text-bg ${usable ? "bg-success" : "bg-danger"}`}>
              <Icon name={usable ? "check" : "close"} size={20} stroke={2.6} />
            </span>
            <span className={`text-[16px] font-bold ${usable ? "text-success" : "text-danger"}`}>
              {usable ? "Voucher valid" : !voucher.valid ? (voucher.status === "used" ? "Sudah dipakai" : voucher.status === "refunded" ? "Sudah di-refund" : "Kedaluwarsa") : "Tidak berlaku di outlet ini"}
            </span>
          </div>
          <span className="font-display text-[22px] font-semibold text-fg">{voucher.title}</span>
          <span className="text-[15px] text-fg-label">
            Milik <b>{voucher.nickname}</b> · berlaku s.d. {new Intl.DateTimeFormat("id-ID", { timeZone: "Asia/Jakarta", day: "numeric", month: "short" }).format(new Date(voucher.expires_at))}
            {voucher.description ? ` · ${voucher.description}` : ""}
          </span>
          {voucher.valid_outlet_ids && (
            <span className="text-[15px] text-fg-label">Berlaku di: {validNames.length > 0 ? validNames.join(", ") : "outlet lain"}</span>
          )}
          {usable && (
            <form action={useAction} className="flex flex-col gap-2">
              <input type="hidden" name="organizer_id" value={organizerId} />
              <input type="hidden" name="code" value={voucher.code} />
              <input type="hidden" name="outlet_id" value={outletId} />
              <ErrorMessage message={useState_.error} />
              <SubmitButton pendingText="Memakai…" className="!bg-success">
                Pakai voucher sekarang · {outletName}
              </SubmitButton>
            </form>
          )}
        </section>
      ) : null}
    </>
  );
}
