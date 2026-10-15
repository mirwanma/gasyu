import { Suspense } from "react";
import { signOut } from "./actions";
import { SubmitButton, Wordmark } from "@/components/ui";
import { levelFor } from "@/lib/gamification/level";
import { createClient } from "@/lib/supabase/server";

// Beranda sementara (Irisan 1). Isi lengkap dashboard warga menyusul di irisan berikutnya.
export default function BerandaPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-6 px-4 py-8">
      <Wordmark />
      <Suspense fallback={<p className="text-[13px] text-ink-soft">Memuat…</p>}>
        <CitizenSummary />
      </Suspense>
      <p className="rounded-[var(--radius-card)] border border-line bg-white p-4 text-[13px] leading-[18px] text-ink-soft">
        Event dan challenge di kelurahan kamu segera hadir di sini.
      </p>
      <form action={signOut} className="mt-auto">
        <SubmitButton variant="secondary" pendingText="Keluar…">
          Keluar
        </SubmitButton>
      </form>
    </main>
  );
}

async function CitizenSummary() {
  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub ?? "";

  const [{ data: profile }, { data: xpRows }, { data: levels }] = await Promise.all([
    supabase
      .from("profiles")
      .select("nickname, home_village:regions(name)")
      .eq("id", userId)
      .maybeSingle(),
    supabase.from("xp_ledger").select("amount").eq("user_id", userId),
    supabase.from("levels").select("level, name, min_xp"),
  ]);

  const totalXp = (xpRows ?? []).reduce((sum, row) => sum + row.amount, 0);
  const level = levelFor(totalXp, levels ?? []);
  const village = profile?.home_village as { name: string } | { name: string }[] | null;
  const villageName = Array.isArray(village) ? village[0]?.name : village?.name;

  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="text-[24px] font-extrabold leading-[30px]">Halo, {profile?.nickname}</h1>
        <p className="text-[13px] font-medium leading-[18px] text-ink-soft">
          {villageName ? `Kel. ${villageName}` : "Luar Cimahi"}
        </p>
      </div>

      <section className="flex items-center gap-4 rounded-[var(--radius-card)] border border-line bg-white p-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-full border-4 border-warga text-[20px] font-extrabold text-warga">
          {level.level}
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-[12px] font-semibold uppercase leading-[16px] tracking-[0.08em] text-ink-soft">
            {level.name}
          </span>
          <span className="text-[32px] font-extrabold leading-none tabular-nums">
            {totalXp.toLocaleString("id-ID")}{" "}
            <span className="text-[15px] font-semibold text-warga">XP</span>
          </span>
          {level.nextMinXp !== null && (
            <span className="text-[13px] leading-[18px] text-ink-soft">
              {(level.nextMinXp - totalXp).toLocaleString("id-ID")} XP lagi ke level berikutnya
            </span>
          )}
        </div>
      </section>
    </>
  );
}
