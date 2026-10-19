"use client";

import type { InputHTMLAttributes } from "react";

const MAX_SIDE = 1600;
const KEEP_BELOW = 500 * 1024;
const KEPT_TYPES = ["image/jpeg", "image/png", "image/webp"];

// Foto kamera HP biasanya 2–6 MB, padahal server action Next.js hanya menerima 1 MB
// (dinaikkan ke 4 MB di next.config.ts) dan Vercel maks. 4,5 MB. Sebelum dikirim,
// foto diperkecil ke sisi terpanjang 1600 px (JPEG), biasanya jadi 200–500 KB.
// Foto yang sudah kecil dibiarkan, supaya logo PNG tetap transparan.
export async function shrinkImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/")) return file;
  if (file.size <= KEEP_BELOW && KEPT_TYPES.includes(file.type)) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    // Latar putih supaya bagian transparan tidak jadi hitam di JPEG.
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.82));
    if (!blob || blob.size >= file.size) return file;
    const name = file.name.replace(/\.[^.]+$/, "") || "foto";
    return new File([blob], `${name}.jpg`, { type: "image/jpeg" });
  } catch {
    // Format yang tidak bisa dibaca browser (mis. HEIC di sebagian Android): kirim apa adanya.
    return file;
  }
}

export type ImagePick = { name: string; busy: boolean; error?: string } | null;

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, "type" | "onChange"> & {
  maxMb: number;
  onPick?: (pick: ImagePick) => void;
};

// Pengganti <input type="file"> untuk foto: memperkecil foto begitu dipilih.
// Selama foto disiapkan atau jika masih terlalu besar, form tidak bisa dikirim.
export function ImageFileInput({ maxMb, onPick, ...props }: Props) {
  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const picked = input.files?.[0];
    if (!picked) {
      input.setCustomValidity("");
      onPick?.(null);
      return;
    }
    input.setCustomValidity("Foto sedang disiapkan, tunggu sebentar.");
    onPick?.({ name: picked.name, busy: true });
    const small = await shrinkImage(picked);
    // Warga sudah memilih foto lain selagi foto ini diproses.
    if (input.files?.[0] !== picked) return;
    if (small !== picked) {
      const dt = new DataTransfer();
      dt.items.add(small);
      input.files = dt.files;
    }
    const error = small.size > maxMb * 1024 * 1024 ? `Foto terlalu besar, maksimal ${maxMb} MB.` : undefined;
    input.setCustomValidity(error ?? "");
    onPick?.({ name: picked.name, busy: false, error });
  }

  return <input {...props} type="file" onChange={handleChange} />;
}
