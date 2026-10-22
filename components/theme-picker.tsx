"use client";

import { useSyncExternalStore } from "react";
import { Icon, type IconName } from "./icons";

// Pemilih tema di Profil. Pilihan disimpan di cookie `gasyu-theme` (dibaca skrip di app/layout.tsx
// sebelum halaman tampil) dan langsung dipasang di <html data-theme>. Hanya tampilan, tanpa data server.
type Theme = "light" | "dark";

// Contoh warna latar tiap tema (sengaja hex: menampilkan tema lain, bukan tema yang sedang aktif).
const OPTIONS: { value: Theme; label: string; hint: string; icon: IconName; swatch: string }[] = [
  { value: "light", label: "Terang", hint: "Krem hangat", icon: "sun", swatch: "bg-[#FFF7EF] border-[#F1E2D3]" },
  { value: "dark", label: "Gelap", hint: "Espresso hangat", icon: "moon", swatch: "bg-[#17100C] border-[#3A2A20]" },
];

function currentTheme(): Theme {
  const chosen = document.documentElement.dataset.theme;
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribe(onChange: () => void) {
  const observer = new MutationObserver(onChange);
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  return () => {
    observer.disconnect();
    media.removeEventListener("change", onChange);
  };
}

function choose(theme: Theme) {
  document.cookie = `gasyu-theme=${theme}; path=/; max-age=31536000; samesite=lax`;
  document.documentElement.dataset.theme = theme;
}

export function ThemePicker() {
  const theme = useSyncExternalStore(subscribe, currentTheme, () => null);

  return (
    <div role="radiogroup" aria-label="Tema aplikasi" className="grid grid-cols-2 gap-2.5">
      {OPTIONS.map((option) => {
        const selected = theme === option.value;
        return (
          <button
            key={option.value}
            type="button"
            role="radio"
            aria-checked={selected}
            onClick={() => choose(option.value)}
            className={`flex min-h-[72px] items-center gap-3 rounded-2xl border-2 px-3.5 py-3 text-left transition-colors ${
              selected ? "border-primary bg-primary-tint" : "border-line bg-surface hover:bg-surface-2"
            }`}
          >
            <span className={`flex size-11 shrink-0 items-center justify-center rounded-xl border ${option.swatch}`}>
              <Icon name={option.icon} size={22} weight="fill" className="text-primary" />
            </span>
            <span className="flex min-w-0 flex-col">
              <span className="text-[16px] font-bold">{option.label}</span>
              <span className="text-[13px] text-fg-soft">{selected ? "Dipakai" : option.hint}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
