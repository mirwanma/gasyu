"use client";

import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/icons";
import { inputClass, labelClass } from "@/components/styles";
import { createClient } from "@/lib/supabase/client";
import type { CityChoice } from "@/lib/data/regions";

export type RegionValue = { districtId: string; districtName: string; cityName: string; cityActive: boolean };

type District = { id: string; name: string };

// "Kota Bandung" dan "Kabupaten Bandung" sama-sama cocok dengan kata kunci "bandung".
function normalize(text: string) {
  return text.toLowerCase().replace(/^(kota administrasi|kota|kabupaten administrasi|kabupaten)\s+/, "");
}

// Pemilih wilayah asal: cari kota/kabupaten (seluruh Indonesia), lalu pilih kecamatannya.
// Nilai yang dikirim formulir: id kecamatan di input tersembunyi `name`.
export function RegionPicker({
  cities,
  name,
  initialCityId = null,
  initialDistrictId = null,
  onChange,
  idPrefix = "wilayah",
  closedNote = "Kamu tetap bisa daftar dan ikut aktivitas; peringkat kotamu tampil setelah kota ini dibuka.",
}: {
  cities: CityChoice[];
  name: string;
  initialCityId?: string | null;
  initialDistrictId?: string | null;
  onChange?: (value: RegionValue | null) => void;
  idPrefix?: string;
  // Keterangan jika kota yang dipilih belum dibuka di Gasyu.
  closedNote?: string;
}) {
  const [cityId, setCityId] = useState<string | null>(initialCityId);
  const [query, setQuery] = useState("");
  const [districts, setDistricts] = useState<{ cityId: string; rows: District[] } | null>(null);
  const [districtId, setDistrictId] = useState<string>(initialDistrictId ?? "");
  const [loadError, setLoadError] = useState(false);

  const city = cities.find((c) => c.id === cityId) ?? null;
  const rows = districts?.cityId === cityId ? districts.rows : null;

  // Kecamatan dimuat dari tabel regions (boleh dibaca semua orang) setiap kota berganti.
  useEffect(() => {
    if (!cityId) return;
    let cancelled = false;
    createClient()
      .from("regions")
      .select("id, name")
      .eq("parent_id", cityId)
      .eq("level", "district")
      .eq("is_active", true)
      .order("name")
      .then(({ data, error }) => {
        if (cancelled) return;
        setLoadError(Boolean(error));
        setDistricts({ cityId, rows: data ?? [] });
      });
    return () => {
      cancelled = true;
    };
  }, [cityId]);

  const matches = useMemo(() => {
    const keyword = normalize(query.trim());
    if (!keyword) return [];
    return cities
      .filter((c) => normalize(c.name).includes(keyword) || c.name.toLowerCase().includes(keyword))
      .sort((a, b) => Number(normalize(b.name).startsWith(keyword)) - Number(normalize(a.name).startsWith(keyword)))
      .slice(0, 8);
  }, [cities, query]);

  const pickCity = (id: string) => {
    setCityId(id);
    setDistrictId("");
    setQuery("");
    onChange?.(null);
  };

  const pickDistrict = (id: string) => {
    setDistrictId(id);
    const district = rows?.find((d) => d.id === id);
    onChange?.(district && city ? { districtId: id, districtName: district.name, cityName: city.name, cityActive: city.active } : null);
  };

  return (
    <div className="flex flex-col gap-4">
      <input type="hidden" name={name} value={districtId} />

      <div className="flex flex-col gap-2.5">
        <span className={labelClass} id={`${idPrefix}-kota-label`}>
          Kota/kabupaten
        </span>
        {city ? (
          <div className="flex min-h-[52px] items-center justify-between gap-3 rounded-2xl border border-primary bg-surface px-4">
            <span className="flex min-w-0 items-center gap-2 text-[16px] font-semibold text-fg">
              <Icon name="pin" size={18} className="shrink-0 text-primary" />
              <span className="truncate">{city.name}</span>
            </span>
            <button type="button" onClick={() => { setCityId(null); setDistrictId(""); onChange?.(null); }} className="min-h-11 shrink-0 text-[15px] font-semibold text-link">
              Ganti
            </button>
          </div>
        ) : (
          <>
            <div className="relative">
              <Icon name="search" size={18} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-fg-muted" />
              <input
                id={`${idPrefix}-kota`}
                aria-labelledby={`${idPrefix}-kota-label`}
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Ketik nama kota, mis. Bandung"
                autoComplete="off"
                className={`${inputClass} pl-11`}
              />
            </div>
            {query.trim() !== "" && (
              <ul className="flex flex-col overflow-hidden rounded-2xl border border-line bg-surface" aria-label="Hasil pencarian kota">
                {matches.map((c) => (
                  <li key={c.id}>
                    <button type="button" onClick={() => pickCity(c.id)} className="flex min-h-12 w-full flex-col items-start justify-center px-4 py-2 text-left hover:bg-surface-2">
                      <span className="text-[15px] font-semibold text-fg">{c.name}</span>
                      {c.province && <span className="text-[13px] text-fg-muted">{c.province}</span>}
                    </button>
                  </li>
                ))}
                {matches.length === 0 && <li className="px-4 py-3 text-[15px] text-fg-soft">Kota tidak ditemukan.</li>}
              </ul>
            )}
          </>
        )}
      </div>

      {city && (
        <div className="flex flex-col gap-2.5">
          <label htmlFor={`${idPrefix}-kecamatan`} className={labelClass}>
            Kecamatan
          </label>
          <select
            id={`${idPrefix}-kecamatan`}
            value={districtId}
            onChange={(event) => pickDistrict(event.target.value)}
            disabled={!rows}
            className={inputClass}
          >
            <option value="">{rows ? "Pilih kecamatan" : "Memuat kecamatan…"}</option>
            {rows?.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>
          {loadError && <p className="text-[14px] text-danger">Daftar kecamatan gagal dimuat. Coba muat ulang halaman.</p>}
          {!city.active && (
            <p className="text-[14px] leading-[1.5] text-fg-soft">
              {city.name} belum dibuka di Gasyu. {closedNote}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
