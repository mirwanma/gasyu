"use client";

import { useActionState, useState } from "react";
import { submitMissionCode, submitMissionPhoto, type MissionActionState } from "@/lib/actions/missions";
import { inputClass, smallButton } from "@/components/styles";
import { ImageFileInput, type ImagePick } from "@/components/image-file-input";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

// Aksi warga untuk satu misi terbuka: ketik kode atau unggah foto (QR lewat halaman Scan).
export function MissionCodeForm({ missionId, activityId }: { missionId: string; activityId: string }) {
  const [state, formAction] = useActionState<MissionActionState, FormData>(submitMissionCode, {});
  const [open, setOpen] = useState(false);
  if (state.success) return <SuccessMessage message={state.success} />;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${smallButton.dark} self-start`}>
        Ketik kode
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="mission_id" value={missionId} />
      <input type="hidden" name="activity_id" value={activityId} />
      <ErrorMessage message={state.error} />
      <div className="flex gap-2">
        <input name="code" required autoFocus autoComplete="off" autoCapitalize="characters" placeholder="Kode rahasia" aria-label="Kode rahasia" className={`${inputClass} h-11 flex-1 uppercase`} />
        <SubmitButton size="small" variant="dark" pendingText="…" className="h-11">
          Kirim
        </SubmitButton>
      </div>
      <span className="text-[11px] text-fg-muted">Maksimal 5 percobaan per 15 menit.</span>
    </form>
  );
}

export function MissionPhotoForm({ missionId, activityId, retry }: { missionId: string; activityId: string; retry?: boolean }) {
  const [state, formAction] = useActionState<MissionActionState, FormData>(submitMissionPhoto, {});
  const [open, setOpen] = useState(false);
  const [pick, setPick] = useState<ImagePick>(null);
  if (state.success) return <SuccessMessage message={state.success} />;
  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)} className={`${smallButton.dark} self-start`}>
        {retry ? "Unggah ulang foto" : "Kirim foto"}
      </button>
    );
  }
  return (
    <form action={formAction} className="flex flex-col gap-2">
      <input type="hidden" name="mission_id" value={missionId} />
      <input type="hidden" name="activity_id" value={activityId} />
      <ErrorMessage message={pick?.error ?? state.error} />
      <label className="flex h-11 cursor-pointer items-center justify-center rounded-xl border border-dashed border-line-strong px-3 text-[13px] font-semibold text-fg">
        {pick?.busy ? "Menyiapkan foto…" : (pick?.name ?? "Pilih atau ambil foto")}
        <ImageFileInput name="proof" accept="image/*" capture="environment" required className="hidden" maxMb={3} onPick={setPick} />
      </label>
      <SubmitButton size="small" variant="dark" pendingText="Mengunggah…" className="self-start">
        Kirim bukti
      </SubmitButton>
    </form>
  );
}
