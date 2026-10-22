// Kelas Tailwind yang dipakai ulang. Sengaja di file biasa (bukan "use client")
// supaya bisa diimpor oleh server component maupun client component.
// Warna mengikuti token di app/globals.css. Ukuran dibuat besar dan longgar supaya
// mudah dibaca dan ditekan oleh anak-anak sampai lansia (lihat docs/BRAND.md bagian 4).

const buttonBase =
  "flex min-h-[58px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 py-3 text-[18px] font-semibold transition-colors disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-primary text-on-primary hover:bg-primary-hover`,
  light: `${buttonBase} border border-line-strong bg-surface text-fg hover:bg-bg`,
  ghost: `${buttonBase} border border-line-strong bg-surface text-fg hover:bg-bg`,
  danger: `${buttonBase} border border-danger/40 bg-surface text-danger`,
};

// Tombol kecil (48 px) untuk aksi di dalam kartu.
export const smallButton = {
  dark: "flex min-h-12 items-center justify-center gap-2 rounded-xl bg-primary px-5 text-[16px] font-semibold text-on-primary transition-colors hover:bg-primary-hover disabled:opacity-60",
  outline:
    "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-line-strong bg-surface px-5 text-[16px] font-semibold text-fg transition-colors hover:bg-bg disabled:opacity-60",
  danger:
    "flex min-h-12 items-center justify-center gap-2 rounded-xl border border-danger/40 bg-surface px-5 text-[16px] font-semibold text-danger disabled:opacity-60",
};

export const inputClass =
  "h-14 w-full rounded-[14px] border border-line-strong bg-surface px-4 text-[18px] text-fg outline-none placeholder:text-fg-muted focus:border-primary focus:ring-2 focus:ring-primary/30";

export const textareaClass =
  "w-full rounded-[14px] border border-line-strong bg-surface px-4 py-3 text-[18px] leading-[1.5] text-fg outline-none placeholder:text-fg-muted focus:border-primary focus:ring-2 focus:ring-primary/30";

export const labelClass = "text-[17px] font-semibold text-fg-label";

export const cardClass = "rounded-[20px] border border-line bg-surface";

export const chipClass = {
  base: "flex min-h-11 items-center gap-1.5 rounded-full border px-4 text-[16px] font-semibold",
  selected: "border-primary bg-primary text-on-primary",
  idle: "border-line-strong bg-surface text-fg-label hover:bg-bg",
};

// Tautan "Kembali" di kepala halaman: selalu ikon + teks.
export const backLinkClass =
  "flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border border-line bg-surface pl-3 pr-4 text-[16px] font-semibold text-fg transition-colors hover:bg-bg";

// Label status kecil (mis. "Menunggu verifikasi").
export const tagClass = {
  base: "inline-flex items-center rounded-[10px] px-2 py-[3px] text-[13px] font-bold whitespace-nowrap",
  success: "bg-success-tint text-success",
  warn: "bg-warn-tint text-warn",
  info: "bg-info-tint text-info",
  hot: "bg-hot-tint text-hot",
  neutral: "bg-track text-fg-label",
  primary: "bg-primary-tint text-link",
};
