import { UserAvatar } from "@/components/avatar";
import { Icon, type IconName } from "@/components/icons";
import { ActivityCard } from "@/components/activity-card";
import { cardClass } from "@/components/styles";
import { PARTICIPATION_LABELS, PAYMENT_LABELS } from "@/lib/activities";
import type { ActivityCard as Card, Participation } from "@/lib/data/activities";
import { formatDateTime } from "@/lib/format";
import { badgeMeta } from "@/lib/gamification/badges";
import { levelFor, type LevelRow } from "@/lib/gamification/level";
import type { LeaderRow } from "@/lib/data/leaderboard";
import { DailyMissions, type DailyMission } from "./daily-missions";

// Tampilan beranda warga (tanpa pengambilan data): kartu level, bento skor, misi hari ini, dan podium 3 besar.
export function HomeView({
  nickname,
  avatarUrl,
  districtName,
  cityName,
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
  // Kecamatan dan kota tempat tinggal; kosong untuk akun lama yang belum mengisinya.
  districtName?: string;
  cityName?: string;
  totalXp: number;
  levels: LevelRow[];
  greeting: string;
  unread: number;
  myActivities: { card: Card; participation: Participation }[];
  recommended?: { card: Card; reason: string }[];
  wallet: { balance: number; activeVouchers: number; expiring30d: number };
  // Peringkat hanya ada jika kota warga sudah dibuka.
  rank?: { district: number | null; city: number | null; xpMonth: number; streakWeeks: number; districtRank: number | null };
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

  const districtRank = rank?.districtRank ?? null;
  const myRank = rank?.district ?? rank?.city ?? null;
  const cityShort = cityName?.replace(/^(Kota Administrasi|Kota|Kabupaten Administrasi|Kabupaten)\s+/, "");
  const third = topCitizens[2];
  const xpToPodium = third && rank && !topCitizens.some((row) => row.is_me) ? Math.max(third.xp - rank.xpMonth + 1, 1) : null;

  return (
    <>
      <header className="flex animate-pop items-center gap-3">
        <UserAvatar nickname={nickname} avatarUrl={avatarUrl} size={50} />
        <div className="flex min-w-0 flex-1 flex-col">
          <span className="flex items-center gap-1 text-[14px] text-fg-soft">
            {greeting}
            <Icon name="sun" size={16} weight="duotone" className="text-sun" />
          </span>
          <span className="truncate font-display text-[22px] font-bold leading-tight">{nickname}</span>
        </div>
        <a
          href="/notifikasi"
          className="flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 text-[14px] font-bold text-fg shadow-card"
        >
          <Icon name={unread > 0 ? "bellRinging" : "bell"} size={18} weight="fill" className="text-primary" />
          Notifikasi
          {unread > 0 && (
            <span className="flex h-5 min-w-5 items-center justify-center rounded-full bg-berry px-1.5 text-[12px] text-bg">{unread}</span>
          )}
        </a>
      </header>

      <section
        aria-label="Level dan Jejak"
        className="relative animate-pop overflow-hidden rounded-[30px] bg-linear-140 from-hero-from via-hero-via to-hero-to p-5 text-on-hero shadow-hero"
      >
        <span className="absolute -right-12 -top-16 size-48 rounded-full bg-white/12" aria-hidden="true" />
        <span className="absolute -bottom-8 -left-8 size-24 rounded-full bg-white/12" aria-hidden="true" />
        <div className="relative flex items-center gap-4">
          <div
            role="progressbar"
            aria-label="Progres ke level berikutnya"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="grid size-[96px] shrink-0 place-items-center rounded-full"
            style={{ background: `conic-gradient(var(--color-sun) ${progress}%, rgb(255 255 255 / 0.25) 0)` }}
          >
            <div className="grid size-[78px] place-items-center rounded-full bg-black/15 text-center leading-none backdrop-blur-sm">
              <span>
                <span className="block font-display text-[12px] tracking-[0.08em] opacity-90">LEVEL</span>
                <span className="block font-display text-[34px] font-extrabold">{level.level}</span>
              </span>
            </div>
          </div>
          <div className="flex min-w-0 flex-col gap-1.5">
            <span className="font-display text-[24px] font-extrabold leading-tight">{level.name}</span>
            <span className="text-[14px] opacity-95">
              <b>{totalXp.toLocaleString("id-ID")} Jejak</b>
              {level.nextMinXp === null ? " · level tertinggi" : ` · ${(level.nextMinXp - totalXp).toLocaleString("id-ID")} lagi ke ${nextName}`}
            </span>
            <div className="flex flex-wrap gap-1.5">
              {rank && rank.streakWeeks > 0 && (
                <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[13px] font-bold">
                  <Icon name="fire" size={15} weight="fill" className="text-sun" />
                  {rank.streakWeeks} minggu
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-white/20 px-3 py-1 text-[13px] font-bold">
                <Icon name="pin" size={15} weight="fill" />
                {districtName ?? "Wilayah belum diisi"}
              </span>
            </div>
          </div>
        </div>
        {districtRank && (
          <a href="/peringkat?tab=kecamatan" className="relative mt-4 flex items-center gap-2.5 rounded-[18px] bg-black/20 px-3.5 py-2.5 text-[14px]">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-sun text-on-sun">
              <Icon name="trophy" size={18} weight="fill" />
            </span>
            <span>
              Kecamatanmu <b>#{districtRank} se-{cityShort}</b> bulan ini
            </span>
          </a>
        )}
      </section>

      {!districtName && (
        <a href="/profil/ubah" className={`${cardClass} flex items-center gap-3 border-warn/40 p-4 text-fg`}>
          <Icon name="pin" size={22} weight="fill" className="shrink-0 text-warn" />
          <span className="flex flex-col gap-0.5">
            <span className="text-[16px] font-semibold">Lengkapi kota dan kecamatanmu</span>
            <span className="text-[14px] leading-[1.5] text-fg-soft">Supaya Jejakmu masuk peringkat kota dan kecamatan, dan kamu bisa ikut aktivitas khusus warga.</span>
          </span>
        </a>
      )}

      {prizeAlert && prizeAlert.count > 0 && (
        <a href="/hadiah" className="flex animate-pop items-center gap-3 rounded-3xl border border-berry/40 bg-berry-tint p-4 text-fg">
          <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-berry text-bg">
            <Icon name="gift" size={24} weight="fill" />
          </span>
          <span className="flex flex-1 flex-col">
            <span className="text-[16px] font-bold">{prizeAlert.count > 1 ? `${prizeAlert.count} hadiah perlu diklaim` : "Hadiah perlu diklaim"}</span>
            <span className="text-[13px] text-fg-label">Klaim sebelum {formatDateTime(prizeAlert.deadline)}</span>
          </span>
          <Icon name="chevron" size={16} weight="bold" className="text-fg-muted" />
        </a>
      )}

      <section aria-label="Ringkasan skor" className="grid animate-pop grid-cols-[1.3fr_1fr] gap-3">
        <div className="row-span-2 flex flex-col justify-between gap-3 rounded-[28px] rounded-bl-xl bg-linear-165 from-gold-from to-gold-to p-4 text-on-gold">
          <ScoreLabel icon="coins" tile="bg-surface/55 text-points">
            Poin kamu
          </ScoreLabel>
          <div>
            <span className="block font-display text-[40px] font-extrabold leading-none tabular-nums">{wallet.balance.toLocaleString("id-ID")}</span>
            <span className="mt-1 block text-[13px] font-semibold opacity-85">
              {wallet.expiring30d > 0 ? `${wallet.expiring30d.toLocaleString("id-ID")} habis dalam 30 hari` : "Tukar dengan voucher merchant"}
            </span>
          </div>
          <a
            href="/dompet"
            className="btn-3d flex min-h-12 items-center justify-center gap-1.5 rounded-2xl bg-fg px-3 text-[15px] font-bold text-bg [--btn-edge:var(--color-fg-label)]"
          >
            <Icon name="gift" size={18} weight="fill" />
            Tukar Hadiah
          </a>
        </div>
        <a href="/peringkat" className="flex flex-col gap-1 rounded-3xl rounded-bl-[10px] border border-line bg-surface p-4 text-fg shadow-card">
          <ScoreLabel icon="fire" tile="bg-primary-tint text-primary">
            Beruntun
          </ScoreLabel>
          <span className="font-display text-[28px] font-extrabold leading-tight text-primary">
            {rank?.streakWeeks ?? 0} <span className="text-[15px]">minggu</span>
          </span>
        </a>
        <a href="/dompet?tab=voucher" className="flex flex-col gap-1 rounded-3xl rounded-tl-[10px] border border-line bg-surface p-4 text-fg shadow-card">
          <ScoreLabel icon="ticket" tile="bg-success-tint text-success">
            Kupon
          </ScoreLabel>
          <span className="font-display text-[28px] font-extrabold leading-tight text-success">
            {wallet.activeVouchers} <span className="text-[15px]">aktif</span>
          </span>
        </a>
      </section>

      {dailyMissions.length > 0 && <DailyMissions missions={dailyMissions} />}

      {topCitizens.length > 0 && (
        <section aria-labelledby="warga-teladan" className={`${cardClass} flex animate-pop flex-col gap-1 rounded-[28px] p-5`}>
          <div className="flex items-center justify-between gap-2">
            <h2 id="warga-teladan" className="font-display text-[22px] font-bold">
              Warga Teladan
            </h2>
            <a href="/peringkat" className="flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-[13px] font-bold text-fg">
              <Icon name="ranking" size={16} weight="bold" className="text-primary" />
              Semua
            </a>
          </div>
          <span className="text-[14px] text-fg-soft">3 besar bulan ini {districtName ? `di ${districtName}` : ""}</span>
          <Podium rows={topCitizens} />
          {xpToPodium && myRank && (
            <p className="mt-3 flex items-center gap-2.5 rounded-[18px] bg-primary-tint px-3.5 py-3 text-[14px]">
              <span className="flex size-8 shrink-0 items-center justify-center rounded-[10px] bg-primary text-on-primary">
                <Icon name="target" size={18} weight="fill" />
              </span>
              <span>
                Kamu <b>#{myRank}</b>. Butuh <b>{xpToPodium.toLocaleString("id-ID")} Jejak</b> lagi untuk masuk 3 besar!
              </span>
            </p>
          )}
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
            <span className="text-[15px] font-semibold">Badge terbaru: {badges.recent[0].name}</span>
            <span className="text-[13px] text-fg-soft">
              {badges.earned} dari {badges.total} badge terkumpul
            </span>
          </span>
          <Icon name="chevron" size={16} stroke={2} className="text-fg-muted" />
        </a>
      )}

      <section id="aktivitasku" className="flex scroll-mt-4 flex-col gap-3">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[22px] font-semibold">Aktivitasku</h2>
          <a href="/jelajah" className="text-[15px] font-semibold text-link">
            Jelajah
          </a>
        </div>
        {myActivities.length === 0 ? (
          <a href="/jelajah" className={`${cardClass} flex flex-col gap-1 p-4 text-fg`}>
            <span className="text-[16px] font-semibold">Belum ikut aktivitas</span>
            <span className="text-[15px] leading-[1.5] text-fg-soft">
              Cari event dan challenge dari UMKM dan komunitas
              {districtName ? ` di sekitar ${districtName}` : " di kotamu"} lewat Jelajah.
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
                  <span className="text-[13px] font-bold text-hot">
                    {globalScores[card.id].score.toLocaleString("id-ID")} skor{globalScores[card.id].rank ? ` · posisi #${globalScores[card.id].rank}` : ""}
                  </span>
                ) : participation.payment_status === "unpaid" || participation.payment_status === "awaiting_confirmation" ? (
                  <span className={`text-[13px] font-bold ${participation.payment_status === "unpaid" ? "text-warn" : "text-info"}`}>{PAYMENT_LABELS[participation.payment_status]}</span>
                ) : (
                  <span className="text-[13px] font-bold text-success">{PARTICIPATION_LABELS[participation.status]}</span>
                )
              }
            />
          ))
        )}
      </section>

      {openGlobal.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[22px] font-semibold">Event Global</h2>
            <a href="/jelajah?filter=global" className="text-[15px] font-semibold text-link">
              Lihat semua
            </a>
          </div>
          {openGlobal.map(({ card, topPrize }) => (
            <ActivityCard key={card.id} card={card} href={`/aktivitas/${card.id}`} topPrize={topPrize} footer={<span className="text-[13px] font-bold text-hot">Terbuka untuk semua kota</span>} />
          ))}
        </section>
      )}

      {recommended.length > 0 && (
        <section className="flex flex-col gap-3">
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[22px] font-semibold">Rekomendasi</h2>
            <a href="/jelajah" className="text-[15px] font-semibold text-link">
              Lihat semua
            </a>
          </div>
          {recommended.map(({ card, reason }) => (
            <ActivityCard key={card.id} card={card} href={`/aktivitas/${card.id}`} footer={<span className="text-[13px] font-bold text-link">{reason}</span>} />
          ))}
        </section>
      )}
    </>
  );
}

