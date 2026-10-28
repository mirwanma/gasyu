import Link from "next/link";
import { MissionCodeForm, MissionPhotoForm } from "./mission-actions";
import { Icon, type IconName } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import { VERIFICATION_HOW, type CitizenMission, type CitizenMissionList } from "@/lib/missions";
import { formatDateTime } from "@/lib/format";

const ICONS: Record<string, IconName> = { qr_scan: "qr", secret_code: "keyboard", photo: "upload", manual: "flag" };

// Bagian "Misi" di halaman aktivitas warga, mengikuti artboard "Warga · Detail aktivitas":
// misi terbuka lengkap dengan aksi; misi belum terbuka sebagai kartu rahasia (teaser).
export function MissionSection({ list, activityId, activityType, targetKind }: { list: CitizenMissionList | null; activityId: string; activityType: "event" | "challenge"; targetKind: string | null }) {
  const missions = list?.missions ?? [];
  // Event Global: misi memberi skor event, tanpa wajib/bonus dan tanpa status selesai (ALUR bagian 22c).
  const global = list?.reach === "global";
  const requiredTotal = list?.required_total ?? 0;
  const requiredDone = list?.required_done ?? 0;
  const rule = global
    ? "Setiap misi yang berhasil menambah skor event. Skor tertinggi memenangkan hadiah, dan kamu bisa terus menambah skor sampai acara berakhir."
    : activityType === "event"
      ? requiredTotal > 0
        ? "Selesai saat kamu check-in di checkpoint dan semua misi wajib disetujui. Misi bonus menambah Jejak."
        : "Selesai saat kamu check-in di checkpoint. Misi bonus menambah Jejak."
      : targetKind === "required_missions"
        ? "Selesai saat semua misi wajib disetujui."
        : targetKind === "missions_completed"
          ? "Selesai saat jumlah misi yang disetujui mencapai target."
          : "Progress bertambah tiap check-in di checkpoint. Misi menambah Jejak.";

  return (
    <section id="misi" className="flex scroll-mt-4 flex-col gap-2.5">
      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[18px] font-semibold">Misi</h2>
        {requiredTotal > 0 && !global && (
          <span className="text-[13px] font-semibold text-fg-soft">
            {requiredDone} dari {requiredTotal} wajib selesai
          </span>
        )}
      </div>
      <p className="text-[15px] leading-[1.5] text-fg-soft">{rule}</p>
      {list && list.participation_status && list.payment_status && !["not_required", "paid"].includes(list.payment_status) && (
        <p className="rounded-2xl bg-warn-tint px-4 py-3 text-[15px] text-warn">Check-in dan misi terbuka setelah pembayaran dikonfirmasi panitia.</p>
      )}
      {missions.length === 0 && <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>Belum ada misi di aktivitas ini.</p>}
      {missions.map((m) => (
        <MissionCard key={m.id} m={m} activityId={activityId} global={global} />
      ))}
    </section>
  );
}

function MissionCard({ m, activityId, global }: { m: CitizenMission; activityId: string; global: boolean }) {
  const reward = global ? `+${m.score_reward.toLocaleString("id-ID")} skor` : `+${m.xp_reward} Jejak`;
  const kindTag = global ? null : <span className={`${tagClass.base} ${m.is_required ? tagClass.hot : tagClass.info}`}>{m.is_required ? "WAJIB" : "BONUS"}</span>;
  if (!m.open) {
    return (
      <div className={`${cardClass} flex items-center gap-3 border-dashed p-3.5 opacity-80`}>
        <span className="flex size-10 items-center justify-center rounded-xl bg-track text-fg-muted">
          <Icon name="shield" size={18} stroke={2} />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="flex items-center gap-1.5">
            {kindTag}
            <span className="text-[15px] font-semibold">Misi rahasia</span>
          </span>
          <span className="text-[13px] text-fg-soft">{m.hint}</span>
        </span>
        <span className={`text-[15px] font-semibold ${global ? "text-hot" : "text-xp"}`}>{reward}</span>
      </div>
    );
  }
  const done = m.my_status === "approved";
  const pending = m.my_status === "pending_review";
  const rejected = m.my_status === "rejected";
  return (
    <div className={`${cardClass} flex flex-col gap-2.5 p-3.5 ${done ? "border-success/40" : ""}`}>
      <div className="flex items-start gap-3">
        <span className={`flex size-10 shrink-0 items-center justify-center rounded-xl ${done ? "bg-success-tint text-success" : "bg-primary-tint text-link"}`}>
          <Icon name={done ? "check" : (ICONS[m.verification] ?? "flag")} size={18} stroke={2} />
        </span>
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="flex flex-wrap items-center gap-1.5">
            {kindTag}
            <span className="text-[12px] text-fg-soft">{VERIFICATION_HOW[m.verification]}</span>
          </span>
          <span className="text-[15px] font-semibold">{m.title}</span>
          {m.description && <span className="text-[13px] leading-[1.5] text-fg-soft">{m.description}</span>}
          {m.checkpoint_name && <span className="text-[12px] text-fg-muted">Lokasi: {m.checkpoint_name}</span>}
          {(m.available_from || m.available_until) && (
            <span className="text-[12px] text-fg-muted">
              {m.available_from ? `Mulai ${formatDateTime(m.available_from)}` : ""}
              {m.available_from && m.available_until ? " · " : ""}
              {m.available_until ? `sampai ${formatDateTime(m.available_until)}` : ""}
            </span>
          )}
        </span>
        <span className={`text-[15px] font-semibold ${done ? "text-success" : global ? "text-hot" : "text-xp"}`}>{reward}</span>
      </div>
      {done && <span className="text-[13px] font-semibold text-success">Selesai{m.my_submitted_at ? ` · ${formatDateTime(m.my_submitted_at)}` : ""}</span>}
      {pending && <span className="text-[13px] font-semibold text-warn">Foto sedang ditinjau panitia</span>}
      {rejected && <span className="text-[13px] text-danger">Ditolak{m.my_note ? `: ${m.my_note}` : ""}</span>}
      {m.can_work && m.verification === "qr_scan" && (
        <Link href="/scan" className="flex h-10 w-fit items-center gap-2 rounded-xl bg-fg px-4 text-[15px] font-semibold text-bg">
          <Icon name="scan" size={16} stroke={2.2} />
          Scan QR misi
        </Link>
      )}
      {m.can_work && m.verification === "secret_code" && <MissionCodeForm missionId={m.id} activityId={activityId} />}
      {m.can_work && m.verification === "photo" && <MissionPhotoForm missionId={m.id} activityId={activityId} retry={rejected} />}
      {!done && !pending && m.verification === "manual" && <span className="text-[13px] text-fg-muted">Panitia akan menandai saat kamu berhasil.</span>}
    </div>
  );
}
