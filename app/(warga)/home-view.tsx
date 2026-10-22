import { UserAvatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ActivityCard } from "@/components/activity-card";
import { cardClass } from "@/components/styles";
import { PARTICIPATION_LABELS, PAYMENT_LABELS } from "@/lib/activities";
import type { ActivityCard as Card, Participation } from "@/lib/data/activities";
import { formatDateTime } from "@/lib/format";
import { badgeMeta } from "@/lib/gamification/badges";
import { levelFor, type LevelRow } from "@/lib/gamification/level";
import type { LeaderRow } from "@/lib/data/leaderboard";

export type DailyMission = { id: string; title: string; activityId: string; activityTitle: string; reward: string };

const MEDALS = ["🥇", "🥈", "🥉"];

// Tampilan beranda warga (tanpa pengambilan data): profil, kartu skor, misi hari ini, dan 3 besar peringkat.
export function HomeView({
  nickname,
  avatarUrl,
  villageName,
  totalXp,
  levels,
  greeting,
  unread,
  myActivities,
  recommended = [],
  wallet,
  rank,
  badges,
  globalScores = {},
  openGlobal = [],
  prizeAlert,
  dailyMissions = [],
  topCitizens = [],
}: {
  nickname: string;
  avatarUrl?: string | null;
  villageName?: string;
  totalXp: number;
  levels: LevelRow[];
  greeting: string;
  unread: number;
  myActivities: { card: Card; participation: Participation }[];
  recommended?: { card: Card; reason: string }[];
  wallet: { balance: number; activeVouchers: number; expiring30d: number };
  rank?: { village: number | null; city: number | null; xpMonth: number; streakWeeks: number; villageRank: number | null };
  badges?: { recent: { code: string; name: string; awarded_at: string }[]; earned: number; total: number };
  // Event Global (ALUR bagian 22e): skor dan posisi per event yang diikuti, event yang dibuka, dan hadiah yang perlu diklaim.
  globalScores?: Record<string, { rank: number | null; score: number }>;
  openGlobal?: { card: Card; topPrize: string | null }[];
  prizeAlert?: { count: number; deadline: string };
  // Misi terbuka dari aktivitas yang sedang diikuti; hadiah tetap diberikan server setelah misi diverifikasi.
  dailyMissions?: DailyMission[];
  topCitizens?: LeaderRow[];
}) {
  const level = levelFor(totalXp, levels);
  const currentMin = levels.find((row) => row.level === level.level)?.min_xp ?? 0;
  const progress =
    level.nextMinXp === null ? 100 : Math.round(((totalXp - currentMin) / (level.nextMinXp - currentMin)) * 100);
  const nextName = levels.find((row) => row.min_xp === level.nextMinXp)?.name;

  return (
    <>
      <section aria-label="Profil warga" className={`${cardClass} flex flex-col gap-5 p-5`}>
        <div className="flex items-center gap-4">
          <UserAvatar nickname={nickname} avatarUrl={avatarUrl} />
          <div className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="text-[17px] text-fg-soft">{greeting}</span>
            <span className="truncate font-display text-[26px] font-bold leading-tight">{nickname}</span>
            <span className="text-[16px] font-semibold text-success">
              ⭐ Level {level.level} · {level.name}
            </span>
          </div>
        </div>
        <a
          href="/notifikasi"
          className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line bg-bg px-4 text-[16px] font-semibold text-fg"
        >
          <Icon name="bell" size={20} />
          {unread > 0 ? `${unread} Notifikasi baru` : "Notifikasi"}
          {unread > 0 && <span className="size-2.5 rounded-full bg-hot" />}
        </a>
        <div className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-2">
            <span className="font-display text-[20px] font-bold tabular-nums">{totalXp.toLocaleString("id-ID")} XP</span>
            <span className="text-[16px] text-fg-soft">{villageName ? `Kel. ${villageName}` : "Luar Cimahi"}</span>
          </div>
          <div
            role="progressbar"
            aria-label="Progres ke level berikutnya"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-4 overflow-hidden rounded-full bg-track"
          >
            <div className="h-full rounded-full bg-xp" style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
          <span className="text-[16px] text-fg-soft">
            {level.nextMinXp === null
              ? "Kamu sudah di level tertinggi."
              : `${(level.nextMinXp - totalXp).toLocaleString("id-ID")} XP lagi ke level ${nextName}`}
          </span>
        </div>
      </section>

      {prizeAlert && prizeAlert.count > 0 && (
        <a href="/hadiah" className="flex items-center gap-3 rounded-[20px] border border-hot/40 bg-hot-tint p-4 text-fg">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-hot text-on-primary">
            <Icon name="ticket" size={22} stroke={2} />
          </span>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[18px] font-semibold">{prizeAlert.count > 1 ? `${prizeAlert.count} hadiah perlu diklaim` : "Hadiah perlu diklaim"}</span>
            <span className="text-[14px] text-fg-label">Klaim sebelum {formatDateTime(prizeAlert.deadline)}</span>
          </span>
          <Icon name="chevron" size={16} stroke={2} className="text-fg-muted" />
        </a>
      )}

      <section aria-label="Ringkasan skor" className="grid grid-cols-3 gap-3">
        <ScoreCard href="/dompet" emoji="🪙" value={wallet.balance.toLocaleString("id-ID")} label="Poin" valueClass="text-points" />
        <ScoreCard href="/peringkat" emoji="🔥" value={String(rank?.streakWeeks ?? 0)} label="Minggu Aktif" valueClass="text-primary" />
        <ScoreCard href="/dompet?tab=voucher" emoji="🎟️" value={String(wallet.activeVouchers)} label="Kupon" valueClass="text-success" />
      </section>
      {wallet.expiring30d > 0 && (
        <p className="-mt-2 rounded-xl bg-warn-tint px-4 py-3 text-[16px] font-semibold text-warn">
          ⏳ {wallet.expiring30d.toLocaleString("id-ID")} poin kedaluwarsa dalam 30 hari
        </p>
      )}

      {dailyMissions.length > 0 && (
        <section aria-labelledby="misi-hari-ini" className="flex flex-col gap-3">
          <h2 id="misi-hari-ini" className="font-display text-[24px] font-bold">
            Misi Hari Ini
          </h2>
          <ul className="flex flex-col gap-3">
            {dailyMissions.map((m) => (
              <li key={m.id} className={`${cardClass} flex flex-col gap-3 p-4 sm:flex-row sm:items-center`}>
                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="text-[18px] font-semibold leading-snug">{m.title}</span>
                  <span className="text-[16px] text-fg-soft">{m.activityTitle}</span>
                  <span className="text-[16px] font-semibold text-success">{m.reward}</span>
                </div>
                <a
                  href={`/aktivitas/${m.activityId}#misi`}
                  className="flex min-h-[52px] shrink-0 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[18px] font-semibold text-on-primary transition-colors hover:bg-primary-hover"
                >
                  <Icon name="check" size={20} stroke={2.4} />
                  Kerjakan
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {topCitizens.length > 0 && (
        <section aria-labelledby="warga-teladan" className={`${cardClass} flex flex-col gap-4 p-5`}>
          <div className="flex flex-col gap-0.5">
            <h2 id="warga-teladan" className="font-display text-[24px] font-bold">
              Warga Teladan
            </h2>
            <span className="text-[16px] text-fg-soft">3 besar bulan ini {villageName ? `di ${villageName}` : "se-Cimahi"}</span>
          </div>
          <ol className="flex flex-col gap-2.5">
            {topCitizens.map((row, i) => (
              <li
                key={row.rank}
                className={`flex items-center gap-3 rounded-2xl px-4 py-3 ${row.is_me ? "border border-primary/40 bg-primary-tint" : "bg-bg"}`}
              >
                <span className="text-[28px] leading-none" aria-hidden="true">
                  {MEDALS[i]}
                </span>
                <span className="sr-only">Peringkat {row.rank}</span>
                <span className="min-w-0 flex-1 truncate text-[18px] font-semibold">
                  {row.nickname}
                  {row.is_me ? " (kamu)" : ""}
                </span>
                <span className="font-display text-[18px] font-bold tabular-nums">{row.xp.toLocaleString("id-ID")} XP</span>
              </li>
            ))}
          </ol>
          {rank && (rank.village ?? rank.city) && !topCitizens.some((row) => row.is_me) && (
            <p className="text-[16px] text-fg-soft">
              Posisimu <b className="text-fg">#{rank.village ?? rank.city}</b> dengan {rank.xpMonth.toLocaleString("id-ID")} XP bulan ini.
            </p>
          )}
          <a
            href="/peringkat"
            className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong px-4 text-[17px] font-semibold text-fg transition-colors hover:bg-bg"
          >
            <Icon name="chart" size={20} />
            Lihat Semua Peringkat
          </a>
        </section>
      )}

      {badges && badges.recent.length > 0 && (
        <a href="/profil" className={`${cardClass} flex items-center gap-3 p-4 text-fg`}>
          <div className="flex -space-x-2">
            {badges.recent.map((b) => {
              const meta = badgeMeta(b.code);
              return (
                <span key={b.code} className={`flex size-10 items-center justify-center rounded-full border-2 border-surface bg-track ${meta.color}`} title={b.name}>
                  <Icon name={meta.icon} size={18} stroke={2} />
                </span>
              );
            })}
          </div>
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[17px] font-semibold">Badge terbaru: {badges.recent[0].name}</span>
            <span className="text-[14px] text-fg-soft">
              {badges.earned} dari {badges.total} badge terkumpul
            </span>
          </span>
          <Icon name="chevron" size={16} stroke={2} className="text-fg-muted" />
        </a>
      )}

      <section id="aktivitasku" className="flex scroll-mt-4 flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[24px] font-semibold">Aktivitasku</h2>
          <a href="/jelajah" className="text-[16px] font-semibold text-link">
            Jelajah
          </a>
        </div>
        {myActivities.length === 0 ? (
          <a href="/jelajah" className={`${cardClass} flex flex-col gap-1 p-4 text-fg`}>
            <span className="text-[18px] font-semibold">Belum ikut aktivitas</span>
            <span className="text-[16px] leading-[1.5] text-fg-soft">
              Cari event dan challenge dari UMKM dan komunitas
              {villageName ? ` di sekitar ${villageName}` : " di Cimahi"} lewat Jelajah.
            </span>
          </a>
        ) : (
          myActivities.map(({ card, participation }) => (
            <ActivityCard
              key={card.id}
              card={card}
              href={`/aktivitas/${card.id}`}
              footer={
                card.reach === "global" && globalScores[card.id] && participation.payment_status !== "unpaid" && participation.payment_status !== "awaiting_confirmation" ? (
                  <span className="text-[14px] font-bold text-hot">
                    {globalScores[card.id].score.toLocaleString("id-ID")} skor{globalScores[card.id].rank ? ` · posisi #${globalScores[card.id].rank}` : ""}
                  </span>
                ) : participation.payment_status === "unpaid" || participation.payment_status === "awaiting_confirmation" ? (
                  <span className={`text-[14px] font-bold ${participation.payment_status === "unpaid" ? "text-warn" : "text-info"}`}>{PAYMENT_LABELS[participation.payment_status]}</span>
                ) : (
                  <span className="text-[14px] font-bold text-success">{PARTICIPATION_LABELS[participation.status]}</span>
                )
              }
            />
          ))
        )}
      </section>

      {openGlobal.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[24px] font-semibold">Event Global</h2>
            <a href="/jelajah?filter=global" className="text-[16px] font-semibold text-link">
              Lihat semua
            </a>
          </div>
          {openGlobal.map(({ card, topPrize }) => (
            <ActivityCard key={card.id} card={card} href={`/aktivitas/${card.id}`} topPrize={topPrize} footer={<span className="text-[14px] font-bold text-hot">Terbuka untuk semua kota</span>} />
          ))}
        </section>
      )}

      {recommended.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[24px] font-semibold">Rekomendasi</h2>
            <a href="/jelajah" className="text-[16px] font-semibold text-link">
              Lihat semua
            </a>
          </div>
          {recommended.map(({ card, reason }) => (
            <ActivityCard key={card.id} card={card} href={`/aktivitas/${card.id}`} footer={<span className="text-[14px] font-bold text-link">{reason}</span>} />
          ))}
        </section>
      )}
    </>
  );
}

// Kartu skor besar: emoji + angka + teks, bisa ditekan.
function ScoreCard({ href, emoji, value, label, valueClass }: { href: string; emoji: string; value: string; label: string; valueClass: string }) {
  return (
    <a href={href} className={`${cardClass} flex flex-col items-center gap-1 px-2 py-4 text-center text-fg transition-colors hover:border-line-strong`}>
      <span className="text-[28px] leading-none" aria-hidden="true">
        {emoji}
      </span>
      <span className={`font-display text-[26px] font-bold leading-tight tabular-nums ${valueClass}`}>{value}</span>
      <span className="text-[15px] font-semibold leading-tight text-fg-soft">{label}</span>
    </a>
  );
}
