import { Suspense } from "react";
import { LainnyaPage } from "@/components/organizer/pages";

export default function Page({ params }: PageProps<"/merchant/[id]/lainnya">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/merchant/[id]/lainnya">, "params">) {
  const { id } = await params;
  return <LainnyaPage id={id} type="merchant" />;
}
