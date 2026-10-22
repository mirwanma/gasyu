import { Icon, type IconName } from "./icons";
import { NavShell } from "./nav-shell";

// Navigasi bawah melayang. Item dengan href null tampil redup (halaman belum dibangun).
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
    <NavShell>
      <ul className="flex items-center justify-around px-1.5 py-1.5 transition-[padding] duration-300 group-data-[compact=true]:py-1">
        {items.map((item) => {
          const isActive = item.label === active;
          // Semua menu: ikon + teks. Menu aktif memakai ikon penuh dengan latar oranye muda,
          // tombol Scan selalu oranye 3D supaya mudah ditemukan.
          const base =
            "flex min-h-12 min-w-[60px] flex-col items-center justify-center gap-0.5 rounded-[20px] px-2.5 py-1 text-[12px] font-bold";
          const tone = item.emphasis
            ? "btn-3d bg-primary text-on-primary"
            : isActive
              ? "bg-primary-tint text-primary"
              : "text-fg-soft";
          const content = (
            <>
              <Icon name={item.icon} size={item.emphasis ? 24 : 22} weight={item.emphasis ? "bold" : isActive ? "fill" : "regular"} />
              <span>{item.label}</span>
            </>
          );
          return (
            <li key={item.label}>
              {item.href ? (
                <a href={item.href} aria-current={isActive ? "page" : undefined} className={`${base} ${tone}`}>
                  {content}
                </a>
              ) : (
                <span title="Segera hadir" className={`${base} ${tone} opacity-50`}>
                  {content}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </NavShell>
  );
}
