import { UserAvatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { cardClass } from "@/components/styles";
import { levelFor, type LevelRow } from "@/lib/gamification/level";

// Tampilan beranda warga (tanpa pengambilan data), mengikuti artboard "Warga · Beranda".
export function HomeView({
  nickname,
  villageName,
  totalXp,
  levels,
  greeting,
  unread,
}: {
  nickname: string;
  villageName?: string;
  totalXp: number;
  levels: LevelRow[];
  greeting: string;
  unread: number;
}) {
  const level = levelFor(totalXp, levels);
  const currentMin = levels.find((row) => row.level === level.level)?.min_xp ?? 0;
  const progress =
    level.nextMinXp === null ? 100 : Math.round(((totalXp - currentMin) / (level.nextMinXp - currentMin)) * 100);
  const nextName = levels.find((row) => row.min_xp === level.nextMinXp)?.name;

  return (
    <>
      <header className="flex items-center gap-3">
        <UserAvatar nickname={nickname} />
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-fg-soft">{greeting}</span>
          <span className="font-display text-[19px] font-semibold">{nickname}</span>
        </div>
        <a
          href="/notifikasi"
          aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
          className="relative flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg"
        >
          <Icon name="bell" />
          {unread > 0 && (
            <span className="absolute right-2.5 top-2.5 size-[9px] rounded-full border-2 border-surface bg-hot" />
          )}
        </a>
      </header>

      <section
        aria-label="Level dan XP"
        className="flex flex-col gap-4 rounded-3xl bg-linear-135 from-hero-from to-hero-to p-5 text-[#F3F4FA]"
      >
        <div className="flex flex-col gap-1">
          <span className="text-[13px] text-on-hero">
            Level {level.level} · {level.name}
          </span>
          <span className="font-display text-[34px] font-bold leading-none tabular-nums">
            {totalXp.toLocaleString("id-ID")} <span className="text-[18px] font-semibold">XP</span>
          </span>
        </div>
        <div className="flex flex-col gap-2">
          <div className="h-2 overflow-hidden rounded-lg bg-[#0D1024]/45">
            <div className="h-full rounded-lg bg-xp" style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
          <div className="flex justify-between text-[12px] text-on-hero">
            <span>
              {level.nextMinXp === null
                ? "Kamu sudah di level tertinggi."
                : `${(level.nextMinXp - totalXp).toLocaleString("id-ID")} XP lagi ke ${nextName}`}
            </span>
            <span>{villageName ? `Kel. ${villageName}` : "Luar Cimahi"}</span>
          </div>
        </div>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="font-display text-[19px] font-semibold">Aktivitasku</h2>
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="text-[15px] font-semibold">Belum ada aktivitas</span>
          <span className="text-[13px] leading-[1.5] text-fg-soft">
            Event dan challenge dari UMKM dan komunitas
            {villageName ? ` di ${villageName}` : " di Cimahi"} segera hadir di sini.
          </span>
        </div>
      </section>
    </>
  );
}
