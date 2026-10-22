import { Suspense } from "react";
import { LainnyaPage } from "@/components/organizer/pages";

export default function Page(props: PageProps<"/merchant/[id]/lainnya">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader {...props} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/merchant/[id]/lainnya">) {
  const [{ id }, { akses }] = await Promise.all([params, searchParams]);
  return <LainnyaPage id={id} type="merchant" akses={typeof akses === "string" ? akses : undefined} />;
}
