"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { buttonStyles, cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { RegionPicker, type RegionValue } from "@/components/region-picker";
import type { CityChoice } from "@/lib/data/regions";

type Step = 1 | 2 | 3;

const TITLES: Record<Step, { title: string; intro: string }> = {
  1: {
    title: "Kenalan dulu, yuk",
    intro: "Nama panggilan tampil di peringkat. Nama lengkap tidak ditampilkan ke publik.",
  },
  2: {
    title: "Kamu tinggal di mana?",
    intro: "Pilih provinsi, kota, dan kecamatanmu. Jejakmu ikut dihitung untuk kecamatan ini di peringkat bulanan. Bisa diganti sekali tiap 90 hari.",
  },
  3: {
    title: "Satu langkah lagi",
    intro: "Cek lagi profil kamu sebelum mulai.",
  },
};

const INITIAL: OnboardingState = {};

export function OnboardingForm({
  next,
  cities,
  profileXp,
}: {
  next: string;
  cities: CityChoice[];
  profileXp: number;
}) {
  const [state, formAction] = useActionState<OnboardingState, FormData>(completeOnboarding, INITIAL);
  // Langkah pilihan warga berlaku sampai server mengembalikan hasil baru;
  // jika server menolak, buka langkah yang perlu diperbaiki.
  const [nav, setNav] = useState<{ base: OnboardingState; step: Step }>({ base: INITIAL, step: 1 });
  const step: Step = nav.base === state ? nav.step : (state.step ?? nav.step);
  const goTo = (target: Step) => {
    setLocalError(undefined);
    setNav({ base: state, step: target });
  };

  const [nickname, setNickname] = useState("");
  const [fullName, setFullName] = useState("");
  const [region, setRegion] = useState<RegionValue | null>(null);
  const [localError, setLocalError] = useState<string>();

  const advance = () => {
    if (step === 1) {
      const nick = nickname.trim();
      if (nick.length < 3 || nick.length > 20) return setLocalError("Nama panggilan harus 3–20 karakter.");
      if (!fullName.trim()) return setLocalError("Nama lengkap belum diisi.");
    }
    if (step === 2 && !region) return setLocalError("Pilih kota dan kecamatan tempat tinggalmu.");
    goTo((step + 1) as Step);
  };

  const error = localError ?? (nav.base === state ? undefined : state.error);

  return (
    <form
      action={formAction}
      onKeyDown={(event) => {
        // Enter di langkah 1–2 berarti "Lanjut", bukan kirim formulir.
        if (event.key === "Enter" && step < 3 && event.target instanceof HTMLInputElement) {
          event.preventDefault();
          advance();
        }
      }}
      className="flex flex-1 flex-col gap-[22px]"
    >
      <input type="hidden" name="next" value={next} />

      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-[5px] rounded ${n <= step ? "bg-primary-soft" : "bg-line"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between text-[15px] text-fg-soft">
          <span>Langkah {step} dari 3</span>
          {step > 1 && (
            <button type="button" onClick={() => goTo((step - 1) as Step)} className="min-h-11 font-semibold text-link">
              Kembali
            </button>
          )}
        </div>
        <h1 className="font-display text-[28px] font-bold">{TITLES[step].title}</h1>
        <p className="text-[15px] leading-[1.55] text-fg-soft">{TITLES[step].intro}</p>
      </div>

      {/* Langkah 1: nama. Semua langkah tetap ada di halaman supaya isiannya ikut terkirim. */}
      <div hidden={step !== 1} className="flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <label htmlFor="nickname" className={labelClass}>
            Nama panggilan
          </label>
          <input
            id="nickname"
            name="nickname"
            value={nickname}
            onChange={(event) => setNickname(event.target.value)}
            maxLength={20}
            autoComplete="nickname"
            placeholder="contoh: budi_cimahi"
            className={inputClass}
          />
        </div>
        <div className="flex flex-col gap-2.5">
          <label htmlFor="full_name" className={labelClass}>
            Nama lengkap
          </label>
          <input
            id="full_name"
            name="full_name"
            value={fullName}
            onChange={(event) => setFullName(event.target.value)}
            maxLength={100}
            autoComplete="name"
            className={inputClass}
          />
        </div>
      </div>

      {/* Langkah 2: kota dan kecamatan */}
      <div hidden={step !== 2} className="flex flex-col gap-[22px]">
        <RegionPicker cities={cities} name="district" onChange={setRegion} />
      </div>

      {/* Langkah 3: ringkasan dan persetujuan */}
      <div hidden={step !== 3} className="flex flex-col gap-5">
        <dl className={`${cardClass} flex flex-col gap-3 p-4 text-[15px]`}>
          <SummaryRow label="Nama panggilan" value={nickname.trim()} />
          <SummaryRow label="Nama lengkap" value={fullName.trim()} />
          <SummaryRow label="Wilayah" value={region ? `${region.districtName}, ${region.cityName}` : "-"} />
        </dl>
        <label className="flex items-start gap-3 text-[15px] leading-[1.55] text-fg-label">
          <input name="terms" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>Saya setuju dengan syarat &amp; ketentuan dan kebijakan privasi Gasyu.</span>
        </label>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <ErrorMessage message={error} />
        {profileXp > 0 && (
          <div className={`flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-[15px] text-fg-label`}>
            <span className="font-display text-[16px] font-bold text-xp">+{profileXp} Jejak</span>
            setelah profil lengkap
          </div>
        )}
        {step < 3 ? (
          <button type="button" onClick={advance} className={buttonStyles.primary}>
            Lanjut
          </button>
        ) : (
          <SubmitButton pendingText="Menyimpan…">Simpan dan mulai</SubmitButton>
        )}
      </div>
    </form>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4">
      <dt className="text-fg-soft">{label}</dt>
      <dd className="text-right font-semibold">{value}</dd>
    </div>
  );
}
