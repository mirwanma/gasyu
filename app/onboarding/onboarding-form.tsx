"use client";

import { useActionState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { OUTSIDE_CIMAHI } from "./constants";
import { ErrorMessage, SubmitButton, inputClass, labelClass } from "@/components/ui";

export type DistrictOption = {
  id: string;
  name: string;
  villages: { id: string; name: string }[];
};

export function OnboardingForm({
  next,
  districts,
}: {
  next: string;
  districts: DistrictOption[];
}) {
  const [state, formAction] = useActionState<OnboardingState, FormData>(completeOnboarding, {});

  return (
    <form action={formAction} className="flex flex-col gap-5">
      <input type="hidden" name="next" value={next} />

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Nama panggilan (tampil di peringkat)</span>
        <input
          name="nickname"
          required
          minLength={3}
          maxLength={20}
          autoComplete="nickname"
          placeholder="contoh: andi_cimahi"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Nama lengkap (tidak ditampilkan ke publik)</span>
        <input
          name="full_name"
          required
          maxLength={100}
          autoComplete="name"
          className={inputClass}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={labelClass}>Kelurahan asal</span>
        <select name="village" required defaultValue="" className={inputClass}>
          <option value="" disabled>
            Pilih kelurahan
          </option>
          {districts.map((district) => (
            <optgroup key={district.id} label={`Kec. ${district.name}`}>
              {district.villages.map((village) => (
                <option key={village.id} value={village.id}>
                  {village.name}
                </option>
              ))}
            </optgroup>
          ))}
          <option value={OUTSIDE_CIMAHI}>Luar Cimahi</option>
        </select>
        <span className="text-[13px] leading-[18px] text-ink-soft">
          Kelurahan ini yang kamu bela di peringkat. Bisa diganti sekali tiap 90 hari.
        </span>
      </label>

      <label className="flex items-start gap-3 text-[15px] leading-[22px]">
        <input name="terms" type="checkbox" required className="mt-1 size-5 accent-ink" />
        <span>Saya setuju dengan syarat &amp; ketentuan dan kebijakan privasi Ramein.</span>
      </label>

      <ErrorMessage message={state.error} />
      <SubmitButton pendingText="Menyimpan…">Simpan dan mulai</SubmitButton>
    </form>
  );
}
