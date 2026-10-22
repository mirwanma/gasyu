"use client";

import { useEffect, useRef, useState } from "react";

// Bingkai navigasi bawah berbahan "kaca" yang melayang. Saat halaman digulir ke bawah
// navigasi sedikit mengecil, dan kembali penuh saat digulir ke atas (gaya iOS 26).
export function NavShell({ children }: { children: React.ReactNode }) {
  const [compact, setCompact] = useState(false);
  const lastY = useRef(0);

  useEffect(() => {
    function onScroll() {
      const y = window.scrollY;
      setCompact(y > lastY.current && y > 80);
      lastY.current = y;
    }
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      aria-label="Navigasi utama"
      data-compact={compact}
      className="group fixed inset-x-0 bottom-[calc(12px+env(safe-area-inset-bottom))] z-20 mx-auto w-[calc(100%-24px)] max-w-[420px] rounded-[28px] border border-glass-line bg-glass shadow-[0_12px_30px_-10px_rgb(60_30_10/0.35)] backdrop-blur-xl backdrop-saturate-150 transition-[width,transform] duration-300 ease-spring data-[compact=true]:w-[calc(100%-64px)] data-[compact=true]:max-w-[380px]"
    >
      {children}
    </nav>
  );
}
