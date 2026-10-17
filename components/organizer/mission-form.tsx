"use client";

import { useActionState, useState } from "react";
import { saveMission, type MissionActionState } from "@/lib/actions/missions";
import { REVEAL_OPTIONS, VERIFICATION_LABELS, type MissionReveal, type MissionVerification } from "@/lib/missions";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

export type MissionFormValues = {
  id?: string;
  title: string;
  description: string;
  verification: MissionVerification;
  checkpoint_id: string | null;
  xp_reward: number;
  is_required: boolean;
  reveal_mode: MissionReveal;
  reveal_at: string; // nilai datetime-local (WIB)
  prerequisite_mission_id: string | null;
  show_teaser: boolean;
  available_from: string;
  available_until: string;
  locked: boolean;
  revealed: boolean;
};

const VERIFICATION_HELP: Record<MissionVerification, string> = {
  qr_scan: "Warga memindai QR misi (berganti tiap 60 detik) di dalam radius checkpoint. XP langsung masuk.",
  secret_code: "Warga mengetik kode yang diumumkan atau disembunyikan di lokasi. Maks. 5 percobaan per 15 menit.",
  photo: "Warga mengunggah foto; tim meninjau lalu menyetujui atau menolak. XP masuk saat disetujui.",
  manual: "Tim menandai peserta yang berhasil (misalnya finis lomba). XP masuk saat ditandai.",
};

