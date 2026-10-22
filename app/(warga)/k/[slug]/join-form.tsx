"use client";

import { useActionState } from "react";
import { requestMembership, type JoinState } from "./actions";
import { cardClass, labelClass, tagClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

export function JoinForm({
  communityId,
  slug,
  policy,
  defaultMessage,
}: {
  communityId: string;
  slug: string;
  policy: "open" | "approval";
  defaultMessage: string;
}) {
  const [state, formAction] = useActionState<JoinState, FormData>(requestMembership, {});

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="community_id" value={communityId} />
      <input type="hidden" name="slug" value={slug} />
      <div className="flex items-center justify-between">
        <span className="text-[18px] font-semibold">Gabung jadi member</span>
        <span className={`${tagClass.base} ${policy === "open" ? tagClass.success : tagClass.warn}`}>
          {policy === "open" ? "Langsung aktif" : "Perlu persetujuan"}
        </span>
      </div>
      <span className="text-[16px] leading-[1.5] text-fg-soft">
        Member bisa ikut aktivitas khusus member dan dapat kabar aktivitas baru.
      </span>
      {policy === "approval" && (
        <>
          <label htmlFor="pesan" className={labelClass}>
            Pesan untuk pengurus (opsional)
          </label>
          <textarea
            id="pesan"
            name="message"
            rows={3}
            maxLength={200}
            defaultValue={defaultMessage}
            placeholder="Contoh: Sudah ikut latihan Minggu 2 bulan terakhir."
            className={`${textareaClass} resize-none`}
          />
        </>
      )}
      <ErrorMessage message={state.error} />
      <SubmitButton pendingText="Mengirim…" className="h-[50px] rounded-[14px] text-[18px]">
        {policy === "open" ? "Gabung sekarang" : "Minta bergabung"}
      </SubmitButton>
    </form>
  );
}
