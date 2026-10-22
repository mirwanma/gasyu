import { Suspense } from "react";
import { MisiPage, type MisiQuery } from "@/components/organizer/mission-pages";

export default function Page({ params, searchParams }: PageProps<"/merchant/[id]/aktivitas/[aid]/misi">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/merchant/[id]/aktivitas/[aid]/misi">) {
  const [{ id, aid }, sp] = await Promise.all([params, searchParams]);
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const query: MisiQuery = { tab: str(sp.tab), tambah: str(sp.tambah), ubah: str(sp.ubah), qr: str(sp.qr), tandai: str(sp.tandai), hasil: str(sp.hasil), error: str(sp.error), n: str(sp.n), template: str(sp.template) };
  return <MisiPage id={id} type="merchant" aid={aid} query={query} />;
}
