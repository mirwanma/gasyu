import { Suspense } from "react";
import { SaranPage } from "@/components/organizer/suggestion-pages";

export default function Page(props: PageProps<"/komunitas/[id]/saran">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Loader {...props} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/saran">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const one = (v: string | string[] | undefined) => (typeof v === "string" ? v : undefined);
  return <SaranPage id={id} type="community" query={{ tab: one(sp.tab), hasil: one(sp.hasil), error: one(sp.error) }} />;
}
