import { Suspense } from "react";
import { acceptInvite } from "./actions";
import { Logo, SubmitButton } from "@/components/ui";
import { cardClass } from "@/components/styles";

// Tautan undangan tim: /undangan/<token>. Proxy memastikan sudah login dan onboarding.
export default function UndanganPage({ params, searchParams }: PageProps<"/undangan/[token]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
      <Logo />
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <InviteContent params={params} searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function InviteContent({ params, searchParams }: PageProps<"/undangan/[token]">) {
  const { token } = await params;
  const { error } = await searchParams;

  return (
    <div className={`${cardClass} flex flex-col gap-4 p-5`}>
      <h1 className="font-display text-[24px] font-bold">Undangan tim</h1>
      <p className="text-[14px] leading-[1.55] text-fg-soft">
        Kamu diundang untuk membantu mengelola merchant atau komunitas di Gasyu. Setelah bergabung, dashboard-nya
        muncul di menu Profil.
      </p>
      {error === "invalid" && (
        <p role="alert" className="rounded-[14px] bg-danger-tint px-4 py-3 text-[13px] text-danger">
          Tautan undangan tidak berlaku, sudah dipakai, atau sudah lewat 7 hari. Minta tautan baru ke pemilik atau ketua.
        </p>
      )}
      {error === "member" && (
        <p role="alert" className="rounded-[14px] bg-warn-tint px-4 py-3 text-[13px] text-warn">
          Kamu sudah tercatat di tim ini.
        </p>
      )}
      <form action={acceptInvite} className="flex flex-col gap-3">
        <input type="hidden" name="token" value={token} />
        <SubmitButton pendingText="Bergabung…">Terima undangan</SubmitButton>
        <a href="/profil" className="text-center text-[13px] font-semibold text-link">
          Kembali ke profil
        </a>
      </form>
    </div>
  );
}
