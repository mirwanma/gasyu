import { Suspense } from "react";
import { QrPage } from "@/components/organizer/qr-pages";

export default function Page({ params, searchParams }: PageProps<"/komunitas/[id]/qr">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/qr">) {
  const [{ id }, { cp }] = await Promise.all([params, searchParams]);
  return <QrPage id={id} type="community" selected={typeof cp === "string" ? cp : undefined} />;
}
