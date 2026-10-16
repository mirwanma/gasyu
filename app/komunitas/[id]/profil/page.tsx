import { Suspense } from "react";
import { ProfilPage } from "@/components/organizer/pages";

export default function Page(props: PageProps<"/komunitas/[id]/profil">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Loader {...props} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/profil">) {
  const { id } = await params;
  const { unggah } = await searchParams;
  return <ProfilPage id={id} type="community" unggah={typeof unggah === "string" ? unggah : undefined} />;
}
