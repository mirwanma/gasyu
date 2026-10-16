"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { getCheckpointQr, type QrResponse } from "@/lib/actions/checkin";
import { getMissionQr } from "@/lib/actions/missions";
import { buildQrUrl } from "@/lib/checkin";
import { buildMissionQrUrl } from "@/lib/missions";

// QR checkpoint yang berganti tiap 60 detik, mengikuti artboard "QR checkpoint (staf)".
export function QrDisplay({ checkpointId, missionId }: { checkpointId?: string; missionId?: string }) {
  const [qr, setQr] = useState<QrResponse | null>(null);
  const [image, setImage] = useState<string>();
  const [left, setLeft] = useState(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const load = async () => {
      const res: QrResponse = missionId
        ? await getMissionQr(missionId).then((r) => (r.ok ? { ok: true as const, checkpointId: r.missionId, token: r.token, expiresIn: r.expiresIn, rotateSeconds: r.rotateSeconds, checkpointName: r.missionTitle, activityTitle: r.activityTitle, activityStatus: r.revealed ? "running" : "hidden" } : r))
        : await getCheckpointQr(checkpointId ?? "");
      if (cancelled) return;
      setQr(res);
      if (res.ok) {
        const url = missionId ? buildMissionQrUrl(window.location.origin, missionId, res.token) : buildQrUrl(window.location.origin, res.checkpointId, res.token);
        setImage(await QRCode.toDataURL(url, { margin: 0, width: 520, color: { dark: "#14162B", light: "#FFFFFF" } }));
        setLeft(res.expiresIn);
        timer = setTimeout(load, Math.max(res.expiresIn, 1) * 1000 + 300);
      } else {
        timer = setTimeout(load, 15000);
      }
    };
    void load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [checkpointId, missionId]);

  useEffect(() => {
    const id = setInterval(() => setLeft((v) => Math.max(v - 1, 0)), 1000);
    return () => clearInterval(id);
  }, []);

  // Layar tetap menyala selama halaman terbuka (jika browser mendukung).
  useEffect(() => {
    let lock: { release: () => Promise<void> } | undefined;
    navigator.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => undefined);
    return () => void lock?.release();
  }, []);

  if (qr && !qr.ok) {
    return <p role="alert" className="rounded-2xl bg-danger-tint px-4 py-3 text-center text-[13px] text-danger">{qr.error}</p>;
  }

  return (
    <div className="flex flex-col items-center gap-4">
      <div role="img" aria-label={missionId ? "QR misi, berganti tiap 60 detik" : "QR check-in, berganti tiap 60 detik"} className="flex size-[300px] items-center justify-center rounded-3xl border border-line bg-white p-[18px]">
        {/* eslint-disable-next-line @next/next/no-img-element -- data URL yang dibuat di browser, bukan aset */}
        {image ? <img src={image} alt="" className="size-full" /> : <span className="text-[13px] text-fg-muted">Menyiapkan QR…</span>}
      </div>
      <div className="flex items-center gap-2.5">
        <span className="size-9 rounded-full border-4 border-primary border-l-line" style={{ transform: `rotate(${(1 - left / (qr?.ok ? qr.rotateSeconds : 60)) * 360}deg)` }} />
        <span className="text-[14px] font-semibold">QR baru dalam {left} detik</span>
      </div>
    </div>
  );
}
