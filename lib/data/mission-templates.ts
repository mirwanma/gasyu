import "server-only";
import { createClient } from "@/lib/supabase/server";
import type { MissionTemplate } from "@/lib/mission-templates";

const COLUMNS = "id, title, description, organizer_tips, category, verification, xp_reward, is_required, activity_type, organizer_type, is_active, sort_order, updated_at";

// Template aktif yang cocok untuk aktivitas dan penyelenggara tertentu.
// organizerType "platform" (event Gasyu) melihat semua template.
export async function listTemplatesFor(opts: {
  activityType: "event" | "challenge";
  organizerType: "merchant" | "community" | "platform";
  qrOnly?: boolean;
}): Promise<MissionTemplate[]> {
  const supabase = await createClient();
  let query = supabase
    .from("mission_templates")
    .select(COLUMNS)
    .eq("is_active", true)
    .or(`activity_type.is.null,activity_type.eq.${opts.activityType}`)
    .order("category")
    .order("sort_order");
  if (opts.organizerType !== "platform") query = query.or(`organizer_type.is.null,organizer_type.eq.${opts.organizerType}`);
  if (opts.qrOnly) query = query.eq("verification", "qr_scan");
  const { data } = await query;
  return (data ?? []) as MissionTemplate[];
}

export async function getTemplate(id: string): Promise<MissionTemplate | null> {
  const supabase = await createClient();
  const { data } = await supabase.from("mission_templates").select(COLUMNS).eq("id", id).maybeSingle();
  return (data as MissionTemplate | null) ?? null;
}

export type TemplateStats = { missions: number; activities: number; completions: number; participant_slots: number; last_used_at: string | null };

// Semua template (aktif dan nonaktif) beserta statistik pemakaian. Khusus admin.
export async function listTemplatesWithStats(): Promise<(MissionTemplate & { stats: TemplateStats })[]> {
  const supabase = await createClient();
  const [{ data: templates }, { data: stats }] = await Promise.all([
    supabase.from("mission_templates").select(COLUMNS).order("is_active", { ascending: false }).order("category").order("sort_order"),
    supabase.from("v_mission_template_stats").select("template_id, missions, activities, completions, participant_slots, last_used_at"),
  ]);
  const byId = new Map((stats ?? []).map((s) => [s.template_id as string, s]));
  return ((templates ?? []) as MissionTemplate[]).map((t) => {
    const s = byId.get(t.id);
    return {
      ...t,
      stats: {
        missions: s?.missions ?? 0,
        activities: s?.activities ?? 0,
        completions: s?.completions ?? 0,
        participant_slots: s?.participant_slots ?? 0,
        last_used_at: s?.last_used_at ?? null,
      },
    };
  });
}
