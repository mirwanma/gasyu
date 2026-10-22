"use client";

import { useActionState, useState } from "react";
import { completeOnboarding, type OnboardingState } from "./actions";
import { OUTSIDE_CIMAHI } from "./constants";
import { buttonStyles, cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

export type DistrictOption = {
  id: string;
  name: string;
  villages: { id: string; name: string }[];
};

type Step = 1 | 2 | 3;

const TITLES: Record<Step, { title: string; intro: string }> = {
  1: {
    title: "Kenalan dulu, yuk",
    intro: "Nama panggilan tampil di peringkat. Nama lengkap tidak ditampilkan ke publik.",
  },
  2: {
    title: "Kamu warga mana?",
    intro: "XP-mu ikut dihitung untuk kelurahan ini di peringkat bulanan. Bisa diganti sekali tiap 90 hari.",
  },
  3: {
    title: "Satu langkah lagi",
    intro: "Cek lagi profil kamu sebelum mulai.",
  },
};

const INITIAL: OnboardingState = {};

export function OnboardingForm({
  next,
  districts,
  profileXp,
}: {
  next: string;
  districts: DistrictOption[];
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
  const [village, setVillage] = useState("");
  const [query, setQuery] = useState("");
  const [localError, setLocalError] = useState<string>();

  const villageName =
    village === OUTSIDE_CIMAHI
      ? "Luar Cimahi"
      : districts.flatMap((d) => d.villages).find((v) => v.id === village)?.name;

  const advance = () => {
    if (step === 1) {
      const nick = nickname.trim();
      if (nick.length < 3 || nick.length > 20) return setLocalError("Nama panggilan harus 3–20 karakter.");
      if (!fullName.trim()) return setLocalError("Nama lengkap belum diisi.");
    }
    if (step === 2 && !village) return setLocalError("Pilih kelurahan asal kamu, atau Luar Cimahi.");
    goTo((step + 1) as Step);
  };

  const keyword = query.trim().toLowerCase();
  const filtered = districts
    .map((d) => ({ ...d, villages: d.villages.filter((v) => v.name.toLowerCase().includes(keyword)) }))
    .filter((d) => d.villages.length > 0);

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
      <input type="hidden" name="village" value={village} />

      <div className="flex flex-col gap-3.5">
        <div className="grid grid-cols-3 gap-1.5" aria-hidden="true">
          {[1, 2, 3].map((n) => (
            <span key={n} className={`h-[5px] rounded ${n <= step ? "bg-primary-soft" : "bg-line"}`} />
          ))}
        </div>
        <div className="flex items-center justify-between text-[16px] text-fg-soft">
          <span>Langkah {step} dari 3</span>
          {step > 1 && (
            <button type="button" onClick={() => goTo((step - 1) as Step)} className="min-h-11 font-semibold text-link">
              Kembali
            </button>
          )}
        </div>
        <h1 className="font-display text-[30px] font-bold">{TITLES[step].title}</h1>
        <p className="text-[17px] leading-[1.55] text-fg-soft">{TITLES[step].intro}</p>
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

      {/* Langkah 2: kelurahan */}
      <div hidden={step !== 2} className="flex flex-col gap-[22px]">
        <div className="flex h-[50px] items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 focus-within:border-primary-soft">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-fg-muted" aria-hidden="true">
            <path d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14zM20 20l-4-4" />
          </svg>
          <label htmlFor="cari" className="sr-only">
            Cari kelurahan
          </label>
          <input
            id="cari"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Cari kelurahan"
            className="flex-1 bg-transparent text-[18px] text-fg outline-none placeholder:text-fg-muted"
          />
        </div>

        <div className="flex flex-col gap-4">
          {filtered.map((district) => (
            <div key={district.id} className="flex flex-col gap-2">
              <span className="text-[14px] font-bold uppercase tracking-[0.06em] text-fg-muted">
                {district.name}
              </span>
              <div className="flex flex-wrap gap-2">
                {district.villages.map((v) => (
                  <Chip key={v.id} selected={village === v.id} onClick={() => setVillage(v.id)}>
                    {v.name}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-[16px] text-fg-soft">Kelurahan tidak ditemukan.</p>
          )}
          <Chip selected={village === OUTSIDE_CIMAHI} dashed onClick={() => setVillage(OUTSIDE_CIMAHI)}>
            Luar Cimahi
          </Chip>
        </div>
      </div>

      {/* Langkah 3: ringkasan dan persetujuan */}
      <div hidden={step !== 3} className="flex flex-col gap-5">
        <dl className={`${cardClass} flex flex-col gap-3 p-4 text-[17px]`}>
          <SummaryRow label="Nama panggilan" value={nickname.trim()} />
          <SummaryRow label="Nama lengkap" value={fullName.trim()} />
          <SummaryRow label="Kelurahan" value={villageName ?? "-"} />
        </dl>
        <label className="flex items-start gap-3 text-[17px] leading-[1.55] text-fg-label">
          <input name="terms" type="checkbox" className="mt-0.5 size-5 shrink-0 accent-primary" />
          <span>Saya setuju dengan syarat &amp; ketentuan dan kebijakan privasi Gasyu.</span>
        </label>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <ErrorMessage message={error} />
        {profileXp > 0 && (
          <div className={`flex items-center gap-2.5 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-[16px] text-fg-label`}>
            <span className="font-display text-[18px] font-bold text-xp">+{profileXp} XP</span>
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

function Chip({
  children,
  selected,
  dashed,
  onClick,
}: {
  children: React.ReactNode;
  selected: boolean;
  dashed?: boolean;
  onClick: () => void;
}) {
  const look = selected
    ? "border-primary bg-primary text-white"
    : dashed
      ? "border-dashed border-line-strong bg-transparent text-fg-label"
      : "border-line bg-surface text-fg-label";
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`h-11 self-start rounded-full border px-3.5 text-[17px] font-semibold ${look}`}
    >
      {children}
    </button>
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
