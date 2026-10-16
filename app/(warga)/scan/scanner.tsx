"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { performCheckin } from "@/lib/actions/checkin";
import { parseQrPayload, type CheckinResult, type QrPayload } from "@/lib/checkin";
import { levelFor, type LevelRow } from "@/lib/gamification/level";
import { Icon } from "@/components/icons";

type Phase = { kind: "scan" } | { kind: "confirm"; payload: QrPayload } | { kind: "sending" } | { kind: "done"; result: CheckinResult } | { kind: "error"; message: string };

// Halaman Scan QR warga, mengikuti artboard "Warga · Scan QR" dan "Warga · Check-in berhasil".
export function Scanner({ initial, levels }: { initial: QrPayload | null; levels: LevelRow[] }) {
  const [phase, setPhase] = useState<Phase>(initial ? { kind: "confirm", payload: initial } : { kind: "scan" });
  const [geo, setGeo] = useState<{ lat: number; lng: number; accuracy: number } | null>(null);
  const [geoMessage, setGeoMessage] = useState("Mengaktifkan lokasi…");
  const [cameraMessage, setCameraMessage] = useState<string>();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const submittingRef = useRef(false);

  // Lokasi: dipantau terus supaya akurasi membaik sambil kamera dibuka.
  useEffect(() => {
    if (!navigator.geolocation) {
      queueMicrotask(() => setGeoMessage("Lokasi tidak didukung"));
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        setGeo({ lat: pos.coords.latitude, lng: pos.coords.longitude, accuracy: pos.coords.accuracy });
        setGeoMessage(`Lokasi aktif · akurasi ${Math.round(pos.coords.accuracy)} m`);
      },
      () => setGeoMessage("Lokasi tidak aktif · check-in akan ditandai untuk ditinjau"),
      { enableHighAccuracy: true, maximumAge: 10000, timeout: 15000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  const submit = useCallback(
    async (payload: QrPayload) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setPhase({ kind: "sending" });
      const res = await performCheckin(payload.checkpointId, payload.token, geo?.lat ?? null, geo?.lng ?? null);
      submittingRef.current = false;
      setPhase(res.ok ? { kind: "done", result: res.result } : { kind: "error", message: res.error });
    },
    [geo],
  );

  // Kamera + pembacaan QR (jsQR) selama fase scan.
  useEffect(() => {
    if (phase.kind !== "scan") return;
    let stream: MediaStream | null = null;
    let raf = 0;
    let stopped = false;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) return;

    const tick = () => {
      if (stopped) return;
      if (video.readyState === video.HAVE_ENOUGH_DATA) {
        const size = Math.min(video.videoWidth, video.videoHeight, 480);
        canvas.width = size;
        canvas.height = size;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (ctx) {
          const sx = (video.videoWidth - size) / 2;
          const sy = (video.videoHeight - size) / 2;
          ctx.drawImage(video, sx, sy, size, size, 0, 0, size, size);
          const img = ctx.getImageData(0, 0, size, size);
          const code = jsQR(img.data, size, size, { inversionAttempts: "dontInvert" });
          if (code?.data) {
            const payload = parseQrPayload(code.data);
            if (payload) {
              stopped = true;
              void submit(payload);
              return;
            }
            setCameraMessage("QR ini bukan QR Ramein.");
          }
        }
      }
      raf = requestAnimationFrame(tick);
    };

    navigator.mediaDevices
      ?.getUserMedia({ video: { facingMode: { ideal: "environment" } }, audio: false })
      .then((s) => {
        stream = s;
        video.srcObject = s;
        return video.play();
      })
      .then(() => {
        raf = requestAnimationFrame(tick);
      })
      .catch(() => setCameraMessage("Kamera tidak bisa dibuka. Izinkan akses kamera, atau buka QR lewat kamera bawaan HP."));

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [phase.kind, submit]);

  if (phase.kind === "done") return <Reward result={phase.result} levels={levels} />;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 px-5 pb-8 pt-6" style={{ background: "radial-gradient(circle at 50% 40%, #2A2F4F 0%, #0B0E22 65%)" }}>
      <div className="flex w-full items-center justify-between">
        <Link href="/" aria-label="Tutup" className="flex size-11 items-center justify-center rounded-full bg-[#0D1024]/70 text-cream">
          <Icon name="close" stroke={2} />
        </Link>
        <span className="font-display text-[18px] font-semibold text-cream">Scan QR</span>
        <span className="size-11" />
      </div>

      {phase.kind === "confirm" ? (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="text-[15px] leading-[1.5] text-fg-label">QR check-in terbaca. Pastikan kamu berada di lokasi, lalu lanjutkan.</span>
          <button type="button" onClick={() => void submit(phase.payload)} className="flex h-[54px] w-full items-center justify-center rounded-2xl bg-primary text-[16px] font-semibold text-on-primary">
            Check-in sekarang
          </button>
          <button type="button" onClick={() => setPhase({ kind: "scan" })} className="text-[14px] font-semibold text-fg-soft">
            Pindai ulang
          </button>
        </div>
      ) : (
        <>
          <p className="max-w-[280px] text-center text-[15px] leading-[1.5] text-fg-label">Arahkan kamera ke QR di HP staf penyelenggara</p>
          <div className="relative size-[260px] overflow-hidden rounded-[20px]">
            <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <span className="absolute left-0 top-0 size-14 rounded-tl-[20px] border-l-[5px] border-t-[5px] border-hot" />
            <span className="absolute right-0 top-0 size-14 rounded-tr-[20px] border-r-[5px] border-t-[5px] border-hot" />
            <span className="absolute bottom-0 left-0 size-14 rounded-bl-[20px] border-b-[5px] border-l-[5px] border-hot" />
            <span className="absolute bottom-0 right-0 size-14 rounded-br-[20px] border-b-[5px] border-r-[5px] border-hot" />
            <span className="absolute inset-x-6 top-[128px] h-0.5 bg-hot shadow-[0_0_16px_#F0508A]" />
            {phase.kind === "sending" && (
              <span className="absolute inset-0 flex items-center justify-center bg-[#0D1024]/70 text-[14px] font-semibold text-cream">Memproses check-in…</span>
            )}
          </div>
          {phase.kind === "error" && (
            <div role="alert" className="flex w-full flex-col gap-2 rounded-2xl border border-danger/40 bg-danger-tint px-4 py-3 text-center text-[13px] text-danger">
              {phase.message}
              <button type="button" onClick={() => setPhase({ kind: "scan" })} className="font-bold">
                Coba lagi
              </button>
            </div>
          )}
          {cameraMessage && <span className="text-center text-[12px] text-warn">{cameraMessage}</span>}
        </>
      )}

      <div className={`flex h-9 items-center gap-2 rounded-full px-3.5 text-[13px] font-semibold ${geo ? "bg-[#123A33]/90 text-[#6EE7B7]" : "bg-warn-tint text-warn"}`}>
        <Icon name="pin" size={16} stroke={2} />
        {geoMessage}
      </div>

      <div className="mt-auto flex w-full flex-col gap-2.5">
        <span title="Segera hadir" className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface/95 text-[15px] font-semibold text-fg-muted">
          <Icon name="keyboard" size={18} stroke={2} />
          Ketik kode misi · segera hadir
        </span>
        <span className="text-center text-[12px] text-fg-muted">QR berganti tiap 60 detik. Foto QR yang disebar tidak akan berlaku.</span>
      </div>
    </div>
  );
}

function Reward({ result, levels }: { result: CheckinResult; levels: LevelRow[] }) {
  const level = levelFor(result.total_xp, levels);
  const currentMin = levels.find((l) => l.level === level.level)?.min_xp ?? 0;
  const pct = level.nextMinXp === null ? 100 : Math.round(((result.total_xp - currentMin) / (level.nextMinXp - currentMin)) * 100);
  const rows: [string, number][] = [
    [result.activity_type === "event" ? "Check-in event" : "Challenge selesai", result.xp_base],
    ["Kunjungan pertama", result.xp_first_visit],
    ["Bonus kolaborasi 25%", result.xp_collab],
    ["Bonus grup 20%", result.xp_group],
  ];
  const isChallenge = result.activity_type === "challenge";
  const shown = result.target_scope === "group" ? (result.group_progress ?? result.progress) : result.progress;
  return (
    <div className="flex min-h-screen flex-col items-center gap-[18px] px-5 pb-7 pt-12" style={{ background: "radial-gradient(circle at 50% 18%, #3B2F8F 0%, #0D1024 60%)" }}>
      <div className="flex size-24 items-center justify-center rounded-full bg-success text-bg shadow-[0_0_0_12px_rgba(52,211,153,0.15)]">
        <Icon name="check" size={48} stroke={2.6} />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[13px] text-fg-label">
          {result.partner_name} · {result.checkpoint_name}
        </span>
        <h1 className="font-display text-[28px] font-bold">{isChallenge && result.completed ? "Challenge selesai!" : "Check-in berhasil!"}</h1>
        <span className="text-[14px] text-fg-soft">
          {result.activity_title}
          {isChallenge ? ` · ${Math.min(shown, result.target_count)} dari ${result.target_count}${result.target_scope === "group" ? " (grup)" : ""}` : result.completed ? " · selesai" : ""}
        </span>
      </div>
      <div className="flex w-full gap-3">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <span className="font-display text-[32px] font-bold text-xp">+{result.xp_total}</span>
          <span className="text-[12px] text-fg-soft">XP</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <span className="font-display text-[32px] font-bold text-points">+{result.points}</span>
          <span className="text-[12px] text-fg-soft">{result.points > 0 ? `poin dari ${result.partner_name}` : result.completed ? "poin · budget habis" : "poin · setelah selesai"}</span>
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4">
        {rows.filter(([, v]) => v > 0).map(([k, v]) => (
          <div key={k} className="flex justify-between text-[14px]">
            <span className="text-fg-label">{k}</span>
            <span className="font-semibold">+{v}</span>
          </div>
        ))}
        {result.xp_total === 0 && <span className="text-[13px] text-fg-soft">Batas XP harian (1.000) sudah tercapai. Check-in tetap tercatat.</span>}
        <div className="h-px bg-track" />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[12px] text-fg-soft">
            <span>
              Level {level.level} · {level.name}
            </span>
            <span>
              {result.total_xp.toLocaleString("id-ID")}
              {level.nextMinXp !== null ? ` / ${level.nextMinXp.toLocaleString("id-ID")}` : ""} XP
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-lg bg-track">
            <div className="h-full bg-xp" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        </div>
      </div>
      {result.flagged && (
        <p className="w-full rounded-2xl bg-warn-tint px-4 py-3 text-[12px] leading-[1.5] text-warn">
          Lokasi kamu {result.distance_m !== null ? `${result.distance_m} m dari checkpoint` : "tidak terbaca"}. Check-in tetap dihitung, tetapi akan ditinjau tim Ramein.
        </p>
      )}
      <div className="mt-auto flex w-full flex-col gap-2.5">
        <Link href={result.points > 0 ? "/dompet" : `/aktivitas/${result.activity_id}`} className="flex h-[52px] items-center justify-center rounded-2xl bg-primary text-[15px] font-semibold text-on-primary">
          {result.points > 0 ? "Tukar poin" : "Lihat aktivitas"}
        </Link>
        <Link href="/" className="flex h-12 items-center justify-center rounded-2xl text-[14px] font-semibold text-fg-label">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}
