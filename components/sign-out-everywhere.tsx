"use client";

import { useState } from "react";
import { signOutEverywhere } from "@/app/(warga)/actions";
import { Icon } from "@/components/icons";
import { smallButton } from "@/components/styles";
import { SubmitButton } from "@/components/ui";

// Tombol "Keluar dari semua perangkat" di Profil, dengan konfirmasi supaya tidak terpencet.
export function SignOutEverywhere() {
  const [confirming, setConfirming] = useState(false);
  if (!confirming) {
    return (
      <button type="button" onClick={() => setConfirming(true)} className="flex h-[52px] w-full items-center justify-between px-4 text-[14px] font-medium text-danger">
        Keluar dari semua perangkat
        <Icon name="logout" size={16} />
      </button>
    );
  }
  return (
    <form action={signOutEverywhere} className="flex flex-col gap-3 px-4 py-4">
      <p className="text-[13px] leading-[1.5] text-fg-label">
        Semua HP dan browser yang memakai akun ini akan keluar, termasuk HP ini. Cocok kalau HP hilang atau kamu pernah masuk di HP orang lain.
      </p>
      <div className="flex gap-2">
        <SubmitButton size="small" variant="danger" pendingText="Mengeluarkan…">
          Ya, keluar dari semua
        </SubmitButton>
        <button type="button" onClick={() => setConfirming(false)} className={smallButton.outline}>
          Batal
        </button>
      </div>
    </form>
  );
}
