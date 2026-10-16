import type { IconName } from "@/components/icons";

// Tampilan badge (ikon dan warna). Aturan pemberian tetap di tabel `badges.rule` (database).
export const BADGE_META: Record<string, { icon: IconName; color: string }> = {
  first_step: { icon: "check", color: "text-success" },
  village_explorer: { icon: "pin", color: "text-info" },
  regular: { icon: "store", color: "text-warn" },
  collaborator: { icon: "link", color: "text-hot" },
  consistent: { icon: "calendar", color: "text-xp" },
  one_team: { icon: "users", color: "text-xp" },
};

export function badgeMeta(code: string) {
  return BADGE_META[code] ?? { icon: "check" as IconName, color: "text-fg-soft" };
}
