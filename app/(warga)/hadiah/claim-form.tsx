"use client";

import { useActionState } from "react";
import { claimPrize, type ClaimState } from "@/lib/actions/prizes";
import { inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

// Form klaim: hadiah yang dikirim meminta data pengiriman; yang lain cukup satu tombol.
export function ClaimForm({ winnerId, shipping }: { winnerId: string; shipping: boolean }) {
  const [state, action] = useActionState<ClaimState, FormData>(claimPrize, {});
  if (state.success) return <SuccessMessage message={state.success} />;
  return (
    <form action={action} className="flex flex-col gap-3">
      <input type="hidden" name="winner_id" value={winnerId} />
      <ErrorMessage message={state.error} />
      {shipping && (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`n-${winnerId}`} className={labelClass}>Nama penerima</label>
            <input id={`n-${winnerId}`} name="ship_name" required maxLength={100} autoComplete="name" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`p-${winnerId}`} className={labelClass}>Nomor HP</label>
            <input id={`p-${winnerId}`} name="ship_phone" required inputMode="tel" autoComplete="tel" placeholder="0812…" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor={`a-${winnerId}`} className={labelClass}>Alamat lengkap</label>
            <textarea id={`a-${winnerId}`} name="ship_address" required minLength={10} maxLength={500} rows={3} autoComplete="street-address" placeholder="Jalan, nomor, RT/RW, kelurahan, kecamatan, kota, kode pos" className={textareaClass} />
          </div>
          <span className="text-[12px] leading-[1.5] text-fg-muted">Hanya kamu dan panitia Gasyu yang bisa melihat data ini. Dihapus otomatis setelah hadiah terkirim.</span>
        </>
      )}
      <SubmitButton pendingText="Mengklaim…">Klaim hadiah</SubmitButton>
    </form>
  );
}
