"use client";

import { useFormStatus } from "react-dom";

// Komponen kecil yang dipakai ulang. Gaya mengikuti docs/BRAND.md bagian 4.

export function Wordmark() {
  return <p className="text-[24px] font-extrabold leading-[30px] tracking-[-0.03em]">ramein</p>;
}

export function SubmitButton({
  children,
  pendingText,
  variant = "primary",
  name,
  value,
}: {
  children: React.ReactNode;
  pendingText: string;
  variant?: "primary" | "secondary";
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  const style =
    variant === "primary"
      ? "bg-ink text-cream"
      : "border-[1.5px] border-ink bg-white text-ink";

  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      className={`h-12 w-full rounded-full px-6 text-[15px] font-semibold disabled:opacity-60 ${style}`}
    >
      {pending ? pendingText : children}
    </button>
  );
}

export function ErrorMessage({ message }: { message?: string }) {
  if (!message) return null;
  return (
    <p role="alert" className="rounded-[var(--radius-card)] bg-danger-tint px-4 py-3 text-[13px] leading-[18px] text-danger">
      {message}
    </p>
  );
}

export const inputClass =
  "h-12 w-full rounded-[12px] border border-line bg-white px-4 text-[15px] outline-none focus:border-ink";

export const labelClass = "text-[13px] font-medium leading-[18px] text-ink-soft";
