// Label master misi yang aman dipakai di server maupun client.
import type { MissionVerification } from "@/lib/missions";

export type MissionCategory = "visit" | "purchase" | "social" | "sport" | "environment" | "learning" | "community" | "other";

export const MISSION_CATEGORIES: [MissionCategory, string][] = [
  ["visit", "Kunjungan"],
  ["purchase", "Belanja"],
  ["social", "Media sosial"],
  ["sport", "Olahraga"],
  ["environment", "Lingkungan"],
  ["learning", "Edukasi"],
  ["community", "Komunitas"],
  ["other", "Lainnya"],
];

export const CATEGORY_LABELS = Object.fromEntries(MISSION_CATEGORIES) as Record<MissionCategory, string>;

export type MissionTemplate = {
  id: string;
  title: string;
  description: string | null;
  organizer_tips: string | null;
  category: MissionCategory;
  verification: MissionVerification;
  xp_reward: number;
  is_required: boolean;
  activity_type: "event" | "challenge" | null;
  organizer_type: "merchant" | "community" | null;
  is_active: boolean;
  sort_order: number;
  updated_at: string;
};

export function audienceLabel(t: Pick<MissionTemplate, "activity_type" | "organizer_type">) {
  const act = t.activity_type === "event" ? "Event" : t.activity_type === "challenge" ? "Challenge" : "Event & challenge";
  const org = t.organizer_type === "merchant" ? "merchant" : t.organizer_type === "community" ? "komunitas" : "semua penyelenggara";
  return `${act} · ${org}`;
}
