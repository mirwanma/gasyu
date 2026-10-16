"use client";

import { useActionState, useState } from "react";
import { createActivity, updateActivity, type ActivityActionState } from "@/lib/actions/activities";
import { DIFFICULTY_LABELS, GOAL_OPTIONS, JOIN_MODE_LABELS, TARGET_KIND_LABELS, toLocalInput, type ActivityGoal, type ActivityType, type Difficulty, type JoinMode, type TargetKind, type TargetScope } from "@/lib/activities";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

type District = { id: string; name: string; villages: { id: string; name: string }[] };
export type ActivityFormValues = {
  id?: string;
  type: ActivityType;
  difficulty: Difficulty | null;
  target_scope: TargetScope;
  target_kind: TargetKind | null;
  target_count: number | null;
  join_mode: JoinMode;
  group_min: number | null;
  group_max: number | null;
  goal: ActivityGoal;
  title: string;
  description: string;
  scope_region_id: string | null;
  starts_at: string;
  ends_at: string;
  quota: number | null;
  residency_rule: "open" | "residents_only";
  audience: "public" | "members_only";
};

const STEPS = ["Dasar", "Waktu & cakupan", "Aturan ikut"];

// Formulir buat/ubah aktivitas (event) tiga langkah, mengikuti artboard
// "Penyelenggara · Buat aktivitas". Langkah bayar dan misi menyusul di irisan 10–11.
export function ActivityForm({
  organizerId,
  type,
  cityId,
  districts,
  initial,
}: {
  organizerId: string;
  type: "merchant" | "community";
  cityId: string | null;
  districts: District[];
  initial?: ActivityFormValues;
}) {
  const [state, formAction] = useActionState<ActivityActionState, FormData>(initial ? updateActivity : createActivity, {});
  const [step, setStep] = useState(0);
  const [goal, setGoal] = useState<ActivityGoal>(initial?.goal ?? "awareness");
  const [scope, setScope] = useState(initial?.scope_region_id ?? "");
  const [residency, setResidency] = useState(initial?.residency_rule ?? "open");
  const [audience, setAudience] = useState(initial?.audience ?? "public");
  const [kind, setKind] = useState<ActivityType>(initial?.type ?? "event");
  const [difficulty, setDifficulty] = useState<Difficulty>(initial?.difficulty ?? "easy");
  const [targetKind, setTargetKind] = useState<TargetKind>(initial?.target_kind ?? "total_checkins");
  const [targetScope, setTargetScope] = useState<TargetScope>(initial?.target_scope ?? "individual");
  const [joinMode, setJoinMode] = useState<JoinMode>(initial?.join_mode ?? "individual");
  const last = step === STEPS.length - 1;
  const chip = (on: boolean) => `${chipClass.base} ${on ? chipClass.selected : chipClass.idle}`;

  return (
    <form action={formAction} className="flex flex-col gap-4">
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="type_org" value={type} />
      {initial?.id && <input type="hidden" name="activity_id" value={initial.id} />}
      <input type="hidden" name="goal" value={goal} />
      <input type="hidden" name="residency_rule" value={residency} />
      <input type="hidden" name="audience" value={audience} />
      <input type="hidden" name="type" value={kind} />
      <input type="hidden" name="difficulty" value={difficulty} />
      <input type="hidden" name="target_kind" value={targetKind} />
      <input type="hidden" name="target_scope" value={targetScope} />
      <input type="hidden" name="join_mode" value={joinMode} />

      <div className="flex flex-col gap-2">
        <span className="text-[12px] font-semibold text-fg-soft">
          Langkah {step + 1} dari {STEPS.length} · {STEPS[step]}
        </span>
        <div className="flex gap-1.5">
          {STEPS.map((s, i) => (
            <span key={s} className={`h-1.5 flex-1 rounded-full ${i <= step ? "bg-primary" : "bg-track"}`} />
          ))}
        </div>
      </div>

      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />

      {/* Langkah 1: dasar. Semua langkah tetap ter-render supaya nilainya ikut terkirim. */}
      <section className={`${cardClass} flex flex-col gap-3 p-4 ${step === 0 ? "" : "hidden"}`}>
        <div className="flex flex-col gap-2">
          <span className={labelClass}>Jenis aktivitas</span>
          <div className="grid grid-cols-2 gap-2">
            {([["event", "Event", "Satu waktu, satu check-in"], ["challenge", "Challenge", "Rentang tanggal, ada target"]] as const).map(([value, label, hint]) => {
              const on = kind === value;
              return (
                <button key={value} type="button" aria-pressed={on} onClick={() => { setKind(value); if (value === "event") { setTargetScope("individual"); } }} className={`flex flex-col gap-0.5 rounded-2xl border p-3 text-left ${on ? "border-primary bg-primary-tint" : "border-line bg-surface"}`}>
                  <span className={`text-[14px] font-bold ${on ? "text-link" : "text-fg"}`}>{label}</span>
                  <span className="text-[11px] leading-[1.4] text-fg-soft">{hint}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="title" className={labelClass}>Judul aktivitas</label>
          <input id="title" name="title" required minLength={3} maxLength={100} defaultValue={initial?.title} placeholder="contoh: Workshop Latte Art" className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="description" className={labelClass}>Deskripsi</label>
          <textarea id="description" name="description" rows={4} maxLength={2000} defaultValue={initial?.description} placeholder="Apa yang warga dapat, siapa yang cocok ikut, apa yang perlu dibawa." className={textareaClass} />
        </div>
        <div className="flex flex-col gap-2">
          <span className={labelClass}>Tujuan utama</span>
          <div className="grid grid-cols-2 gap-2">
            {GOAL_OPTIONS.map(([value, label, hint]) => {
              const on = goal === value;
              return (
                <button key={value} type="button" aria-pressed={on} onClick={() => setGoal(value)} className={`flex flex-col gap-0.5 rounded-2xl border p-3 text-left ${on ? "border-primary bg-primary-tint" : "border-line bg-surface"}`}>
                  <span className={`text-[14px] font-bold ${on ? "text-link" : "text-fg"}`}>{label}</span>
                  <span className="text-[11px] leading-[1.4] text-fg-soft">{hint}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="cover" className={labelClass}>Gambar cover (opsional, maks. 3 MB)</label>
          <input id="cover" name="cover" type="file" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-fg-label file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-fg" />
        </div>
      </section>

      {/* Langkah 2: waktu dan cakupan */}
      <section className={`${cardClass} flex flex-col gap-3 p-4 ${step === 1 ? "" : "hidden"}`}>
        <div className="grid grid-cols-1 gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="starts_at" className={labelClass}>Mulai (WIB)</label>
            <input id="starts_at" name="starts_at" type="datetime-local" required defaultValue={toLocalInput(initial?.starts_at)} className={inputClass} />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="ends_at" className={labelClass}>Selesai (WIB)</label>
            <input id="ends_at" name="ends_at" type="datetime-local" required defaultValue={toLocalInput(initial?.ends_at)} className={inputClass} />
          </div>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="scope_region_id" className={labelClass}>Wilayah cakupan</label>
          <select id="scope_region_id" name="scope_region_id" value={scope} onChange={(e) => setScope(e.target.value)} className={inputClass}>
            <option value="">Tanpa cakupan khusus</option>
            {cityId && <option value={cityId}>Seluruh kota</option>}
            {districts.map((d) => (
              <optgroup key={d.id} label={`Kec. ${d.name}`}>
                <option value={d.id}>Seluruh Kec. {d.name}</option>
                {d.villages.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </optgroup>
            ))}
          </select>
          <span className="text-[12px] text-fg-soft">Dipakai untuk aturan khusus warga dan rekomendasi di Jelajah.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="quota" className={labelClass}>Kuota peserta (kosongkan jika tanpa batas)</label>
          <input id="quota" name="quota" type="number" min={1} max={100000} inputMode="numeric" defaultValue={initial?.quota ?? ""} className={inputClass} />
        </div>
      </section>

      {/* Langkah 3: aturan ikut */}
      <section className={`${cardClass} flex flex-col gap-4 p-4 ${step === 2 ? "" : "hidden"}`}>
        {kind === "challenge" && (
          <>
            <div className="flex flex-col gap-2">
              <span className={labelClass}>Tingkat kesulitan (menentukan XP)</span>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(DIFFICULTY_LABELS) as Difficulty[]).map((value) => (
                  <button key={value} type="button" aria-pressed={difficulty === value} onClick={() => setDifficulty(value)} className={chip(difficulty === value)}>
                    {DIFFICULTY_LABELS[value]}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className={labelClass}>Target</span>
              <div className="flex flex-wrap gap-2">
                {(["total_checkins", "distinct_checkpoints"] as TargetKind[]).map((value) => (
                  <button key={value} type="button" aria-pressed={targetKind === value} onClick={() => setTargetKind(value)} className={chip(targetKind === value)}>
                    {TARGET_KIND_LABELS[value]}
                  </button>
                ))}
              </div>
              <div className="flex items-center gap-2">
                <input name="target_count" type="number" min={1} max={100} inputMode="numeric" defaultValue={initial?.target_count ?? 3} aria-label="Jumlah target" className={`${inputClass} w-24`} />
                <span className="text-[12px] text-fg-soft">{targetKind === "total_checkins" ? "kali check-in (maks. 1 per hari)" : "checkpoint berbeda"}</span>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <span className={labelClass}>Cakupan target</span>
              <div className="flex flex-wrap gap-2">
                {([["individual", "Per orang"], ["group", "Kolektif grup"]] as const).map(([value, label]) => (
                  <button key={value} type="button" aria-pressed={targetScope === value} onClick={() => { setTargetScope(value); if (value === "group") setJoinMode("group"); }} className={chip(targetScope === value)}>
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
        <div className="flex flex-col gap-2">
          <span className={labelClass}>Cara mendaftar</span>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(JOIN_MODE_LABELS) as JoinMode[]).map((value) => {
              const disabled = targetScope === "group" && value !== "group";
              return (
                <button key={value} type="button" disabled={disabled} aria-pressed={joinMode === value} onClick={() => setJoinMode(value)} className={`${chip(joinMode === value)} disabled:opacity-40`}>
                  {JOIN_MODE_LABELS[value]}
                </button>
              );
            })}
          </div>
          {joinMode !== "individual" && (
            <div className="flex items-center gap-2 text-[13px] text-fg-label">
              Grup
              <input name="group_min" type="number" min={2} max={10} inputMode="numeric" defaultValue={initial?.group_min ?? 2} aria-label="Anggota minimal" className={`${inputClass} w-20`} />
              sampai
              <input name="group_max" type="number" min={2} max={10} inputMode="numeric" defaultValue={initial?.group_max ?? 10} aria-label="Anggota maksimal" className={`${inputClass} w-20`} />
              orang
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <span className={labelClass}>Siapa yang boleh ikut</span>
          <div className="flex flex-wrap gap-2">
            {([["open", "Semua warga"], ["residents_only", "Khusus warga cakupan"]] as const).map(([value, label]) => (
              <button key={value} type="button" aria-pressed={residency === value} onClick={() => setResidency(value)} className={`${chipClass.base} ${residency === value ? chipClass.selected : chipClass.idle}`}>
                {label}
              </button>
            ))}
          </div>
          {residency === "residents_only" && !scope && <span className="text-[12px] text-warn">Pilih wilayah cakupan di langkah sebelumnya.</span>}
        </div>
        {type === "community" && (
          <div className="flex flex-col gap-2">
            <span className={labelClass}>Audiens</span>
            <div className="flex flex-wrap gap-2">
              {([["public", "Publik"], ["members_only", "Khusus member"]] as const).map(([value, label]) => (
                <button key={value} type="button" aria-pressed={audience === value} onClick={() => setAudience(value)} className={`${chipClass.base} ${audience === value ? chipClass.selected : chipClass.idle}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
        )}
        <p className="rounded-2xl bg-info-tint px-4 py-3 text-[12px] leading-[1.5] text-info">
          XP dasar mengikuti pengaturan Ramein (event 100 XP; challenge sesuai kesulitan). Poin, harga, dan misi bisa diatur setelah fitur reward dan misi dirilis.
          Setelah tersimpan sebagai draft, tambahkan checkpoint lalu ajukan ke tim Ramein.
        </p>
      </section>

      <div className="flex gap-2.5">
        {step > 0 && (
          <button type="button" onClick={() => setStep(step - 1)} className="flex h-[54px] flex-1 items-center justify-center rounded-2xl border border-line-strong bg-surface text-[15px] font-semibold text-fg">
            Kembali
          </button>
        )}
        {last ? (
          <SubmitButton pendingText="Menyimpan…" className="flex-1">
            {initial ? "Simpan perubahan" : "Simpan draft"}
          </SubmitButton>
        ) : (
          <button type="button" onClick={() => setStep(step + 1)} className="flex h-[54px] flex-1 items-center justify-center rounded-2xl bg-primary text-[15px] font-semibold text-on-primary">
            Lanjut
          </button>
        )}
      </div>
    </form>
  );
}

// Formulir ringkas setelah terbit: hanya deskripsi dan cover.
export function ActivityLiteForm({ organizerId, type, activityId, description }: { organizerId: string; type: "merchant" | "community"; activityId: string; description: string }) {
  const [state, formAction] = useActionState<ActivityActionState, FormData>(updateActivity, {});
  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="type_org" value={type} />
      <input type="hidden" name="activity_id" value={activityId} />
      <h2 className="text-[15px] font-bold">Ubah deskripsi dan cover</h2>
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <textarea name="description" rows={4} maxLength={2000} defaultValue={description} className={textareaClass} aria-label="Deskripsi" />
      <input name="cover" type="file" accept="image/png,image/jpeg,image/webp" aria-label="Cover" className="text-[13px] text-fg-label file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-fg" />
      <SubmitButton size="small" variant="dark" pendingText="Menyimpan…" className="self-end">
        Simpan
      </SubmitButton>
    </form>
  );
}
