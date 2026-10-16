import { Suspense } from "react";
import { HomeView } from "./home-view";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { getCurrentUser, getUnreadCount } from "@/lib/data/user";
import { greetingFor } from "@/lib/format";
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
      <BottomNav items={CITIZEN_NAV} active="Beranda" />
    </>
  );
}

async function CitizenHome() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: xpRows }, { data: levels }, unread] = await Promise.all([
    supabase.from("xp_ledger").select("amount").eq("user_id", user.id),
    supabase.from("levels").select("level, name, min_xp"),
    getUnreadCount(user.id),
  ]);

  return (
    <HomeView
      nickname={user.nickname}
      villageName={user.villageName ?? undefined}
      totalXp={(xpRows ?? []).reduce((sum, row) => sum + row.amount, 0)}
      levels={levels ?? []}
      greeting={greetingFor()}
      unread={unread}
    />
  );
}
