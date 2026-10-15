// Kelas Tailwind yang dipakai ulang. Sengaja di file biasa (bukan "use client")
// supaya bisa diimpor oleh server component maupun client component.

const buttonBase =
  "flex h-[54px] w-full items-center justify-center gap-2.5 rounded-2xl px-6 text-[16px] font-semibold disabled:opacity-60";

export const buttonStyles = {
  primary: `${buttonBase} bg-primary text-white`,
  light: `${buttonBase} bg-fg text-[15px] text-bg`,
  ghost: `${buttonBase} border border-line bg-surface text-fg-label`,
};

export const inputClass =
  "h-[52px] w-full rounded-[14px] border border-line bg-surface px-4 text-[15px] text-fg outline-none placeholder:text-fg-muted focus:border-primary-soft";

export const labelClass = "text-[13px] font-semibold text-fg-label";

export const cardClass = "rounded-[20px] border border-line bg-surface";