// Label kartu skor: ikon di kotak berwarna + teks kapital kecil.
function ScoreLabel({ icon, tile, children }: { icon: IconName; tile: string; children: React.ReactNode }) {
  return (
    <span className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-[0.05em] opacity-80">
      <span className={`flex size-7 items-center justify-center rounded-[10px] ${tile}`}>
        <Icon name={icon} size={16} weight="fill" />
      </span>
      {children}
    </span>
  );
}

// Podium 3 besar: juara 1 di tengah dan paling tinggi. Hanya nickname yang tampil.
const PODIUM = [
  { index: 1, height: "h-[70px]", block: "bg-silver", ring: "border-silver", size: "size-[52px]" },
  { index: 0, height: "h-[100px]", block: "bg-linear-to-b from-sun to-primary", ring: "border-sun", size: "size-[64px]" },
  { index: 2, height: "h-[54px]", block: "bg-bronze", ring: "border-bronze", size: "size-[52px]" },
];

function Podium({ rows }: { rows: LeaderRow[] }) {
  return (
    <ol className="mt-3 grid grid-cols-[1fr_1.15fr_1fr] items-end gap-2.5">
      {PODIUM.map(({ index, height, block, ring, size }) => {
        const row = rows[index];
        if (!row) return <li key={index} />;
        return (
          <li key={index} className="flex min-w-0 flex-col items-center gap-0.5 text-center">
            {index === 0 && <Icon name="crown" size={26} weight="fill" className="text-sun" />}
            <span className={`flex ${size} items-center justify-center rounded-full border-[3px] ${ring} bg-surface-2 font-display text-[17px] font-bold uppercase`}>
              {row.nickname.slice(0, 2)}
            </span>
            <span className="w-full truncate text-[14px] font-bold">
              {row.nickname}
              {row.is_me ? " (kamu)" : ""}
            </span>
            <span className="text-[12px] text-fg-soft">{row.xp.toLocaleString("id-ID")} Jejak</span>
            <span className={`mt-1.5 grid w-full ${height} place-items-center rounded-t-[18px] rounded-b-lg font-display text-[26px] font-extrabold text-white ${block}`}>
              <span className="sr-only">Peringkat </span>
              {row.rank}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
