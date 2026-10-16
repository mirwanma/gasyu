import Link from "next/link";
import { Icon } from "@/components/icons";
import { QrDisplay } from "@/components/organizer/qr-display";
import { OrganizerShell } from "@/components/organizer/shell";
import { cardClass } from "@/components/styles";
import { formatSchedule } from "@/lib/activities";
import { listQrCheckpoints, listTodayCheckins } from "@/lib/data/checkins";
import { timeAgo } from "@/lib/format";

type Kind = "merchant" | "community";
const basePath = (type: Kind, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;

// Halaman QR checkpoint (staf): pilih checkpoint, tampilkan QR, lihat check-in hari ini.
export function QrPage({ id, type, selected }: { id: string; type: Kind; selected?: string }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="QR" title="QR check-in">
      {() => <QrBody base={base} id={id} selected={selected} />}
    </OrganizerShell>
  );
}

async function QrBody({ base, id, selected }: { base: string; id: string; selected?: string }) {
  const checkpoints = await listQrCheckpoints(id);
  const current = checkpoints.find((c) => c.id === selected) ?? checkpoints[0];

  if (!current) {
    return (
      <div className={`${cardClass} flex flex-col gap-1 p-4`}>
        <span className="text-[15px] font-semibold">Belum ada checkpoint aktif</span>
        <span className="text-[13px] leading-[1.5] text-fg-soft">QR muncul untuk checkpoint di aktivitas yang sudah terbit atau sedang berjalan.</span>
        <Link href={`${base}/aktivitas`} className="pt-2 text-[13px] font-semibold text-link">
          Lihat aktivitas
        </Link>
      </div>
    );
  }
  const feed = await listTodayCheckins(current.id);
  const running = current.activity.status === "running";

  return (
    <>
      {checkpoints.length > 1 ? (
        <form className="flex flex-col gap-1.5">
          <label htmlFor="cp" className="text-[12px] font-semibold text-fg-soft">Checkpoint</label>
          <select id="cp" name="cp" defaultValue={current.id} className="h-[52px] w-full rounded-2xl border border-line bg-surface px-3.5 text-[14px] font-bold text-fg">
            {checkpoints.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.activity.title}
              </option>
            ))}
          </select>
          <noscript>
            <button type="submit" className="text-[13px] font-semibold text-link">Pilih</button>
          </noscript>
          <SelectAutoSubmit />
        </form>
      ) : null}
      <div className={`${cardClass} flex items-center gap-3 p-3.5`}>
        <span className="flex size-10 items-center justify-center rounded-xl bg-primary-tint text-link">
          <Icon name="pin" size={18} stroke={2} />
        </span>
        <span className="flex flex-1 flex-col">
          <span className="text-[14px] font-bold">{current.name}</span>
          <span className="text-[12px] text-fg-soft">
            {current.activity.title} · {formatSchedule(current.activity.starts_at, current.activity.ends_at)} · radius {current.radius_m} m
          </span>
        </span>
        <span className={`text-[11px] font-bold ${running ? "text-success" : "text-warn"}`}>{running ? "Berjalan" : "Belum mulai"}</span>
      </div>

      {!running && (
        <p className="rounded-2xl bg-warn-tint px-4 py-3 text-[12px] leading-[1.5] text-warn">
          QR sudah bisa ditampilkan, tetapi check-in warga baru diterima setelah jam mulai aktivitas.
        </p>
      )}

      <QrDisplay checkpointId={current.id} />

      <section className={`${cardClass} flex flex-col gap-2.5 p-3.5`}>
        <div className="flex items-baseline justify-between">
          <span className="text-[14px] font-bold">Check-in hari ini</span>
          <span className="font-display text-[22px] font-semibold">{feed.length}</span>
        </div>
        {feed.length === 0 && <span className="text-[13px] text-fg-soft">Belum ada yang check-in.</span>}
        {feed.slice(0, 10).map((row) => (
          <div key={row.id} className="flex justify-between text-[13px]">
            <span>
              <b>{row.nickname}</b> <span className="text-fg-soft">{timeAgo(row.checked_in_at)}</span>
            </span>
            <span className={`font-semibold ${row.review_status === "flagged" ? "text-warn" : "text-success"}`}>
              {row.review_status === "flagged" ? "Di luar radius" : "Di radius"}
            </span>
          </div>
        ))}
      </section>
      <span className="text-center text-[12px] text-fg-soft">Layar tetap menyala selama halaman ini terbuka. Muat ulang untuk memperbarui daftar.</span>
    </>
  );
}

// Kirim formulir saat pilihan berubah (tanpa JavaScript, tombol di noscript dipakai).
function SelectAutoSubmit() {
  return <script dangerouslySetInnerHTML={{ __html: `document.getElementById('cp').addEventListener('change',function(){this.form.submit()})` }} />;
}
