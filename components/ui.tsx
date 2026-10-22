"use client";

import { useFormStatus } from "react-dom";
import { buttonStyles, smallButton } from "./styles";

// Komponen kecil yang dipakai ulang. Gaya mengikuti UI Mockup (lihat docs/BRAND.md).

export function LogoMark({ size = 48 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
      <circle cx="50" cy="34" r="26" fill="#F06A2A" />
      <circle cx="36" cy="58" r="26" fill="#0F8B6D" />
      <circle cx="64" cy="58" r="26" fill="#2D4FCF" />
      <path d="M24.01 34.92A26 26 0 0 1 61.99 57.08A26 26 0 0 1 24.01 34.92Z" fill="#7E7A2C" />
      <path d="M38.01 57.08A26 26 0 0 1 75.99 34.92A26 26 0 0 1 38.01 57.08Z" fill="#9A4E80" />
      <path d="M50 36.09A26 26 0 0 1 50 79.91A26 26 0 0 1 50 36.09Z" fill="#1A6AA6" />
      <circle cx="50" cy="50" r="7" fill="#FFFFFF" />
    </svg>
  );
}

export function Logo() {
  return (
    <div className="flex items-center gap-2.5" role="img" aria-label="gasyu">
      <LogoMark />
      <span className="text-[32px] font-extrabold tracking-[-0.03em] text-fg">gasyu</span>
    </div>
  );
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  size = "full",
  name,
  value,
  formNoValidate,
  className = "",
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: keyof typeof buttonStyles | keyof typeof smallButton;
  size?: "full" | "small";
  name?: string;
  value?: string;
  formNoValidate?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  const styles =
    size === "small"
      ? smallButton[variant as keyof typeof smallButton]
      : buttonStyles[variant as keyof typeof buttonStyles];
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      formNoValidate={formNoValidate}
      className={`${styles} ${className}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="alert"
      className="rounded-[14px] border border-danger/30 bg-danger-tint px-4 py-3 text-[16px] leading-[1.5] text-danger"
    >
      {message}
    </p>
  );
}

export function SuccessMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p
      role="status"
      className="rounded-[14px] border border-success/30 bg-success-tint px-4 py-3 text-[16px] leading-[1.5] text-success"
    >
      {message}
    </p>
  );
}

export function GoogleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.3 3-4.1 5.6-4.1z" />
    </svg>
  );
}
