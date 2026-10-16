import Link from "next/link";
import { notFound } from "next/navigation";
import { ActivityRow, StatusTag, coverStyle } from "@/components/activity-card";
import { Icon } from "@/components/icons";
import { ActivityForm, ActivityLiteForm, type ActivityFormValues } from "@/components/organizer/activity-form";
import { CheckpointForm } from "@/components/organizer/checkpoint-form";
import { OrganizerShell, type OrganizerContext } from "@/components/organizer/shell";
import { cardClass, chipClass, smallButton, tagClass, textareaClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { changeActivityStatus, toggleCheckpoint } from "@/lib/actions/activities";
import { PARTICIPATION_LABELS, PAYMENT_LABELS, formatPrice, formatSchedule, typeLabel, type ParticipationStatus, type PaymentStatus } from "@/lib/activities";
import { getActivityCard, getCheckpoints, listOrganizerActivities } from "@/lib/data/activities";
import { getVillageOptions } from "@/lib/data/organizers";
import { formatDateTime, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Kind = "merchant" | "community";
const basePath = (type: Kind, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;

function BackLink({ href, label }: { href: string; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-1.5 text-[13px] font-semibold text-link">
      <Icon name="back" size={16} stroke={2} />
      {label}
    </Link>
  );
}

// ---- Daftar aktivitas --------------------------------------------------

export function AktivitasListPage({ id, type, tab }: { id: string; type: Kind; tab?: string }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="Aktivitas" title="Aktivitas">
      {({ org }) => <AktivitasList id={id} base={base} tab={tab ?? ""} approved={org.status === "approved"} />}
    </OrganizerShell>
  );
}

const LIST_TABS: [string, string, string[]][] = [
  ["", "Aktif", ["draft", "awaiting_partners", "in_review", "published", "running"]],
  ["selesai", "Selesai", ["ended", "settled", "cancelled"]],
];

async function AktivitasList({ id, base, tab, approved }: { id: string; base: string; tab: string; approved: boolean }) {
  const all = await listOrganizerActivities(id);
  const statuses = (LIST_TABS.find(([key]) => key === tab) ?? LIST_TABS[0])[2];
  const items = all.filter((a) => statuses.includes(a.status));
  return (
    <>
      <div className="flex gap-2">
        {LIST_TABS.map(([key, label]) => (
          <a key={key} href={`${base}/aktivitas${key ? `?tab=${key}` : ""}`} className={`${chipClass.base} ${key === tab ? chipClass.selected : chipClass.idle}`}>
            {label}
          </a>
        ))}
      </div>
      {items.length === 0 ? (
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="text-[15px] font-semibold">{tab ? "Belum ada yang selesai" : "Belum ada aktivitas"}</span>
          <span className="text-[13px] leading-[1.5] text-fg-soft">
            {approved ? "Buat event pertamamu: isi dasar, waktu, checkpoint, lalu ajukan ke tim Ramein." : "Kamu bisa menyiapkan draft sekarang dan mengajukannya setelah terverifikasi."}
          </span>
        </div>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {items.map((card) => (
            <ActivityRow key={card.id} card={card} href={`${base}/aktivitas/${card.id}`} />
          ))}
        </div>
      )}
      <Link href={`${base}/aktivitas/baru`} className="fixed bottom-[104px] right-5 z-10 flex h-[52px] items-center gap-2 rounded-full bg-primary px-[18px] text-[15px] font-semibold text-on-primary shadow-[0_8px_20px_rgba(75,79,224,0.3)]">
        + Buat aktivitas
      </Link>
    </>
  );
}

// ---- Buat aktivitas ------------------------------------------------------

export function AktivitasBaruPage({ id, type }: { id: string; type: Kind }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="Aktivitas">
      {() => (
        <>
          <BackLink href={`${base}/aktivitas`} label="Aktivitas" />
          <h1 className="font-display text-[24px] font-bold">Buat event</h1>
          <FormLoader id={id} type={type} />
        </>
      )}
    </OrganizerShell>
  );
}

async function FormLoader({ id, type, initial }: { id: string; type: Kind; initial?: ActivityFormValues }) {
  const supabase = await createClient();
  const [districts, { data: city }] = await Promise.all([getVillageOptions(), supabase.from("regions").select("id").eq("level", "city").eq("is_active", true).limit(1).maybeSingle()]);
  return <ActivityForm organizerId={id} type={type} cityId={(city?.id as string | undefined) ?? null} districts={districts} initial={initial} />;
}

// ---- Kelola satu aktivitas ----------------------------------------------

export function AktivitasDetailPage({ id, type, aid, hasil, error, edit }: { id: string; type: Kind; aid: string; hasil?: string; error?: string; edit?: boolean }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="Aktivitas">
      {(ctx) => <AktivitasDetail ctx={ctx} id={id} type={type} base={base} aid={aid} hasil={hasil} error={error} edit={edit} />}
    </OrganizerShell>
  );
}

