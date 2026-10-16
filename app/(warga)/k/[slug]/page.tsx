import { Suspense } from "react";
import { notFound } from "next/navigation";
import { JoinForm } from "./join-form";
import { OrganizerAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import { categoryLabel } from "@/lib/data/organizers";
import { getCurrentUser } from "@/lib/data/user";
import { createClient } from "@/lib/supabase/server";

// Profil publik komunitas: /k/<slug>. Mengikuti artboard "Warga · Profil komunitas & gabung".
export default function KomunitasPublikPage({ params, searchParams }: PageProps<"/k/[slug]">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-32">
        <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
          <CommunityProfile params={params} searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="" />
    </>
  );
}

async function CommunityProfile({ params, searchParams }: PageProps<"/k/[slug]">) {
  const { slug } = await params;
  const { pesan } = await searchParams;
  const user = await getCurrentUser();
  const supabase = await createClient();

  const { data: org } = await supabase
    .from("organizers")
    .select("id, name, logo_url, description, status, village:regions(name), profile:community_profiles(interest_category, join_policy, basecamp_address, social_links)")
    .eq("slug", slug)
    .eq("type", "community")
    .maybeSingle();
  if (!org) notFound();

  const profile = (Array.isArray(org.profile) ? org.profile[0] : org.profile) as {
    interest_category: string;
    join_policy: "open" | "approval";
    basecamp_address: string | null;
    social_links: Record<string, string>;
  } | null;
  const village = (Array.isArray(org.village) ? org.village[0] : org.village) as { name: string } | null;

  const [{ data: stats }, { data: membership }] = await Promise.all([
    supabase.rpc("community_public_stats", { p_community_id: org.id }).maybeSingle(),
    user
      ? supabase
          .from("community_memberships")
          .select("status")
          .eq("community_id", org.id)
          .eq("user_id", user.id)
          .in("status", ["active", "pending"])
          .maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  const activeMembers = Number((stats as { active_members?: number } | null)?.active_members ?? 0);
  const myStatus = (membership as { status?: string } | null)?.status;

  return (
    <>
      <div className="h-[150px] bg-linear-140 from-[#7A2554] to-[#3B2F8F] p-5">
        <a
          href="/profil"
          aria-label="Kembali"
          className="flex size-11 items-center justify-center rounded-full bg-[#0D1024]/60 text-[#F3F4FA]"
        >
          <Icon name="back" stroke={2} />
        </a>
      </div>
      <div className="-mt-10 flex flex-col gap-[18px] px-5">
        <div className="w-fit rounded-3xl border-4 border-bg">
          <OrganizerAvatar name={org.name} type="community" logoUrl={org.logo_url} size={72} radius={20} />
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
            {profile ? categoryLabel(profile.interest_category) : ""}
            {village ? ` · ${village.name}` : ""}
            {profile?.basecamp_address ? ` · basecamp ${profile.basecamp_address}` : ""}
          </span>
          {org.description && <p className="text-[14px] leading-[1.55] text-fg-label">{org.description}</p>}
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          <Stat value={activeMembers.toLocaleString("id-ID")} label="member aktif" />
          <Stat value="0" label="aktivitas" />
          <Stat value="–" label="skor hadir" />
        </div>

        {myStatus === "active" ? (
          <section className={`${cardClass} flex flex-col gap-2 p-4`}>
            <span className="text-[15px] font-semibold">Kamu member komunitas ini</span>
            <span className="text-[13px] text-fg-soft">Aktivitas khusus member akan muncul di sini.</span>
          </section>
        ) : myStatus === "pending" ? (
          <section className={`${cardClass} flex flex-col gap-2 p-4`}>
            <div className="flex items-center justify-between">
              <span className="text-[15px] font-semibold">Permintaan terkirim</span>
              <span className={`${tagClass.base} ${tagClass.warn}`}>Menunggu</span>
            </div>
            <span className="text-[13px] text-fg-soft">Pengurus akan meninjau permintaanmu. Tidak dijawab 30 hari = otomatis ditolak.</span>
          </section>
        ) : (
          <JoinForm communityId={org.id} slug={slug} policy={profile?.join_policy ?? "approval"} defaultMessage={typeof pesan === "string" ? pesan : ""} />
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-[19px] font-semibold">Aktivitas</h2>
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada aktivitas yang terbit.</p>
        </section>
      </div>
    </>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className={`${cardClass} flex flex-col gap-0.5 rounded-2xl p-3`}>
      <span className="font-display text-[20px] font-semibold">{value}</span>
      <span className="text-[11px] text-fg-soft">{label}</span>
    </div>
  );
}
