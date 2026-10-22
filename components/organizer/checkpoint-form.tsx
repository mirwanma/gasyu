"use client";

import { useActionState, useState } from "react";
import { addCheckpoint, type ActivityActionState } from "@/lib/actions/activities";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

type Outlet = { id: string; name: string; address: string };

// Tambah checkpoint: dari outlet merchant, atau titik peta manual.
export function CheckpointForm({ organizerId, type, activityId, outlets, partnerOrganizerId }: { organizerId: string; type: "merchant" | "community" | "admin"; activityId: string; outlets: Outlet[]; partnerOrganizerId?: string }) {
  const [state, formAction] = useActionState<ActivityActionState, FormData>(addCheckpoint, {});
  const [mode, setMode] = useState<"outlet" | "manual">(outlets.length > 0 ? "outlet" : "manual");
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [geoMessage, setGeoMessage] = useState<string>();

  const useMyLocation = () => {
    if (!navigator.geolocation) return setGeoMessage("Browser ini tidak mendukung lokasi.");
    setGeoMessage("Mencari lokasi…");
    navigator.geolocation.getCurrentPosition(
      ({ coords: c }) => {
        setCoords({ lat: c.latitude.toFixed(6), lng: c.longitude.toFixed(6) });
        setGeoMessage("Lokasi terisi.");
      },
      () => setGeoMessage("Lokasi tidak bisa diambil. Isi koordinat secara manual."),
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="type_org" value={type} />
      <input type="hidden" name="activity_id" value={activityId} />
      {partnerOrganizerId && <input type="hidden" name="partner_organizer_id" value={partnerOrganizerId} />}
      <h2 className="text-[18px] font-bold">Tambah checkpoint{partnerOrganizerId ? " milikmu" : ""}</h2>
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      {outlets.length > 0 && (
        <div className="flex gap-2">
          {([["outlet", "Dari outlet"], ["manual", "Titik peta"]] as const).map(([value, label]) => (
            <button key={value} type="button" aria-pressed={mode === value} onClick={() => setMode(value)} className={`${chipClass.base} ${mode === value ? chipClass.selected : chipClass.idle}`}>
              {label}
            </button>
          ))}
        </div>
      )}
      {mode === "outlet" ? (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="outlet_id" className={labelClass}>Outlet</label>
          <select id="outlet_id" name="outlet_id" required defaultValue={outlets[0]?.id} className={inputClass}>
            {outlets.map((o) => (
              <option key={o.id} value={o.id}>{o.name} · {o.address}</option>
            ))}
          </select>
        </div>
      ) : (
        <>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cp_name" className={labelClass}>Nama titik</label>
            <input id="cp_name" name="name" required maxLength={80} placeholder="contoh: Panggung utama" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="cp_address" className={labelClass}>Alamat (opsional)</label>
            <input id="cp_address" name="address" maxLength={300} className={inputClass} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input name="lat" value={coords.lat} onChange={(e) => setCoords({ ...coords, lat: e.target.value })} inputMode="decimal" placeholder="Lintang" required className={inputClass} aria-label="Lintang" />
            <input name="lng" value={coords.lng} onChange={(e) => setCoords({ ...coords, lng: e.target.value })} inputMode="decimal" placeholder="Bujur" required className={inputClass} aria-label="Bujur" />
          </div>
          <button type="button" onClick={useMyLocation} className="flex h-10 items-center justify-center gap-2 self-start rounded-full border border-line-strong bg-surface px-3.5 text-[16px] font-semibold text-fg">
            <Icon name="pin" size={16} stroke={2} />
            Pakai lokasi saat ini
          </button>
          {geoMessage && <span className="text-[14px] text-fg-soft">{geoMessage}</span>}
        </>
      )}
      <div className="flex flex-col gap-1.5">
        <label htmlFor="radius_m" className={labelClass}>Radius check-in (meter, kosongkan untuk standar)</label>
        <input id="radius_m" name="radius_m" type="number" min={30} max={2000} inputMode="numeric" className={inputClass} />
      </div>
      <SubmitButton size="small" variant="dark" pendingText="Menyimpan…" className="self-end">
        Tambah
      </SubmitButton>
    </form>
  );
}
