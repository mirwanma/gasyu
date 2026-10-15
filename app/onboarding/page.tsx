import { Suspense } from "react";
import { OnboardingForm, type DistrictOption } from "./onboarding-form";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-7">
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <OnboardingContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OnboardingContent({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();

  const [{ data: regions }, { data: xpSetting }] = await Promise.all([
    supabase
      .from("regions")
      .select("id, name, level, parent_id")
      .eq("is_active", true)
      .in("level", ["district", "village"])
      .order("name"),
    supabase.from("app_settings").select("value").eq("key", "xp.profile_complete").maybeSingle(),
  ]);

  const districts: DistrictOption[] = (regions ?? [])
    .filter((region) => region.level === "district")
    .map((district) => ({
      id: district.id,
      name: district.name,
      villages: (regions ?? [])
        .filter((region) => region.parent_id === district.id)
        .map(({ id, name }) => ({ id, name })),
    }));

  return <OnboardingForm next={next} districts={districts} profileXp={Number(xpSetting?.value ?? 0)} />;
}
