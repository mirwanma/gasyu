"use client";

import { useEffect } from "react";

// Mendaftarkan service worker (hanya di produksi) supaya PWA bisa dipasang
// dan menampilkan halaman offline saat tidak ada jaringan.
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Gagal mendaftar tidak menghalangi aplikasi.
    });
  }, []);
  return null;
}
