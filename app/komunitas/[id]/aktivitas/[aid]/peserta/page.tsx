import { Suspense } from "react";
import { PesertaPage } from "@/components/organizer/activity-pages";

export default function Page({ params, searchParams }: PageProps<"/komunitas/[id]/aktivitas/[aid]/peserta">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[16px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/aktivitas/[aid]/peserta">) {
  const [{ id, aid }, sp] = await Promise.all([params, searchParams]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  return <PesertaPage id={id} type="community" aid={aid} query={{ tab: str(sp.tab), hasil: str(sp.hasil), error: str(sp.error) }} />;
}
