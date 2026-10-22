import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Figtree } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegister } from "@/components/sw-register";

// Teks: Figtree (jelas di layar kecil). Judul dan angka: Bricolage Grotesque (lihat docs/BRAND.md bagian 3).
const figtree = Figtree({
  subsets: ["latin"],
  variable: "--font-figtree",
});

const bricolage = Bricolage_Grotesque({
  subsets: ["latin"],
  variable: "--font-bricolage",
});

// Dipasang di <head> sebelum halaman tampil supaya tema pilihan warga tidak berkedip.
const THEME_SCRIPT = `try{var m=document.cookie.match(/(?:^|; )gasyu-theme=(light|dark)/);if(m)document.documentElement.dataset.theme=m[1]}catch(e){}`;

export const metadata: Metadata = {
  title: "Gasyu",
  description: "Bikin kota makin rame, bareng-bareng.",
  applicationName: "Gasyu",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Gasyu" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#FFF7EF" },
    { media: "(prefers-color-scheme: dark)", color: "#17100C" },
  ],
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="id" className={`${figtree.variable} ${bricolage.variable} h-full antialiased`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body className="min-h-full flex flex-col">
        {children}
        <ServiceWorkerRegister />
      </body>
    </html>
  );
}
