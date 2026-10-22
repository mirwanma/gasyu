import { Suspense } from "react";
import { TimPage } from "@/components/organizer/pages";

export default function Page(props: PageProps<"/komunitas/[id]/tim">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader {...props} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/tim">) {
  const { id } = await params;
  const { error, hasil } = await searchParams;
  return <TimPage id={id} type="community" error={typeof error === "string" ? error : undefined} hasil={typeof hasil === "string" ? hasil : undefined} />;
}
