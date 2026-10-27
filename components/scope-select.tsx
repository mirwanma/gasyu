import type { ScopeCity } from "@/lib/data/regions";

// Pilihan wilayah cakupan: seluruh kota atau satu kecamatan, hanya di kota yang sudah dibuka.
export function ScopeOptions({ cities }: { cities: ScopeCity[] }) {
  return (
    <>
      {cities.map((city) => (
        <optgroup key={city.id} label={city.name}>
          <option value={city.id}>Seluruh {city.name}</option>
          {city.districts.map((d) => (
            <option key={d.id} value={d.id}>
              Kec. {d.name}
            </option>
          ))}
        </optgroup>
      ))}
    </>
  );
}