// Form tambah/ubah misi, mengikuti alur ALUR-SISTEM 9b dan 9e.
export function MissionForm({
  organizerId,
  type,
  activityId,
  checkpoints,
  otherMissions,
  partnerOnly,
  partnerOrganizerId,
  initial,
  onCancelHref,
  templateId,
}: {
  organizerId: string;
  type: "merchant" | "community" | "admin";
  activityId: string;
  checkpoints: { id: string; name: string; partner_organizer_id: string }[];
  otherMissions: { id: string; title: string; is_required: boolean }[];
  partnerOnly: boolean;
  partnerOrganizerId?: string;
  initial?: MissionFormValues;
  onCancelHref: string;
  templateId?: string;
}) {
  const [state, formAction] = useActionState<MissionActionState, FormData>(saveMission, {});
  const [verification, setVerification] = useState<MissionVerification>(initial?.verification ?? (partnerOnly ? "qr_scan" : "manual"));
  const [reveal, setReveal] = useState<MissionReveal>(initial?.reveal_mode ?? "on_publish");
  const [required, setRequired] = useState(initial?.is_required ?? true);
  const locked = initial?.locked ?? false;
  const ownCheckpoints = partnerOrganizerId ? checkpoints.filter((c) => c.partner_organizer_id === partnerOrganizerId) : checkpoints;
  const verifications = (partnerOnly ? ["qr_scan"] : ["manual", "qr_scan", "secret_code", "photo"]) as MissionVerification[];
  const prereqOptions = otherMissions.filter((m) => m.id !== initial?.id && (!required || m.is_required));

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3.5 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="type_org" value={type} />
      <input type="hidden" name="activity_id" value={activityId} />
      {initial?.id && <input type="hidden" name="mission_id" value={initial.id} />}
      {templateId && !initial?.id && <input type="hidden" name="template_id" value={templateId} />}
      {partnerOrganizerId && <input type="hidden" name="partner_organizer_id" value={partnerOrganizerId} />}
      <div className="flex items-baseline justify-between">
        <h2 className="text-[15px] font-bold">{initial?.id ? "Ubah misi" : "Tambah misi"}</h2>
        <a href={onCancelHref} className="text-[13px] font-semibold text-link">
          Batal
        </a>
      </div>
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      {locked && <p className="rounded-xl bg-warn-tint px-3 py-2 text-[12px] text-warn">Sudah ada yang menyelesaikan misi ini: XP, cara verifikasi, dan status wajib terkunci. Teks masih bisa diubah.</p>}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="m_title" className={labelClass}>Judul misi</label>
        <input id="m_title" name="title" required minLength={3} maxLength={80} defaultValue={initial?.title} placeholder="contoh: Mampir booth Kopi Lereng" className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="m_desc" className={labelClass}>Instruksi untuk warga</label>
        <textarea id="m_desc" name="description" rows={3} maxLength={500} defaultValue={initial?.description} placeholder={verification === "photo" ? "Kriteria foto yang diterima, misalnya: foto bersama minimal 3 orang di garis finish" : verification === "manual" ? "Kriteria berhasil, misalnya: menyelesaikan rute 5K" : "Petunjuk singkat"} className={textareaClass} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Wajib atau bonus?</legend>
        <div className="flex gap-2">
          {([[true, "Wajib"], [false, "Bonus"]] as const).map(([value, label]) => (
            <button key={label} type="button" disabled={locked} aria-pressed={required === value} onClick={() => setRequired(value)} className={`${chipClass.base} ${required === value ? chipClass.selected : chipClass.idle} disabled:opacity-60`}>
              {label}
            </button>
          ))}
        </div>
        <input type="hidden" name="is_required" value={required ? "on" : ""} />
        <span className="text-[12px] text-fg-soft">Misi wajib ikut menentukan status selesai; misi bonus hanya menambah XP.</span>
      </fieldset>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="m_xp" className={labelClass}>XP misi (10–100)</label>
        <input id="m_xp" name="xp_reward" type="number" min={10} max={100} required readOnly={locked} defaultValue={initial?.xp_reward ?? 30} inputMode="numeric" className={inputClass} />
        <span className="text-[12px] text-fg-soft">Total XP semua misi aktif maksimal 500 per aktivitas.</span>
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Cara verifikasi</legend>
        <div className="flex flex-wrap gap-2">
          {verifications.map((v) => (
            <button key={v} type="button" disabled={locked} aria-pressed={verification === v} onClick={() => setVerification(v)} className={`${chipClass.base} ${verification === v ? chipClass.selected : chipClass.idle} disabled:opacity-60`}>
              {VERIFICATION_LABELS[v]}
            </button>
          ))}
        </div>
        <input type="hidden" name="verification" value={verification} />
        <span className="text-[12px] leading-[1.5] text-fg-soft">{VERIFICATION_HELP[verification]}</span>
      </fieldset>

      {verification === "qr_scan" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="m_cp" className={labelClass}>Checkpoint QR misi</label>
          {ownCheckpoints.length === 0 ? (
            <span className="text-[12px] text-warn">Belum ada checkpoint milikmu di aktivitas ini. Tambahkan dulu di halaman kelola aktivitas.</span>
          ) : (
            <select id="m_cp" name="checkpoint_id" required disabled={locked} defaultValue={initial?.checkpoint_id ?? ownCheckpoints[0]?.id} className={inputClass}>
              {ownCheckpoints.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          )}
          {locked && initial?.checkpoint_id && <input type="hidden" name="checkpoint_id" value={initial.checkpoint_id} />}
        </div>
      )}
      {verification === "secret_code" && (
        <div className="flex flex-col gap-1.5">
          <label htmlFor="m_code" className={labelClass}>Kode rahasia {initial?.id ? "(kosongkan jika tidak diubah)" : ""}</label>
          <input id="m_code" name="code" minLength={3} maxLength={40} required={!initial?.id} autoComplete="off" placeholder="contoh: MALAM19" className={inputClass} />
          <span className="text-[12px] text-fg-soft">Disimpan terenkripsi, tidak peka huruf besar/kecil.</span>
        </div>
      )}

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Kapan tampil ke warga?</legend>
        {initial?.revealed ? (
          <span className="text-[12px] text-success">Misi ini sudah terbuka dan tidak bisa disembunyikan lagi.</span>
        ) : (
          REVEAL_OPTIONS.map(([value, label, help]) => (
            <label key={value} className={`flex cursor-pointer items-start gap-2.5 rounded-xl border px-3 py-2.5 ${reveal === value ? "border-primary bg-primary-tint" : "border-line"}`}>
              <input type="radio" name="reveal_mode" value={value} checked={reveal === value} onChange={() => setReveal(value)} className="mt-1" />
              <span className="flex flex-col">
                <span className="text-[13px] font-semibold">{label}</span>
                <span className="text-[11px] text-fg-soft">{help}</span>
              </span>
            </label>
          ))
        )}
        {!initial?.revealed && reveal === "scheduled" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m_reveal_at" className={labelClass}>Jam buka (WIB)</label>
            <input id="m_reveal_at" name="reveal_at" type="datetime-local" required defaultValue={initial?.reveal_at} className={inputClass} />
          </div>
        )}
        {!initial?.revealed && reveal === "after_mission" && (
          <div className="flex flex-col gap-1.5">
            <label htmlFor="m_prereq" className={labelClass}>Misi prasyarat</label>
            {prereqOptions.length === 0 ? (
              <span className="text-[12px] text-warn">{required ? "Belum ada misi wajib lain yang bisa jadi prasyarat." : "Belum ada misi lain di aktivitas ini."}</span>
            ) : (
              <select id="m_prereq" name="prerequisite_mission_id" required defaultValue={initial?.prerequisite_mission_id ?? prereqOptions[0]?.id} className={inputClass}>
                {prereqOptions.map((m) => (
                  <option key={m.id} value={m.id}>{m.title}{m.is_required ? " (wajib)" : ""}</option>
                ))}
              </select>
            )}
          </div>
        )}
        {!initial?.revealed && reveal !== "on_publish" && (
          <label className="flex items-center gap-2 text-[13px]">
            <input type="checkbox" name="show_teaser" defaultChecked={initial?.show_teaser ?? true} />
            Tampilkan sebagai teaser (kartu terkunci tanpa judul) sebelum terbuka
          </label>
        )}
      </fieldset>

      <details className="flex flex-col gap-2">
        <summary className="cursor-pointer text-[13px] font-semibold text-fg-label">Jendela waktu misi (opsional)</summary>
        <div className="mt-2 grid grid-cols-2 gap-2">
          <input name="available_from" type="datetime-local" defaultValue={initial?.available_from} aria-label="Mulai" className={inputClass} />
          <input name="available_until" type="datetime-local" defaultValue={initial?.available_until} aria-label="Selesai" className={inputClass} />
        </div>
        <span className="text-[12px] text-fg-soft">Misi hanya bisa dikerjakan di dalam jendela ini (di dalam waktu aktivitas).</span>
      </details>

      <SubmitButton pendingText="Menyimpan…">{initial?.id ? "Simpan perubahan" : "Simpan misi"}</SubmitButton>
    </form>
  );
}
