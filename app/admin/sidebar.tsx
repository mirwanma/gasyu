"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/icons";
import { LogoMark } from "@/components/ui";

type Item = { label: string; href: string | null; icon: IconName; count?: number };

export function AdminSidebar({ pendingOrganizers, pendingActivities, openFlags, refundsPending, nickname }: { pendingOrganizers: number; pendingActivities: number; openFlags: number; refundsPending: number; nickname: string }) {
  const pathname = usePathname();
  const items: Item[] = [
    { label: "Ringkasan", href: "/admin", icon: "home" },
    { label: "Verifikasi", href: "/admin/verifikasi", icon: "shield", count: pendingOrganizers },
    { label: "Aktivitas & event Gasyu", href: "/admin/aktivitas", icon: "calendar", count: pendingActivities },
    { label: "Master misi", href: "/admin/misi", icon: "check" },
    { label: "Moderasi", href: "/admin/moderasi", icon: "flag", count: openFlags },
    { label: "Pembayaran", href: "/admin/pembayaran", icon: "wallet", count: refundsPending },
    { label: "Pengguna", href: "/admin/pengguna", icon: "users" },
    { label: "Wilayah", href: "/admin/wilayah", icon: "pin" },
    { label: "Pengaturan", href: "/admin/pengaturan", icon: "sliders" },
    { label: "Audit", href: "/admin/audit", icon: "clock" },
  ];

  return (
    <aside className="flex w-full flex-col gap-1.5 border-b border-line bg-surface px-4 py-5 md:min-h-screen md:w-[260px] md:border-b-0 md:border-r md:py-6">
      <div className="flex items-center gap-2.5 px-2 pb-4">
        <LogoMark size={40} />
        <span className="flex flex-col">
          <span className="text-[24px] font-extrabold leading-[1.1] tracking-[-0.03em]">
            gasyu <span className="text-[15px] font-semibold tracking-normal text-fg-soft">admin</span>
          </span>
          <span className="text-[13px] text-fg-soft">Seluruh Indonesia</span>
        </span>
      </div>
      <nav aria-label="Menu admin" className="flex flex-row flex-wrap gap-1 md:flex-col">
        {items.map((item) => {
          const active = item.href && (pathname === item.href || (item.href !== "/admin" && pathname.startsWith(item.href)));
          const base = "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold";
          const content = (
            <>
              <Icon name={item.icon} />
              <span className="flex-1">{item.label}</span>
              {item.count ? (
                <span className="flex h-[22px] min-w-[22px] items-center justify-center rounded-full bg-hot px-1.5 text-[12px] font-bold text-white">
                  {item.count}
                </span>
              ) : null}
            </>
          );
          return item.href ? (
            <a key={item.label} href={item.href} aria-current={active ? "page" : undefined} className={`${base} ${active ? "bg-primary-tint text-link" : "text-fg-label"}`}>
              {content}
            </a>
          ) : (
            <span key={item.label} title="Segera hadir" className={`${base} text-fg-muted opacity-60`}>
              {content}
            </span>
          );
        })}
      </nav>
      <div className="mt-auto flex items-center justify-between px-2 pt-4 text-[13px] text-fg-soft">
        <span>Masuk sebagai {nickname}</span>
        <Link href="/" className="font-semibold text-link">
          Ke PWA
        </Link>
      </div>
    </aside>
  );
}
