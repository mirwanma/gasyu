import { Suspense } from "react";
import { AktivitasDetailPage } from "@/components/organizer/activity-pages";

export default function Page({ params, searchParams }: PageProps<"/merchant/[id]/aktivitas/[aid]">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/merchant/[id]/aktivitas/[aid]">) {
  const [{ id, aid }, sp] = await Promise.all([params, searchParams]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return <AktivitasDetailPage id={id} type="merchant" aid={aid} hasil={str(sp.hasil)} error={str(sp.error)} edit={sp.ubah === "1"} />;
}
