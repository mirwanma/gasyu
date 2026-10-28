import { Suspense } from "react";
import { OnboardingForm } from "./onboarding-form";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";
import { listCityChoices } from "@/lib/data/regions";

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 py-7">
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <OnboardingContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}

async function OnboardingContent({ searchParams }: Pick<PageProps<"/onboarding">, "searchParams">) {
  const next = safeNext((await searchParams).next);
  const supabase = await createClient();

  const [cities, { data: xpSetting }] = await Promise.all([
    listCityChoices(),
    supabase.from("app_settings").select("value").eq("key", "xp.profile_complete").maybeSingle(),
  ]);

  return <OnboardingForm next={next} cities={cities} profileXp={Number(xpSetting?.value ?? 0)} />;
}
