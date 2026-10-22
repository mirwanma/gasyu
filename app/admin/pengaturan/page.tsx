import { Suspense } from "react";
import { updateSetting } from "./actions";
import { cardClass, inputClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";

// Angka aturan main (app_settings). Hanya admin yang bisa mengubah (RLS).
export default function PengaturanPage({ searchParams }: PageProps<"/admin/pengaturan">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] font-bold">Pengaturan aturan main</h1>
        <span className="text-[17px] text-fg-soft">Berlaku langsung tanpa deploy ulang. Ubah dengan hati-hati.</span>
      </div>
      <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
        <Settings searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Settings({ searchParams }: Pick<PageProps<"/admin/pengaturan">, "searchParams">) {
  const { hasil } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase.from("app_settings").select("key, value, updated_at").order("key");
  const rows = (data ?? []) as { key: string; value: unknown; updated_at: string }[];

  return (
    <section className={`${cardClass} overflow-hidden`}>
      {hasil === "ok" && <p className="border-b border-line bg-success-tint px-4 py-3 text-[16px] font-semibold text-success">Pengaturan tersimpan.</p>}
      {hasil === "gagal" && <p className="border-b border-line bg-danger-tint px-4 py-3 text-[16px] font-semibold text-danger">Nilai tidak valid. Pakai angka atau JSON yang benar.</p>}
      {rows.map((row, i) => (
        <form key={row.key} action={updateSetting} className={`flex flex-wrap items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
          <input type="hidden" name="key" value={row.key} />
          <code className="min-w-[240px] flex-1 text-[16px] font-semibold">{row.key}</code>
          <input name="value" defaultValue={JSON.stringify(row.value)} className={`${inputClass} h-10 max-w-[280px] font-mono text-[16px]`} aria-label={`Nilai ${row.key}`} />
          <SubmitButton size="small" variant="dark" pendingText="…">
            Simpan
          </SubmitButton>
        </form>
      ))}
    </section>
  );
}
