"use client";

import { useActionState, useState } from "react";
import { addOutlet, type ActionState } from "@/lib/actions/organizer";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

type District = { id: string; name: string; villages: { id: string; name: string }[] };

const DAYS = [
  ["mon", "Sen"],
  ["tue", "Sel"],
  ["wed", "Rab"],
  ["thu", "Kam"],
  ["fri", "Jum"],
  ["sat", "Sab"],
  ["sun", "Min"],
] as const;

export function OutletForm({ organizerId, districts }: { organizerId: string; districts: District[] }) {
  const [state, formAction] = useActionState<ActionState, FormData>(addOutlet, {});
  const [days, setDays] = useState<string[]>(DAYS.map(([key]) => key));
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [geoMessage, setGeoMessage] = useState<string>();

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeoMessage("Browser ini tidak mendukung lokasi.");
    setGeoMessage("Mencari lokasi…");
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude.toFixed(6), lng: c.longitude.toFixed(6) });
        setGeoMessage("Lokasi terisi. Pastikan kamu sedang berada di outlet.");
      },
      () => setGeoMessage("Lokasi tidak bisa diambil. Isi koordinat secara manual."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <h2 className="text-[16px] font-bold">Tambah outlet</h2>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="outlet_name" className={labelClass}>Nama outlet</label>
        <input id="outlet_name" name="outlet_name" placeholder="contoh: Cabang Cibabat" maxLength={80} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="outlet_address" className={labelClass}>Alamat</label>
        <input id="outlet_address" name="outlet_address" required maxLength={300} className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="outlet_village" className={labelClass}>Kelurahan</label>
        <select id="outlet_village" name="outlet_village" defaultValue="" className={inputClass}>
          <option value="">Pilih kelurahan</option>
          {districts.map((district) => (
            <optgroup key={district.id} label={`Kec. ${district.name}`}>
              {district.villages.map((village) => (
                <option key={village.id} value={village.id}>{village.name}</option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Titik lokasi</span>
        <div className="grid grid-cols-2 gap-2">
          <input name="outlet_lat" value={coords.lat} onChange={(e) => setCoords({ ...coords, lat: e.target.value })} inputMode="decimal" placeholder="Lintang" required className={inputClass} aria-label="Lintang" />
          <input name="outlet_lng" value={coords.lng} onChange={(e) => setCoords({ ...coords, lng: e.target.value })} inputMode="decimal" placeholder="Bujur" required className={inputClass} aria-label="Bujur" />
        </div>
        <button type="button" onClick={useMyLocation} className="flex h-10 items-center justify-center gap-2 self-start rounded-full border border-line-strong bg-surface px-3.5 text-[15px] font-semibold text-fg">
          <Icon name="pin" size={16} stroke={2} />
          Pakai lokasi saat ini
        </button>
        {geoMessage && <span className="text-[13px] text-fg-soft">{geoMessage}</span>}
      </div>
      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Jam buka</span>
        <div className="flex flex-wrap gap-1.5">
          {DAYS.map(([key, label]) => {
            const on = days.includes(key);
            return (
              <button key={key} type="button" aria-pressed={on} onClick={() => setDays(on ? days.filter((d) => d !== key) : [...days, key])} className={`flex h-9 w-11 items-center justify-center rounded-full border text-[13px] font-semibold ${on ? chipClass.selected : chipClass.idle}`}>
                {label}
              </button>
            );
          })}
        </div>
        <input type="hidden" name="days" value={days.join(",")} />
        <div className="grid grid-cols-2 gap-2">
          <input name="open_time" type="time" defaultValue="08:00" className={inputClass} aria-label="Jam buka" />
          <input name="close_time" type="time" defaultValue="21:00" className={inputClass} aria-label="Jam tutup" />
        </div>
      </div>
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <SubmitButton pendingText="Menyimpan…" className="h-12 rounded-[14px] text-[15px]">Simpan outlet</SubmitButton>
    </form>
  );
}
