"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import jsQR from "jsqr";
import { performCheckin } from "@/lib/actions/checkin";
import { completeMissionQr } from "@/lib/actions/missions";
import { parseQrPayload, type CheckinResult, type QrPayload } from "@/lib/checkin";
import type { MissionResult } from "@/lib/missions";
import { levelFor, type LevelRow } from "@/lib/gamification/level";
import { Icon } from "@/components/icons";

type Phase =
  | { kind: "scan" }
  | { kind: "confirm"; payload: QrPayload }
  | { kind: "sending" }
  | { kind: "done"; result: CheckinResult }
  | { kind: "mission"; result: MissionResult }
  | { kind: "error"; message: string };

// Halaman Scan QR warga, mengikuti artboard "Warga · Scan QR" dan "Warga · Check-in berhasil".
export function Scanner({ initial, levels }: { initial: QrPayload | null; levels: LevelRow[] }) {
  const [phase, setPhase] = useState<Phase>(initial ? { kind: "confirm", payload: initial } : { kind: "scan" });
  // Lokasi disimpan di ref, bukan state: jika submit bergantung pada state lokasi, kamera
  // ikut dinyalakan ulang setiap GPS memperbarui posisi (kamera berkedip, pemindaian tersendat).
  const geoRef = useRef<{ lat: number; lng: number } | null>(null);
  const [hasGeo, setHasGeo] = useState(false);
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
        geoRef.current = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        setHasGeo(true);
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
      const geo = geoRef.current;
      if (payload.kind === "mission") {
        const res = await completeMissionQr(payload.missionId, payload.token, geo?.lat ?? null, geo?.lng ?? null);
        submittingRef.current = false;
        setPhase(res.ok ? { kind: "mission", result: res.result } : { kind: "error", message: res.error });
        return;
      }
      const res = await performCheckin(payload.checkpointId, payload.token, geo?.lat ?? null, geo?.lng ?? null);
      submittingRef.current = false;
      setPhase(res.ok ? { kind: "done", result: res.result } : { kind: "error", message: res.error });
    },
    [],
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
            setCameraMessage("QR ini bukan QR Gasyu.");
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
      .catch(() => {
        // Kamera yang sengaja dihentikan (pindah fase) bukan kegagalan.
        if (!stopped) setCameraMessage("Kamera tidak bisa dibuka. Izinkan akses kamera, atau buka QR lewat kamera bawaan HP.");
      });

    return () => {
      stopped = true;
      cancelAnimationFrame(raf);
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [phase.kind, submit]);

  if (phase.kind === "done") return phase.result.reach === "global" ? <ScoreReward kind="checkin" result={phase.result} /> : <Reward result={phase.result} levels={levels} />;
  if (phase.kind === "mission") return phase.result.reach === "global" ? <ScoreReward kind="mission" result={phase.result} /> : <MissionReward result={phase.result} levels={levels} />;

  return (
    <div className="flex min-h-screen flex-col items-center gap-6 px-5 pb-8 pt-6" style={{ background: "var(--color-bg)" }}>
      <div className="flex w-full items-center justify-between">
        <Link href="/" className="flex min-h-12 items-center gap-1.5 rounded-full border border-line bg-surface pl-3 pr-4 text-[15px] font-semibold text-fg">
          <Icon name="close" stroke={2} />
          Tutup
        </Link>
        <span className="font-display text-[22px] font-semibold text-fg">Scan QR</span>
        <span className="w-[92px]" />
      </div>

      {phase.kind === "confirm" ? (
        <div className="flex w-full flex-1 flex-col items-center justify-center gap-4 text-center">
          <span className="text-[16px] leading-[1.5] text-fg-label">
            {phase.payload.kind === "mission" ? "QR misi terbaca. Pastikan kamu berada di lokasi, lalu selesaikan misinya." : "QR check-in terbaca. Pastikan kamu berada di lokasi, lalu lanjutkan."}
          </span>
          <button type="button" onClick={() => void submit(phase.payload)} className="flex min-h-[58px] w-full items-center justify-center rounded-2xl bg-primary text-[16px] font-semibold text-on-primary hover:bg-primary-hover">
            {phase.payload.kind === "mission" ? "Selesaikan misi" : "Check-in sekarang"}
          </button>
          <button type="button" onClick={() => setPhase({ kind: "scan" })} className="text-[15px] font-semibold text-fg-soft">
            Pindai ulang
          </button>
        </div>
      ) : (
        <>
          <p className="max-w-[280px] text-center text-[16px] leading-[1.5] text-fg-label">Arahkan kamera ke QR di HP staf penyelenggara</p>
          <div className="relative size-[260px] overflow-hidden rounded-[20px]">
            <video ref={videoRef} playsInline muted className="absolute inset-0 size-full object-cover" />
            <canvas ref={canvasRef} className="hidden" />
            <span className="absolute left-0 top-0 size-14 rounded-tl-[20px] border-l-[5px] border-t-[5px] border-hot" />
            <span className="absolute right-0 top-0 size-14 rounded-tr-[20px] border-r-[5px] border-t-[5px] border-hot" />
            <span className="absolute bottom-0 left-0 size-14 rounded-bl-[20px] border-b-[5px] border-l-[5px] border-hot" />
            <span className="absolute bottom-0 right-0 size-14 rounded-br-[20px] border-b-[5px] border-r-[5px] border-hot" />
            <span className="absolute inset-x-6 top-[128px] h-0.5 bg-hot shadow-[0_0_16px_var(--color-hot)]" />
            {phase.kind === "sending" && (
              <span className="absolute inset-0 flex items-center justify-center bg-scrim text-[15px] font-semibold text-cream">Memproses check-in…</span>
            )}
          </div>
          {phase.kind === "error" && (
            <div role="alert" className="flex w-full flex-col gap-2 rounded-2xl border border-danger/40 bg-danger-tint px-4 py-3 text-center text-[15px] text-danger">
              {phase.message}
              <button type="button" onClick={() => setPhase({ kind: "scan" })} className="font-bold">
                Coba lagi
              </button>
            </div>
          )}
          {cameraMessage && <span className="text-center text-[13px] text-warn">{cameraMessage}</span>}
        </>
      )}

      <div className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-[15px] font-semibold ${hasGeo ? "bg-success-tint text-success" : "bg-warn-tint text-warn"}`}>
        <Icon name="pin" size={16} stroke={2} />
        {geoMessage}
      </div>

      <div className="mt-auto flex w-full flex-col gap-2.5">
        <Link href="/#aktivitasku" className="flex h-[52px] items-center justify-center gap-2 rounded-2xl border border-line-strong bg-surface text-[16px] font-semibold text-fg">
          <Icon name="keyboard" size={18} stroke={2} />
          Ketik kode misi: buka aktivitasmu
        </Link>
        <span className="text-center text-[13px] text-fg-muted">QR check-in dan QR misi berganti tiap 60 detik. Foto QR yang disebar tidak akan berlaku.</span>
      </div>
    </div>
  );
}

// Event Global: hasil berupa skor event, tanpa Jejak, level, atau poin (ALUR bagian 22c).
function ScoreReward(props: { kind: "checkin"; result: CheckinResult } | { kind: "mission"; result: MissionResult }) {
  const isCheckin = props.kind === "checkin";
  const gained = isCheckin ? (props.result.score ?? 0) : (props.result.mission_score ?? 0);
  const total = isCheckin ? props.result.event_score : undefined;
  const activityId = props.result.activity_id;
  return (
    <div className="flex min-h-screen flex-col items-center gap-[18px] px-5 pb-7 pt-12" style={{ background: "var(--color-bg)" }}>
      <div className="flex size-24 items-center justify-center rounded-full bg-success text-bg ring-[12px] ring-success/15">
        <Icon name="check" size={48} stroke={2.6} />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[15px] text-fg-label">{isCheckin ? `${props.result.partner_name} · ${props.result.checkpoint_name}` : props.result.activity_title}</span>
        <h1 className="font-display text-[28px] font-bold">{isCheckin ? "Check-in berhasil!" : "Misi selesai!"}</h1>
        <span className="text-[15px] text-fg-soft">{isCheckin ? props.result.activity_title : props.result.mission_title}</span>
      </div>
      <div className="flex w-full gap-3">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <span className="font-display text-[32px] font-bold text-hot">+{gained.toLocaleString("id-ID")}</span>
          <span className="text-[13px] text-fg-soft">skor event</span>
        </div>
        {total !== undefined && (
          <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
            <span className="font-display text-[32px] font-bold">{total.toLocaleString("id-ID")}</span>
            <span className="text-[13px] text-fg-soft">total skor kamu</span>
          </div>
        )}
      </div>
      <p className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-[15px] leading-[1.5] text-fg-label">
        Ini Event Global: skor hanya dihitung untuk papan peringkat event ini, tidak menambah Jejak, level, atau poin.
      </p>
      {props.result.flagged && (
        <p className="w-full rounded-2xl bg-warn-tint px-4 py-3 text-[13px] leading-[1.5] text-warn">
          Lokasi kamu {props.result.distance_m != null ? `${props.result.distance_m} m dari checkpoint` : "tidak terbaca"}. Tetap dihitung, tetapi akan ditinjau tim Gasyu.
        </p>
      )}
      <div className="mt-auto flex w-full flex-col gap-2.5">
        <Link href={activityId ? `/aktivitas/${activityId}/peringkat` : "/"} className="flex h-[52px] items-center justify-center rounded-2xl bg-primary text-[16px] font-semibold text-on-primary">
          Lihat papan peringkat
        </Link>
        <Link href={activityId ? `/aktivitas/${activityId}` : "/"} className="flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-fg-label">
          Lihat misi lainnya
        </Link>
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
  // Jejak sebelum dipotong batas harian; jika total lebih kecil, batas harian tercapai.
  const planned = rows.reduce((sum, [, v]) => sum + v, 0);
  const shown = result.target_scope === "group" ? (result.group_progress ?? result.progress) : result.progress;
  return (
    <div className="flex min-h-screen flex-col items-center gap-[18px] px-5 pb-7 pt-12" style={{ background: "var(--color-bg)" }}>
      <div className="flex size-24 items-center justify-center rounded-full bg-success text-bg ring-[12px] ring-success/15">
        <Icon name="check" size={48} stroke={2.6} />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[15px] text-fg-label">
          {result.partner_name} · {result.checkpoint_name}
        </span>
        <h1 className="font-display text-[28px] font-bold">{isChallenge && result.completed ? "Challenge selesai!" : "Check-in berhasil!"}</h1>
        <span className="text-[15px] text-fg-soft">
          {result.activity_title}
          {isChallenge ? ` · ${Math.min(shown, result.target_count)} dari ${result.target_count}${result.target_scope === "group" ? " (grup)" : ""}` : result.completed ? " · selesai" : ""}
        </span>
      </div>
      <div className="flex w-full gap-3">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <span className="font-display text-[32px] font-bold text-xp">+{result.xp_total}</span>
          <span className="text-[13px] text-fg-soft">Jejak</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <PointsBox points={result.points} promised={result.points_promised ?? 0} completed={result.completed} from={result.partner_name} />
        </div>
      </div>
      <div className="flex w-full flex-col gap-2.5 rounded-[20px] border border-line bg-surface p-4">
        {rows.filter(([, v]) => v > 0).map(([k, v]) => (
          <div key={k} className="flex justify-between text-[15px]">
            <span className="text-fg-label">{k}</span>
            <span className="font-semibold">+{v}</span>
          </div>
        ))}
        {planned === 0 && isChallenge && !result.completed && <span className="text-[15px] text-fg-soft">Jejak challenge masuk saat challenge selesai. Check-in ini tercatat sebagai progres.</span>}
        {result.xp_total < planned && <span className="text-[15px] text-fg-soft">Batas Jejak harian sudah tercapai, jadi Jejak check-in ini dipotong. Check-in tetap tercatat.</span>}
        <div className="h-px bg-track" />
        <div className="flex flex-col gap-1.5">
          <div className="flex justify-between text-[13px] text-fg-soft">
            <span>
              Level {level.level} · {level.name}
            </span>
            <span>
              {result.total_xp.toLocaleString("id-ID")}
              {level.nextMinXp !== null ? ` / ${level.nextMinXp.toLocaleString("id-ID")}` : ""} Jejak
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-lg bg-track">
            <div className="h-full bg-xp" style={{ width: `${Math.max(pct, 2)}%` }} />
          </div>
        </div>
      </div>
      {result.flagged && (
        <p className="w-full rounded-2xl bg-warn-tint px-4 py-3 text-[13px] leading-[1.5] text-warn">
          Lokasi kamu {result.distance_m !== null ? `${result.distance_m} m dari checkpoint` : "tidak terbaca"}. Check-in tetap dihitung, tetapi akan ditinjau tim Gasyu.
        </p>
      )}
      <div className="mt-auto flex w-full flex-col gap-2.5">
        <Link href={result.points > 0 ? "/dompet" : `/aktivitas/${result.activity_id}`} className="flex h-[52px] items-center justify-center rounded-2xl bg-primary text-[16px] font-semibold text-on-primary">
          {result.points > 0 ? "Tukar poin" : "Lihat aktivitas"}
        </Link>
        <Link href="/" className="flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-fg-label">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}

function MissionReward({ result, levels }: { result: MissionResult; levels: LevelRow[] }) {
  const totalXp = result.total_xp ?? 0;
  const level = levelFor(totalXp, levels);
  const currentMin = levels.find((l) => l.level === level.level)?.min_xp ?? 0;
  const pct = level.nextMinXp === null ? 100 : Math.round(((totalXp - currentMin) / (level.nextMinXp - currentMin)) * 100);
  const gained = (result.mission_xp ?? 0) + (result.xp ?? 0);
  return (
    <div className="flex min-h-screen flex-col items-center gap-[18px] px-5 pb-7 pt-12" style={{ background: "var(--color-bg)" }}>
      <div className="flex size-24 items-center justify-center rounded-full bg-success text-bg ring-[12px] ring-success/15">
        <Icon name="check" size={48} stroke={2.6} />
      </div>
      <div className="flex flex-col items-center gap-1.5 text-center">
        <span className="text-[15px] text-fg-label">{result.activity_title}</span>
        <h1 className="font-display text-[28px] font-bold">{result.completed ? "Aktivitas selesai!" : "Misi selesai!"}</h1>
        <span className="text-[15px] text-fg-soft">
          {result.mission_title}
          {result.required_total ? ` · ${result.required_done ?? 0} dari ${result.required_total} misi wajib` : ""}
        </span>
      </div>
      <div className="flex w-full gap-3">
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <span className="font-display text-[32px] font-bold text-xp">+{gained}</span>
          <span className="text-[13px] text-fg-soft">Jejak{result.xp ? " · termasuk bonus selesai" : ""}</span>
        </div>
        <div className="flex flex-1 flex-col items-center gap-1 rounded-[20px] border border-line bg-surface p-4">
          <PointsBox points={result.points ?? 0} promised={result.points_promised ?? 0} completed={Boolean(result.completed)} />
        </div>
      </div>
      <div className="flex w-full flex-col gap-1.5 rounded-[20px] border border-line bg-surface p-4">
        <div className="flex justify-between text-[13px] text-fg-soft">
          <span>
            Level {level.level} · {level.name}
          </span>
          <span>
            {totalXp.toLocaleString("id-ID")}
            {level.nextMinXp !== null ? ` / ${level.nextMinXp.toLocaleString("id-ID")}` : ""} Jejak
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-lg bg-track">
          <div className="h-full bg-xp" style={{ width: `${Math.max(pct, 2)}%` }} />
        </div>
      </div>
      {result.flagged && (
        <p className="w-full rounded-2xl bg-warn-tint px-4 py-3 text-[13px] leading-[1.5] text-warn">
          Lokasi kamu {result.distance_m != null ? `${result.distance_m} m dari checkpoint` : "tidak terbaca"}. Misi tetap dihitung, tetapi akan ditinjau tim Gasyu.
        </p>
      )}
      <div className="mt-auto flex w-full flex-col gap-2.5">
        <Link href={result.activity_id ? `/aktivitas/${result.activity_id}` : "/"} className="flex h-[52px] items-center justify-center rounded-2xl bg-primary text-[16px] font-semibold text-on-primary">
          Lihat misi lainnya
        </Link>
        <Link href="/" className="flex h-12 items-center justify-center rounded-2xl text-[15px] font-semibold text-fg-label">
          Kembali ke beranda
        </Link>
      </div>
    </div>
  );
}

// Kotak poin di layar hasil scan: poin yang baru masuk, atau janji poin saat aktivitas selesai.
function PointsBox({ points, promised, completed, from }: { points: number; promised: number; completed: boolean; from?: string }) {
  const [value, label] =
    points > 0
      ? [points, from ? `poin dari ${from}` : "poin"]
      : !completed && promised > 0
        ? [promised, "poin · masuk setelah selesai"]
        : [0, promised > 0 ? "poin · budget habis" : "aktivitas tanpa poin"];
  return (
    <>
      <span className="font-display text-[32px] font-bold text-points">+{value}</span>
      <span className="text-center text-[13px] text-fg-soft">{label}</span>
    </>
  );
}
