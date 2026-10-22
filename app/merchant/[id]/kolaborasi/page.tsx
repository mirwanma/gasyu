import { Suspense } from "react";
import { KolaborasiPage } from "@/components/organizer/collab-pages";

export default function Page({ params, searchParams }: PageProps<"/merchant/[id]/kolaborasi">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/merchant/[id]/kolaborasi">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return <KolaborasiPage id={id} type="merchant" filter={{ kind: str(sp.kind), regionId: str(sp.wilayah) }} buka={sp.buka === "1"} />;
}
