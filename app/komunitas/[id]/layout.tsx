// Mode komunitas memakai tema terang (lihat Ramein UI Mockup, halaman "Merchant & Komunitas").
export default function KomunitasLayout({ children }: LayoutProps<"/komunitas/[id]">) {
  return <div className="theme-light flex flex-1 flex-col">{children}</div>;
}
