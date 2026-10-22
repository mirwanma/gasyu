"use client";

import { useState } from "react";
import { inputClass } from "@/components/styles";

// Kolom kata sandi dengan tombol "Lihat" supaya warga bisa mengecek ketikannya di HP.
export function PasswordInput({
  id,
  name,
  autoComplete,
  minLength,
  placeholder,
}: {
  id: string;
  name: string;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  placeholder?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <input
        id={id}
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        minLength={minLength}
        maxLength={72}
        placeholder={placeholder}
        required
        className={`${inputClass} pr-24`}
      />
      <button
        type="button"
        onClick={() => setVisible((value) => !value)}
        aria-controls={id}
        aria-pressed={visible}
        className="absolute inset-y-0 right-0 min-w-11 px-4 text-[16px] font-semibold text-link"
      >
        {visible ? "Sembunyikan" : "Lihat"}
      </button>
    </div>
  );
}
