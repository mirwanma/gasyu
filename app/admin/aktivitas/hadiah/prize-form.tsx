"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { savePrize, type PrizeActionState } from "@/lib/actions/global-events";
import { FULFILLMENT_LABELS, PRIZE_KIND_LABELS, type PrizeFulfillment, type PrizeKind } from "@/lib/global-events";
import type { Prize } from "@/lib/data/global-events";
import { cardClass, chipClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { ImageFileInput } from "@/components/image-file-input";

const KINDS = Object.keys(PRIZE_KIND_LABELS) as PrizeKind[];
const FULFILLMENTS = Object.keys(FULFILLMENT_LABELS) as PrizeFulfillment[];

// Form tambah/ubah hadiah per peringkat Event Global (ALUR bagian 22d).
// Setelah event terbit, hadiah lama terkunci: hanya deskripsi dan gambar yang terkirim.
export function PrizeForm({
  activityId,
  initial,
  locked,
  nextRank,
  sponsors,
  badges,
  cancelHref,
}: {
  activityId: string;
  initial?: Prize;
  locked: boolean;
  nextRank: number;
  sponsors: { id: string; name: string }[];
  badges: { id: string; name: string }[];
  cancelHref: string;
}) {
  const [state, action] = useActionState<PrizeActionState, FormData>(savePrize, {});
  const [kind, setKind] = useState<PrizeKind>(initial?.kind ?? "physical");
  const [fulfillment, setFulfillment] = useState<PrizeFulfillment>(initial?.fulfillment ?? "shipping");
  const [badgeId, setBadgeId] = useState(initial?.badge_id ?? (badges[0]?.id ?? "baru"));
  const chip = (on: boolean) => `${chipClass.base} ${on ? chipClass.selected : chipClass.idle} disabled:opacity-60`;
  const effectiveFulfillment = kind === "badge" ? "digital" : fulfillment;

  return (
    <form action={action} className={`${cardClass} flex flex-col gap-4 p-5`}>
      <input type="hidden" name="activity_id" value={activityId} />
      {initial && <input type="hidden" name="prize_id" value={initial.id} />}
      <input type="hidden" name="locked" value={locked ? "1" : ""} />
      <input type="hidden" name="kind" value={kind} />
      <input type="hidden" name="fulfillment" value={effectiveFulfillment} />
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[19px] font-semibold">{initial ? "Ubah hadiah" : "Hadiah baru"}</h2>
        <Link href={cancelHref} className="text-[13px] font-semibold text-link">
          Batal
        </Link>
      </div>
      <ErrorMessage message={state.error} />
      {locked && <p className="rounded-xl bg-warn-tint px-3 py-2 text-[12px] text-warn">Event sudah terbit: peringkat, jenis, cara serah, penyedia, dan skor minimal terkunci. Deskripsi dan gambar masih bisa diubah.</p>}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <span className={labelClass}>Peringkat</span>
          <div className="flex items-center gap-2 text-[13px] text-fg-label">
            <input name="rank_from" type="number" min={1} max={100} required disabled={locked} defaultValue={initial?.rank_from ?? nextRank} inputMode="numeric" aria-label="Dari peringkat" className={`${inputClass} w-24`} />
            sampai
            <input name="rank_to" type="number" min={1} max={100} disabled={locked} defaultValue={initial?.rank_to ?? nextRank} inputMode="numeric" aria-label="Sampai peringkat" className={`${inputClass} w-24`} />
          </div>
          <span className="text-[12px] text-fg-soft">Satu pemenang per peringkat. Contoh: 1 sampai 1 untuk Juara 1, 4 sampai 20 untuk hadiah hiburan.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p_min" className={labelClass}>Skor minimal</label>
          <input id="p_min" name="min_score" type="number" min={1} disabled={locked} defaultValue={initial?.min_score ?? 100} inputMode="numeric" className={`${inputClass} w-36`} />
          <span className="text-[12px] text-fg-soft">Peserta di bawah skor ini tidak berhak, walaupun peringkatnya masuk.</span>
        </div>
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="p_title" className={labelClass}>Nama hadiah</label>
        <input id="p_title" name="title" required minLength={3} maxLength={100} disabled={locked} defaultValue={initial?.title} placeholder="contoh: Sepeda lipat + medali" className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor="p_desc" className={labelClass}>Deskripsi (opsional)</label>
        <textarea id="p_desc" name="description" rows={3} maxLength={1000} defaultValue={initial?.description ?? ""} placeholder="Detail hadiah, ukuran, atau syarat tambahan" className={textareaClass} />
      </div>

      <fieldset className="flex flex-col gap-2">
        <legend className={labelClass}>Jenis hadiah</legend>
        <div className="flex flex-wrap gap-2">
          {KINDS.map((k) => (
            <button key={k} type="button" disabled={locked} aria-pressed={kind === k} onClick={() => setKind(k)} className={chip(kind === k)}>
              {PRIZE_KIND_LABELS[k]}
            </button>
          ))}
        </div>
        {kind === "voucher" && <span className="text-[12px] text-fg-soft">Voucher atau tiket dari sponsor diserahkan di luar sistem voucher Gasyu.</span>}
      </fieldset>

      {kind === "badge" ? (
        <div className="flex flex-col gap-2">
          <label htmlFor="p_badge" className={labelClass}>Badge</label>
          <select id="p_badge" name="badge_id" disabled={locked} value={badgeId} onChange={(e) => setBadgeId(e.target.value)} className={inputClass}>
            {badges.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
            <option value="baru">+ Buat badge baru</option>
          </select>
          {badgeId === "baru" && !locked && (
            <div className="grid gap-3 md:grid-cols-2">
              <input name="badge_name" required minLength={3} maxLength={60} placeholder="Nama badge, contoh: Juara Foto HUT Cimahi" aria-label="Nama badge" className={inputClass} />
              <input name="badge_description" required minLength={3} maxLength={200} placeholder="Deskripsi singkat badge" aria-label="Deskripsi badge" className={inputClass} />
            </div>
          )}
          <span className="text-[12px] text-fg-soft">Badge langsung masuk ke profil pemenang saat event selesai, tanpa perlu diklaim.</span>
        </div>
      ) : (
        <fieldset className="flex flex-col gap-2">
          <legend className={labelClass}>Cara serah</legend>
          <div className="flex flex-wrap gap-2">
            {FULFILLMENTS.map((f) => (
              <button key={f} type="button" disabled={locked} aria-pressed={fulfillment === f} onClick={() => setFulfillment(f)} className={chip(fulfillment === f)}>
                {FULFILLMENT_LABELS[f]}
              </button>
            ))}
          </div>
          {fulfillment === "pickup" && (
            <textarea name="pickup_note" rows={2} required maxLength={500} disabled={locked} defaultValue={initial?.pickup_note ?? ""} placeholder="Lokasi dan cara ambil, contoh: Kantor Gasyu, Jl. ..., Senin–Jumat 09.00–16.00, tunjukkan halaman Hadiah" aria-label="Lokasi dan cara ambil" className={textareaClass} />
          )}
          {fulfillment === "shipping" && <span className="text-[12px] text-fg-soft">Pemenang mengisi nama, nomor HP, dan alamat saat klaim. Hanya admin yang bisa melihatnya.</span>}
        </fieldset>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p_sponsor" className={labelClass}>Penyedia hadiah</label>
          <select id="p_sponsor" name="sponsor_organizer_id" disabled={locked} defaultValue={initial?.sponsor_organizer_id ?? ""} className={inputClass}>
            <option value="">Gasyu</option>
            {sponsors.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <span className="text-[12px] text-fg-soft">Partner yang sudah bergabung di event ini. Tampil &quot;Hadiah dari …&quot;; pengiriman tetap oleh panitia Gasyu.</span>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor="p_image" className={labelClass}>Gambar (opsional, maks. 3 MB)</label>
          <ImageFileInput id="p_image" name="image" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-fg-label file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-fg" maxMb={3} />
        </div>
      </div>

      <SubmitButton pendingText="Menyimpan…" className="md:self-start md:px-8">
        {initial ? "Simpan perubahan" : "Simpan hadiah"}
      </SubmitButton>
    </form>
  );
}
