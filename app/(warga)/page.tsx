import { Suspense } from "react";
import { HomeView, type DailyMission } from "./home-view";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { listMyActivities, listPublicActivities, type ActivityCard } from "@/lib/data/activities";
import { listMyCommunityIds } from "@/lib/data/communities";
import { getCitizenDashboard } from "@/lib/data/dashboards";
import { getLeaderboard, listMyPrizes, listTopPrizes } from "@/lib/data/global-events";
import { getUserLeaderboard } from "@/lib/data/leaderboard";
import { getCitizenMissions } from "@/lib/data/missions";
import { getWallet, listMyVouchers } from "@/lib/data/rewards";
import { getCurrentUser, getUnreadCount } from "@/lib/data/user";
import { greetingFor } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Beranda warga: profil & level, kartu skor, misi hari ini, 3 besar peringkat, aktivitasku, dan rekomendasi.
export default function BerandaPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[22px] px-5 pb-32 pt-6">
        <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
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

  const [{ data: xpRows }, { data: levels }, unread, myActivities, wallet, vouchers, dashboard, publicActivities, myCommunityIds, globalActivities, myPrizes] = await Promise.all([
    supabase.from("xp_ledger").select("amount").eq("user_id", user.id),
    supabase.from("levels").select("level, name, min_xp"),
    getUnreadCount(user.id),
    listMyActivities(user.id),
    getWallet(),
    listMyVouchers(user.id),
    getCitizenDashboard(),
    listPublicActivities(),
    listMyCommunityIds(user.id),
    listPublicActivities({ filter: "global" }),
    listMyPrizes(user.id),
  ]);
  // Event Global: skor dan posisi saya di event yang diikuti, event yang dibuka, dan hadiah yang perlu diklaim.
  const joinedIds = new Set(myActivities.map((row) => row.card.id));
  const myGlobal = myActivities.filter((row) => row.card.reach === "global").map((row) => row.card.id);
  const openGlobal = globalActivities.filter((card) => !joinedIds.has(card.id)).slice(0, 2);
  // Misi hari ini: dari maksimal 3 aktivitas yang sedang berjalan dan sudah lunas.
  const running = myActivities
    .filter(({ card, participation }) => card.status === "running" && ["registered", "in_progress", "completed"].includes(participation.status) && participation.payment_status !== "unpaid" && participation.payment_status !== "awaiting_confirmation")
    .slice(0, 3);
  const [boards, topPrizes, missionLists, leaderboard] = await Promise.all([
    Promise.all(myGlobal.map((id) => getLeaderboard(id, 1))),
    listTopPrizes(openGlobal.map((c) => c.id)),
    Promise.all(running.map(({ card }) => getCitizenMissions(card.id))),
    getUserLeaderboard(user.homeVillageId ? "village" : "city"),
  ]);
  const dailyMissions = running.flatMap(({ card }, i) => openMissions(card, missionLists[i])).slice(0, 4);
  const globalScores = Object.fromEntries(myGlobal.map((id, i) => [id, { rank: boards[i]?.me?.rank ?? null, score: boards[i]?.me?.score ?? 0 }]));
  const pendingPrizes = myPrizes.filter((p) => p.status === "pending_claim" && isFuture(p.claim_deadline));
  const recommended = recommend(publicActivities, {
    joinedIds,
    communityIds: new Set(myCommunityIds),
    villageId: user.homeVillageId,
  });

  return (
    <HomeView
      nickname={user.nickname}
      avatarUrl={user.avatarUrl}
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
      globalScores={globalScores}
      openGlobal={openGlobal.map((card) => ({ card, topPrize: topPrizes.get(card.id) ?? null }))}
      dailyMissions={dailyMissions}
      topCitizens={(leaderboard?.rows ?? []).slice(0, 3)}
      prizeAlert={pendingPrizes.length ? { count: pendingPrizes.length, deadline: pendingPrizes.map((p) => p.claim_deadline).sort()[0] } : undefined}
    />
  );
}

// Misi yang masih bisa dikerjakan (belum dikirim atau ditolak). Hadiah ditulis server setelah misi diverifikasi.
function openMissions(card: ActivityCard, list: Awaited<ReturnType<typeof getCitizenMissions>>): DailyMission[] {
  if (!list?.can_work) return [];
  return list.missions.flatMap((m) =>
    m.open && m.can_work && (m.my_status === null || m.my_status === "rejected")
      ? [{ id: m.id, title: m.title, activityId: card.id, activityTitle: card.title, reward: card.reach === "global" ? `+${m.score_reward} skor` : `+${m.xp_reward} XP` }]
      : [],
  );
}

// Dipisah dari render supaya aturan "komponen harus murni" terpenuhi.
function isFuture(value: string) {
  return new Date(value).getTime() > Date.now();
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
        reason = "Event Gasyu";
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
