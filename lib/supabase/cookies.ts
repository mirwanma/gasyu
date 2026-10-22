import type { CookieOptionsWithName } from "@supabase/ssr";

// Opsi cookie sesi Supabase (access token + refresh token).
// - httpOnly: JavaScript di browser tidak bisa membaca token, jadi aman dari XSS.
//   Karena itu semua akses Supabase lewat server (Server Component, Server Action,
//   Route Handler); jangan memakai client Supabase di browser.
// - secure: hanya dikirim lewat HTTPS di produksi (localhost tetap jalan saat dev).
// - sameSite lax: tidak ikut terkirim dari form situs lain (anti-CSRF), tapi tetap
//   ikut saat warga membuka tautan Gasyu dari WhatsApp atau email.
export const sessionCookieOptions: CookieOptionsWithName = {
  path: "/",
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
};
