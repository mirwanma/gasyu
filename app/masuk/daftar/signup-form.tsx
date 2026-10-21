"use client";

import { useActionState } from "react";
import { signUpWithPassword, type SignupState } from "../actions";
import { ResendCode } from "../login-form";
import { OtpInput } from "@/components/otp-input";
import { PasswordInput } from "@/components/password-input";
import { cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { PASSWORD_MIN } from "@/lib/password";

// Daftar akun: isi email + kata sandi, lalu masukkan kode 6 angka dari email.
// `confirmEmail` diisi jika warga datang dari halaman masuk dengan akun yang belum dikonfirmasi.
export function SignupForm({ next, confirmEmail }: { next: string; confirmEmail?: string }) {
  const [state, formAction] = useActionState<SignupState, FormData>(
    signUpWithPassword,
    confirmEmail ? { step: "confirm", email: confirmEmail } : { step: "form" },
  );

  if (state.step === "form") {
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
          <label htmlFor="password" className={labelClass}>
            Kata sandi
          </label>
          <PasswordInput
            id="password"
            name="password"
            autoComplete="new-password"
            minLength={PASSWORD_MIN}
            placeholder={`Minimal ${PASSWORD_MIN} karakter`}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <label htmlFor="password_confirm" className={labelClass}>
            Ulangi kata sandi
          </label>
          <PasswordInput id="password_confirm" name="password_confirm" autoComplete="new-password" minLength={PASSWORD_MIN} />
        </div>
        <ErrorMessage message={state.error} />
        <div className="mt-auto flex flex-col gap-4">
          <SubmitButton name="intent" value="signup" pendingText="Mendaftarkan…">
            Daftar
          </SubmitButton>
          <p className="text-center text-[14px] text-fg-soft">
            Sudah punya akun?{" "}
            <a href={`/masuk?next=${encodeURIComponent(next)}`} className="font-semibold text-link">
              Masuk
            </a>
          </p>
        </div>
      </form>
    );
  }

  return (
    <form action={formAction} className="flex flex-1 flex-col gap-7">
      <input type="hidden" name="next" value={next} />
      <input type="hidden" name="email" value={state.email ?? ""} />
      <input type="hidden" name="sent_at" value={state.sentAt ?? ""} />

      {state.step === "confirm" ? (
        <>
          <div className={`${cardClass} flex flex-col gap-1 p-[18px]`}>
            <span className="text-[15px] font-semibold">Konfirmasi email</span>
            <span className="text-[13px] leading-[1.5] text-fg-soft">
              Kami kirim kode 6 angka ke {state.email}. Setelah kode dimasukkan, akunmu aktif.
            </span>
          </div>
          <ErrorMessage message={state.error} />
          <div className="mt-auto">
            <SubmitButton name="intent" value="resend" pendingText="Mengirim kode…">
              Kirim kode konfirmasi
            </SubmitButton>
          </div>
        </>
      ) : (
        <>
          {/* Tombol bawaan untuk Enter: selalu "Konfirmasi", bukan "Kirim ulang". */}
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
              <ResendCode key={state.sentAt} intent="resend" />
              <a href={`/masuk/daftar?next=${encodeURIComponent(next)}`} className="flex min-h-11 items-center font-semibold text-link">
                Ganti email
              </a>
            </div>
          </div>
          <ErrorMessage message={state.error} />
          <div className="mt-auto">
            <SubmitButton name="intent" value="verify" pendingText="Mengecek…">
              Konfirmasi
            </SubmitButton>
          </div>
        </>
      )}
    </form>
  );
}
