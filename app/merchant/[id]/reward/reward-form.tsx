"use client";

import { useActionState } from "react";
import { saveReward, type RewardActionState } from "@/lib/actions/rewards";
import { cardClass, inputClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton, SuccessMessage } from "@/components/ui";

export type RewardFormValues = { id: string; title: string; description: string; price_points: number; stock: number; valid_days: number; available_until: string | null };

// Formulir tambah/ubah reward (voucher) merchant.
export function RewardForm({ organizerId, initial }: { organizerId: string; initial?: RewardFormValues }) {
  const [state, action] = useActionState<RewardActionState, FormData>(saveReward, {});
  const untilDate = initial?.available_until ? new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date(initial.available_until)) : "";
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      {initial && <input type="hidden" name="reward_id" value={initial.id} />}
      <h2 className="text-[15px] font-bold">{initial ? "Ubah reward" : "Tambah reward"}</h2>
      <ErrorMessage message={state.error} />
      <SuccessMessage message={state.success} />
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`title-${initial?.id ?? "new"}`} className={labelClass}>Nama reward</label>
        <input id={`title-${initial?.id ?? "new"}`} name="title" required minLength={3} maxLength={80} defaultValue={initial?.title} placeholder="contoh: Gratis 1 es kopi susu" className={inputClass} />
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`desc-${initial?.id ?? "new"}`} className={labelClass}>Syarat pemakaian (opsional)</label>
        <textarea id={`desc-${initial?.id ?? "new"}`} name="description" rows={2} maxLength={500} defaultValue={initial?.description} placeholder="contoh: Berlaku di semua outlet, tidak bisa digabung promo lain." className={textareaClass} />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`price-${initial?.id ?? "new"}`} className={labelClass}>Harga (poin)</label>
          <input id={`price-${initial?.id ?? "new"}`} name="price_points" type="number" min={1} max={100000} required inputMode="numeric" defaultValue={initial?.price_points ?? 100} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`stock-${initial?.id ?? "new"}`} className={labelClass}>Stok</label>
          <input id={`stock-${initial?.id ?? "new"}`} name="stock" type="number" min={0} max={100000} required inputMode="numeric" defaultValue={initial?.stock ?? 10} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`days-${initial?.id ?? "new"}`} className={labelClass}>Masa berlaku voucher (hari)</label>
          <input id={`days-${initial?.id ?? "new"}`} name="valid_days" type="number" min={1} max={365} inputMode="numeric" defaultValue={initial?.valid_days ?? 30} className={inputClass} />
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={`until-${initial?.id ?? "new"}`} className={labelClass}>Bisa ditukar sampai (opsional)</label>
          <input id={`until-${initial?.id ?? "new"}`} name="available_until" type="date" defaultValue={untilDate} className={inputClass} />
        </div>
      </div>
      <div className="flex flex-col gap-1.5">
        <label htmlFor={`image-${initial?.id ?? "new"}`} className={labelClass}>Gambar (opsional, maks. 2 MB)</label>
        <input id={`image-${initial?.id ?? "new"}`} name="image" type="file" accept="image/png,image/jpeg,image/webp" className="text-[13px] text-fg-label file:mr-3 file:rounded-full file:border file:border-line-strong file:bg-surface file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-fg" />
      </div>
      <SubmitButton size="small" variant="dark" pendingText="Menyimpan…" className="self-end">
        {initial ? "Simpan" : "Tambah reward"}
      </SubmitButton>
    </form>
  );
}
