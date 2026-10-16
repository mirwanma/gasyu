import { Suspense } from "react";
import { PesertaPage } from "@/components/organizer/activity-pages";

export default function Page({ params }: PageProps<"/merchant/[id]/aktivitas/[aid]/peserta">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/merchant/[id]/aktivitas/[aid]/peserta">, "params">) {
  const { id, aid } = await params;
  return <PesertaPage id={id} type="merchant" aid={aid} />;
}
