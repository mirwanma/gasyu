// Pemformat tanggal dan angka untuk tampilan (Bahasa Indonesia, zona WIB).

const WIB = "Asia/Jakarta";

export function formatDate(value: string | Date, options: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: WIB, day: "numeric", month: "short", year: "numeric", ...options }).format(
    new Date(value),
  );
}

export function formatDateTime(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", {
    timeZone: WIB,
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(value))
    .replace(".", ":");
}

export function formatMonthYear(value: string | Date) {
  return new Intl.DateTimeFormat("id-ID", { timeZone: WIB, month: "short", year: "numeric" }).format(new Date(value));
}

export function formatNumber(value: number) {
  return value.toLocaleString("id-ID");
}

// "3 jam lalu", "2 hari lalu"
export function timeAgo(value: string | Date, now = new Date()) {
  const diff = Math.max(0, now.getTime() - new Date(value).getTime());
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return "baru saja";
  if (minutes < 60) return `${minutes} menit lalu`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} jam lalu`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} hari lalu`;
  return formatDate(value);
}

export function greetingFor(now = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("id-ID", { hour: "numeric", hourCycle: "h23", timeZone: WIB }).format(now));
  if (hour < 11) return "Selamat pagi,";
  if (hour < 15) return "Selamat siang,";
  if (hour < 18) return "Selamat sore,";
  return "Selamat malam,";
}
