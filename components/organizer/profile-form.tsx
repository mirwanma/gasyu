"use client";

import { useActionState, useState } from "react";
import { updateOrganizerProfile, type ActionState } from "@/lib/actions/organizer";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";
import { COMMUNITY_CATEGORIES, MERCHANT_CATEGORIES } from "@/lib/organizers";
import { ImageFileInput } from "@/components/image-file-input";

type District = { id: string; name: string; villages: { id: string; name: string }[] };

export function ProfileForm({
  organizerId,
  type,
  districts,
  values,
}: {
  organizerId: string;
  type: "merchant" | "community";
  districts: District[];
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
    areaVillage: string;
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
        <span className="text-[13px] font-semibold">Kategori</span>
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
            <label htmlFor="area_village" className={labelClass}>
              Area kegiatan (kelurahan)
            </label>
            <select id="area_village" name="area_village" defaultValue={values.areaVillage} className={inputClass}>
              <option value="">Pilih kelurahan</option>
              {districts.map((district) => (
                <optgroup key={district.id} label={`Kec. ${district.name}`}>
                  {district.villages.map((village) => (
                    <option key={village.id} value={village.id}>
                      {village.name}
                    </option>
                  ))}
                </optgroup>
              ))}
            </select>
          </div>
          <Field id="instagram" label="Instagram" defaultValue={values.instagram} placeholder="nama akun tanpa @" />
          <Field id="tiktok" label="TikTok" defaultValue={values.tiktok} placeholder="nama akun tanpa @" />
          <Field id="est_members" label="Perkiraan jumlah anggota" type="number" min={0} defaultValue={values.estMembers} />
          <Field id="basecamp_address" label="Basecamp" defaultValue={values.basecamp} />
        </>
      )}

      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>Logo baru (opsional, maks. 2 MB)</span>
        <ImageFileInput name="logo" accept="image/png,image/jpeg,image/webp" className="text-[12px] text-fg-label" maxMb={2} />
      </div>
      <div className="flex flex-col gap-1.5">
        <span className={labelClass}>
          {type === "merchant" ? "Foto tempat usaha" : "Foto kegiatan"} {values.hasProof ? "(ganti, opsional)" : "(belum ada, wajib untuk verifikasi)"}
        </span>
        <ImageFileInput name="proof" accept="image/png,image/jpeg,image/webp" className="text-[12px] text-fg-label" maxMb={3} />
      </div>

      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <SubmitButton pendingText="Menyimpan…" className="h-12 rounded-[14px] text-[14px]">
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
