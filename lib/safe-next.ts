// Membersihkan parameter `next` supaya hanya mengarah ke halaman di Gasyu sendiri,
// bukan ke situs lain (mencegah open redirect).
const BASE = "http://gasyu.local";

export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value === "") return fallback;
  // Browser membuang tab/baris baru dan membaca "\" sebagai "/", sehingga "/\t/situs-lain.com"
  // bisa berubah menjadi "//situs-lain.com". Tolak karakter seperti itu sejak awal.
  if (/[\u0000-\u001f\u007f\\]/.test(value)) return fallback;
  if (!value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, BASE);
    if (url.origin !== BASE) return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
