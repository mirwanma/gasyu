import { Suspense } from "react";
import { AktivitasListPage } from "@/components/organizer/activity-pages";

export default function Page({ params, searchParams }: PageProps<"/komunitas/[id]/aktivitas">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/aktivitas">) {
  const [{ id }, { tab }] = await Promise.all([params, searchParams]);
  return <AktivitasListPage id={id} type="community" tab={typeof tab === "string" ? tab : undefined} />;
}
