import { Suspense } from "react";
import { loginWithGoogle } from "./actions";
import { LoginForm } from "./login-form";
import { ErrorMessage, GoogleIcon, Logo, SubmitButton } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";

export default function MasukPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
      <div className="flex flex-col gap-[18px]">
        <Logo />
        <h1 className="font-display text-[32px] font-bold leading-[1.15]">
          Ramein kotamu,
          <br />
          kumpulkan XP-nya.
        </h1>
        <p className="text-[15px] leading-[1.55] text-fg-soft">
          Ikut event dan challenge dari UMKM dan komunitas di Cimahi. Tanpa kata sandi.
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

  return (
    <>
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
        atau pakai email
        <span className="h-px flex-1 bg-line" />
      </div>

      <LoginForm next={next} />
    </>
  );
}
