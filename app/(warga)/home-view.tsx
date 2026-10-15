import { signOut } from "./actions";
import { cardClass } from "@/components/styles";
import { levelFor, type LevelRow } from "@/lib/gamification/level";

// Tampilan beranda warga (tanpa pengambilan data), mengikuti artboard "Warga · Beranda".
export function HomeView({
  nickname,
  villageName,
  totalXp,
  levels,
  greeting,
}: {
  nickname: string;
  villageName?: string;
  totalXp: number;
  levels: LevelRow[];
  greeting: string;
}) {
  const level = levelFor(totalXp, levels);
  const currentMin = levels.find((row) => row.level === level.level)?.min_xp ?? 0;
  const progress =
    level.nextMinXp === null ? 100 : Math.round(((totalXp - currentMin) / (level.nextMinXp - currentMin)) * 100);
  const nextName = levels.find((row) => row.min_xp === level.nextMinXp)?.name;

  return (
    <>
      <header className="flex items-center gap-3">
        <div className="flex size-12 items-center justify-center rounded-full border-2 border-avatar-ring bg-avatar font-display text-[17px] font-semibold uppercase">
          {nickname.slice(0, 2)}
        </div>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="text-[13px] text-fg-soft">{greeting}</span>
          <span className="font-display text-[19px] font-semibold">{nickname}</span>
        </div>
        <span className="text-[12px] font-semibold text-fg-soft">
          {villageName ? `Kel. ${villageName}` : "Luar Cimahi"}
        </span>
      </header>

      <section
        aria-label="Level dan XP"
        className="flex flex-col gap-4 rounded-3xl bg-linear-135 from-hero-from to-hero-to p-5"
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
          <div className="h-2 overflow-hidden rounded-lg bg-bg/45">
            <div className="h-full rounded-lg bg-xp" style={{ width: `${Math.max(progress, 2)}%` }} />
          </div>
          <span className="text-[12px] text-on-hero">
            {level.nextMinXp === null
              ? "Kamu sudah di level tertinggi."
              : `${(level.nextMinXp - totalXp).toLocaleString("id-ID")} XP lagi ke ${nextName}`}
          </span>
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

      <form action={signOut} className="mt-4 flex justify-center">
        <button type="submit" className="min-h-11 px-4 text-[13px] font-semibold text-fg-muted">
          Keluar dari akun
        </button>
      </form>
    </>
  );
}
