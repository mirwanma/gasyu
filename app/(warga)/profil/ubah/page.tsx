import { Suspense } from "react";
import { AvatarForm } from "./avatar-form";
import { ProfileForm, RegionForm } from "./forms";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, backLinkClass } from "@/components/styles";
import { getDistrictInfo, listCityChoices } from "@/lib/data/regions";
import { getCurrentUser } from "@/lib/data/user";
import { formatDate } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Ubah profil warga: nama panggilan, nama lengkap, kota dan kecamatan; tautan hapus akun.
export default function UbahProfilPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" className={backLinkClass}>
            <Icon name="back" stroke={2} />
            Kembali
          </a>
          <h1 className="font-display text-[26px] font-bold">Ubah profil</h1>
        </div>
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
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
  const [{ data: profile }, { data: setting }, cities, region] = await Promise.all([
    supabase.from("profiles").select("home_district_changed_at").eq("id", user.id).maybeSingle(),
    supabase.from("app_settings").select("value").eq("key", "profile.district_change_days").maybeSingle(),
    listCityChoices(),
    getDistrictInfo(user.homeDistrictId),
  ]);
  const days = Number(setting?.value ?? 90);
  const changedAt = profile?.home_district_changed_at ? new Date(profile.home_district_changed_at as string) : null;
  // Akun lama yang belum punya kecamatan boleh langsung mengisinya.
  const unlock = changedAt && region ? new Date(changedAt.getTime() + days * 24 * 60 * 60 * 1000) : null;
  const lockedUntil = unlock && unlock > new Date() ? formatDate(unlock) : null;

  return (
    <>
      <AvatarForm nickname={user.nickname} avatarUrl={user.avatarUrl} />
      <ProfileForm nickname={user.nickname} fullName={user.fullName ?? ""} />
      <RegionForm
        cities={cities}
        current={region ? { label: `${region.districtName}, ${region.cityName}`, cityId: region.cityId, districtId: region.districtId } : null}
        lockedUntil={lockedUntil}
        days={days}
      />
      <a href="/profil/hapus" className={`${cardClass} flex items-center justify-between p-4 text-[15px] font-semibold text-danger`}>
        Hapus akun
        <Icon name="chevron" size={16} stroke={2} />
      </a>
    </>
  );
}
