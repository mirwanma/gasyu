"use client";

import { useRef, useState } from "react";

// Enam kotak kode OTP. Nilai gabungannya dikirim lewat input tersembunyi `name`.
// Mendukung tempel (paste) dan isi otomatis kode dari SMS/email di HP.
export function OtpInput({ name, length = 6 }: { name: string; length?: number }) {
  const [digits, setDigits] = useState<string[]>(() => Array(length).fill(""));
  const refs = useRef<(HTMLInputElement | null)[]>([]);

  const fillFrom = (start: number, text: string) => {
    const chars = text.replace(/\D/g, "").slice(0, length - start).split("");
    if (chars.length === 0) return;
    setDigits((prev) => {
      const next = [...prev];
      chars.forEach((char, offset) => (next[start + offset] = char));
      return next;
    });
    refs.current[Math.min(start + chars.length, length - 1)]?.focus();
  };

  return (
    <div role="group" aria-label="Kode masuk 6 angka" className="grid grid-cols-6 gap-2">
      {digits.map((digit, index) => (
        <input
          key={index}
          ref={(element) => {
            refs.current[index] = element;
          }}
          aria-label={`Angka ke-${index + 1}`}
          value={digit}
          inputMode="numeric"
          autoComplete={index === 0 ? "one-time-code" : "off"}
          autoFocus={index === 0}
          onChange={(event) => {
            const value = event.target.value.replace(/\D/g, "");
            if (value.length > 1) return fillFrom(index, value);
            setDigits((prev) => prev.map((old, i) => (i === index ? value : old)));
            if (value) refs.current[index + 1]?.focus();
          }}
          onKeyDown={(event) => {
            if (event.key === "Backspace" && !digit && index > 0) {
              refs.current[index - 1]?.focus();
            }
          }}
          onPaste={(event) => {
            event.preventDefault();
            fillFrom(index, event.clipboardData.getData("text"));
          }}
          className="h-[52px] w-full rounded-xl border-[1.5px] border-line bg-bg text-center font-display text-[26px] font-semibold text-fg outline-none focus:border-primary-soft"
        />
      ))}
      <input type="hidden" name={name} value={digits.join("")} />
    </div>
  );
}
