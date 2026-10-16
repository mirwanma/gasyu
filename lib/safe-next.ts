// Membersihkan parameter `next` supaya hanya mengarah ke halaman di Gasyu sendiri,
// bukan ke situs lain (mencegah open redirect).
export function safeNext(value: unknown, fallback = "/"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return fallback;
  }
  return value;
}
