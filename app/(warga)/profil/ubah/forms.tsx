"use client";

import { useActionState } from "react";
import { changeVillage, updateProfile, type AccountState } from "@/lib/actions/account";
import { cardClass, inputClass, labelClass } from "@/components/styles";
import { ErrorMessage, SubmitButton } from "@/components/ui";

function Success({ text }: { text?: string }) {
  if (!text) return null;
  return (
    <p role="status" className="rounded-[14px] bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">
      {text}
    </p>
  );
}

export function ProfileForm({ nickname, fullName }: { nickname: string; fullName: string }) {
  const [state, action] = useActionState<AccountState, FormData>(updateProfile, {});
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <span className="text-[15px] font-semibold">Data diri</span>
      <label htmlFor="nickname" className={labelClass}>
        Nama panggilan
      </label>
      <input id="nickname" name="nickname" defaultValue={nickname} minLength={3} maxLength={20} required className={inputClass} />
      <span className="-mt-1 text-[12px] text-fg-soft">Tampil di leaderboard dan dilihat penyelenggara. 3–20 karakter, harus unik.</span>
      <label htmlFor="full_name" className={labelClass}>
        Nama lengkap
      </label>
      <input id="full_name" name="full_name" defaultValue={fullName} maxLength={100} required className={inputClass} />
      <span className="-mt-1 text-[12px] text-fg-soft">Tidak pernah ditampilkan ke warga lain atau penyelenggara.</span>
      <ErrorMessage message={state.error} />
      <Success text={state.success} />
      <SubmitButton pendingText="Menyimpan…">Simpan</SubmitButton>
    </form>
  );
}

export function VillageForm({
  current,
  districts,
  lockedUntil,
  days,
}: {
  current: string;
  districts: { id: string; name: string; villages: { id: string; name: string }[] }[];
  lockedUntil: string | null;
  days: number;
}) {
  const [state, action] = useActionState<AccountState, FormData>(changeVillage, {});
  return (
    <form action={action} className={`${cardClass} flex flex-col gap-3 p-4`}>
      <span className="text-[15px] font-semibold">Kelurahan asal</span>
      <span className="text-[13px] leading-[1.5] text-fg-soft">
        Menentukan leaderboard kelurahanmu dan aktivitas khusus warga yang bisa kamu ikuti. Hanya bisa diganti sekali setiap {days} hari.
      </span>
      <Success text={state.success} />
      {lockedUntil ? (
        <p className="rounded-[14px] bg-warn-tint px-4 py-3 text-[13px] text-warn">Kamu baru bisa mengganti kelurahan lagi mulai {lockedUntil}.</p>
      ) : (
        <>
          <label htmlFor="village" className={labelClass}>
            Pilih kelurahan
          </label>
          <select id="village" name="village" defaultValue={current} className={inputClass}>
            {districts.map((d) => (
              <optgroup key={d.id} label={`Kec. ${d.name}`}>
                {d.villages.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.name}
                  </option>
                ))}
              </optgroup>
            ))}
            <option value="luar">Luar Cimahi</option>
          </select>
          <ErrorMessage message={state.error} />
          <SubmitButton pendingText="Mengganti…" variant="ghost">
            Ganti kelurahan
          </SubmitButton>
        </>
      )}
    </form>
  );
}
