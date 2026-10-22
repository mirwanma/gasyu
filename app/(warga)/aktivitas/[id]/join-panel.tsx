"use client";

import { useActionState, useState } from "react";
import { InviteResponse } from "@/app/(warga)/grup/group-forms";
import { cancelParticipation, joinActivity, type ActivityActionState } from "@/lib/actions/activities";
import { registerGroup, type GroupActionState } from "@/lib/actions/groups";
import { PARTICIPATION_LABELS, PAYMENT_LABELS, type JoinMode, type ParticipationStatus, type PaymentStatus } from "@/lib/activities";
import { chipClass, inputClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

export type LeaderGroup = { id: string; name: string; members: { user_id: string; nickname: string }[] };

// Panel bawah: ikut sendiri, daftarkan grup, jawab undangan, atau status + batal.
export function JoinPanel({
  activityId,
  participation,
  canJoin,
  blockedReason,
  priceLabel,
  joinMode,
  groupMin,
  groupMax,
  leaderGroups,
  userId,
}: {
  activityId: string;
  participation: { id: string; status: ParticipationStatus; paymentStatus?: PaymentStatus } | null;
  canJoin: boolean;
  blockedReason?: string;
  priceLabel: string;
  joinMode: JoinMode;
  groupMin: number | null;
  groupMax: number | null;
  leaderGroups: LeaderGroup[];
  userId: string;
}) {
  const [joinState, joinAction] = useActionState<ActivityActionState, FormData>(joinActivity, {});
  const [cancelState, cancelAction] = useActionState<ActivityActionState, FormData>(cancelParticipation, {});
  const [groupState, groupAction] = useActionState<GroupActionState, FormData>(registerGroup, {});
  const [mode, setMode] = useState<"individual" | "group">(joinMode === "group" ? "group" : "individual");
  const [groupId, setGroupId] = useState(leaderGroups[0]?.id ?? "");
  const group = leaderGroups.find((g) => g.id === groupId);
  const active = participation && !["cancelled", "not_completed"].includes(participation.status);
  const unpaid = participation?.paymentStatus === "unpaid" || participation?.paymentStatus === "awaiting_confirmation";

  return (
    <div className="fixed inset-x-0 bottom-0 z-10 max-h-[70vh] overflow-y-auto border-t border-line bg-surface-deep pb-[env(safe-area-inset-bottom)]">
      <div className="mx-auto flex w-full max-w-md flex-col gap-2 px-5 py-3">
        <ErrorMessage message={joinState.error ?? cancelState.error ?? groupState.error} />
        <SuccessMessage message={joinState.success ?? cancelState.success ?? groupState.success} />

        {active && participation?.status === "invited" ? (
          <div className="flex flex-col gap-2">
            <span className="text-[15px] text-fg-label">Ketua grupmu mendaftarkan kamu. Ikut?</span>
            <InviteResponse participationId={participation.id} activityId={activityId} compact />
          </div>
        ) : active && participation ? (
          <form action={cancelAction} className="flex items-center gap-3">
            <input type="hidden" name="activity_id" value={activityId} />
            <input type="hidden" name="participation_id" value={participation.id} />
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] text-fg-soft">{unpaid ? "Per orang" : "Status kamu"}</span>
              {unpaid ? (
                <span className="flex items-center gap-2">
                  <span className="text-[18px] font-bold">{priceLabel}</span>
                  <a href="#bayar" className={`text-[13px] font-bold ${participation.paymentStatus === "unpaid" ? "text-warn" : "text-info"}`}>
                    {PAYMENT_LABELS[participation.paymentStatus!]} · Lihat status bayar
                  </a>
                </span>
              ) : (
                <span className="text-[16px] font-bold text-success">{PARTICIPATION_LABELS[participation.status]}</span>
              )}
            </span>
            {participation.status === "registered" && (
              <SubmitButton size="small" variant="danger" pendingText="Membatalkan…">
                Batalkan
              </SubmitButton>
            )}
          </form>
        ) : !canJoin ? (
          <div className="flex items-center gap-3">
            <span className="flex flex-1 flex-col">
              <span className="text-[13px] text-fg-soft">Per orang</span>
              <span className="text-[18px] font-bold">{priceLabel}</span>
            </span>
            <span className="max-w-[55%] text-right text-[13px] text-fg-soft">{blockedReason ?? "Belum bisa diikuti"}</span>
          </div>
        ) : (
          <>
            {joinMode === "both" && (
              <div className="flex gap-2">
                {([["individual", "Sendiri"], ["group", "Bersama grup"]] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`${chipClass.base} ${mode === value ? chipClass.selected : chipClass.idle}`}>
                    {label}
                  </button>
                ))}
              </div>
            )}
            {mode === "individual" ? (
              <form action={joinAction} className="flex items-center gap-3">
                <input type="hidden" name="activity_id" value={activityId} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[13px] text-fg-soft">Per orang</span>
                  <span className="text-[18px] font-bold">{priceLabel}</span>
                </span>
                <SubmitButton size="small" variant="dark" pendingText="Mendaftar…" className="!h-12 !px-6 !text-[16px]">
                  Ikut
                </SubmitButton>
              </form>
            ) : leaderGroups.length === 0 ? (
              <div className="flex flex-col gap-1 text-[15px] text-fg-label">
                <span>
                  Aktivitas ini diikuti lewat grup ({groupMin}–{groupMax} orang). Hanya ketua grup yang bisa mendaftarkan.
                </span>
                <a href="/grup" className="font-semibold text-link">
                  Buat atau kelola grup
                </a>
              </div>
            ) : (
              <form action={groupAction} className="flex flex-col gap-2.5">
                <input type="hidden" name="activity_id" value={activityId} />
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="group_id" className="text-[13px] font-semibold text-fg-soft">
                    Daftarkan grup ({groupMin}–{groupMax} orang)
                  </label>
                  <select id="group_id" name="group_id" value={groupId} onChange={(e) => setGroupId(e.target.value)} className={inputClass}>
                    {leaderGroups.map((g) => (
                      <option key={g.id} value={g.id}>
                        {g.name} · {g.members.length} anggota
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex flex-wrap gap-2">
                  {group?.members.map((m) => (
                    <label key={m.user_id} className="flex h-9 items-center gap-2 rounded-full border border-line-strong bg-surface px-3 text-[15px] font-semibold has-checked:border-primary has-checked:bg-primary-tint">
                      <input type="checkbox" name="member_ids" value={m.user_id} defaultChecked className="accent-primary" />
                      {m.nickname}
                      {m.user_id === userId ? " (kamu)" : ""}
                    </label>
                  ))}
                </div>
                <div className="flex items-center gap-3">
                  <span className="flex flex-1 flex-col">
                    <span className="text-[13px] text-fg-soft">Per orang</span>
                    <span className="text-[18px] font-bold">{priceLabel}</span>
                  </span>
                  <SubmitButton size="small" variant="dark" pendingText="Mendaftarkan…" className="!h-12 !px-5 !text-[16px]">
                    Daftarkan grup
                  </SubmitButton>
                </div>
                <span className="text-[12px] text-fg-muted">Anggota yang dipilih mendapat undangan dan harus mengonfirmasi sebelum aktivitas mulai.</span>
              </form>
            )}
          </>
        )}
      </div>
    </div>
  );
}
