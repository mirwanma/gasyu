import { Suspense } from "react";
import { HomeView } from "./home-view";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { listMyActivities } from "@/lib/data/activities";
import { getCitizenDashboard } from "@/lib/data/dashboards";
import { getWallet, listMyVouchers } from "@/lib/data/rewards";
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

  const [{ data: xpRows }, { data: levels }, unread, myActivities, wallet, vouchers, dashboard] = await Promise.all([
    supabase.from("xp_ledger").select("amount").eq("user_id", user.id),
    supabase.from("levels").select("level, name, min_xp"),
    getUnreadCount(user.id),
    listMyActivities(user.id),
    getWallet(),
    listMyVouchers(user.id),
    getCitizenDashboard(),
  ]);

  return (
    <HomeView
      nickname={user.nickname}
      villageName={user.villageName ?? undefined}
      totalXp={(xpRows ?? []).reduce((sum, row) => sum + row.amount, 0)}
      levels={levels ?? []}
      greeting={greetingFor()}
      unread={unread}
      myActivities={myActivities}
      wallet={{ balance: wallet.balance, activeVouchers: vouchers.filter((v) => v.status === "active").length, expiring30d: wallet.expiring_30d }}
      rank={dashboard ? { village: dashboard.rank_village, city: dashboard.rank_city, xpMonth: dashboard.xp_month, streakWeeks: dashboard.streak_weeks, villageRank: dashboard.village_rank } : undefined}
      badges={dashboard ? { recent: dashboard.badges.slice(0, 3), earned: dashboard.badges.length, total: dashboard.badge_total } : undefined}
    />
  );
}
