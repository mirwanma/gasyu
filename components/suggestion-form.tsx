"use client";

import { useActionState, useState } from "react";
import { sendSuggestion, type SuggestionState } from "@/lib/actions/suggestions";
import { cardClass, chipClass, labelClass, textareaClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";
import { SUGGESTION_CATEGORIES } from "@/lib/suggestions";

// Formulir "Kasih saran" di profil publik merchant (/m) dan komunitas (/k).
export function SuggestionForm({ organizerId, organizerName, path }: { organizerId: string; organizerName: string; path: string }) {
  const [state, formAction] = useActionState<SuggestionState, FormData>(sendSuggestion, {});
  const [category, setCategory] = useState("activity");
  const [length, setLength] = useState(0);

  if (state.success) {
    return (
      <section className={`${cardClass} flex flex-col gap-2 p-4`}>
        <span className="text-[16px] font-semibold">Saran terkirim</span>
        <span className="text-[15px] leading-[1.5] text-fg-soft">{state.success} Balasan dan statusnya muncul di menu Saran saya.</span>
        <a href="/saran" className="text-[15px] font-semibold text-link">
          Lihat saran saya
        </a>
      </section>
    );
  }

  return (
    <form action={formAction} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="path" value={path} />
      <input type="hidden" name="category" value={category} />
      <div className="flex flex-col gap-1">
        <span className="text-[16px] font-semibold">Kasih saran</span>
        <span className="text-[15px] leading-[1.5] text-fg-soft">Ide aktivitas, menu, pelayanan, atau tempat. Saranmu dibaca langsung oleh tim {organizerName}.</span>
      </div>
      <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Jenis saran">
        {SUGGESTION_CATEGORIES.map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="radio"
            aria-checked={category === key}
            onClick={() => setCategory(key)}
            className={`${chipClass.base} ${category === key ? chipClass.selected : chipClass.idle}`}
          >
            {label}
          </button>
        ))}
      </div>
      <label htmlFor="saran-body" className={labelClass}>
        Saranmu
      </label>
      <textarea
        id="saran-body"
        name="body"
        rows={4}
        minLength={10}
        maxLength={1000}
        required
        onChange={(e) => setLength(e.target.value.length)}
        placeholder="Contoh: Bikin kelas latte art buat pemula di akhir pekan."
        className={`${textareaClass} resize-none`}
      />
      <span className="-mt-1 text-right text-[12px] text-fg-muted">{length}/1000</span>
      <label className="flex items-start gap-2.5 text-[15px] leading-[1.5] text-fg-label">
        <input type="checkbox" name="anonymous" className="mt-0.5 size-5 shrink-0 accent-primary" />
        <span>Kirim tanpa nama. Tim penyelenggara tidak melihat nama panggilanmu.</span>
      </label>
      <ErrorMessage message={state.error} />
      <SubmitButton pendingText="Mengirim…" className="h-[50px] rounded-[14px] text-[16px]">
        Kirim saran
      </SubmitButton>
    </form>
  );
}
