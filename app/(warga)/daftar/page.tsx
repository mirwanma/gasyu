import { Suspense } from "react";
import { backLinkClass } from "@/components/styles";
import { DaftarForm } from "./daftar-form";
import { Icon } from "@/components/icons";
import { getVillageOptions } from "@/lib/data/organizers";

// Daftarkan merchant atau komunitas. Mode penyelenggara memakai tema terang.
export default function DaftarPage({ searchParams }: PageProps<"/daftar">) {
  return (
    <div className="flex flex-1 flex-col">
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-10 pt-5">
        <div className="flex items-center gap-3">
          <a href="/profil" className={backLinkClass}>
            <Icon name="back" stroke={2} />
            Kembali
          </a>
          <h1 className="font-display text-[24px] font-semibold">Daftarkan penyelenggara</h1>
        </div>
        <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
          <FormLoader searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function FormLoader({ searchParams }: Pick<PageProps<"/daftar">, "searchParams">) {
  const { jenis } = await searchParams;
  const districts = await getVillageOptions();
  return <DaftarForm districts={districts} initialType={jenis === "komunitas" ? "community" : "merchant"} />;
}
