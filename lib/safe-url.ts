// Gambar (cover, logo, hadiah, reward) hanya dari Storage Supabase project ini.
// URL lain diabaikan supaya tidak bisa dipakai melacak pengunjung atau menyisipkan CSS.
const STORAGE_PREFIX = `${process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}/storage/v1/object/public/`;

export function safeImageUrl(url: string | null | undefined): string | null {
  if (!url || !process.env.NEXT_PUBLIC_SUPABASE_URL || !url.startsWith(STORAGE_PREFIX)) return null;
  if (/[\s"'()<>\\]/.test(url)) return null;
  return url;
}

// Gaya latar gambar yang aman (URL dikutip dan sudah disaring).
export function backgroundImage(url: string | null | undefined) {
  const safe = safeImageUrl(url);
  return safe ? { backgroundImage: `url("${safe}")`, backgroundSize: "cover", backgroundPosition: "center" } : undefined;
}

// Teks pencarian untuk filter .or() PostgREST: buang karakter yang bermakna di sintaks filter.
export function filterTerm(q: string) {
  return q.replace(/[%,().*"\\:]/g, " ").replace(/\s+/g, " ").trim().slice(0, 60);
}
