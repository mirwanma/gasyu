import { Suspense } from "react";
import { signOut } from "../actions";
import { OrganizerAvatar, UserAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { SignOutEverywhere } from "@/components/sign-out-everywhere";
import { ThemePicker } from "@/components/theme-picker";
import { Icon } from "@/components/icons";
import { cardClass } from "@/components/styles";
import { getMyOrganizers, ROLE_LABELS, STATUS_LABELS, TYPE_LABELS } from "@/lib/data/organizers";
import { getCurrentUser } from "@/lib/data/user";
import { badgeMeta } from "@/lib/gamification/badges";
import { levelFor } from "@/lib/gamification/level";
import { listBadges, listUserBadges } from "@/lib/data/leaderboard";
import { createClient } from "@/lib/supabase/server";

export default function ProfilPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
          <ProfileContent />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}

async function ProfileContent() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();

  const [{ data: xpRows }, { data: levels }, organizers, { data: memberships }, badges, userBadges] = await Promise.all([
    supabase.from("xp_ledger").select("amount").eq("user_id", user.id),
    supabase.from("levels").select("level, name, min_xp"),
    getMyOrganizers(user.id),
    supabase
      .from("community_memberships")
      .select("status, community:organizers(name, slug)")
      .eq("user_id", user.id)
      .in("status", ["active", "pending"]),
    listBadges(),
    listUserBadges(user.id),
  ]);

  const totalXp = (xpRows ?? []).reduce((sum, row) => sum + row.amount, 0);
  const earned = new Set(userBadges.map((b) => b.badge_id));
  const level = levelFor(totalXp, levels ?? []);
  const communities = (memberships ?? [])
    .map((row) => ({
      status: row.status as string,
      community: row.community as unknown as { name: string; slug: string } | null,
    }))
    .filter((row) => row.community);

  return (
    <>
      <div className="flex items-center gap-3.5">
        <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={68} />
        <div className="flex flex-col gap-[3px]">
          <span className="font-display text-[24px] font-bold">{user.nickname}</span>
          <span className="text-[15px] text-fg-soft">{user.regionLabel ?? "Wilayah belum diisi"}</span>
          <span className="text-[13px] font-semibold text-xp">
            Level {level.level} · {level.name} · {totalXp.toLocaleString("id-ID")} Jejak
          </span>
        </div>
      </div>

      <section className={`${cardClass} flex flex-col gap-2.5 p-4`}>
        <span className="text-[13px] font-bold tracking-[0.05em] text-fg-muted">GUNAKAN SEBAGAI</span>

        <div className="flex min-h-14 items-center gap-3 rounded-[14px] border border-avatar-ring bg-primary-tint px-3 py-2">
          <UserAvatar nickname={user.nickname} avatarUrl={user.avatarUrl} size={40} />
          <span className="flex flex-1 flex-col gap-0.5">
            <span className="text-[15px] font-semibold">Warga</span>
            <span className="text-[13px] text-fg-soft">Akun pribadi</span>
          </span>
          <span className="text-[13px] font-semibold text-success">Aktif</span>
        </div>

        {organizers.map((org) => {
          const href = `/${org.type === "merchant" ? "merchant" : "komunitas"}/${org.id}`;
          return (
            <a
              key={org.id}
              href={href}
              className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line bg-bg px-3 py-2 text-fg"
            >
              <OrganizerAvatar name={org.name} type={org.type} logoUrl={org.logoUrl} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{org.name}</span>
                <span className="text-[13px] text-fg-soft">
                  {TYPE_LABELS[org.type]} · {ROLE_LABELS[org.role]}
                  {org.status !== "approved" && ` · ${STATUS_LABELS[org.status].toLowerCase()}`}
                </span>
              </span>
              <span className="text-[13px] font-semibold text-link">Buka</span>
            </a>
          );
        })}

        {user.isAdmin && (
          <a
            href="/admin"
            className="flex min-h-14 items-center gap-3 rounded-[14px] border border-line bg-bg px-3 py-2 text-fg"
          >
            <span className="flex size-10 items-center justify-center rounded-xl bg-accent-warga text-warga">
              <Icon name="shield" />
            </span>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[15px] font-semibold">Gasyu Admin</span>
              <span className="text-[13px] text-fg-soft">Dashboard admin (web)</span>
            </span>
            <span className="text-[13px] font-semibold text-link">Buka</span>
          </a>
        )}

        <a
          href="/daftar"
          className="flex h-12 items-center justify-center gap-2 rounded-[14px] border border-dashed border-line-strong text-[15px] font-semibold text-fg"
        >
          <Icon name="plus" size={18} stroke={2} />
          Daftarkan merchant atau komunitas
        </a>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold text-fg-label">Badge</span>
          <span className="text-[13px] text-fg-soft">
            {earned.size} dari {badges.length}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          {badges.map((b) => {
            const meta = badgeMeta(b.code);
            const got = earned.has(b.id);
            return (
              <div key={b.id} title={b.description} className={`${cardClass} flex flex-col items-center gap-1.5 px-2 py-3 text-center ${got ? "" : "opacity-55"}`}>
                <span className={`flex size-10 items-center justify-center rounded-full bg-track ${got ? meta.color : "text-fg-muted"}`}>
                  <Icon name={meta.icon} size={18} stroke={2} />
                </span>
                <span className="text-[12px] font-semibold leading-[1.3]">{b.name}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <span className="text-[15px] font-bold text-fg-label">Member di</span>
          <a href="/komunitas-saya" className="text-[13px] font-semibold text-link">
            Komunitas saya
          </a>
        </div>
        {communities.length === 0 ? (
          <span className="text-[15px] text-fg-soft">Belum bergabung ke komunitas mana pun.</span>
        ) : (
          <div className="flex flex-wrap gap-2">
            {communities.map(({ community, status }) => (
              <a
                key={community!.slug}
                href={`/k/${community!.slug}`}
                className="flex h-9 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-[15px] font-semibold text-fg"
              >
                {community!.name}
                {status === "pending" && <span className="text-[12px] font-bold text-warn">menunggu</span>}
              </a>
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-2.5">
        <span className="flex items-center gap-1.5 text-[15px] font-bold text-fg-label">
          <Icon name="palette" size={18} weight="fill" className="text-primary" />
          Tema aplikasi
        </span>
        <ThemePicker />
      </section>

      <nav aria-label="Menu profil" className={`${cardClass} flex flex-col overflow-hidden`}>
        <a href="/profil/ubah" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Ubah profil
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/profil/kata-sandi" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Kata sandi
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/riwayat" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Riwayat Jejak & poin
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/notifikasi" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Notifikasi
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/grup" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Grup saya
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/komunitas-saya" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Komunitas saya
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/saran" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Saran saya
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/peringkat" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Peringkat
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <a href="/bantuan" className="flex h-[52px] items-center justify-between border-b border-line px-4 text-[15px] font-medium text-fg">
          Bantuan
          <Icon name="chevron" size={16} className="text-fg-muted" />
        </a>
        <form action={signOut}>
          <button type="submit" className="flex h-[52px] w-full items-center justify-between border-b border-line px-4 text-[15px] font-medium text-danger">
            Keluar dari akun
            <Icon name="logout" size={16} />
          </button>
        </form>
        <SignOutEverywhere />
      </nav>
    </>
  );
}
