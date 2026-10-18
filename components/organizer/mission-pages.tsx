import Link from "next/link";
import { notFound } from "next/navigation";
import { MissionForm, type MissionFormValues } from "@/components/organizer/mission-form";
import { QrDisplay } from "@/components/organizer/qr-display";
import { OrganizerShell, type OrganizerContext } from "@/components/organizer/shell";
import { Icon } from "@/components/icons";
import { StatusTag } from "@/components/activity-card";
import { cardClass, smallButton, tagClass, textareaClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { markManual, revealMission, reviewCompletion, toggleMission } from "@/lib/actions/missions";
import { toLocalInput } from "@/lib/activities";
import { listActivityPartners } from "@/lib/data/collab";
import { getActivityCard, getCheckpoints } from "@/lib/data/activities";
import { listManualCandidates, listReviewQueue, listTeamMissions, type TeamMission } from "@/lib/data/missions";
import { VERIFICATION_LABELS } from "@/lib/missions";
import { listTemplatesFor } from "@/lib/data/mission-templates";
import { CATEGORY_LABELS, type MissionTemplate } from "@/lib/mission-templates";
import { formatDateTime } from "@/lib/format";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

type Kind = "merchant" | "community";

export type MisiQuery = { tab?: string; tambah?: string; ubah?: string; qr?: string; tandai?: string; hasil?: string; error?: string; n?: string; template?: string };

// Halaman kelola misi untuk tim merchant/komunitas (dalam shell), mengikuti artboard "Kelola misi".
export function MisiPage({ id, type, aid, query }: { id: string; type: Kind; aid: string; query: MisiQuery }) {
  const base = `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;
  return (
    <OrganizerShell organizerId={id} type={type} active="Aktivitas">
      {(ctx) => <MisiBody organizerId={id} type={type} aid={aid} query={query} selfHref={`${base}/aktivitas/${aid}/misi`} backHref={`${base}/aktivitas/${aid}`} ctx={ctx} />}
    </OrganizerShell>
  );
}

const REVEAL_LABEL = (m: TeamMission): { label: string; tone: keyof typeof tagClass } => {
  if (!m.is_active) return { label: "Nonaktif", tone: "neutral" };
  if (m.revealed_at) return { label: "Terbuka", tone: "success" };
  if (m.reveal_mode === "after_mission") return { label: "Berantai", tone: "primary" };
  if (m.reveal_mode === "scheduled") return { label: `Terbuka ${m.reveal_at ? formatDateTime(m.reveal_at) : ""}`, tone: "warn" };
  if (m.reveal_mode === "manual") return { label: "Tersembunyi", tone: "neutral" };
  return { label: "Terbit bersama aktivitas", tone: "neutral" };
};

export async function MisiBody({
  organizerId,
  type,
  aid,
  query,
  selfHref,
  backHref,
  ctx,
}: {
  organizerId: string;
  type: "merchant" | "community" | "admin";
  aid: string;
  query: MisiQuery;
  selfHref: string;
  backHref: string;
  ctx?: OrganizerContext;
}) {
  const [card, missions, checkpoints, partners] = await Promise.all([getActivityCard(aid), listTeamMissions(aid), getCheckpoints(aid), listActivityPartners(aid)]);
  if (!card) notFound();
  const isHost = type === "admin" ? card.host_type === "platform" : card.host_organizer_id === organizerId;
  const myPartner = partners.find((p) => p.organizer_id === organizerId && p.status === "accepted");
  if (!isHost && !myPartner) notFound();
  const partnerOnly = !isHost;
  const sep = selfHref.includes("?") ? "&" : "?";
  const link = (q: string) => `${selfHref}${sep}${q}`;
  const tab = query.tab === "tinjau" ? "tinjau" : "misi";
  const editing = query.ubah ? missions.find((m) => m.id === query.ubah) : undefined;
  const showForm = query.tambah === "1" || !!editing;
  const canEdit = !["ended", "settled", "cancelled"].includes(card.status) && (type === "admin" || !!ctx);
  const pendingCount = missions.reduce((s, m) => s + m.stats.pending, 0);
  // Event Global: misi memberi skor event, bukan XP (ALUR bagian 22b).
  const isGlobal = card.reach === "global";
  const reward = (m: { xp_reward: number; score_reward: number }) => (isGlobal ? `+${m.score_reward.toLocaleString("id-ID")} skor` : `+${m.xp_reward} XP`);
  const totalScore = missions.filter((m) => m.is_active).reduce((s, m) => s + m.score_reward, 0);
  // Master misi: template aktif yang cocok untuk aktivitas dan penyelenggara ini.
  const templates =
    showForm && !editing && canEdit
      ? await listTemplatesFor({
          activityType: card.type,
          organizerType: type === "admin" ? "platform" : type,
          qrOnly: partnerOnly,
        })
      : [];
  const chosen = query.template ? templates.find((t) => t.id === query.template) : undefined;
  const mine = (m: TeamMission) => isHost || m.partner_organizer_id === organizerId;
  const notices: Record<string, string> = {
    buka: `Misi dibuka. ${query.n ?? 0} peserta diberi tahu.`,
    tandai: `${query.n ?? 0} peserta ditandai selesai.`,
    setuju: isGlobal ? "Bukti disetujui. Skor masuk ke papan peringkat." : "Bukti disetujui. XP masuk ke warga.",
    tolak: "Bukti ditolak dan warga diberi tahu. Ia boleh mengunggah ulang.",
  };

  return (
    <>
      <div className="flex items-center gap-3">
        <Link href={backHref} aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
          <Icon name="back" size={20} stroke={2} />
        </Link>
        <div className="flex flex-1 flex-col gap-0.5">
          <h1 className="font-display text-[19px] font-semibold leading-tight">{card.title}</h1>
          <span className="flex items-center gap-2 text-[12px] text-fg-soft">
            <StatusTag status={card.status} /> {card.seats_taken} peserta
          </span>
        </div>
      </div>

      {query.hasil && notices[query.hasil] && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">{notices[query.hasil]}</p>}
      {query.error && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">{query.error}</p>}

      <div role="tablist" className="grid grid-cols-2 gap-1.5 rounded-2xl border border-line bg-surface p-1">
        <a role="tab" aria-selected={tab === "misi"} href={selfHref} className={`flex h-10 items-center justify-center rounded-xl text-[13px] font-semibold ${tab === "misi" ? "bg-fg text-bg" : "text-fg-label"}`}>
          Misi · {missions.filter((m) => m.is_active).length}
        </a>
        <a role="tab" aria-selected={tab === "tinjau"} href={link("tab=tinjau")} className={`flex h-10 items-center justify-center rounded-xl text-[13px] font-semibold ${tab === "tinjau" ? "bg-fg text-bg" : "text-fg-label"}`}>
          Tinjau foto{pendingCount ? ` · ${pendingCount}` : ""}
        </a>
      </div>

      {tab === "tinjau" ? (
        <ReviewTab aid={aid} organizerId={organizerId} type={type} rewardOf={(missionId) => {
          const m = missions.find((x) => x.id === missionId);
          return m ? reward(m) : "";
        }} />
      ) : (
        <>
          {showForm && canEdit && !editing && templates.length > 0 && (
            <TemplatePicker templates={templates} chosen={chosen} pickHref={(id) => link(`tambah=1&template=${id}`)} clearHref={link("tambah=1")} />
          )}
          {showForm && canEdit && (
            <MissionForm
              key={chosen?.id ?? editing?.id ?? "baru"}
              templateId={chosen?.id}
              organizerId={organizerId}
              type={type}
              activityId={aid}
              checkpoints={checkpoints.filter((c) => c.is_active).map((c) => ({ id: c.id, name: c.name, partner_organizer_id: c.partner_organizer_id }))}
              otherMissions={missions.filter((m) => m.is_active).map((m) => ({ id: m.id, title: m.title, is_required: m.is_required }))}
              partnerOnly={partnerOnly && !editing}
              partnerOrganizerId={partnerOnly ? organizerId : undefined}
              initial={editing ? toFormValues(editing) : chosen ? fromTemplate(chosen) : undefined}
              onCancelHref={selfHref}
              global={isGlobal ? { locationMode: card.location_mode } : undefined}
            />
          )}
          {isGlobal && (
            <p className={`${cardClass} flex items-center justify-between gap-2 p-3.5 text-[13px]`}>
              <span className="text-fg-label">Total skor misi aktif</span>
              <span className={`font-display font-semibold ${totalScore > 5000 ? "text-danger" : "text-info"}`}>{totalScore.toLocaleString("id-ID")} / 5.000</span>
            </p>
          )}
          {missions.length === 0 && !showForm && (
            <p className={`${cardClass} p-4 text-[13px] leading-[1.5] text-fg-soft`}>
              {isGlobal
                ? "Belum ada misi. Di Event Global setiap misi memberi skor event (10–1.000) untuk papan peringkat; peserta tetap bisa menambah skor sampai acara berakhir."
                : "Belum ada misi. Misi adalah tugas di dalam aktivitas: scan QR booth, kode rahasia, foto, atau ditandai panitia. Warga dapat XP tiap misi, dan misi wajib ikut menentukan status selesai."}
            </p>
          )}
          {missions.map((m) => {
            const st = REVEAL_LABEL(m);
            const showQr = query.qr === m.id;
            const marking = query.tandai === m.id;
            return (
              <section key={m.id} className={`${cardClass} flex flex-col gap-2.5 p-3.5 ${m.is_active ? "" : "opacity-60"}`}>
                <div className="flex flex-wrap items-center gap-1.5">
                  {!isGlobal && <span className={`${tagClass.base} ${m.is_required ? tagClass.hot : tagClass.info}`}>{m.is_required ? "WAJIB" : "BONUS"}</span>}
                  <span className="text-[11px] font-semibold text-fg-soft">
                    {VERIFICATION_LABELS[m.verification]}
                    {m.partner_organizer_id !== card.host_organizer_id ? ` · dibuat ${m.partner_name}` : ""}
                  </span>
                  <span className={`${tagClass.base} ${tagClass[st.tone]} ml-auto`}>{st.label}</span>
                </div>
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-[15px] font-semibold">{m.title}</span>
                  <span className="whitespace-nowrap font-display text-[14px] font-semibold text-info">{reward(m)}</span>
                </div>
                <span className="text-[12px] text-fg-soft">{statNote(m)}</span>
                {m.is_active && mine(m) && (
                  <div className="flex flex-wrap gap-2">
                    {m.verification === "qr_scan" && (
                      <a href={showQr ? selfHref : link(`qr=${m.id}`)} className={smallButton.outline}>
                        {showQr ? "Sembunyikan QR" : "Tampilkan QR misi"}
                      </a>
                    )}
                    {m.verification === "manual" && ["running", "ended"].includes(card.status) && (m.revealed_at || m.reveal_mode === "after_mission") && (
                      <a href={marking ? selfHref : link(`tandai=${m.id}`)} className={smallButton.outline}>
                        {marking ? "Tutup" : "Tandai peserta"}
                      </a>
                    )}
                    {!m.revealed_at && ["manual", "scheduled"].includes(m.reveal_mode) && ["published", "running"].includes(card.status) && (
                      <form action={revealMission}>
                        <input type="hidden" name="mission_id" value={m.id} />
                        <input type="hidden" name="organizer_id" value={organizerId} />
                        <input type="hidden" name="type_org" value={type} />
                        <input type="hidden" name="activity_id" value={aid} />
                        <SubmitButton size="small" variant="dark" pendingText="Membuka…">Buka misi sekarang</SubmitButton>
                      </form>
                    )}
                    {canEdit && (
                      <a href={link(`ubah=${m.id}`)} className={smallButton.outline}>
                        Ubah
                      </a>
                    )}
                  </div>
                )}
                {canEdit && mine(m) && (
                  <form action={toggleMission} className="self-start">
                    <input type="hidden" name="mission_id" value={m.id} />
                    <input type="hidden" name="organizer_id" value={organizerId} />
                    <input type="hidden" name="type_org" value={type} />
                    <input type="hidden" name="activity_id" value={aid} />
                    <input type="hidden" name="active" value={m.is_active ? "false" : "true"} />
                    <button type="submit" className={`text-[12px] font-semibold ${m.is_active ? "text-danger" : "text-link"}`}>
                      {m.is_active ? "Nonaktifkan misi" : "Aktifkan lagi"}
                    </button>
                  </form>
                )}
                {showQr && (
                  <div className="flex flex-col items-center gap-2 border-t border-line pt-3">
                    <QrDisplay missionId={m.id} />
                    <span className="text-center text-[12px] text-fg-soft">QR misi berbeda dengan QR check-in. Warga memindainya lewat menu Scan.</span>
                  </div>
                )}
                {marking && <ManualMarker missionId={m.id} organizerId={organizerId} type={type} aid={aid} />}
              </section>
            );
          })}
          {canEdit && !showForm && (
            <a href={link("tambah=1")} className="flex h-[52px] items-center justify-center gap-2 rounded-2xl bg-primary text-[15px] font-semibold text-on-primary">
              <Icon name="plus" size={20} stroke={2.2} />
              Tambah misi
            </a>
          )}
        </>
      )}
    </>
  );
}

function statNote(m: TeamMission) {
  const s = m.stats;
  if (m.verification === "photo") return `${s.approved} disetujui · ${s.pending} menunggu tinjauan · ${s.rejected} ditolak`;
  if (m.verification === "qr_scan") return `${s.approved} selesai${s.flagged ? ` · ${s.flagged} di luar radius ditandai` : ""}`;
  if (m.verification === "manual") return `${s.approved} dari ${s.participants} ditandai selesai`;
  const base = `${s.approved} dari ${s.participants} selesai`;
  if (m.reveal_mode === "after_mission") return `${base} · terbuka untuk ${s.unlocked_for} warga`;
  if (!m.revealed_at && m.reveal_mode === "scheduled") return `${m.show_teaser ? "Teaser tampil ke warga" : "Tersembunyi"} · terbuka otomatis`;
  if (!m.revealed_at && m.reveal_mode === "manual") return "Warga belum melihat misi ini. Buka saat MC mengumumkan.";
  return base;
}

// Nilai awal form misi dari template master misi (disalin, tetap bisa diubah).
function fromTemplate(t: MissionTemplate): MissionFormValues {
  return {
    title: t.title,
    description: t.description ?? "",
    verification: t.verification,
    checkpoint_id: null,
    xp_reward: t.xp_reward,
    score_reward: 0,
    is_required: t.is_required,
    reveal_mode: "on_publish",
    reveal_at: "",
    prerequisite_mission_id: null,
    show_teaser: true,
    available_from: "",
    available_until: "",
    locked: false,
    revealed: false,
  };
}

// Daftar template master misi di atas form tambah misi.
function TemplatePicker({
  templates,
  chosen,
  pickHref,
  clearHref,
}: {
  templates: MissionTemplate[];
  chosen?: MissionTemplate;
  pickHref: (id: string) => string;
  clearHref: string;
}) {
  if (chosen) {
    return (
      <section className="flex flex-col gap-1.5 rounded-[18px] border border-primary/30 bg-primary-tint p-3.5">
        <span className="flex items-center justify-between gap-2">
          <span className="text-[13px] font-bold text-link">Dari master misi: {chosen.title}</span>
          <a href={clearHref} className="text-[12px] font-semibold text-link">Ganti</a>
        </span>
        <span className="text-[12px] leading-[1.5] text-fg-label">Isi form sudah terisi dari template. Sesuaikan judul, instruksi, dan XP dengan aktivitasmu.</span>
        {chosen.organizer_tips && <span className="text-[12px] leading-[1.5] text-fg-label">Tips: {chosen.organizer_tips}</span>}
      </section>
    );
  }
  return (
    <details className={`${cardClass} group overflow-hidden`} open>
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3">
        <span className="flex flex-col">
          <span className="text-[14px] font-bold">Mulai dari master misi</span>
          <span className="text-[12px] text-fg-soft">{templates.length} template siap pakai dari tim Gasyu, atau isi form di bawah dari nol.</span>
        </span>
        <Icon name="chevronDown" size={16} stroke={2} className="shrink-0 text-fg-muted group-open:hidden" />
      </summary>
      <ul className="flex max-h-[360px] flex-col overflow-y-auto border-t border-line">
        {templates.map((t) => (
          <li key={t.id} className="flex items-center gap-3 border-b border-line px-4 py-2.5 last:border-b-0">
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[13px] font-semibold">{t.title}</span>
              <span className="text-[11px] text-fg-soft">
                {CATEGORY_LABELS[t.category]} · {VERIFICATION_LABELS[t.verification]} · {t.xp_reward} XP · {t.is_required ? "wajib" : "bonus"}
              </span>
            </span>
            <a href={pickHref(t.id)} className={smallButton.outline}>Pakai</a>
          </li>
        ))}
      </ul>
    </details>
  );
}

function toFormValues(m: TeamMission): MissionFormValues {
  return {
    id: m.id,
    title: m.title,
    description: m.description ?? "",
    verification: m.verification,
    checkpoint_id: m.checkpoint_id,
    xp_reward: m.xp_reward,
    score_reward: m.score_reward,
    is_required: m.is_required,
    reveal_mode: m.reveal_mode,
    reveal_at: toLocalInput(m.reveal_at),
    prerequisite_mission_id: m.prerequisite_mission_id,
    show_teaser: m.show_teaser,
    available_from: toLocalInput(m.available_from),
    available_until: toLocalInput(m.available_until),
    locked: !!m.locked_at,
    revealed: !!m.revealed_at,
  };
}

async function ManualMarker({ missionId, organizerId, type, aid }: { missionId: string; organizerId: string; type: string; aid: string }) {
  const candidates = await listManualCandidates(missionId);
  const todo = candidates.filter((c) => !c.done);
  return (
    <form action={markManual} className="flex flex-col gap-2 border-t border-line pt-3">
      <input type="hidden" name="mission_id" value={missionId} />
      <input type="hidden" name="organizer_id" value={organizerId} />
      <input type="hidden" name="type_org" value={type} />
      <input type="hidden" name="activity_id" value={aid} />
      <span className="text-[13px] font-semibold">Tandai peserta yang berhasil · {candidates.length - todo.length} sudah</span>
      {todo.length === 0 ? (
        <span className="text-[12px] text-fg-soft">Semua peserta yang memenuhi syarat sudah ditandai.</span>
      ) : (
        <div className="flex max-h-72 flex-col gap-1 overflow-y-auto">
          {todo.map((c) => (
            <label key={c.user_id} className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 text-[13px] hover:bg-bg">
              <input type="checkbox" name="user_id" value={c.user_id} />
              <span className="flex-1">
                <b>{c.nickname}</b> <span className="text-fg-soft">· {c.village_name ?? "Luar Cimahi"}</span>
              </span>
            </label>
          ))}
        </div>
      )}
      {todo.length > 0 && (
        <SubmitButton size="small" variant="dark" pendingText="Menandai…" className="self-start">
          Tandai selesai
        </SubmitButton>
      )}
    </form>
  );
}

async function ReviewTab({ aid, organizerId, type, rewardOf }: { aid: string; organizerId: string; type: string; rewardOf: (missionId: string) => string }) {
  const supabase = await createClient();
  const [pending, history] = await Promise.all([listReviewQueue(aid, "pending"), listReviewQueue(aid, "history")]);
  const first = pending[0];
  const url = first ? await signedUrl(supabase, "mission-proofs", first.proof_path) : null;
  return (
    <>
      {first ? (
        <section className={`${cardClass} flex flex-col gap-3 p-3.5`}>
          <div className="flex items-baseline justify-between">
            <h2 className="text-[15px] font-bold">Tinjau bukti foto</h2>
            <span className="text-[12px] text-fg-soft">1 dari {pending.length}</span>
          </div>
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element -- URL bertanda tangan sementara dari bucket privat
            <img src={url} alt={`Bukti foto ${first.nickname}`} className="max-h-[320px] w-full rounded-[14px] object-contain bg-track" />
          ) : (
            <div className="flex h-40 items-center justify-center rounded-[14px] bg-track text-[12px] text-fg-soft">Foto tidak bisa dimuat</div>
          )}
          <span className="text-[13px]">
            <b>{first.nickname}</b> · {first.mission_title} · {formatDateTime(first.submitted_at)} · {rewardOf(first.mission_id) || `+${first.xp_reward} XP`}
          </span>
          <form action={reviewCompletion} className="flex flex-col gap-2">
            <input type="hidden" name="completion_id" value={first.id} />
            <input type="hidden" name="organizer_id" value={organizerId} />
            <input type="hidden" name="type_org" value={type} />
            <input type="hidden" name="activity_id" value={aid} />
            <textarea name="note" rows={2} placeholder="Catatan untuk warga (wajib saat menolak)" className={textareaClass} />
            <div className="grid grid-cols-2 gap-2.5">
              <SubmitButton size="small" variant="danger" name="decision" value="reject" pendingText="…" className="h-11">
                Tolak + catatan
              </SubmitButton>
              <SubmitButton size="small" variant="dark" name="decision" value="approve" pendingText="…" className="h-11 bg-success text-white">
                Setujui
              </SubmitButton>
            </div>
          </form>
        </section>
      ) : (
        <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Tidak ada bukti foto yang menunggu tinjauan.</p>
      )}
      {pending.length > 1 && (
        <div className={`${cardClass} overflow-hidden`}>
          {pending.slice(1).map((p) => (
            <div key={p.id} className="flex items-center justify-between border-b border-line px-4 py-2.5 text-[13px] last:border-b-0">
              <span>
                <b>{p.nickname}</b> · {p.mission_title}
              </span>
              <span className="text-fg-soft">{formatDateTime(p.submitted_at)}</span>
            </div>
          ))}
        </div>
      )}
      {history.length > 0 && (
        <details className="text-[13px]">
          <summary className="cursor-pointer font-semibold text-fg-label">Riwayat tinjauan · {history.length}</summary>
          <div className={`${cardClass} mt-2 overflow-hidden`}>
            {history.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 border-b border-line px-4 py-2.5 last:border-b-0">
                <span className="flex flex-col">
                  <span>
                    <b>{p.nickname}</b> · {p.mission_title}
                  </span>
                  {p.review_note && <span className="text-[12px] text-fg-soft">{p.review_note}</span>}
                </span>
                <span className={`${tagClass.base} ${p.status === "approved" ? tagClass.success : tagClass.hot}`}>{p.status === "approved" ? "Disetujui" : "Ditolak"}</span>
              </div>
            ))}
          </div>
        </details>
      )}
    </>
  );
}
