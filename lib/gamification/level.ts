// Helper tampilan level. Aturan level tetap di tabel `levels` (database).

export type LevelRow = { level: number; name: string; min_xp: number };

export type LevelInfo = {
  level: number;
  name: string;
  nextMinXp: number | null; // null = sudah level tertinggi
};

export function levelFor(totalXp: number, levels: LevelRow[]): LevelInfo {
  const sorted = [...levels].sort((a, b) => a.min_xp - b.min_xp);
  let current = sorted[0] ?? { level: 1, name: "Warga Baru", min_xp: 0 };
  for (const row of sorted) {
    if (totalXp >= row.min_xp) current = row;
  }
  const next = sorted.find((row) => row.min_xp > totalXp);
  return { level: current.level, name: current.name, nextMinXp: next?.min_xp ?? null };
}
