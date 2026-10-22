import { Suspense } from "react";
import { LainnyaPage } from "@/components/organizer/pages";

export default function Page(props: PageProps<"/komunitas/[id]/lainnya">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[16px] text-fg-muted">Memuat…</p>}>
      <Loader {...props} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/lainnya">) {
  const [{ id }, { akses }] = await Promise.all([params, searchParams]);
  return <LainnyaPage id={id} type="community" akses={typeof akses === "string" ? akses : undefined} />;
}
