"use client";

import { useActionState } from "react";
import { deleteAccount, type AccountState } from "@/lib/actions/account";
import { inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

export function DeleteForm() {
  const [state, action] = useActionState<AccountState, FormData>(deleteAccount, {});
  return (
    <form action={action} className="flex flex-col gap-3">
      <label htmlFor="confirm" className={labelClass}>
        Ketik HAPUS untuk mengonfirmasi
      </label>
      <input id="confirm" name="confirm" autoComplete="off" required className={inputClass} placeholder="HAPUS" />
      <ErrorMessage message={state.error} />
      <SubmitButton pendingText="Menghapus…" variant="danger">
        Hapus akun saya
      </SubmitButton>
    </form>
  );
}
