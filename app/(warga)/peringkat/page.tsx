import { Suspense } from "react";
import { UserAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass } from "@/components/styles";
import { getUserLeaderboard, getVillageLeaderboard, listMonthlyWinners, type LeaderRow } from "@/lib/data/leaderboard";
import { getCurrentUser } from "@/lib/data/user";
import { formatMonthYear } from "@/lib/format";

// Peringkat bulanan, mengikuti artboard "Warga · Peringkat": tab kelurahan saya,
// se-Cimahi, dan peringkat kelurahan. Hanya nickname warga lain yang tampil.
export default function PeringkatPage({ searchParams }: PageProps<"/peringkat">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
          <Board searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}

const RING = ["border-sun", "border-silver", "border-bronze"];
const BLOCK = ["bg-linear-to-b from-sun to-primary", "bg-silver", "bg-bronze"];
const RANK_COLOR = ["text-points", "text-fg-soft", "text-bronze"];

async function Board({ searchParams }: Pick<PageProps<"/peringkat">, "searchParams">) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (!user) return null;
  const tab = sp.tab === "kota" ? "kota" : sp.tab === "kelurahan" ? "kelurahan" : user.villageName ? "saya" : "kota";
  const [board, villages, winners] = await Promise.all([
    tab === "kelurahan" ? null : getUserLeaderboard(tab === "kota" ? "city" : "village"),
    getVillageLeaderboard(),
    listMonthlyWinners(3),
  ]);
  const month = formatMonthYear(new Date());
  const myVillage = villages?.rows.find((r) => r.is_mine) ?? null;
  const tabs = [
    ...(user.villageName ? [["saya", user.villageName]] : []),
    ["kota", "Se-Cimahi"],
    ["kelurahan", "Kelurahan"],
  ] as const;

  return (
    <>
      <div className="flex items-center justify-between">
        <h1 className="font-display text-[28px] font-bold">Peringkat</h1>
        <span className="text-[15px] text-fg-soft">{month}</span>
      </div>

      <div role="tablist" className={`grid gap-1.5 rounded-2xl border border-line bg-surface p-[5px] ${tabs.length === 3 ? "grid-cols-3" : "grid-cols-2"}`}>
        {tabs.map(([value, label]) => (
          <a key={value} role="tab" aria-selected={tab === value} href={`/peringkat?tab=${value}`} className={`flex h-10 items-center justify-center truncate rounded-xl px-2 text-[15px] font-semibold ${tab === value ? "bg-fg text-bg" : "text-fg-label"}`}>
            {label}
          </a>
        ))}
      </div>

      {tab === "kelurahan" ? (
        <VillageBoard rows={villages?.rows ?? []} minActive={villages?.min_active_citizens ?? 10} />
      ) : (
        <UserBoard rows={board?.rows ?? []} me={board?.me ?? null} total={board?.total ?? 0} scopeLabel={tab === "kota" ? "se-Cimahi" : `di ${user.villageName}`} />
      )}

      {tab !== "kelurahan" && (
        <a href="/peringkat?tab=kelurahan" className={`${cardClass} flex flex-col gap-1.5 p-4 text-fg`}>
          <span className="text-[13px] text-fg-soft">Kelurahan teraktif bulan ini</span>
          {myVillage ? (
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[18px] font-semibold">
                {myVillage.rank ? `#${myVillage.rank} ` : ""}
                {myVillage.name}
              </span>
              <span className="text-[15px] text-fg-soft">{myVillage.active_citizens} warga aktif</span>
            </div>
          ) : villages?.rows[0] ? (
            <div className="flex items-baseline justify-between">
              <span className="font-display text-[18px] font-semibold">#1 {villages.rows[0].name}</span>
              <span className="text-[15px] text-fg-soft">{villages.rows[0].active_citizens} warga aktif</span>
            </div>
          ) : (
            <span className="font-display text-[18px] font-semibold">Belum ada</span>
          )}
          <span className="text-[13px] text-fg-muted">Rata-rata XP per warga aktif · minimal {villages?.min_active_citizens ?? 10} warga untuk masuk peringkat</span>
        </a>
      )}

      {winners.length > 0 && (
        <section className={`${cardClass} flex flex-col gap-2 p-4`}>
          <span className="text-[13px] text-fg-soft">Juara {formatMonthYear(winners[0].month)}</span>
          {winners.map((w) => (
            <div key={`${w.month}-${w.rank}`} className="flex items-center justify-between text-[15px]">
              <span className="font-semibold">
                <span className={`mr-2 font-display ${RANK_COLOR[w.rank - 1] ?? "text-fg-soft"}`}>{w.rank}</span>
                {w.village?.name}
              </span>
              <span className="text-[13px] text-fg-soft">
                {Math.round(Number(w.avg_xp)).toLocaleString("id-ID")} XP · {w.active_citizens} warga
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}

function UserBoard({ rows, me, total, scopeLabel }: { rows: LeaderRow[]; me: { rank: number; xp: number } | null; total: number; scopeLabel: string }) {
  if (rows.length === 0) {
    return <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>Belum ada XP bulan ini {scopeLabel}. Check-in di aktivitas untuk masuk peringkat.</p>;
  }
  const top = rows.slice(0, 3);
  const podium = [top[1], top[0], top[2]].filter(Boolean) as LeaderRow[];
  const rest = rows.slice(3);
  const meInList = rows.some((r) => r.is_me);
  return (
    <>
      <div className={`grid items-end gap-2.5 pt-3 ${podium.length === 3 ? "grid-cols-3" : podium.length === 2 ? "grid-cols-2" : "grid-cols-1"}`}>
        {podium.map((p) => {
          const i = p.rank - 1;
          const first = p.rank === 1;
          return (
            <div key={p.nickname} className="flex flex-col items-center gap-2">
              {first && <Icon name="crown" size={28} weight="fill" className="-mb-1 text-sun" />}
              <div className={`flex items-center justify-center rounded-full border-[3px] bg-track ${RING[i] ?? "border-line"} ${first ? "size-[68px]" : "size-14"}`}>
                <UserAvatar nickname={p.nickname} size={first ? 60 : 48} />
              </div>
              <span className="max-w-full truncate text-[15px] font-semibold">
                {p.nickname}
                {p.is_me ? " (kamu)" : ""}
              </span>
              <span className="text-[13px] font-semibold text-xp">{p.xp.toLocaleString("id-ID")} XP</span>
              <div className={`flex w-full justify-center rounded-t-[18px] rounded-b-lg pt-2.5 font-display text-[28px] font-extrabold text-white ${BLOCK[i] ?? "bg-surface-2"} ${first ? "h-24" : p.rank === 2 ? "h-[70px]" : "h-14"}`}>
                {p.rank}
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex flex-col gap-2">
        {rest.map((r) => (
          <Row key={`${r.rank}-${r.nickname}`} row={r} />
        ))}
        {!meInList && me && (
          <>
            <div className="flex h-8 items-center justify-center text-[15px] text-fg-muted">… {total} warga</div>
            <Row row={{ rank: me.rank, nickname: "Kamu", xp: me.xp, village: null, is_me: true }} />
          </>
        )}
      </div>
    </>
  );
}

function Row({ row }: { row: LeaderRow }) {
  return (
    <div className={`flex h-[58px] items-center gap-3 rounded-2xl border px-3.5 ${row.is_me ? "border-primary-soft bg-primary-tint" : "border-line bg-surface"}`}>
      <span className="w-7 font-display text-[16px] font-semibold text-fg-soft">{row.rank}</span>
      <UserAvatar nickname={row.nickname} size={36} />
      <span className="flex-1 truncate text-[15px] font-semibold">
        {row.nickname}
        {row.is_me && row.nickname !== "Kamu" ? " (kamu)" : ""}
      </span>
      <span className="text-[15px] font-semibold text-xp">{row.xp.toLocaleString("id-ID")} XP</span>
    </div>
  );
}

function VillageBoard({ rows, minActive }: { rows: { rank: number | null; village_id: string; name: string; district: string | null; avg_xp: number; active_citizens: number; is_mine: boolean; qualifies: boolean }[]; minActive: number }) {
  const ranked = rows.filter((r) => r.rank !== null);
  const others = rows.filter((r) => r.rank === null);
  return (
    <>
      {ranked.length === 0 && <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>Belum ada kelurahan dengan minimal {minActive} warga aktif bulan ini.</p>}
      <div className="flex flex-col gap-2">
        {ranked.map((r) => (
          <div key={r.village_id} className={`flex h-[58px] items-center gap-3 rounded-2xl border px-3.5 ${r.is_mine ? "border-primary-soft bg-primary-tint" : "border-line bg-surface"}`}>
            <span className={`w-7 font-display text-[16px] font-semibold ${RANK_COLOR[(r.rank ?? 1) - 1] ?? "text-fg-soft"}`}>{r.rank}</span>
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-semibold">
                {r.name}
                {r.is_mine ? " (kelurahanku)" : ""}
              </span>
              <span className="text-[12px] text-fg-soft">
                {r.district ? `Kec. ${r.district} · ` : ""}
                {r.active_citizens} warga aktif
              </span>
            </span>
            <span className="text-[15px] font-semibold text-xp">{Math.round(Number(r.avg_xp)).toLocaleString("id-ID")} XP</span>
          </div>
        ))}
      </div>
      {others.length > 0 && (
        <details className="text-[15px] text-fg-soft">
          <summary className="cursor-pointer font-semibold">Belum masuk peringkat (kurang dari {minActive} warga aktif) · {others.length}</summary>
          <div className="mt-2 flex flex-col gap-1">
            {others.map((r) => (
              <div key={r.village_id} className="flex justify-between">
                <span>
                  {r.name}
                  {r.is_mine ? " (kelurahanku)" : ""}
                </span>
                <span>{r.active_citizens} warga aktif</span>
              </div>
            ))}
          </div>
        </details>
      )}
      <span className="text-[13px] text-fg-muted">Rata-rata XP per warga aktif bulan ini. XP dicatat ke kelurahan saat diberikan, jadi pindah kelurahan tidak memindahkan XP lama.</span>
    </>
  );
}
