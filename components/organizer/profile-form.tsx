"use client";

import { useActionState, useState } from "react";
import { updateOrganizerProfile, type ActionState } from "@/lib/actions/organizer";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";
import { COMMUNITY_CATEGORIES, MERCHANT_CATEGORIES } from "@/lib/organizers";
import { ImageFileInput } from "@/components/image-file-input";
import { RegionPicker } from "@/components/region-picker";
import type { CityChoice } from "@/lib/data/regions";

export function ProfileForm({
  organizerId,
  type,
  cities,
  values,
}: {
  organizerId: string;
  type: "merchant" | "community";
  cities: CityChoice[];
  values: {
    name: string;
    description: string;
    whatsapp: string;
    category: string;
    nib: string;
    instagram: string;
    tiktok: string;
    estMembers: string;
    basecamp: string;
    // Area kegiatan komunitas (kecamatan) dan kotanya.
    area: { cityId: string; districtId: string } | null;
    hasProof: boolean;
  };
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(updateOrganizerProfile, {});
  const [category, setCategory] = useState(values.category);
  const categories = type === "merchant" ? MERCHANT_CATEGORIES : COMMUNITY_CATEGORIES;

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3.5 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="type" value={type} />
      <input type="hidden" name="category" value={category} />

      <Field id="name" label={type === "merchant" ? "Nama usaha" : "Nama komunitas"} defaultValue={values.name} required maxLength={80} />
      <Field id="whatsapp" label="WhatsApp" type="tel" defaultValue={values.whatsapp} required />
      {type === "merchant" && <Field id="nib" label="NIB (opsional)" defaultValue={values.nib} />}

      <div className="flex flex-col gap-2">
        <span className="text-[15px] font-semibold">Kategori</span>
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
          Deskripsi singkat
        </label>
        <textarea id="description" name="description" rows={3} maxLength={1000} defaultValue={values.description} className={`${textareaClass} resize-none`} />
      </div>

      {type === "community" && (
        <>
          <div className="flex flex-col gap-1.5">
            <span className="text-[15px] font-semibold">Area kegiatan</span>
            <RegionPicker
              cities={cities}
              name="area_district"
              idPrefix="area"
              initialCityId={values.area?.cityId}
              initialDistrictId={values.area?.districtId}
              closedNote="Kamu tetap bisa melanjutkan. Tim Gasyu meninjau pembukaan kota ini saat verifikasi."
            />
          </div>
          <Field id="instagram" label="Instagram" defaultValue={values.instagram} placeholder="nama akun tanpa @" />
          <Field id="tiktok" label="TikTok" defaultValue={values.tiktok} placeholder="nama akun tanpa @" />
          <Field id="est_members" label="Perkiraan jumlah anggota" type="number" min={0} defaultValue={values.estMembers} />
          <Field id="basecamp_address" label="Basecamp" defaultValue={values.basecamp} />
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Logo baru (opsional, maks. 2 MB)</span>
        <ImageFileInput name="logo" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-fg-label" maxMb={2} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>
          {type === "merchant" ? "Foto tempat usaha" : "Foto kegiatan"} {values.hasProof ? "(ganti, opsional)" : "(belum ada, wajib untuk verifikasi)"}
        </span>
        <ImageFileInput name="proof" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-fg-label" maxMb={3} />
      </div>

      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <SubmitButton pendingText="Menyimpan…" className="h-12 rounded-[14px] text-[15px]">
        Simpan profil
      </SubmitButton>
    </form>
  );
}

function Field({ id, label, type = "text", ...rest }: { id: string; label: string } & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className={labelClass}>
        {label}
      </label>
      <input id={id} name={id} type={type} className={inputClass} {...rest} />
    </div>
  );
}
