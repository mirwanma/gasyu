import { Suspense } from "react";
import { notFound } from "next/navigation";
import { MisiBody, type MisiQuery } from "@/components/organizer/mission-pages";
import { createClient } from "@/lib/supabase/server";

// Admin mengelola misi event Gasyu (host platform), memakai tampilan yang sama dengan penyelenggara.
export default function AdminMisiPage({ searchParams }: PageProps<"/admin/aktivitas/misi">) {
  return (
    <div className="flex max-w-md flex-col gap-[18px]">
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <Loader searchParams={searchParams} />
      </Suspense>
    </div>
  );
}

async function Loader({ searchParams }: Pick<PageProps<"/admin/aktivitas/misi">, "searchParams">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const aid = str(sp.aid);
  if (!aid) notFound();
  const supabase = await createClient();
  const { data: platformId } = await supabase.rpc("platform_organizer_id");
  const query: MisiQuery = { tab: str(sp.tab), tambah: str(sp.tambah), ubah: str(sp.ubah), qr: str(sp.qr), tandai: str(sp.tandai), hasil: str(sp.hasil), error: str(sp.error), n: str(sp.n), template: str(sp.template) };
  return <MisiBody organizerId={String(platformId ?? "")} type="admin" aid={aid} query={query} selfHref={`/admin/aktivitas/misi?aid=${aid}`} backHref={`/admin/aktivitas?tab=semua&pilih=${aid}`} />;
}
