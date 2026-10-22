import { Suspense } from "react";
import { AktivitasBaruPage } from "@/components/organizer/activity-pages";

export default function Page({ params }: PageProps<"/komunitas/[id]/aktivitas/baru">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} />
    </Suspense>
  );
}

async function Loader({ params }: Pick<PageProps<"/komunitas/[id]/aktivitas/baru">, "params">) {
  const { id } = await params;
  return <AktivitasBaruPage id={id} type="community" />;
}
