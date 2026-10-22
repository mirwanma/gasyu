"use client";

import { useRef, useState } from "react";
import { Icon, type IconName } from "@/components/icons";

// Data misi untuk beranda. Disiapkan di server (app/(warga)/page.tsx); hadiah tetap
// ditulis server setelah misi diverifikasi, bagian ini hanya menunjukkan jalannya.
export type DailyMission = {
  id: string;
  title: string;
  description: string | null;
  activityId: string;
  activityTitle: string;
  partnerName: string | null;
  checkpointName: string | null;
  verification: "qr_scan" | "secret_code" | "photo" | "manual";
  howTo: string;
  reward: string;
  // Batas waktu (ISO) untuk mengurutkan, dan labelnya ("5 jam lagi").
  deadline: string | null;
  timeLeft: string | null;
};

const VERIFY_ICON: Record<DailyMission["verification"], IconName> = {
  qr_scan: "qr",
  secret_code: "keyboard",
  photo: "upload",
  manual: "flag",
};

// Warna kotak ikon bergantian supaya daftar tidak monoton.
const TILES = ["bg-success-tint text-success", "bg-primary-tint text-primary", "bg-sun-tint text-points", "bg-berry-tint text-berry"];

export function DailyMissions({ missions }: { missions: DailyMission[] }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [active, setActive] = useState<DailyMission | null>(null);

  function open(mission: DailyMission) {
    setActive(mission);
    dialogRef.current?.showModal();
  }

  const soonest = missions.find((m) => m.timeLeft)?.timeLeft;

  return (
    <section aria-labelledby="misi-hari-ini" className="flex animate-pop flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <h2 id="misi-hari-ini" className="font-display text-[22px] font-bold">
          Misi Hari Ini
        </h2>
        {soonest && (
          <span className="inline-flex items-center gap-1 rounded-full bg-berry-tint px-3 py-1 text-[13px] font-bold text-berry">
            <Icon name="timer" size={15} weight="fill" />
            {soonest}
          </span>
        )}
      </div>
      <ul className="flex flex-col gap-3">
        {missions.map((m, i) => (
          <li key={m.id} className="flex items-center gap-3.5 rounded-3xl border border-line bg-surface p-4 shadow-card">
            <span className={`flex size-[52px] shrink-0 items-center justify-center rounded-[18px] ${TILES[i % TILES.length]}`}>
              <Icon name={VERIFY_ICON[m.verification]} size={28} weight="fill" />
            </span>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="text-[16px] font-bold leading-snug">{m.title}</span>
              <span className="truncate text-[13px] text-fg-soft">{m.activityTitle}</span>
              <span className="text-[13px] font-bold text-success">{m.reward}</span>
            </span>
            <button
              type="button"
              onClick={() => open(m)}
              className="btn-3d flex min-h-12 shrink-0 items-center gap-1.5 rounded-2xl bg-primary px-4 text-[15px] font-bold text-on-primary hover:bg-primary-hover"
            >
              <Icon name="play" size={16} weight="fill" />
              Kerjakan
            </button>
          </li>
        ))}
      </ul>

      <dialog
        ref={dialogRef}
        aria-label={active ? `Detail misi ${active.title}` : "Detail misi"}
        onClick={(e) => e.target === dialogRef.current && dialogRef.current?.close()}
        className="m-0 mx-auto mt-auto w-full max-w-[460px] max-h-[85vh] animate-sheet rounded-t-[30px] bg-surface p-0 text-fg backdrop:bg-scrim"
      >
        {active && (
          <div className="flex flex-col gap-4 px-5 pb-[calc(24px+env(safe-area-inset-bottom))] pt-3">
            <span className="mx-auto h-[5px] w-11 rounded-full bg-line" aria-hidden="true" />
            <div className="flex items-center gap-3.5">
              <span className="flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-success-tint text-success">
                <Icon name={VERIFY_ICON[active.verification]} size={30} weight="fill" />
              </span>
              <div className="flex min-w-0 flex-col">
                <span className="font-display text-[22px] font-bold leading-tight">{active.title}</span>
                <span className="text-[14px] text-fg-soft">
                  {active.activityTitle}
                  {active.partnerName ? ` · ${active.partnerName}` : ""}
                </span>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-success-tint px-3 py-1 text-[13px] font-bold text-success">
                <Icon name="star" size={15} weight="fill" />
                {active.reward}
              </span>
              {active.timeLeft && (
                <span className="inline-flex items-center gap-1 rounded-full bg-berry-tint px-3 py-1 text-[13px] font-bold text-berry">
                  <Icon name="timer" size={15} weight="fill" />
                  {active.timeLeft}
                </span>
              )}
              <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-3 py-1 text-[13px] font-bold text-fg-soft">
                <Icon name={VERIFY_ICON[active.verification]} size={15} weight="bold" />
                {active.howTo}
              </span>
            </div>
            {active.description && <p className="text-[15px] leading-[1.55] text-fg-label">{active.description}</p>}
            {active.checkpointName && (
              <p className="flex items-center gap-2 rounded-2xl bg-surface-2 px-4 py-3 text-[15px]">
                <Icon name="pin" size={18} weight="fill" className="shrink-0 text-primary" />
                <span>
                  Lokasi: <b>{active.checkpointName}</b>
                </span>
              </p>
            )}
            <a
              href={active.verification === "qr_scan" ? "/scan" : `/aktivitas/${active.activityId}#misi`}
              className="btn-3d flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-primary px-6 text-[16px] font-bold text-on-primary hover:bg-primary-hover"
            >
              <Icon name={active.verification === "qr_scan" ? "scan" : "play"} size={20} weight="bold" />
              {active.verification === "qr_scan" ? "Scan QR Misi" : "Buka Misi"}
            </a>
            <button
              type="button"
              onClick={() => dialogRef.current?.close()}
              className="flex min-h-12 items-center justify-center gap-1.5 text-[15px] font-bold text-fg-soft"
            >
              <Icon name="close" size={16} weight="bold" />
              Nanti saja
            </button>
          </div>
        )}
      </dialog>
    </section>
  );
}
