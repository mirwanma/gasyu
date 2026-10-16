import { redirect } from "next/navigation";
import { OrganizerAvatar } from "@/components/avatar";
import { BottomNav, communityNav, merchantNav } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { getOrganizerForTeam, ROLE_LABELS, type MyOrganizer, type OrganizerType } from "@/lib/data/organizers";
import { getCurrentUser, getUnreadCount, type CurrentUser } from "@/lib/data/user";

export type OrganizerContext = { user: CurrentUser; org: MyOrganizer };

// Memastikan pengguna adalah tim organizer ini; jika bukan, kembali ke profil.
export async function requireOrganizer(organizerId: string, type: OrganizerType): Promise<OrganizerContext> {
  const user = await getCurrentUser();
  if (!user) redirect("/masuk");
  const org = await getOrganizerForTeam(organizerId, user.id, type);
  if (!org) redirect("/profil?akses=ditolak");
  return { user, org };
}

// Kerangka halaman mode penyelenggara: header pemilih mode, isi, navigasi bawah.
export async function OrganizerShell({
  organizerId,
  type,
  active,
  title,
  children,
}: {
  organizerId: string;
  type: "merchant" | "community";
  active: string;
  title?: string;
  children: (ctx: OrganizerContext) => React.ReactNode;
}) {
  const ctx = await requireOrganizer(organizerId, type);
  const unread = await getUnreadCount(ctx.user.id);
  const items = type === "merchant" ? merchantNav(organizerId) : communityNav(organizerId);

  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-5">
        <header className="flex items-center gap-2.5">
          <a
            href="/profil"
            className="flex h-[52px] flex-1 items-center gap-2.5 rounded-2xl border border-line bg-surface py-0 pl-1.5 pr-3 text-fg"
          >
            <OrganizerAvatar name={ctx.org.name} type={ctx.org.type} logoUrl={ctx.org.logoUrl} />
            <span className="flex flex-1 flex-col">
              <span className="text-[15px] font-bold">{ctx.org.name}</span>
              <span className="text-[12px] text-fg-soft">
                Mode {type === "merchant" ? "merchant" : "komunitas"} · {ROLE_LABELS[ctx.org.role]}
              </span>
            </span>
            <Icon name="chevronDown" size={18} stroke={2} className="text-fg-soft" />
          </a>
          <a
            href="/notifikasi"
            aria-label={unread > 0 ? `Notifikasi, ${unread} belum dibaca` : "Notifikasi"}
            className="relative flex size-[52px] items-center justify-center rounded-2xl border border-line bg-surface text-fg"
          >
            <Icon name="bell" />
            {unread > 0 && <span className="absolute right-3 top-3 size-[9px] rounded-full border-2 border-surface bg-hot" />}
          </a>
        </header>
        {title && <h1 className="font-display text-[24px] font-bold">{title}</h1>}
        {children(ctx)}
      </main>
      <BottomNav items={items} active={active} />
    </>
  );
}

export function StatusBanner({ org, base }: { org: MyOrganizer; base: string }) {
  if (org.status === "approved") return null;
  const copy = {
    pending: {
      title: "Menunggu verifikasi tim Gasyu",
      body: "Biasanya 1–2 hari kerja. Sementara itu kamu bisa melengkapi profil dan menyiapkan draft aktivitas.",
      tint: "bg-warn-tint text-warn",
    },
    rejected: {
      title: "Perlu perbaikan data",
      body: "Lihat catatan dari tim Gasyu di halaman profil, perbaiki, lalu ajukan ulang.",
      tint: "bg-danger-tint text-danger",
    },
    suspended: {
      title: "Akun penyelenggara dibekukan",
      body: "Hubungi tim Gasyu untuk informasi lebih lanjut.",
      tint: "bg-danger-tint text-danger",
    },
  }[org.status];
  return (
    <a href={`${base}/profil`} className={`flex flex-col gap-1 rounded-2xl px-4 py-3 ${copy.tint}`}>
      <span className="text-[14px] font-bold">{copy.title}</span>
      <span className="text-[12px] leading-[1.5] opacity-90">{copy.body}</span>
    </a>
  );
}

export function Kpi({ label, value, sub, cols = 2 }: { label: string; value: string; sub?: string; cols?: 2 | 3 }) {
  return (
    <div className={`flex flex-col gap-1 rounded-[18px] border border-line bg-surface ${cols === 3 ? "p-3" : "p-3.5"}`}>
      {cols === 3 ? (
        <>
          <span className="font-display text-[22px] font-semibold">{value}</span>
          <span className="text-[11px] text-fg-soft">{label}</span>
        </>
      ) : (
        <>
          <span className="text-[12px] text-fg-soft">{label}</span>
          <span className="font-display text-[26px] font-semibold">{value}</span>
          {sub && <span className="text-[11px] font-semibold text-fg-soft">{sub}</span>}
        </>
      )}
    </div>
  );
}

export function TodoItem({ n, title, sub, href, tone = "warn" }: { n: number; title: string; sub?: string; href: string; tone?: "warn" | "info" | "primary" }) {
  const tones = { warn: "bg-warn-tint text-warn", info: "bg-info-tint text-info", primary: "bg-primary-tint text-link" };
  return (
    <a href={href} className="flex items-center gap-3 rounded-2xl border border-line bg-surface px-3.5 py-3 text-fg">
      <span className={`flex h-9 min-w-9 items-center justify-center rounded-xl px-1.5 font-display text-[16px] font-bold ${tones[tone]}`}>{n}</span>
      <span className="flex flex-1 flex-col gap-0.5">
        <span className="text-[14px] font-semibold">{title}</span>
        {sub && <span className="text-[12px] text-fg-soft">{sub}</span>}
      </span>
      <Icon name="chevron" size={16} stroke={2} className="text-fg-muted" />
    </a>
  );
}

export function MenuList({ items }: { items: { label: string; href: string | null; hint?: string }[] }) {
  return (
    <nav className="flex flex-col overflow-hidden rounded-[20px] border border-line bg-surface">
      {items.map((item, i) => {
        const base = `flex h-[52px] items-center justify-between px-4 text-[14px] font-medium ${i > 0 ? "border-t border-line" : ""}`;
        return item.href ? (
          <a key={item.label} href={item.href} className={`${base} text-fg`}>
            {item.label}
            <Icon name="chevron" size={16} stroke={2} className="text-fg-muted" />
          </a>
        ) : (
          <span key={item.label} className={`${base} text-fg-muted`}>
            {item.label}
            <span className="text-[11px]">{item.hint ?? "segera hadir"}</span>
          </span>
        );
      })}
    </nav>
  );
}
