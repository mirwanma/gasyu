"use client";

import { useActionState } from "react";
import { setPassword, type AccountState } from "@/lib/actions/account";
import { PasswordInput } from "@/components/password-input";
import { cardClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/password";

export function PasswordForm() {
  const [state, action] = useActionState<AccountState, FormData>(setPassword, {});
  return (
    // key: kosongkan kolom setelah kata sandi tersimpan.
    <form key={state.success} action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <label htmlFor="password" className={labelClass}>
        Kata sandi baru
      </label>
      <PasswordInput
        id="password"
        name="password"
        autoComplete="new-password"
        minLength={PASSWORD_MIN}
        placeholder={`Minimal ${PASSWORD_MIN} karakter`}
      />
      <label htmlFor="password_confirm" className={labelClass}>
        Ulangi kata sandi baru
      </label>
      <PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" minLength={PASSWORD_MIN} />
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <SubmitButton pendingText="Menyimpan…">Simpan kata sandi</SubmitButton>
    </form>
  );
}
