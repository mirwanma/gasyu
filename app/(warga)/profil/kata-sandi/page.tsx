import { Suspense } from "react";
import { PasswordForm } from "./password-form";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { createClient } from "@/lib/supabase/server";

// Buat atau ganti kata sandi. `?baru=1` berarti warga datang dari halaman Lupa kata sandi.
export default function KataSandiPage({ searchParams }: PageProps<"/profil/kata-sandi">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
            <Icon name="back" stroke={2} />
          </a>
          <h1 className="font-display text-[24px] font-bold">Kata sandi</h1>
        </div>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Content searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/profil/kata-sandi">, "searchParams">) {
  const params = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();
  const email = typeof data?.claims?.email === "string" ? data.claims.email : "";

  return (
    <>
      <p className="text-[14px] leading-[1.55] text-fg-soft">
        {params.baru === "1"
          ? "Kamu sudah masuk. Buat kata sandi baru supaya lain kali bisa masuk tanpa menunggu kode."
          : "Buat kata sandi kalau selama ini kamu masuk pakai kode email atau Google, atau ganti kata sandi lama."}
        {email && (
          <>
            {" "}Masuk berikutnya pakai email <span className="font-semibold text-fg">{email}</span>.
          </>
        )}
      </p>
      <PasswordForm />
    </>
  );
}
