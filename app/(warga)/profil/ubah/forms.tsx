"use client";

import { useActionState } from "react";
import { changeDistrict, updateProfile, type AccountState } from "@/lib/actions/account";
import { RegionPicker } from "@/components/region-picker";
import type { CityChoice } from "@/lib/data/regions";
import { cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

function Success({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="status" className="rounded-[14px] bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">
      {text}
    </p>
  );
}

export function ProfileForm({ nickname, fullName }: { nickname: string; fullName: string }) {
  const [state, action] = useActionState<AccountState, FormData>(updateProfile, {});
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <span className="text-[16px] font-semibold">Data diri</span>
      <label htmlFor="nickname" className={labelClass}>
        Nama panggilan
      </label>
      <input id="nickname" name="nickname" defaultValue={nickname} minLength={3} maxLength={20} required className={inputClass} />
      <span className="-mt-1 text-[13px] text-fg-soft">Tampil di leaderboard dan dilihat penyelenggara. 3–20 karakter, harus unik.</span>
      <label htmlFor="full_name" className={labelClass}>
        Nama lengkap
      </label>
      <input id="full_name" name="full_name" defaultValue={fullName} maxLength={100} required className={inputClass} />
      <span className="-mt-1 text-[13px] text-fg-soft">Tidak pernah ditampilkan ke warga lain atau penyelenggara.</span>
      <ErrorMessage message={state.error} />
      <Success text={state.success} />
      <SubmitButton pendingText="Menyimpan…">Simpan</SubmitButton>
    </form>
  );
}

export function RegionForm({
  cities,
  current,
  lockedUntil,
  days,
}: {
  cities: CityChoice[];
  current: { label: string; cityId: string; districtId: string } | null;
  lockedUntil: string | null;
  days: number;
}) {
  const [state, action] = useActionState<AccountState, FormData>(changeDistrict, {});
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <span className="text-[16px] font-semibold">Tempat tinggal</span>
      <span className="text-[15px] leading-[1.5] text-fg-soft">
        Menentukan peringkat kota dan kecamatanmu, serta aktivitas khusus warga yang bisa kamu ikuti. Hanya bisa diganti sekali setiap {days} hari.
      </span>
      {current ? (
        <p className="text-[15px] text-fg-label">
          Sekarang: <span className="font-semibold text-fg">{current.label}</span>
        </p>
      ) : (
        <p className="rounded-[14px] bg-warn-tint px-4 py-3 text-[15px] text-warn">Kamu belum mengisi kota dan kecamatan. Isi sekarang supaya masuk peringkat kotamu.</p>
      )}
      <Success text={state.success} />
      {lockedUntil ? (
        <p className="rounded-[14px] bg-warn-tint px-4 py-3 text-[15px] text-warn">Kamu baru bisa mengganti wilayah lagi mulai {lockedUntil}.</p>
      ) : (
        <>
          <RegionPicker cities={cities} name="district" initialCityId={current?.cityId} initialDistrictId={current?.districtId} />
          <ErrorMessage message={state.error} />
          <SubmitButton pendingText="Menyimpan…" variant="ghost">
            {current ? "Ganti wilayah" : "Simpan wilayah"}
          </SubmitButton>
        </>
      )}
    </form>
  );
}
