// Navigasi bawah mode warga (Beranda, Jelajah, Scan, Dompet, Profil).
// Halaman yang belum dibangun tampil redup dan belum bisa diklik.

const ICONS = {
  home: "M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z",
  compass: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM15.5 8.5l-2 5-5 2 2-5z",
  scan: "M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 12h10",
  wallet: "M3 7a2 2 0 0 1 2-2h12v4M3 7v11a2 2 0 0 0 2 2h14a1 1 0 0 0 1-1v-9a1 1 0 0 0-1-1H5a2 2 0 0 1-2-2zM16 14h.01",
  user: "M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0",
};

type Item = { label: string; href: string | null; icon: string };

const ITEMS: Item[] = [
  { label: "Beranda", href: "/", icon: ICONS.home },
  { label: "Jelajah", href: null, icon: ICONS.compass },
  { label: "Scan", href: null, icon: ICONS.scan },
  { label: "Dompet", href: null, icon: ICONS.wallet },
  { label: "Profil", href: null, icon: ICONS.user },
];

function Icon({ path, size = 22, stroke = 1.8 }: { path: string; size?: number; stroke?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={path} />
    </svg>
  );
}

export function BottomNav({ active }: { active: string }) {
  return (
    <nav
      aria-label="Navigasi utama"
      className="fixed inset-x-0 bottom-0 z-10 border-t border-line bg-surface-deep pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex h-[76px] max-w-md items-start justify-around px-1.5 pt-2">
        {ITEMS.map((item) => {
          if (item.label === "Scan") {
            return (
              <li key={item.label}>
                <span
                  aria-label="Scan (segera hadir)"
                  aria-disabled="true"
                  className="-mt-6 flex size-[60px] items-center justify-center rounded-full border-4 border-bg bg-hot text-bg opacity-60"
                >
                  <Icon path={item.icon} size={26} stroke={2.2} />
                </span>
              </li>
            );
          }
          const isActive = item.label === active;
          const content = (
            <>
              <Icon path={item.icon} />
              <span>{item.label}</span>
            </>
          );
          const base = "flex min-h-12 w-16 flex-col items-center gap-1 text-[11px] font-semibold";
          return (
            <li key={item.label}>
              {item.href ? (
                <a
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={`${base} ${isActive ? "text-fg" : "text-fg-muted"}`}
                >
                  {content}
                </a>
              ) : (
                <span aria-disabled="true" title="Segera hadir" className={`${base} text-fg-muted opacity-50`}>
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
