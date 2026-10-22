// Kelas Tailwind yang dipakai ulang. Sengaja di file biasa (bukan "use client")
// supaya bisa diimpor oleh server component maupun client component.
// Warna mengikuti token di app/globals.css (tema terang dan gelap). Tombol utama bergaya 3D:
// punya "tepi" bawah dan turun saat ditekan (kelas .btn-3d). Target sentuh minimal 48 px.

const buttonBase =
  "flex min-h-[54px] w-full items-center justify-center gap-2 rounded-2xl px-6 py-3 text-[16px] font-bold disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} btn-3d bg-primary text-on-primary hover:bg-primary-hover`,
  light: `${buttonBase} border border-line-strong bg-surface text-fg transition-colors hover:bg-surface-2`,
  ghost: `${buttonBase} border border-line-strong bg-surface text-fg transition-colors hover:bg-surface-2`,
  danger: `${buttonBase} border border-danger/40 bg-surface text-danger`,
};

// Tombol kecil (48 px) untuk aksi di dalam kartu.
export const smallButton = {
  dark: "btn-3d flex min-h-12 items-center justify-center gap-1.5 rounded-xl bg-primary px-4 text-[15px] font-bold text-on-primary hover:bg-primary-hover disabled:opacity-60",
  outline:
    "flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold text-fg transition-colors hover:bg-surface-2 disabled:opacity-60",
  danger:
    "flex min-h-12 items-center justify-center gap-1.5 rounded-xl border border-danger/40 bg-surface px-4 text-[15px] font-semibold text-danger disabled:opacity-60",
};

export const inputClass =
  "h-[52px] w-full rounded-2xl border border-line-strong bg-surface px-4 text-[16px] text-fg outline-none placeholder:text-fg-muted focus:border-primary focus:ring-2 focus:ring-primary/30";

export const textareaClass =
  "w-full rounded-2xl border border-line-strong bg-surface px-4 py-3 text-[16px] leading-[1.5] text-fg outline-none placeholder:text-fg-muted focus:border-primary focus:ring-2 focus:ring-primary/30";

export const labelClass = "text-[15px] font-semibold text-fg-label";

export const cardClass = "rounded-3xl border border-line bg-surface shadow-card";

export const chipClass = {
  base: "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[15px] font-semibold",
  selected: "border-primary bg-primary text-on-primary",
  idle: "border-line-strong bg-surface text-fg-label hover:bg-surface-2",
};

// Tautan "Kembali" di kepala halaman: selalu ikon + teks.
export const backLinkClass =
  "flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface pl-3 pr-4 text-[15px] font-semibold text-fg shadow-card transition-colors hover:bg-surface-2";

// Label status kecil (mis. "Menunggu verifikasi").
export const tagClass = {
  base: "inline-flex items-center rounded-full px-2.5 py-[3px] text-[12px] font-bold whitespace-nowrap",
  success: "bg-success-tint text-success",
  warn: "bg-warn-tint text-warn",
  info: "bg-info-tint text-info",
  hot: "bg-hot-tint text-hot",
  neutral: "bg-track text-fg-label",
  primary: "bg-primary-tint text-link",
};
