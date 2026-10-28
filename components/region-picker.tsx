"use client";

import { useEffect, useMemo, useState } from "react";
import { inputClass, labelClass } from "@/components/styles";
import { createClient } from "@/lib/supabase/client";
import type { CityChoice } from "@/lib/data/regions";

export type RegionValue = { districtId: string; districtName: string; cityName: string; cityActive: boolean };

type District = { id: string; name: string };

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
  const [province, setProvince] = useState<string>(() => cities.find((c) => c.id === initialCityId)?.province ?? "");
  const [cityId, setCityId] = useState<string>(initialCityId ?? "");
  const [districts, setDistricts] = useState<{ cityId: string; rows: District[] } | null>(null);
  const [districtId, setDistrictId] = useState<string>(initialDistrictId ?? "");
  const [loadError, setLoadError] = useState(false);

  const provinces = useMemo(() => [...new Set(cities.map((c) => c.province).filter((p): p is string => Boolean(p)))].sort(), [cities]);
  const provinceCities = useMemo(() => cities.filter((c) => c.province === province), [cities, province]);
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

  const pickProvince = (value: string) => {
    setProvince(value);
    setCityId("");
    setDistrictId("");
    onChange?.(null);
  };

  const pickCity = (id: string) => {
    setCityId(id);
    setDistrictId("");
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
        <label htmlFor={`${idPrefix}-provinsi`} className={labelClass}>
          Provinsi
        </label>
        <select id={`${idPrefix}-provinsi`} value={province} onChange={(event) => pickProvince(event.target.value)} className={inputClass}>
          <option value="">Pilih provinsi</option>
          {provinces.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>

      {province && (
        <div className="flex flex-col gap-2.5">
          <label htmlFor={`${idPrefix}-kota`} className={labelClass}>
            Kota/kabupaten
          </label>
          <select id={`${idPrefix}-kota`} value={cityId} onChange={(event) => pickCity(event.target.value)} className={inputClass}>
            <option value="">Pilih kota/kabupaten</option>
            {provinceCities.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      )}

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
