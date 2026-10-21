"use client";

import { useActionState, useEffect, useState } from "react";
import { loginWithEmail, loginWithPassword, type LoginState, type PasswordLoginState } from "./actions";
import { OtpInput } from "@/components/otp-input";
import { PasswordInput } from "@/components/password-input";
import { cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

// Jeda sebelum kode boleh dikirim ulang (batas bawaan Supabase: 60 detik).
const RESEND_SECONDS = 60;

// Masuk dengan email + kata sandi (cara utama).
export function PasswordLoginForm({ next }: { next: string }) {
  const [state, formAction] = useActionState<PasswordLoginState, FormData>(loginWithPassword, {});
  const confirmHref = `/masuk/daftar?konfirmasi=${encodeURIComponent(state.email ?? "")}&next=${encodeURIComponent(next)}`;

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-5">
      <input type="hidden" name="next" value={next} />
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
          placeholder="kamu@email.com"
          required
          className={inputClass}
        />
      </div>
      <div className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <label htmlFor="password" className={labelClass}>
            Kata sandi
          </label>
          <a href="/masuk/lupa" className="text-[13px] font-semibold text-link">
            Lupa kata sandi?
          </a>
        </div>
        <PasswordInput id="password" name="password" autoComplete="current-password" />
      </div>
      <ErrorMessage message={state.error} />
      {state.unconfirmed && (
        <a href={confirmHref} className="text-[14px] font-semibold text-link">
          Konfirmasi email sekarang
        </a>
      )}
      <div className="mt-auto flex flex-col gap-4">
        <SubmitButton pendingText="Mengecek…">Masuk</SubmitButton>
        <p className="text-center text-[14px] text-fg-soft">
          Belum punya akun?{" "}
          <a href={`/masuk/daftar?next=${encodeURIComponent(next)}`} className="font-semibold text-link">
            Daftar
          </a>
        </p>
        <a
          href={`/masuk?cara=kode&next=${encodeURIComponent(next)}`}
          className="text-center text-[13px] font-semibold text-fg-soft underline underline-offset-4"
        >
          Masuk pakai kode email
        </a>
      </div>
    </form>
  );
}

// Masuk dengan kode 6 angka lewat email. mode="reset" dipakai halaman Lupa kata sandi:
// tidak membuat akun baru.
export function CodeLoginForm({ next, mode }: { next: string; mode?: "reset" }) {
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
      {mode && <input type="hidden" name="mode" value={mode} />}

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
              <ResendCode key={state.sentAt} intent="send" />
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

// Hitung mundur lalu tombol kirim ulang; `intent` adalah nilai tombol untuk aksi server.
export function ResendCode({ intent }: { intent: string }) {
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
      value={intent}
      formNoValidate
      className="min-h-11 font-semibold text-link"
    >
      Kirim ulang kode
    </button>
  );
}
