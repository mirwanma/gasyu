import Link from "next/link";
import { Logo } from "@/components/ui";

export const metadata = { title: "Offline · Ramein" };

// Halaman yang ditampilkan service worker saat tidak ada jaringan.
export default function OfflinePage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-5 px-5 py-10 text-center">
      <Logo />
      <h1 className="font-display text-[24px] font-bold">Kamu sedang offline</h1>
      <p className="text-[14px] leading-[1.55] text-fg-soft">
        Ramein butuh koneksi internet untuk check-in, misi, dan poin. Sambungkan lagi ke jaringan, lalu coba buka ulang.
      </p>
      <Link href="/" className="flex h-12 w-full items-center justify-center rounded-2xl bg-hot text-[15px] font-bold text-bg">
        Coba lagi
      </Link>
    </main>
  );
}
