import { Suspense } from "react";
import { HomeView } from "./home-view";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { listMyActivities, listPublicActivities, type ActivityCard } from "@/lib/data/activities";
import { listMyCommunityIds } from "@/lib/data/communities";
import { getCitizenDashboard } from "@/lib/data/dashboards";
import { getWallet, listMyVouchers } from "@/lib/data/rewards";
import { getCurrentUser, getUnreadCount } from "@/lib/data/user";
import { greetingFor } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Beranda warga: level & XP, dompet, badge, aktivitasku, dan rekomendasi.
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

  const [{ data: xpRows }, { data: levels }, unread, myActivities, wallet, vouchers, dashboard, publicActivities, myCommunityIds] = await Promise.all([
    supabase.from("xp_ledger").select("amount").eq("user_id", user.id),
    supabase.from("levels").select("level, name, min_xp"),
    getUnreadCount(user.id),
    listMyActivities(user.id),
    getWallet(),
    listMyVouchers(user.id),
    getCitizenDashboard(),
    listPublicActivities(),
    listMyCommunityIds(user.id),
  ]);
  const recommended = recommend(publicActivities, {
    joinedIds: new Set(myActivities.map((row) => row.card.id)),
    communityIds: new Set(myCommunityIds),
    villageId: user.homeVillageId,
  });

  return (
    <HomeView
      nickname={user.nickname}
      villageName={user.villageName ?? undefined}
      totalXp={(xpRows ?? []).reduce((sum, row) => sum + row.amount, 0)}
      levels={levels ?? []}
      greeting={greetingFor()}
      unread={unread}
      myActivities={myActivities}
      recommended={recommended}
      wallet={{ balance: wallet.balance, activeVouchers: vouchers.filter((v) => v.status === "active").length, expiring30d: wallet.expiring_30d }}
      rank={dashboard ? { village: dashboard.rank_village, city: dashboard.rank_city, xpMonth: dashboard.xp_month, streakWeeks: dashboard.streak_weeks, villageRank: dashboard.village_rank } : undefined}
      badges={dashboard ? { recent: dashboard.badges.slice(0, 3), earned: dashboard.badges.length, total: dashboard.badge_total } : undefined}
    />
  );
}

// Rekomendasi: aktivitas terbit yang belum diikuti, diutamakan dari komunitas
// yang diikuti dan yang cakupannya kelurahan sendiri (atau seluruh kota).
function recommend(
  cards: ActivityCard[],
  ctx: { joinedIds: Set<string>; communityIds: Set<string>; villageId: string | null },
): { card: ActivityCard; reason: string }[] {
  return cards
    .filter((card) => !ctx.joinedIds.has(card.id))
    .map((card) => {
      let score = 0;
      let reason = "Terbuka untuk semua";
      if (card.host_type === "platform") {
        score += 1;
        reason = "Event Ramein";
      }
      if (card.scope_region_id && card.scope_region_id === ctx.villageId) {
        score += 2;
        reason = "Di kelurahanmu";
      }
      if (ctx.communityIds.has(card.host_organizer_id)) {
        score += 3;
        reason = `Dari ${card.host_name}`;
      }
      if (card.audience === "members_only" && !ctx.communityIds.has(card.host_organizer_id)) score -= 10;
      if (card.residency_rule === "residents_only" && !ctx.villageId) score -= 10;
      return { card, reason, score };
    })
    .filter((row) => row.score > -5)
    .sort((a, b) => b.score - a.score || a.card.starts_at.localeCompare(b.card.starts_at))
    .slice(0, 3)
    .map(({ card, reason }) => ({ card, reason }));
}
