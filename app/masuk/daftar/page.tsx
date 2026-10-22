import { Suspense } from "react";
import { SignupForm } from "./signup-form";
import { Logo } from "@/components/ui";
import { safeNext } from "@/lib/safe-next";

// Daftar akun warga dengan email + kata sandi.
export default function DaftarPage({ searchParams }: PageProps<"/masuk/daftar">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
      <div className="flex flex-col gap-[18px]">
        <Logo />
        <h1 className="font-display text-[32px] font-bold leading-[1.15]">Buat akun Gasyu</h1>
        <p className="text-[16px] leading-[1.55] text-fg-soft">
          Daftar dengan email dan kata sandi. Kami kirim kode 6 angka untuk memastikan emailnya milikmu.
        </p>
      </div>
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <Form searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function Form({ searchParams }: Pick<PageProps<"/masuk/daftar">, "searchParams">) {
  const params = await searchParams;
  const next = safeNext(params.next);
  const confirmEmail = typeof params.konfirmasi === "string" ? params.konfirmasi.trim().toLowerCase() : "";
  return <SignupForm key={confirmEmail} next={next} confirmEmail={confirmEmail || undefined} />;
}
