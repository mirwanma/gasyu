import { Icon } from "@/components/icons";
import type { CityOption } from "@/lib/data/activities";

// Pemilih kota di Jelajah: daftar tautan dalam <details>, tanpa JavaScript tambahan.
// hrefFor(slug) membangun alamat Jelajah dengan filter dan kata kunci yang sedang aktif.
export function CityPicker({ cities, selected, hrefFor }: { cities: CityOption[]; selected: CityOption | null; hrefFor: (slug: string) => string }) {
  const options = [{ slug: "semua", name: "Semua kota", on: selected === null }, ...cities.map((c) => ({ slug: c.slug, name: c.name, on: c.id === selected?.id }))];
  return (
    <details className="group relative">
      <summary className="flex cursor-pointer list-none items-center gap-1 rounded-full border border-line bg-surface px-3 py-1.5 text-[12px] font-semibold text-fg-label [&::-webkit-details-marker]:hidden">
        <Icon name="pin" size={14} className="shrink-0" />
        {selected?.name ?? "Semua kota"}
        <Icon name="chevronDown" size={14} stroke={2} className="shrink-0 group-open:rotate-180" />
      </summary>
      <nav aria-label="Pilih kota" className="absolute right-0 z-20 mt-2 flex min-w-[200px] flex-col overflow-hidden rounded-2xl border border-line bg-surface py-1">
        {options.map((o) => (
          <a key={o.slug} href={hrefFor(o.slug)} aria-current={o.on ? "page" : undefined} className={`px-4 py-2.5 text-[14px] ${o.on ? "font-semibold text-fg" : "text-fg-label"}`}>
            {o.name}
          </a>
        ))}
      </nav>
    </details>
  );
}
