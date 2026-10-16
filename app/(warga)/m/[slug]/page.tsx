import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { OrganizerAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass } from "@/components/styles";
import { categoryLabel } from "@/lib/data/organizers";
import { createClient } from "@/lib/supabase/server";

// Profil publik merchant: /m/<slug>.
export default function MerchantPublikPage({ params }: PageProps<"/m/[slug]">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-32">
        <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
          <MerchantProfile params={params} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="" />
    </>
  );
}

async function MerchantProfile({ params }: Pick<PageProps<"/m/[slug]">, "params">) {
  const { slug } = await params;
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizers")
    .select("id, name, logo_url, description, status, profile:merchant_profiles(merchant_category), outlets:merchant_outlets(id, name, address, lat, lng, is_active, village:regions(name))")
    .eq("slug", slug)
    .eq("type", "merchant")
    .maybeSingle();
  if (!org) notFound();

  const profile = (Array.isArray(org.profile) ? org.profile[0] : org.profile) as { merchant_category: string } | null;
  const outlets = ((org.outlets ?? []) as {
    id: string;
    name: string;
    address: string;
    lat: number;
    lng: number;
    is_active: boolean;
    village: { name: string } | { name: string }[] | null;
  }[]).filter((o) => o.is_active);

  return (
    <>
      <div className="h-[150px] bg-linear-140 from-[#3B2F8F] to-[#1F6F8B] p-5">
        <Link
          href="/"
          aria-label="Kembali"
          className="flex size-11 items-center justify-center rounded-full bg-[#0D1024]/60 text-[#F3F4FA]"
        >
          <Icon name="back" stroke={2} />
        </Link>
      </div>
      <div className="-mt-10 flex flex-col gap-[18px] px-5">
        <div className="w-fit rounded-3xl border-4 border-bg">
          <OrganizerAvatar name={org.name} type="merchant" logoUrl={org.logo_url} size={72} radius={20} />
        </div>
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <h1 className="font-display text-[24px] font-bold">{org.name}</h1>
            {org.status === "approved" && (
              <span className="text-xp" role="img" aria-label="Terverifikasi">
                <Icon name="shield" stroke={2} />
              </span>
            )}
          </div>
          <span className="text-[13px] text-fg-soft">
            {profile ? categoryLabel(profile.merchant_category) : ""} · {outlets.length} outlet
          </span>
          {org.description && <p className="text-[14px] leading-[1.55] text-fg-label">{org.description}</p>}
        </div>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-[19px] font-semibold">Outlet</h2>
          {outlets.map((outlet) => {
            const village = Array.isArray(outlet.village) ? outlet.village[0] : outlet.village;
            return (
              <div key={outlet.id} className={`${cardClass} flex items-start gap-3 p-4`}>
                <span className="mt-0.5 text-hot">
                  <Icon name="pin" />
                </span>
                <div className="flex flex-col gap-0.5">
                  <span className="text-[14px] font-semibold">{outlet.name}</span>
                  <span className="text-[13px] text-fg-soft">
                    {outlet.address}
                    {village ? ` · Kel. ${village.name}` : ""}
                  </span>
                  <a
                    href={`https://www.openstreetmap.org/?mlat=${outlet.lat}&mlon=${outlet.lng}#map=17/${outlet.lat}/${outlet.lng}`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[12px] font-semibold text-link"
                  >
                    Lihat di peta
                  </a>
                </div>
              </div>
            );
          })}
        </section>

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-[19px] font-semibold">Aktivitas</h2>
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada aktivitas yang terbit.</p>
        </section>
      </div>
    </>
  );
}
