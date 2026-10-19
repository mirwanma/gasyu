import { Suspense } from "react";
import { ActivityCard } from "@/components/activity-card";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, inputClass } from "@/components/styles";
import { listPublicActivities } from "@/lib/data/activities";
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
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
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
  const [user, items] = await Promise.all([getCurrentUser(), listPublicActivities({ filter, q })]);
  const isGlobal = filter === "global";
  const topPrizes = isGlobal ? await listTopPrizes(items.map((c) => c.id)) : new Map<string, string>();

  return (
    <>
      <header className="flex items-center justify-between">
        <h1 className="font-display text-[24px] font-bold">Jelajah</h1>
        <span className="rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-fg-label">
          {user?.villageName ?? "Luar Cimahi"}
        </span>
      </header>

      <form className="relative" role="search">
        {filter && <input type="hidden" name="filter" value={filter} />}
        <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
        <input name="q" defaultValue={q} placeholder="Cari event, challenge, atau penyelenggara" className={`${inputClass} pl-11`} aria-label="Cari aktivitas" />
      </form>

      <nav aria-label="Filter" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {FILTERS.map(([value, label]) => {
          const on = value === filter;
          const params = new URLSearchParams();
          if (value) params.set("filter", value);
          if (q) params.set("q", q);
          const qs = params.toString();
          return (
            <a key={label} href={`/jelajah${qs ? `?${qs}` : ""}`} aria-current={on ? "page" : undefined} className={`${chipClass.base} shrink-0 ${on ? chipClass.selected : chipClass.idle}`}>
              {label}
            </a>
          );
        })}
      </nav>

      {isGlobal && (
        <p className="rounded-2xl bg-hot-tint px-4 py-3 text-[12px] leading-[1.5] text-hot">
          Event Global terbuka untuk pengguna dari kota mana pun. Hasilnya skor event dan papan peringkat khusus event, dengan hadiah untuk peringkat teratas. Skor tidak menambah XP atau poin.
        </p>
      )}

      {items.length === 0 ? (
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="text-[15px] font-semibold">Belum ada aktivitas</span>
          <span className="text-[13px] leading-[1.5] text-fg-soft">
            {isGlobal && !q ? "Belum ada Event Global yang dibuka. Pantau terus, tim Gasyu akan mengumumkannya." : q || filter ? "Coba kata kunci atau filter lain." : "Event dan challenge dari UMKM dan komunitas akan tampil di sini."}
          </span>
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
