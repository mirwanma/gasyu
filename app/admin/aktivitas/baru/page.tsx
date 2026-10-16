import { Suspense } from "react";
import { ActivityForm, type ActivityFormValues } from "@/components/organizer/activity-form";
import { adminSaveActivity } from "@/lib/actions/activities";
import { getActivityCard } from "@/lib/data/activities";
import { getVillageOptions } from "@/lib/data/organizers";
import { createClient } from "@/lib/supabase/server";

// Admin membuat atau mengubah event/challenge atas nama Ramein.
export default function AdminAktivitasBaruPage({ searchParams }: PageProps<"/admin/aktivitas/baru">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Event Ramein</h1>
        <span className="text-[14px] text-fg-soft">Dibuat atas nama Ramein, langsung terbit saat diterbitkan tanpa antrean review. Tambahkan partner dan checkpoint setelah draft tersimpan.</span>
      </div>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <FormLoader searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function FormLoader({ searchParams }: Pick<PageProps<"/admin/aktivitas/baru">, "searchParams">) {
  const sp = await searchParams;
  const editId = typeof sp.ubah === "string" ? sp.ubah : undefined;
  const supabase = await createClient();
  const [districts, { data: city }, { data: platformId }, card] = await Promise.all([
    getVillageOptions(),
    supabase.from("regions").select("id").eq("level", "city").eq("is_active", true).limit(1).maybeSingle(),
    supabase.rpc("platform_organizer_id"),
    editId ? getActivityCard(editId) : Promise.resolve(null),
  ]);
  const initial: ActivityFormValues | undefined = card
    ? { id: card.id, type: card.type, difficulty: card.difficulty, target_scope: card.target_scope, target_kind: card.target_kind, target_count: card.target_count, join_mode: card.join_mode, group_min: card.group_min, group_max: card.group_max, goal: card.goal as ActivityFormValues["goal"], title: card.title, description: card.description ?? "", scope_region_id: card.scope_region_id, starts_at: card.starts_at, ends_at: card.ends_at, quota: card.quota, residency_rule: card.residency_rule, audience: card.audience }
    : undefined;
  return (
    <div className="max-w-md">
      <ActivityForm organizerId={String(platformId ?? "")} type="merchant" cityId={(city?.id as string | undefined) ?? null} districts={districts} initial={initial} action={adminSaveActivity} />
    </div>
  );
}
