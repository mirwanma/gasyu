"use client";

import { useActionState, useEffect, useState } from "react";
import { loginWithEmail, type LoginState } from "./actions";
import { OtpInput } from "@/components/otp-input";
import { cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

// Jeda sebelum kode boleh dikirim ulang (batas bawaan Supabase: 60 detik).
const RESEND_SECONDS = 60;

export function LoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<LoginState, FormData>(loginWithEmail, {
    step: "email",
  });
  // "Ganti email" kembali ke langkah email untuk state yang sedang tampil saja.
  const [editingState, setEditingState] = useState<LoginState | null>(null);
  const showCodeStep = state.step === "code" && editingState !== state;

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-7">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="sent_at" value={state.sentAt ?? ""} />

      <div className="flex flex-col gap-2.5">
        <label htmlFor="email" className={labelClass}>
          Email
        </label>
        <input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          defaultValue={state.email}
          readOnly={showCodeStep}
          placeholder="kamu@email.com"
          required
          className={`${inputClass} read-only:text-fg-soft`}
        />
      </div>

      {showCodeStep ? (
        <>
          {/* Tombol bawaan untuk Enter: selalu "Masuk", bukan "Kirim ulang". */}
          <button type="submit" name="intent" value="verify" tabIndex={-1} aria-hidden className="sr-only" />
          <div className={`${cardClass} flex flex-col gap-3.5 p-[18px]`}>
            <div className="flex flex-col gap-1">
              <span className="text-[15px] font-semibold">Masukkan kode 6 digit</span>
              <span className="text-[13px] text-fg-soft">
                Dikirim ke {state.email} · berlaku 10 menit
              </span>
            </div>
            <OtpInput key={state.sentAt} name="token" />
            <div className="flex items-center justify-between text-[13px]">
              <ResendCode key={state.sentAt} />
              <button
                type="button"
                onClick={() => setEditingState(state)}
                className="min-h-11 font-semibold text-link"
              >
                Ganti email
              </button>
            </div>
          </div>
          <ErrorMessage message={state.error} />
          <div className="mt-auto">
            <SubmitButton name="intent" value="verify" pendingText="Mengecek…">
              Masuk
            </SubmitButton>
          </div>
        </>
      ) : (
        <>
          <ErrorMessage message={state.step === "email" ? state.error : undefined} />
          <div className="mt-auto">
            <SubmitButton name="intent" value="send" pendingText="Mengirim kode…">
              Kirim kode masuk
            </SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}

function ResendCode() {
  const [seconds, setSeconds] = useState(RESEND_SECONDS);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  if (seconds > 0) {
    const mm = Math.floor(seconds / 60);
    const ss = String(seconds % 60).padStart(2, "0");
    return <span className="text-fg-soft">Kirim ulang dalam {mm}:{ss}</span>;
  }

  return (
    <button
      type="submit"
      name="intent"
      value="send"
      formNoValidate
      className="min-h-11 font-semibold text-link"
    >
      Kirim ulang kode
    </button>
  );
}
