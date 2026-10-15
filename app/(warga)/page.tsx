import { Suspense } from "react";
import { HomeView } from "./home-view";
import { BottomNav } from "@/components/bottom-nav";
import { createClient } from "@/lib/supabase/server";

// Beranda warga. Bagian poin, voucher, peringkat, dan rekomendasi menyusul
// di irisan berikutnya; yang tampil sekarang hanya data yang sudah ada.
export default function BerandaPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-5 pb-32 pt-6">
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <CitizenHome />
        </Suspense>
      </main>
      <BottomNav active="Beranda" />
    </>
  );
}

function greeting(now: Date) {
  const hour = Number(
    new Intl.DateTimeFormat("id-ID", { hour: "numeric", hourCycle: "h23", timeZone: "Asia/Jakarta" }).format(now),
  );
  if (hour < 11) return "Selamat pagi,";
  if (hour < 15) return "Selamat siang,";
  if (hour < 18) return "Selamat sore,";
  return "Selamat malam,";
}

async function CitizenHome() {
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

  const village = profile?.home_village as { name: string } | { name: string }[] | null;

  return (
    <HomeView
      nickname={profile?.nickname ?? ""}
      villageName={Array.isArray(village) ? village[0]?.name : village?.name}
      totalXp={(xpRows ?? []).reduce((sum, row) => sum + row.amount, 0)}
      levels={levels ?? []}
      greeting={greeting(new Date())}
    />
  );
}
