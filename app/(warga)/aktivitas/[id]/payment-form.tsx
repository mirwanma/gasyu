"use client";

import { useActionState, useState } from "react";
import { submitPaymentProof, type PaymentActionState } from "@/lib/actions/payments";
import { smallButton } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

// Warga mengunggah bukti bayar (opsional; bayar tunai cukup ditandai panitia).
export function PaymentProofForm({ participationId, activityId, retry }: { participationId: string; activityId: string; retry?: boolean }) {
  const [state, formAction] = useActionState<PaymentActionState, FormData>(submitPaymentProof, {});
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState<string>();
  if (state.success) return <SuccessMessage message={state.success} />;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${smallButton.dark} self-start`}>
        {retry ? "Kirim bukti lagi" : "Kirim bukti bayar"}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="participation_id" value={participationId} />
      <input type="hidden" name="activity_id" value={activityId} />
      <ErrorMessage message={state.error} />
      <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line-strong px-3 text-[13px] font-semibold text-fg">
        {fileName ?? "Pilih foto atau tangkapan layar (maks. 5 MB)"}
        <input type="file" name="proof" accept="image/*" required className="hidden" onChange={(e) => setFileName(e.target.files?.[0]?.name)} />
      </label>
      <SubmitButton size="small" variant="dark" pendingText="Mengunggah…" className="self-start">
        Kirim bukti
      </SubmitButton>
    </form>
  );
}
