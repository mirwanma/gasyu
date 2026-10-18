// Mode merchant memakai tema terang (lihat UI Mockup, halaman "Merchant & Komunitas").
export default function MerchantLayout({ children }: LayoutProps<"/merchant/[id]">) {
  return <div className="theme-light flex flex-1 flex-col">{children}</div>;
}
