import { Suspense } from "react";
import { loginWithGoogle } from "./actions";
import { LoginForm } from "./login-form";
import { ErrorMessage, SubmitButton, Wordmark } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";

export default function MasukPage({ searchParams }: PageProps<"/masuk">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Wordmark />
        <h1 className="text-[24px] font-extrabold leading-[30px]">Masuk ke Ramein</h1>
        <p className="text-[15px] leading-[22px] text-ink-soft">
          Tanpa password. Pakai akun Google, atau kode yang kami kirim ke email kamu.
        </p>
      </div>
      <Suspense fallback={<p className="text-[13px] text-ink-soft">Memuat…</p>}>
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
        <SubmitButton variant="secondary" pendingText="Membuka Google…">
          Masuk dengan Google
        </SubmitButton>
        <ErrorMessage
          message={googleFailed ? "Masuk dengan Google gagal. Coba lagi, atau pakai email." : undefined}
        />
      </form>

      <div className="flex items-center gap-3 text-[13px] text-ink-soft">
        <span className="h-px flex-1 bg-line" />
        atau
        <span className="h-px flex-1 bg-line" />
      </div>

      <LoginForm next={next} />
    </>
  );
}
