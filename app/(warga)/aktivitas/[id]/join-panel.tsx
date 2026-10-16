"use client";

import { useActionState } from "react";
import { cancelParticipation, joinActivity, type ActivityActionState } from "@/lib/actions/activities";
import { PARTICIPATION_LABELS, type ParticipationStatus } from "@/lib/activities";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

// Panel bawah: tombol ikut, atau status pendaftaran dan tombol batal.
export function JoinPanel({
  activityId,
  participation,
  canJoin,
  blockedReason,
  priceLabel,
}: {
  activityId: string;
  participation: { id: string; status: ParticipationStatus } | null;
  canJoin: boolean;
  blockedReason?: string;
  priceLabel: string;
}) {
  const [joinState, joinAction] = useActionState<ActivityActionState, FormData>(joinActivity, {});
  const [cancelState, cancelAction] = useActionState<ActivityActionState, FormData>(cancelParticipation, {});
  const active = participation && !["cancelled", "not_completed"].includes(participation.status);

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-deep pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 py-3">
        <ErrorMessage message={joinState.error ?? cancelState.error} />
        <SuccessMessage message={joinState.success ?? cancelState.success} />
        {active && participation ? (
          <form action={cancelAction} className="flex items-center gap-3">
            <input type="hidden" name="activity_id" value={activityId} />
            <input type="hidden" name="participation_id" value={participation.id} />
            <span className="flex flex-1 flex-col">
              <span className="text-[12px] text-fg-soft">Status kamu</span>
              <span className="text-[15px] font-bold text-success">{PARTICIPATION_LABELS[participation.status]}</span>
            </span>
            {["invited", "registered"].includes(participation.status) && (
              <SubmitButton size="small" variant="danger" pendingText="Membatalkan…">
                Batalkan
              </SubmitButton>
            )}
          </form>
        ) : (
          <form action={joinAction} className="flex items-center gap-3">
            <input type="hidden" name="activity_id" value={activityId} />
            <span className="flex flex-1 flex-col">
              <span className="text-[12px] text-fg-soft">Per orang</span>
              <span className="text-[17px] font-bold">{priceLabel}</span>
            </span>
            {canJoin ? (
              <SubmitButton size="small" variant="dark" pendingText="Mendaftar…" className="!h-12 !px-6 !text-[15px]">
                Ikut
              </SubmitButton>
            ) : (
              <span className="max-w-[55%] text-right text-[12px] text-fg-soft">{blockedReason ?? "Belum bisa diikuti"}</span>
            )}
          </form>
        )}
      </div>
    </div>
  );
}
