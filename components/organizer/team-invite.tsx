"use client";

import { useActionState, useState } from "react";
import { createInvite, type ActionState } from "@/lib/actions/organizer";
import { cardClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

export function TeamInvite({ organizerId, type, roleName }: { organizerId: string; type: string; roleName: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(createInvite, {});
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!state.inviteUrl) return;
    try {
      await navigator.clipboard.writeText(state.inviteUrl);
      setCopied(true);
    } catch {
      setCopied(false);
    }
  };

  const shareText = state.inviteUrl ? `Bantu kelola kami di Ramein. Buka tautan ini: ${state.inviteUrl}` : "";

  return (
    <section className={`${cardClass} flex flex-col gap-3 p-4`}>
      <span className="text-[14px] font-bold">Undang {roleName}</span>
      <span className="text-[12px] leading-[1.5] text-fg-soft">
        Tautan berlaku 7 hari dan hanya bisa dipakai sekali. Kirim lewat WhatsApp ke calon {roleName}.
      </span>
      {state.inviteUrl ? (
        <div className="flex flex-col gap-2">
          <code className="break-all rounded-[12px] bg-track px-3 py-2 text-[12px]">{state.inviteUrl}</code>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={copy}
              className="flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface text-[13px] font-semibold text-fg"
            >
              {copied ? "Tersalin" : "Salin tautan"}
            </button>
            <a
              href={`https://wa.me/?text=${encodeURIComponent(shareText)}`}
              target="_blank"
              rel="noreferrer"
              className="flex h-10 items-center justify-center rounded-xl bg-fg text-[13px] font-semibold text-bg"
            >
              Kirim via WhatsApp
            </a>
          </div>
        </div>
      ) : null}
      <form
        action={formAction}
        onSubmit={(e) => {
          const input = e.currentTarget.elements.namedItem("origin") as HTMLInputElement | null;
          if (input) input.value = window.location.origin;
        }}
      >
        <input type="hidden" name="organizer_id" value={organizerId} />
        <input type="hidden" name="type" value={type} />
        <input type="hidden" name="origin" value="" />
        <ErrorMessage message={state.error} />
        <SubmitButton pendingText="Membuat tautan…" className="mt-2 h-12 rounded-[14px] text-[14px]">
          {state.inviteUrl ? "Buat tautan baru" : "Buat tautan undangan"}
        </SubmitButton>
      </form>
    </section>
  );
}
