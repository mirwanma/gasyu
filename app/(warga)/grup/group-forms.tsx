"use client";

import { useActionState, useState } from "react";
import { confirmGroupRegistration, createGroup, joinGroup, type GroupActionState } from "@/lib/actions/groups";
import { chipClass, inputClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

// Buat grup atau gabung lewat kode, dalam satu kartu dengan dua tab.
export function GroupEntryForms({ canCreate }: { canCreate: boolean }) {
  const [tab, setTab] = useState<"join" | "create">("join");
  const [createState, createAction] = useActionState<GroupActionState, FormData>(createGroup, {});
  const [joinState, joinAction] = useActionState<GroupActionState, FormData>(joinGroup, {});
  return (
    <section className="flex flex-col gap-3 rounded-[20px] border border-line bg-surface p-4">
      <div className="flex gap-2">
        {([["join", "Gabung dengan kode"], ["create", "Buat grup"]] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={tab === value} onClick={() => setTab(value)} className={`${chipClass.base} ${tab === value ? chipClass.selected : chipClass.idle}`}>
            {label}
          </button>
        ))}
      </div>
      {tab === "join" ? (
        <form action={joinAction} className="flex flex-col gap-2.5">
          <ErrorMessage message={joinState.error} />
          <SuccessMessage message={joinState.success} />
          <input name="code" required minLength={6} maxLength={6} placeholder="Kode undangan, contoh KRG7Q2" autoCapitalize="characters" className={`${inputClass} font-display text-[18px] font-semibold uppercase tracking-[0.2em]`} aria-label="Kode undangan" />
          <SubmitButton pendingText="Bergabung…">Gabung</SubmitButton>
        </form>
      ) : (
        <form action={createAction} className="flex flex-col gap-2.5">
          <ErrorMessage message={createState.error} />
          <SuccessMessage message={createState.success} />
          <input name="name" required minLength={3} maxLength={30} placeholder="Nama grup, contoh Geng Karangmekar" className={inputClass} aria-label="Nama grup" disabled={!canCreate} />
          {canCreate ? <SubmitButton pendingText="Membuat…">Buat grup</SubmitButton> : <span className="text-[12px] text-warn">Kamu sudah ada di 3 grup. Keluar dari salah satu untuk membuat grup baru.</span>}
        </form>
      )}
    </section>
  );
}

// Jawab undangan ikut aktivitas lewat grup (dipakai di halaman Grup dan detail aktivitas).
export function InviteResponse({ participationId, activityId, compact = false }: { participationId: string; activityId: string; compact?: boolean }) {
  const [state, action] = useActionState<GroupActionState, FormData>(confirmGroupRegistration, {});
  if (state.success) return <SuccessMessage message={state.success} />;
  return (
    <form action={action} className="flex flex-col gap-2">
      <ErrorMessage message={state.error} />
      <input type="hidden" name="participation_id" value={participationId} />
      <input type="hidden" name="activity_id" value={activityId} />
      <div className="grid grid-cols-2 gap-2.5">
        <SubmitButton size={compact ? "small" : "full"} variant={compact ? "outline" : "ghost"} name="decision" value="decline" pendingText="…">
          Tolak
        </SubmitButton>
        <SubmitButton size={compact ? "small" : "full"} variant={compact ? "dark" : "light"} name="decision" value="accept" pendingText="…">
          Ikut
        </SubmitButton>
      </div>
    </form>
  );
}

// Tombol salin/bagikan kode undangan.
export function ShareCode({ code, groupName }: { code: string; groupName: string }) {
  const [done, setDone] = useState(false);
  const share = async () => {
    const text = `Gabung grup "${groupName}" di Ramein dengan kode ${code}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(code);
      setDone(true);
      setTimeout(() => setDone(false), 2000);
    } catch {
      // dibatalkan pengguna
    }
  };
  return (
    <button type="button" onClick={share} className="flex h-11 items-center justify-center rounded-xl border border-line-strong bg-surface-deep px-4 text-[13px] font-semibold text-fg">
      {done ? "Tersalin" : "Bagikan"}
    </button>
  );
}
