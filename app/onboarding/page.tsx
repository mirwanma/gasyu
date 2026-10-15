import { Suspense } from "react";
import { OnboardingForm, type DistrictOption } from "./onboarding-form";
import { Wordmark } from "@/components/ui";
import { createClient } from "@/lib/supabase/server";
import { safeNext } from "@/lib/safe-next";

export default function OnboardingPage({ searchParams }: PageProps<"/onboarding">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-8 px-4 py-12">
      <div className="flex flex-col gap-2">
        <Wordmark />
        <h1 className="text-[24px] font-extrabold leading-[30px]">Kenalan dulu, yuk</h1>
      </div>
      <Suspense fallback={<p className="text-[13px] text-ink-soft">Memuat…</p>}>
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
  const profileXp = Number(xpSetting?.value ?? 0);

  const districts: DistrictOption[] = (regions ?? [])
    .filter((region) => region.level === "district")
    .map((district) => ({
      id: district.id,
      name: district.name,
      villages: (regions ?? [])
        .filter((region) => region.parent_id === district.id)
        .map(({ id, name }) => ({ id, name })),
    }));

  return (
    <>
      <p className="-mt-6 text-[15px] leading-[22px] text-ink-soft">
        Lengkapi profil kamu
        {profileXp > 0 && (
          <>
            {" "}dan langsung dapat{" "}
            <span className="font-semibold text-warga">{profileXp} XP</span>
          </>
        )}
        .
      </p>
      <OnboardingForm next={next} districts={districts} />
    </>
  );
}
