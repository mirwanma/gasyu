import { Suspense } from "react";
import { ActivityCard } from "@/components/activity-card";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { CityPicker } from "@/components/city-picker";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, inputClass } from "@/components/styles";
import { getHomeCityId, listCities, listPublicActivities } from "@/lib/data/activities";
import { listTopPrizes } from "@/lib/data/global-events";
import { getCurrentUser } from "@/lib/data/user";

const FILTERS: [string, string][] = [
  ["", "Semua"],
  ["global", "Event Global"],
  ["event", "Event"],
  ["challenge", "Challenge"],
  ["gratis", "Gratis"],
  ["berbayar", "Berbayar"],
  ["member", "Khusus member"],
];

// Jelajah aktivitas warga, mengikuti artboard "Warga · Jelajah".
export default function JelajahPage({ searchParams }: PageProps<"/jelajah">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-32 pt-6">
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
          <Explore searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Jelajah" />
    </>
  );
}

async function Explore({ searchParams }: Pick<PageProps<"/jelajah">, "searchParams">) {
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : "";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const kota = typeof sp.kota === "string" ? sp.kota : "";
  const [user, cities] = await Promise.all([getCurrentUser(), listCities()]);
  // Kota terpilih: dari alamat (?kota=32.77 atau ?kota=semua), selain itu kota tempat tinggal warga.
  const homeCityId = !kota && user ? await getHomeCityId(user.id, cities) : null;
  const city = kota === "semua" ? null : (cities.find((c) => c.slug === kota) ?? cities.find((c) => c.id === homeCityId) ?? null);
  const isGlobal = filter === "global";
  const items = await listPublicActivities({ filter, q, cityId: city?.id });
  // Alamat Jelajah dengan filter, kata kunci, dan kota yang sedang aktif; kota hanya ditulis jika berbeda dari bawaan.
  const hrefFor = (next: { filter?: string; kota?: string }) => {
    const params = new URLSearchParams();
    const f = next.filter ?? filter;
    const k = next.kota ?? kota;
    if (f) params.set("filter", f);
    if (q) params.set("q", q);
    if (k) params.set("kota", k);
    const qs = params.toString();
    return `/jelajah${qs ? `?${qs}` : ""}`;
  };
  const topPrizes = isGlobal ? await listTopPrizes(items.map((c) => c.id)) : new Map<string, string>();

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[26px] font-bold">Jelajah</h1>
        {!isGlobal && <CityPicker cities={cities} selected={city} hrefFor={(slug) => hrefFor({ kota: slug })} />}
      </header>

      <form className="relative" role="search">
        {filter && <input type="hidden" name="filter" value={filter} />}
        {kota && <input type="hidden" name="kota" value={kota} />}
        <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input name="q" defaultValue={q} placeholder="Cari event, challenge, atau penyelenggara" className={`${inputClass} pl-11`} aria-label="Cari aktivitas" />
      </form>

      <nav aria-label="Filter" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map(([value, label]) => {
          const on = value === filter;
          return (
            <a key={label} href={hrefFor({ filter: value })} aria-current={on ? "page" : undefined} className={`${chipClass.base} shrink-0 ${on ? chipClass.selected : chipClass.idle}`}>
              {label}
            </a>
          );
        })}
      </nav>

      {isGlobal && (
        <p className="rounded-2xl bg-hot-tint px-4 py-3 text-[13px] leading-[1.5] text-hot">
          Event Global terbuka untuk pengguna dari kota mana pun. Hasilnya skor event dan papan peringkat khusus event, dengan hadiah untuk peringkat teratas. Skor tidak menambah Jejak atau poin.
        </p>
      )}

      {items.length === 0 ? (
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="text-[16px] font-semibold">Belum ada aktivitas</span>
          <span className="text-[15px] leading-[1.5] text-fg-soft">
            {isGlobal && !q ? "Belum ada Event Global yang dibuka. Pantau terus, tim Gasyu akan mengumumkannya." : q || filter ? "Coba kata kunci atau filter lain." : "Event dan challenge dari UMKM dan komunitas akan tampil di sini."}
          </span>
          {!isGlobal && city && (
            <a href={hrefFor({ kota: "semua" })} className="mt-1 text-[15px] font-semibold text-link">
              Belum ada di {city.name}. Lihat semua kota →
            </a>
          )}
        </div>
      ) : (
        <div className="flex flex-col gap-3.5">
          {items.map((card) => (
            <ActivityCard key={card.id} card={card} href={`/aktivitas/${card.id}`} topPrize={topPrizes.get(card.id)} />
          ))}
        </div>
      )}
    </>
  );
}
