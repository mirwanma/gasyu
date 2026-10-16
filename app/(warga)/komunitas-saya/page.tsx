import { Suspense } from "react";
import { OrganizerAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import { listCommunities, type CommunityCard } from "@/lib/data/communities";
import { categoryLabel } from "@/lib/data/organizers";
import { getCurrentUser } from "@/lib/data/user";

// Komunitas saya: komunitas yang diikuti warga dan daftar komunitas lain untuk dijelajahi.
export default function KomunitasSayaPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
            <Icon name="back" stroke={2} />
          </a>
          <h1 className="font-display text-[24px] font-bold">Komunitas saya</h1>
        </div>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Content />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="" />
    </>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) return null;
  const communities = await listCommunities(user.id);
  const mine = communities.filter((c) => c.membershipStatus !== null);
  const others = communities.filter((c) => c.membershipStatus === null);

  return (
    <>
      <section className="flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-fg-label">Diikuti ({mine.length})</span>
        {mine.length === 0 ? (
          <p className={`${cardClass} p-4 text-[13px] leading-[1.5] text-fg-soft`}>
            Kamu belum bergabung ke komunitas mana pun. Member komunitas bisa ikut aktivitas khusus member dan dapat kabar aktivitas baru.
          </p>
        ) : (
          mine.map((c) => <CommunityRow key={c.id} c={c} />)
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <span className="text-[13px] font-bold text-fg-label">Temukan komunitas</span>
        {others.length === 0 ? (
          <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada komunitas lain yang terverifikasi.</p>
        ) : (
          others.map((c) => <CommunityRow key={c.id} c={c} />)
        )}
      </section>
    </>
  );
}

function CommunityRow({ c }: { c: CommunityCard }) {
  return (
    <a href={`/k/${c.slug}`} className={`${cardClass} flex items-center gap-3 p-3 text-fg`}>
      <OrganizerAvatar name={c.name} type="community" logoUrl={c.logoUrl} size={44} />
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold">{c.name}</span>
        <span className="text-[12px] text-fg-soft">
          {categoryLabel(c.category)}
          {c.villageName ? ` · ${c.villageName}` : ""}
          {c.membershipStatus === null && (c.joinPolicy === "open" ? " · gabung langsung" : " · perlu persetujuan")}
        </span>
      </span>
      {c.membershipStatus === "active" && <span className={`${tagClass.base} ${tagClass.success}`}>Member</span>}
      {c.membershipStatus === "pending" && <span className={`${tagClass.base} ${tagClass.warn}`}>Menunggu</span>}
      {c.membershipStatus === null && <Icon name="chevron" size={16} stroke={2} className="text-fg-muted" />}
    </a>
  );
}
