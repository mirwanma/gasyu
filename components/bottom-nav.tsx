import { Icon, type IconName } from "./icons";

// Navigasi bawah. Item dengan href null tampil redup (halaman belum dibangun).
export type NavItem = { label: string; href: string | null; icon: IconName; emphasis?: boolean };

export const CITIZEN_NAV: NavItem[] = [
  { label: "Beranda", href: "/", icon: "home" },
  { label: "Jelajah", href: "/jelajah", icon: "compass" },
  { label: "Scan", href: "/scan", icon: "scan", emphasis: true },
  { label: "Dompet", href: "/dompet", icon: "wallet" },
  { label: "Profil", href: "/profil", icon: "user" },
];

export function merchantNav(id: string): NavItem[] {
  return [
    { label: "Dashboard", href: `/merchant/${id}`, icon: "chart" },
    { label: "Aktivitas", href: `/merchant/${id}/aktivitas`, icon: "calendar" },
    { label: "QR", href: `/merchant/${id}/qr`, icon: "qr" },
    { label: "Kasir", href: `/merchant/${id}/kasir`, icon: "ticket" },
    { label: "Lainnya", href: `/merchant/${id}/lainnya`, icon: "more" },
  ];
}

export function communityNav(id: string): NavItem[] {
  return [
    { label: "Dashboard", href: `/komunitas/${id}`, icon: "chart" },
    { label: "Aktivitas", href: `/komunitas/${id}/aktivitas`, icon: "calendar" },
    { label: "QR", href: `/komunitas/${id}/qr`, icon: "qr" },
    { label: "Member", href: `/komunitas/${id}/member`, icon: "users" },
    { label: "Lainnya", href: `/komunitas/${id}/lainnya`, icon: "more" },
  ];
}

export function BottomNav({ items, active }: { items: NavItem[]; active: string }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-deep pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-[76px] max-w-md items-start justify-around px-1.5 pt-2">
        {items.map((item) => {
          const isActive = item.label === active;
          if (item.emphasis) {
            const emphasisClass =
              "-mt-6 flex size-[60px] items-center justify-center rounded-full border-4 border-bg bg-hot text-bg";
            return (
              <li key={item.label}>
                {item.href ? (
                  <a href={item.href} aria-label={item.label} className={emphasisClass}>
                    <Icon name={item.icon} size={26} stroke={2.2} />
                  </a>
                ) : (
                  <span aria-label={`${item.label} (segera hadir)`} className={`${emphasisClass} opacity-60`}>
                    <Icon name={item.icon} size={26} stroke={2.2} />
                  </span>
                )}
              </li>
            );
          }
          const base = "flex min-h-12 w-16 flex-col items-center gap-1 text-[11px] font-semibold";
          const content = (
            <>
              <Icon name={item.icon} size={22} />
              <span>{item.label}</span>
            </>
          );
          return (
            <li key={item.label}>
              {item.href ? (
                <a
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${base} ${isActive ? "text-link" : "text-fg-muted"}`}
                >
                  {content}
                </a>
              ) : (
                <span title="Segera hadir" className={`${base} text-fg-muted opacity-50`}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
