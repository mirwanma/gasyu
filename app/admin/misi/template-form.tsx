"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { saveMissionTemplate, type TemplateState } from "@/lib/actions/mission-templates";
import { MISSION_CATEGORIES, type MissionTemplate } from "@/lib/mission-templates";
import { VERIFICATION_LABELS, type MissionVerification } from "@/lib/missions";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

const VERIFICATIONS = Object.keys(VERIFICATION_LABELS) as MissionVerification[];

// Form tambah/ubah template master misi (admin, desktop-first).
export function TemplateForm({ initial, xpMin, xpMax }: { initial?: MissionTemplate; xpMin: number; xpMax: number }) {
  const [state, action] = useActionState<TemplateState, FormData>(saveMissionTemplate, {});
  const [verification, setVerification] = useState<MissionVerification>(initial?.verification ?? "manual");
  const [required, setRequired] = useState(initial?.is_required ?? true);

  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-5`}>
      {initial && <input type="hidden" name="template_id" value={initial.id} />}
      <input type="hidden" name="verification" value={verification} />
      <input type="hidden" name="is_required" value={required ? "on" : ""} />
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-semibold">{initial ? "Ubah template" : "Template baru"}</h2>
        <Link href="/admin/misi" className="text-[13px] font-semibold text-link">
          Batal
        </Link>
      </div>
      <ErrorMessage message={state.error} />

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t_title" className={labelClass}>Judul misi</label>
          <input id="t_title" name="title" required minLength={3} maxLength={80} defaultValue={initial?.title} placeholder="contoh: Mampir ke booth atau outlet" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t_cat" className={labelClass}>Kategori</label>
          <select id="t_cat" name="category" defaultValue={initial?.category ?? "visit"} className={inputClass}>
            {MISSION_CATEGORIES.map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="t_desc" className={labelClass}>Instruksi untuk warga</label>
        <textarea id="t_desc" name="description" rows={2} maxLength={500} defaultValue={initial?.description ?? ""} placeholder="Apa yang harus dilakukan warga supaya misi dianggap selesai" className={textareaClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="t_tips" className={labelClass}>Tips untuk penyelenggara</label>
        <textarea id="t_tips" name="organizer_tips" rows={2} maxLength={300} defaultValue={initial?.organizer_tips ?? ""} placeholder="Ditampilkan saat penyelenggara memilih template ini" className={textareaClass} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Cara verifikasi</legend>
        <div className="flex flex-wrap gap-2">
          {VERIFICATIONS.map((v) => (
            <button key={v} type="button" aria-pressed={verification === v} onClick={() => setVerification(v)} className={`${chipClass.base} ${verification === v ? chipClass.selected : chipClass.idle}`}>
              {VERIFICATION_LABELS[v]}
            </button>
          ))}
        </div>
        {verification === "secret_code" && <span className="text-[12px] text-fg-soft">Kode rahasianya diisi penyelenggara sendiri saat memakai template.</span>}
        {verification === "qr_scan" && <span className="text-[12px] text-fg-soft">Penyelenggara memilih checkpoint saat memakai template.</span>}
      </fieldset>

      <div className="grid gap-4 md:grid-cols-4">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t_xp" className={labelClass}>Saran XP ({xpMin}–{xpMax})</label>
          <input id="t_xp" name="xp_reward" type="number" required min={xpMin} max={xpMax} defaultValue={initial?.xp_reward ?? 30} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Sifat</span>
          <div className="flex gap-2">
            {([[true, "Wajib"], [false, "Bonus"]] as const).map(([value, label]) => (
              <button key={label} type="button" aria-pressed={required === value} onClick={() => setRequired(value)} className={`${chipClass.base} ${required === value ? chipClass.selected : chipClass.idle}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t_act" className={labelClass}>Untuk aktivitas</label>
          <select id="t_act" name="activity_type" defaultValue={initial?.activity_type ?? ""} className={inputClass}>
            <option value="">Event & challenge</option>
            <option value="event">Event saja</option>
            <option value="challenge">Challenge saja</option>
          </select>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="t_org" className={labelClass}>Untuk penyelenggara</label>
          <select id="t_org" name="organizer_type" defaultValue={initial?.organizer_type ?? ""} className={inputClass}>
            <option value="">Semua</option>
            <option value="merchant">Merchant saja</option>
            <option value="community">Komunitas saja</option>
          </select>
        </div>
      </div>
      <div className="flex flex-col gap-1.5 md:max-w-[200px]">
        <label htmlFor="t_sort" className={labelClass}>Urutan tampil</label>
        <input id="t_sort" name="sort_order" type="number" min={0} max={999} defaultValue={initial?.sort_order ?? 0} className={inputClass} />
      </div>

      <div className="md:max-w-[260px]">
        <SubmitButton pendingText="Menyimpan…">{initial ? "Simpan perubahan" : "Tambah template"}</SubmitButton>
      </div>
    </form>
  );
}
