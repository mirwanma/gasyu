// Kelas Tailwind yang dipakai ulang. Sengaja di file biasa (bukan "use client")
// supaya bisa diimpor oleh server component maupun client component.
// Warna mengikuti token di app/globals.css, jadi otomatis cocok di tema gelap dan terang.

const buttonBase =
  "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 text-[16px] font-semibold disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-primary text-on-primary`,
  light: `${buttonBase} bg-fg text-[15px] text-bg`,
  ghost: `${buttonBase} border border-line-strong bg-surface text-fg`,
  danger: `${buttonBase} border border-danger/40 bg-surface text-danger`,
};

// Tombol kecil (40 px) untuk aksi di dalam kartu.
export const smallButton = {
  dark: "flex h-10 items-center justify-center rounded-xl bg-fg px-4 text-[13px] font-semibold text-bg disabled:opacity-60",
  outline:
    "flex h-10 items-center justify-center rounded-xl border border-line-strong bg-surface px-4 text-[13px] font-semibold text-fg disabled:opacity-60",
  danger:
    "flex h-10 items-center justify-center rounded-xl border border-danger/40 bg-surface px-4 text-[13px] font-semibold text-danger disabled:opacity-60",
};

export const inputClass =
  "h-[52px] w-full rounded-[14px] border border-line-strong bg-surface px-4 text-[15px] text-fg outline-none placeholder:text-fg-muted focus:border-primary-soft";

export const textareaClass =
  "w-full rounded-[14px] border border-line-strong bg-surface px-4 py-3 text-[14px] leading-[1.5] text-fg outline-none placeholder:text-fg-muted focus:border-primary-soft";

export const labelClass = "text-[13px] font-semibold text-fg-label";

export const cardClass = "rounded-[20px] border border-line bg-surface";

export const chipClass = {
  base: "flex h-9 items-center rounded-full border px-3 text-[13px] font-semibold",
  selected: "border-primary bg-primary text-on-primary",
  idle: "border-line-strong bg-surface text-fg-label",
};

// Label status kecil (mis. "Menunggu verifikasi").
export const tagClass = {
  base: "inline-flex items-center rounded-[10px] px-2 py-[3px] text-[11px] font-bold whitespace-nowrap",
  success: "bg-success-tint text-success",
  warn: "bg-warn-tint text-warn",
  info: "bg-info-tint text-info",
  hot: "bg-hot-tint text-hot",
  neutral: "bg-track text-fg-label",
  primary: "bg-primary-tint text-link",
};
