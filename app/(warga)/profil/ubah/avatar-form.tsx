"use client";

import { useActionState, useRef, useState } from "react";
import { removeAvatar, uploadAvatar, type AccountState } from "@/lib/actions/account";
import { UserAvatar } from "@/components/avatar";
import { cardClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

const SIZE = 512;

// Foto dari kamera HP biasanya besar. Sebelum dikirim, foto dipotong persegi
// di tengah dan diperkecil ke 512 px (JPEG), jadi unggah cepat dan hemat kuota.
async function shrink(file: File): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const side = Math.min(bitmap.width, bitmap.height);
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext("2d");
  if (!ctx) return file;
  ctx.drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2, side, side, 0, 0, SIZE, SIZE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.85));
  return blob ? new File([blob], "avatar.jpg", { type: "image/jpeg" }) : file;
}

export function AvatarForm({ nickname, avatarUrl }: { nickname: string; avatarUrl: string | null }) {
  const [preview, setPreview] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const hidden = useRef<HTMLInputElement>(null);
  // Setelah tersimpan, pratinjau dibersihkan supaya tombol Simpan hilang.
  const [state, uploadAction] = useActionState<AccountState, FormData>(async (prev, formData) => {
    const result = await uploadAvatar(prev, formData);
    if (result.success) {
      setPreview(null);
      if (hidden.current) hidden.current.value = "";
    }
    return result;
  }, {});
  const [removeState, removeAction] = useActionState<AccountState, FormData>(removeAvatar, {});

  async function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const picked = e.target.files?.[0];
    if (!picked || !hidden.current) return;
    setBusy(true);
    try {
      const small = await shrink(picked).catch(() => picked);
      const dt = new DataTransfer();
      dt.items.add(small);
      hidden.current.files = dt.files;
      setPreview(URL.createObjectURL(small));
    } finally {
      setBusy(false);
    }
  }

  const message = state.success ?? removeState.success;
  return (
    <section className={`${cardClass} flex flex-col gap-3 p-4`}>
      <span className="text-[18px] font-semibold">Foto profil</span>
      <div className="flex items-center gap-4">
        <UserAvatar nickname={nickname} avatarUrl={preview ?? avatarUrl} size={72} />
        <span className="text-[14px] leading-[1.5] text-fg-soft">Terlihat di profilmu dan oleh tim penyelenggara tempat kamu bergabung. Foto otomatis dipotong persegi.</span>
      </div>
      <form action={uploadAction} className="flex flex-col gap-2">
        <input ref={hidden} type="file" name="avatar" className="hidden" aria-hidden="true" tabIndex={-1} />
        <label className="flex h-12 cursor-pointer items-center justify-center rounded-[14px] border border-dashed border-line-strong text-[17px] font-semibold text-fg">
          {busy ? "Menyiapkan foto…" : preview ? "Ganti pilihan foto" : "Pilih foto"}
          <input type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" onChange={onPick} />
        </label>
        {preview && (
          <SubmitButton pendingText="Mengunggah…" size="full">
            Simpan foto
          </SubmitButton>
        )}
        <ErrorMessage message={state.error} />
      </form>
      {avatarUrl && !preview && (
        <form action={removeAction}>
          <SubmitButton pendingText="Menghapus…" variant="ghost">
            Hapus foto
          </SubmitButton>
          <ErrorMessage message={removeState.error} />
        </form>
      )}
      {message && (
        <p role="status" className="rounded-[14px] bg-success-tint px-4 py-3 text-[16px] font-semibold text-success">
          {message}
        </p>
      )}
    </section>
  );
}
