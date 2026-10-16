import { Suspense } from "react";
import { ProfileForm, VillageForm } from "./forms";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass } from "@/components/styles";
import { getVillageOptions } from "@/lib/data/organizers";
import { getCurrentUser } from "@/lib/data/user";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Ubah profil warga: nama panggilan, nama lengkap, kelurahan asal; tautan hapus akun.
export default function UbahProfilPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
            <Icon name="back" stroke={2} />
          </a>
          <h1 className="font-display text-[24px] font-bold">Ubah profil</h1>
        </div>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Content />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const [{ data: profile }, { data: setting }, districts] = await Promise.all([
    supabase.from("profiles").select("home_village_changed_at").eq("id", user.id).maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "profile.village_change_days").maybeSingle(),
    getVillageOptions(),
  ]);
  const days = Number(setting?.value ?? 90);
  const changedAt = profile?.home_village_changed_at ? new Date(profile.home_village_changed_at as string) : null;
  const unlock = changedAt ? new Date(changedAt.getTime() + days * 24 * 60 * 60 * 1000) : null;
  const lockedUntil = unlock && unlock > new Date() ? formatDate(unlock) : null;

  return (
    <>
      <ProfileForm nickname={user.nickname} fullName={user.fullName ?? ""} />
      <VillageForm current={user.homeVillageId ?? "luar"} districts={districts} lockedUntil={lockedUntil} days={days} />
      <a href="/profil/hapus" className={`${cardClass} flex items-center justify-between p-4 text-[14px] font-semibold text-danger`}>
        Hapus akun
        <Icon name="chevron" size={16} stroke={2} />
      </a>
    </>
  );
}