const RESULT_TEXT: Record<string, string> = {
  submit: "Diajukan. Tim Ramein akan meninjau, biasanya 1–2 hari kerja.",
  withdraw: "Pengajuan ditarik. Aktivitas kembali jadi draft.",
  cancel: "Aktivitas dibatalkan dan peserta sudah diberi tahu.",
};

async function AktivitasDetail({ ctx, id, type, base, aid, hasil, error, edit }: { ctx: OrganizerContext; id: string; type: Kind; base: string; aid: string; hasil?: string; error?: string; edit?: boolean }) {
  const supabase = await createClient();
  const [card, checkpoints, { data: raw }, { count: participants }] = await Promise.all([
    getActivityCard(aid),
    getCheckpoints(aid),
    supabase.from("activities").select("review_note, created_at").eq("id", aid).maybeSingle(),
    supabase.from("participations").select("id", { count: "exact", head: true }).eq("activity_id", aid).in("status", ["invited", "registered", "in_progress", "completed"]),
  ]);
  if (!card || card.host_organizer_id !== id) notFound();
  const isLeader = ctx.org.role === "owner" || ctx.org.role === "chair";
  const editable = card.status === "draft";
  const liteEditable = card.status === "published" || card.status === "running";
  const activeCheckpoints = checkpoints.filter((c) => c.is_active).length;
  const self = `${base}/aktivitas/${aid}`;

  if (edit && editable) {
    return (
      <>
        <BackLink href={self} label={card.title} />
        <h1 className="font-display text-[24px] font-bold">Ubah draft</h1>
        <FormLoader id={id} type={type} initial={{ id: aid, goal: card.goal as ActivityFormValues["goal"], title: card.title, description: card.description ?? "", scope_region_id: card.scope_region_id, starts_at: card.starts_at, ends_at: card.ends_at, quota: card.quota, residency_rule: card.residency_rule, audience: card.audience }} />
      </>
    );
  }

  const outlets = type === "merchant" ? ((await supabase.from("merchant_outlets").select("id, name, address").eq("organizer_id", id).eq("is_active", true).order("name")).data ?? []) : [];

  return (
    <>
      <BackLink href={`${base}/aktivitas`} label="Aktivitas" />
      {hasil && RESULT_TEXT[hasil] && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">{RESULT_TEXT[hasil]}</p>}
      {error && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">{error}</p>}

      <div className="flex flex-col overflow-hidden rounded-[22px] border border-line bg-surface">
        <div className="h-[120px]" style={coverStyle(card)} />
        <div className="flex flex-col gap-2 p-4">
          <div className="flex items-start justify-between gap-3">
            <h1 className="font-display text-[22px] font-bold leading-tight">{card.title}</h1>
            <StatusTag status={card.status} />
          </div>
          <span className="text-[13px] text-fg-soft">
            {typeLabel(card.type)} · {formatSchedule(card.starts_at, card.ends_at)} · {formatPrice(card.price_idr, card.is_paid)} · {card.audience === "members_only" ? "khusus member" : "publik"}
            {card.quota ? ` · kuota ${card.quota.toLocaleString("id-ID")}` : ""}
          </span>
          {card.scope_region_name && (
            <span className="text-[12px] text-fg-soft">
              Cakupan {card.scope_region_name}{card.residency_rule === "residents_only" ? " · khusus warga" : ""}
            </span>
          )}
          {card.status === "draft" && raw?.review_note && (
            <p className="rounded-xl bg-danger-tint px-3 py-2 text-[12px] text-danger">Catatan tim Ramein: {raw.review_note}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {editable && (
              <Link href={`${self}?ubah=1`} className={smallButton.outline}>
                Ubah draft
              </Link>
            )}
            <Link href={`${self}/peserta`} className={smallButton.outline}>
              Peserta · {participants ?? 0}
            </Link>
            <a href={`/aktivitas/${aid}`} className={smallButton.outline}>
              Pratinjau warga
            </a>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          [String(participants ?? 0), "peserta"],
          [String(activeCheckpoints), "checkpoint"],
          [`+${card.xp_base}`, "XP dasar"],
        ].map(([v, k]) => (
          <div key={k} className={`${cardClass} flex flex-col gap-1 p-3`}>
            <span className="font-display text-[22px] font-semibold">{v}</span>
            <span className="text-[11px] text-fg-soft">{k}</span>
          </div>
        ))}
      </div>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Checkpoint</h2>
          <span className="text-[12px] text-fg-soft">radius standar 150 m</span>
        </div>
        {checkpoints.length === 0 && <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada checkpoint. Minimal satu checkpoint aktif sebelum mengajukan.</p>}
        {checkpoints.map((c) => (
          <div key={c.id} className={`${cardClass} flex items-center gap-3 p-3 ${c.is_active ? "" : "opacity-60"}`}>
            <span className="flex size-10 items-center justify-center rounded-xl bg-primary-tint text-link">
              <Icon name="pin" size={18} stroke={2} />
            </span>
            <span className="flex flex-1 flex-col">
              <span className="text-[14px] font-semibold">{c.name}</span>
              <span className="text-[12px] text-fg-soft">{c.address ?? `${c.lat}, ${c.lng}`} · radius {c.radius_m} m{c.is_active ? "" : " · nonaktif"}</span>
            </span>
            {!["ended", "settled", "cancelled"].includes(card.status) && (
              <form action={toggleCheckpoint}>
                <input type="hidden" name="organizer_id" value={id} />
                <input type="hidden" name="type_org" value={type} />
                <input type="hidden" name="activity_id" value={aid} />
                <input type="hidden" name="checkpoint_id" value={c.id} />
                <input type="hidden" name="active" value={c.is_active ? "false" : "true"} />
                <SubmitButton size="small" variant="outline" pendingText="…">
                  {c.is_active ? "Nonaktifkan" : "Aktifkan"}
                </SubmitButton>
              </form>
            )}
          </div>
        ))}
        {(editable || liteEditable) && <CheckpointForm organizerId={id} type={type} activityId={aid} outlets={outlets as { id: string; name: string; address: string }[]} />}
      </section>

      <section className={`${cardClass} flex flex-col gap-1 p-4`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Misi, poin, dan harga</h2>
          <span className="text-[12px] font-semibold text-fg-muted">segera hadir</span>
        </div>
        <p className="text-[13px] leading-[1.5] text-fg-soft">Peserta selesai saat check-in di checkpoint. Misi, budget poin, dan event berbayar dibuka di irisan berikutnya.</p>
      </section>

      {liteEditable && <ActivityLiteForm organizerId={id} type={type} activityId={aid} description={card.description ?? ""} />}

      <section className={`${cardClass} flex flex-col gap-3 p-4`}>
        <h2 className="text-[15px] font-bold">Status</h2>
        <p className="text-[13px] leading-[1.5] text-fg-soft">
          {card.status === "draft" && "Draft hanya terlihat oleh tim kamu. Ajukan supaya ditinjau tim Ramein lalu terbit di Jelajah."}
          {card.status === "in_review" && "Sedang ditinjau tim Ramein. Kamu masih bisa menarik pengajuan untuk mengubah draft."}
          {card.status === "published" && `Terbit ${card.published_at ? formatDateTime(card.published_at) : ""}. Warga sudah bisa mendaftar.`}
          {card.status === "running" && "Sedang berjalan. Tampilkan QR checkpoint untuk check-in peserta (fitur QR menyusul)."}
          {["ended", "settled"].includes(card.status) && "Aktivitas selesai."}
          {card.status === "cancelled" && `Dibatalkan.${raw?.review_note ? ` Alasan: ${raw.review_note}` : ""}`}
        </p>
        {card.status === "draft" && (
          <form action={changeActivityStatus} className="flex flex-col gap-2">
            <input type="hidden" name="organizer_id" value={id} />
            <input type="hidden" name="type_org" value={type} />
            <input type="hidden" name="activity_id" value={aid} />
            <input type="hidden" name="action" value="submit" />
            <SubmitButton pendingText="Mengajukan…">Ajukan ke tim Ramein</SubmitButton>
            {ctx.org.status !== "approved" && <span className="text-[12px] text-warn">Penyelenggara harus terverifikasi dulu sebelum mengajukan.</span>}
          </form>
        )}
        {card.status === "in_review" && (
          <form action={changeActivityStatus}>
            <input type="hidden" name="organizer_id" value={id} />
            <input type="hidden" name="type_org" value={type} />
            <input type="hidden" name="activity_id" value={aid} />
            <input type="hidden" name="action" value="withdraw" />
            <SubmitButton variant="ghost" pendingText="Menarik…">Tarik pengajuan</SubmitButton>
          </form>
        )}
        {isLeader && ["draft", "in_review", "published"].includes(card.status) && (
          <details className="group">
            <summary className="cursor-pointer list-none text-[13px] font-semibold text-danger">Batalkan aktivitas…</summary>
            <form action={changeActivityStatus} className="mt-3 flex flex-col gap-2">
              <input type="hidden" name="organizer_id" value={id} />
              <input type="hidden" name="type_org" value={type} />
              <input type="hidden" name="activity_id" value={aid} />
              <input type="hidden" name="action" value="cancel" />
              <textarea name="reason" rows={2} maxLength={300} placeholder="Alasan (dikirim ke peserta)" className={textareaClass} />
              <SubmitButton variant="danger" pendingText="Membatalkan…">Ya, batalkan</SubmitButton>
            </form>
          </details>
        )}
        <span className="text-[11px] text-fg-muted">Dibuat {raw?.created_at ? timeAgo(raw.created_at) : "-"}</span>
      </section>
    </>
  );
}

// ---- Peserta -------------------------------------------------------------

type ParticipantRow = { id: string; nickname: string; village_name: string | null; status: ParticipationStatus; payment_status: PaymentStatus; created_at: string; group_id: string | null };

export function PesertaPage({ id, type, aid }: { id: string; type: Kind; aid: string }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="Aktivitas">
      {() => <Peserta id={id} base={base} aid={aid} />}
    </OrganizerShell>
  );
}

async function Peserta({ id, base, aid }: { id: string; base: string; aid: string }) {
  const supabase = await createClient();
  const [card, { data }] = await Promise.all([
    getActivityCard(aid),
    supabase.from("v_activity_participants").select("id, nickname, village_name, status, payment_status, created_at, group_id").eq("activity_id", aid).order("created_at", { ascending: false }),
  ]);
  if (!card || card.host_organizer_id !== id) notFound();
  const rows = (data ?? []) as ParticipantRow[];
  const count = (s: ParticipationStatus[]) => rows.filter((r) => s.includes(r.status)).length;
  const sum: [string, number, string][] = [
    ["Terdaftar", count(["invited", "registered", "in_progress"]), "text-fg"],
    ["Selesai", count(["completed"]), "text-success"],
    ["Batal", count(["cancelled", "not_completed"]), "text-fg-soft"],
  ];

  return (
    <>
      <BackLink href={`${base}/aktivitas/${aid}`} label={card.title} />
      <div className="flex flex-col gap-0.5">
        <h1 className="font-display text-[24px] font-bold">Peserta</h1>
        <span className="text-[13px] text-fg-soft">
          {card.title} · {formatPrice(card.price_idr, card.is_paid)}{card.is_paid ? " / orang" : ""}
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {sum.map(([k, v, tone]) => (
          <div key={k} className={`${cardClass} flex flex-col gap-1 p-3`}>
            <span className={`font-display text-[22px] font-semibold ${tone}`}>{v}</span>
            <span className="text-[11px] text-fg-soft">{k}</span>
          </div>
        ))}
      </div>
      {rows.length === 0 ? (
        <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada peserta.</p>
      ) : (
        <div className={`${cardClass} overflow-hidden`}>
          {rows.map((r) => (
            <div key={r.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
              <span className="flex size-10 items-center justify-center rounded-full bg-primary-tint text-[13px] font-bold uppercase text-link">{r.nickname.slice(0, 2)}</span>
              <span className="flex flex-1 flex-col">
                <span className="text-[14px] font-semibold">{r.nickname}</span>
                <span className="text-[12px] text-fg-soft">
                  {r.village_name ?? "Luar Cimahi"} · {r.group_id ? "grup" : "pribadi"} · {timeAgo(r.created_at)}
                </span>
              </span>
              <span className={`${tagClass.base} ${r.status === "completed" ? tagClass.success : r.status === "cancelled" || r.status === "not_completed" ? tagClass.neutral : tagClass.info}`}>
                {card.is_paid && r.payment_status !== "not_required" ? PAYMENT_LABELS[r.payment_status] : PARTICIPATION_LABELS[r.status]}
              </span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
