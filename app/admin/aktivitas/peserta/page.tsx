import { Suspense } from "react";
import { notFound } from "next/navigation";
import { PesertaBody, type PesertaQuery } from "@/components/organizer/participants";
import { createClient } from "@/lib/supabase/server";

// Admin melihat peserta dan mengonfirmasi pembayaran event Gasyu (host platform).
export default function AdminPesertaPage({ searchParams }: PageProps<"/admin/aktivitas/peserta">) {
  return (
    <div className="flex max-w-xl flex-col gap-[18px]">
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Loader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Loader({ searchParams }: Pick<PageProps<"/admin/aktivitas/peserta">, "searchParams">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const aid = str(sp.aid);
  if (!aid) notFound();
  const supabase = await createClient();
  const { data: platformId } = await supabase.rpc("platform_organizer_id");
  const query: PesertaQuery = { tab: str(sp.tab), hasil: str(sp.hasil), error: str(sp.error) };
  return <PesertaBody organizerId={String(platformId ?? "")} type="admin" aid={aid} query={query} selfHref={`/admin/aktivitas/peserta?aid=${aid}`} backHref={`/admin/aktivitas?tab=semua&pilih=${aid}`} />;
}
