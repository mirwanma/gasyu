"use client";

import { useActionState, useState } from "react";
import { registerOrganizer, type RegisterState } from "./actions";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { COMMUNITY_CATEGORIES, MERCHANT_CATEGORIES } from "@/lib/organizers";
import { ImageFileInput } from "@/components/image-file-input";
import { RegionPicker } from "@/components/region-picker";
import type { CityChoice } from "@/lib/data/regions";

const CLOSED_NOTE = "Kamu tetap bisa mendaftar. Tim Gasyu meninjau pembukaan kota ini saat verifikasi.";
type OrganizerKind = "merchant" | "community";

const DAYS = [
  ["mon", "Sen"],
  ["tue", "Sel"],
  ["wed", "Rab"],
  ["thu", "Kam"],
  ["fri", "Jum"],
  ["sat", "Sab"],
  ["sun", "Min"],
] as const;

export function DaftarForm({
  cities,
  home,
  initialType,
}: {
  cities: CityChoice[];
  home: { cityId: string; districtId: string } | null;
  initialType: OrganizerKind;
}) {
  const [state, formAction] = useActionState<RegisterState, FormData>(registerOrganizer, {});
  const [kind, setKind] = useState<OrganizerKind>(initialType);
  const [category, setCategory] = useState("");
  const [days, setDays] = useState<string[]>(DAYS.map(([key]) => key));
  const [coords, setCoords] = useState({ lat: "", lng: "" });
  const [geoMessage, setGeoMessage] = useState<string>();

  const categories = kind === "merchant" ? MERCHANT_CATEGORIES : COMMUNITY_CATEGORIES;

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
    <form action={formAction} className="flex flex-col gap-[18px]">
      <input type="hidden" name="type" value={kind} />
      <input type="hidden" name="category" value={category} />

      <div role="radiogroup" aria-label="Jenis penyelenggara" className="grid grid-cols-2 gap-2.5">
        <KindOption
          selected={kind === "merchant"}
          onSelect={() => {
            if (kind === "merchant") return;
            setKind("merchant");
            setCategory("");
          }}
          title="Merchant / UMKM"
          hint="Kedai, toko, jasa, bengkel, usaha apa pun"
        />
        <KindOption
          selected={kind === "community"}
          onSelect={() => {
            if (kind === "community") return;
            setKind("community");
            setCategory("");
          }}
          title="Komunitas"
          hint="Olahraga, musik, seni, hobi, sosial"
        />
      </div>

      <section className={`${cardClass} flex flex-col gap-3.5 p-4`}>
        <label className="flex items-center gap-3.5">
          <span className="flex size-16 shrink-0 items-center justify-center rounded-[18px] border-[1.5px] border-dashed border-line-strong text-fg-soft">
            <Icon name="upload" size={22} />
          </span>
          <span className="flex flex-col gap-1">
            <span className="text-[15px] text-fg-soft">{kind === "merchant" ? "Logo usaha" : "Logo komunitas"}, persegi, maks. 2 MB</span>
            <ImageFileInput name="logo" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-fg-label" maxMb={2} />
          </span>
        </label>

        <Field id="name" label={kind === "merchant" ? "Nama usaha" : "Nama komunitas"} required maxLength={80} />
        <Field id="whatsapp" label="WhatsApp" type="tel" required placeholder="08xxxxxxxxxx" />
        {kind === "merchant" && <Field id="nib" label="NIB (opsional)" placeholder="Nomor Induk Berusaha" />}

        <div className="flex flex-col gap-2">
          <span className="text-[15px] font-semibold">{kind === "merchant" ? "Kategori usaha" : "Kategori minat"}</span>
          <div className="flex flex-wrap gap-2">
            {categories.map(([value, label]) => (
              <button
                key={value}
                type="button"
                aria-pressed={category === value}
                onClick={() => setCategory(value)}
                className={`${chipClass.base} ${category === value ? chipClass.selected : chipClass.idle}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className={labelClass}>
            Deskripsi singkat (opsional)
          </label>
          <textarea id="description" name="description" rows={3} maxLength={1000} className={`${textareaClass} resize-none`} />
        </div>
      </section>

      {kind === "merchant" ? (
        <section className={`${cardClass} flex flex-col gap-3 p-4`}>
          <h2 className="text-[16px] font-bold">Outlet 1</h2>
          <span className="text-[13px] text-fg-soft">Outlet lain bisa ditambah dari dashboard setelah mendaftar.</span>
          <Field id="outlet_name" label="Nama outlet" placeholder="contoh: Cabang Baros" maxLength={80} />
          <Field id="outlet_address" label="Alamat" required maxLength={300} />
          <RegionPicker cities={cities} name="outlet_district" idPrefix="outlet" initialCityId={home?.cityId} initialDistrictId={home?.districtId} closedNote={CLOSED_NOTE} />

          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">Titik lokasi</span>
            <div className="grid grid-cols-2 gap-2">
              <input
                name="outlet_lat"
                value={coords.lat}
                onChange={(e) => setCoords({ ...coords, lat: e.target.value })}
                inputMode="decimal"
                placeholder="Lintang, mis. -6.8906"
                required
                className={inputClass}
                aria-label="Lintang"
              />
              <input
                name="outlet_lng"
                value={coords.lng}
                onChange={(e) => setCoords({ ...coords, lng: e.target.value })}
                inputMode="decimal"
                placeholder="Bujur, mis. 107.5423"
                required
                className={inputClass}
                aria-label="Bujur"
              />
            </div>
            <button
              type="button"
              onClick={useMyLocation}
              className="flex h-10 items-center justify-center gap-2 self-start rounded-full border border-line-strong bg-surface px-3.5 text-[15px] font-semibold text-fg"
            >
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
                  <button
                    key={key}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setDays(on ? days.filter((d) => d !== key) : [...days, key])}
                    className={`flex h-9 w-11 items-center justify-center rounded-full border text-[13px] font-semibold ${on ? chipClass.selected : chipClass.idle}`}
                  >
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
        </section>
      ) : (
        <section className={`${cardClass} flex flex-col gap-3 p-4`}>
          <h2 className="text-[16px] font-bold">Tentang komunitas</h2>
          <span className="text-[15px] font-semibold">Area kegiatan</span>
          <RegionPicker cities={cities} name="area_district" idPrefix="area" initialCityId={home?.cityId} initialDistrictId={home?.districtId} closedNote={CLOSED_NOTE} />
          <Field id="instagram" label="Instagram (opsional)" placeholder="nama akun tanpa @" />
          <Field id="tiktok" label="TikTok (opsional)" placeholder="nama akun tanpa @" />
          <Field id="est_members" label="Perkiraan jumlah anggota" type="number" min={0} />
          <Field id="basecamp_address" label="Basecamp (opsional)" placeholder="alamat tempat kumpul" />
          <div className="flex flex-col gap-2">
            <span className="text-[15px] font-semibold">Cara warga bergabung jadi member</span>
            <label className="flex items-center gap-3 text-[15px]">
              <input type="radio" name="join_policy" value="approval" defaultChecked className="size-4 accent-primary" />
              Perlu persetujuan pengurus
            </label>
            <label className="flex items-center gap-3 text-[15px]">
              <input type="radio" name="join_policy" value="open" className="size-4 accent-primary" />
              Terbuka, langsung aktif
            </label>
          </div>
        </section>
      )}

      <section className={`${cardClass} flex flex-col gap-2 p-4`}>
        <span className="text-[15px] font-semibold">{kind === "merchant" ? "Foto tempat usaha" : "Bukti kegiatan"}</span>
        <span className="text-[13px] text-fg-soft">
          {kind === "merchant"
            ? "Foto tampak depan dengan papan nama, untuk verifikasi tim Gasyu."
            : "Foto kegiatan komunitas, untuk verifikasi tim Gasyu."}
        </span>
        <ImageFileInput name="proof" accept="image/png,image/jpeg,image/webp" required className="text-[13px] text-fg-label" maxMb={3} />
      </section>

      <ErrorMessage message={state.error} />
      <span className="text-[13px] leading-[1.5] text-fg-soft">
        Selama menunggu verifikasi (1–2 hari kerja) kamu sudah bisa menyiapkan draft aktivitas. Tombol ajukan terbuka setelah
        disetujui.
      </span>
      <SubmitButton pendingText="Mengirim…">Kirim untuk verifikasi</SubmitButton>
    </form>
  );
}

function KindOption({ selected, onSelect, title, hint }: { selected: boolean; onSelect: () => void; title: string; hint: string }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={`flex flex-col gap-1 rounded-2xl p-3.5 text-left ${
        selected ? "border-2 border-primary bg-primary-tint" : "border border-line bg-surface"
      }`}
    >
      <span className="text-[16px] font-bold text-fg">{title}</span>
      <span className="text-[13px] text-fg-soft">{hint}</span>
    </button>
  );
}

function Field({
  id,
  label,
  type = "text",
  ...rest
}: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} name={id} type={type} className={inputClass} {...rest} />
    </div>
  );
}
