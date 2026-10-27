import { Suspense } from "react";
import { backLinkClass } from "@/components/styles";
import { DaftarForm } from "./daftar-form";
import { Icon } from "@/components/icons";
import { getDistrictInfo, listCityChoices } from "@/lib/data/regions";
import { getCurrentUser } from "@/lib/data/user";

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
          <h1 className="font-display text-[22px] font-semibold">Daftarkan penyelenggara</h1>
        </div>
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
          <FormLoader searchParams={searchParams} />
        </Suspense>
      </main>
    </div>
  );
}

async function FormLoader({ searchParams }: Pick<PageProps<"/daftar">, "searchParams">) {
  const { jenis } = await searchParams;
  const [cities, user] = await Promise.all([listCityChoices(), getCurrentUser()]);
  // Wilayah awal: tempat tinggal pendaftar, bisa diganti.
  const home = await getDistrictInfo(user?.homeDistrictId ?? null);
  return (
    <DaftarForm
      cities={cities}
      home={home ? { cityId: home.cityId, districtId: home.districtId } : null}
      initialType={jenis === "komunitas" ? "community" : "merchant"}
    />
  );
}
