"use client";

import { useActionState } from "react";
import { loginWithEmail, type LoginState } from "./actions";
import { ErrorMessage, SubmitButton, inputClass, labelClass } from "@/components/ui";

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginWithEmail, {
    step: "email",
  });

  if (state.step === "code") {
    return (
      <form action={formAction} className="flex flex-col gap-4">
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={next} />
        <p className="text-[15px] leading-[22px]">
          Kode 6 angka sudah dikirim ke <strong>{state.email}</strong>. Berlaku 10 menit.
        </p>
        <label className="flex flex-col gap-2">
          <span className={labelClass}>Kode masuk</span>
          <input
            name="token"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            autoFocus
            className={`${inputClass} text-center text-[24px] font-extrabold tracking-[0.3em]`}
          />
        </label>
        <ErrorMessage message={state.error} />
        <SubmitButton name="intent" value="verify" pendingText="Mengecek…">
          Masuk
        </SubmitButton>
        <SubmitButton name="intent" value="send" variant="secondary" pendingText="Mengirim…">
          Kirim ulang kode
        </SubmitButton>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="intent" value="send" />
      <label className="flex flex-col gap-2">
        <span className={labelClass}>Email</span>
        <input
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          placeholder="kamu@email.com"
          required
          className={inputClass}
        />
      </label>
      <ErrorMessage message={state.error} />
      <SubmitButton pendingText="Mengirim kode…">Kirim kode masuk</SubmitButton>
    </form>
  );
}
