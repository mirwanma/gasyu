import { Suspense } from "react";
import { loginWithGoogle } from "./actions";
import { CodeLoginForm, PasswordLoginForm } from "./login-form";
import { ErrorMessage, GoogleIcon, Logo, SubmitButton } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";

export default function MasukPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
      <div className="flex flex-col gap-[18px]">
        <Logo />
        <h1 className="font-display text-[32px] font-bold leading-[1.15]">
          Ramaikan kotamu,
          <br />
          kumpulkan XP-nya.
        </h1>
        <p className="text-[15px] leading-[1.55] text-fg-soft">
          Ikut event dan challenge dari UMKM dan komunitas di Cimahi.
        </p>
      </div>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <LoginOptions searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function LoginOptions({ searchParams }: Pick<PageProps<"/masuk">, "searchParams">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const googleFailed = params.error === "google";
  const deleted = params.akun === "dihapus";
  const signedOutAll = params.akun === "keluar-semua";
  const withCode = params.cara === "kode";

  return (
    <>
      {deleted && (
        <p role="status" className="rounded-[14px] border border-line bg-surface px-4 py-3 text-[13px] leading-[1.5] text-fg-label">
          Akun ini sudah dihapus. Terima kasih sudah ikut meramaikan kota bersama Gasyu.
        </p>
      )}
      {signedOutAll && (
        <p role="status" className="rounded-[14px] border border-line bg-surface px-4 py-3 text-[13px] leading-[1.5] text-fg-label">
          Kamu sudah keluar dari semua perangkat. Masuk lagi di HP ini kalau mau lanjut.
        </p>
      )}
      <form action={loginWithGoogle} className="flex flex-col gap-3">
        <input type="hidden" name="next" value={next} />
        <SubmitButton variant="light" pendingText="Membuka Google…">
          <GoogleIcon />
          Lanjut dengan Google
        </SubmitButton>
        <ErrorMessage
          message={googleFailed ? "Masuk dengan Google gagal. Coba lagi, atau pakai email." : undefined}
        />
      </form>

      <div className="flex items-center gap-3 text-[13px] text-fg-muted">
        <span className="h-px flex-1 bg-line" />
        {withCode ? "atau pakai kode email" : "atau pakai email"}
        <span className="h-px flex-1 bg-line" />
      </div>

      {withCode ? (
        <>
          <CodeLoginForm next={next} />
          <a
            href={`/masuk?next=${encodeURIComponent(next)}`}
            className="-mt-3 text-center text-[13px] font-semibold text-fg-soft underline underline-offset-4"
          >
            Masuk pakai kata sandi
          </a>
        </>
      ) : (
        <PasswordLoginForm next={next} />
      )}
    </>
  );
}
