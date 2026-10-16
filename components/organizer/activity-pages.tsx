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
import { saveActivityPoints } from "@/lib/actions/rewards";
import { cancelPartnerInvite } from "@/lib/actions/collab";
import { InvitePartnerForm } from "@/components/organizer/collab-forms";
import { listActivityPartners, listApprovedOrganizers, listMyPartnerships } from "@/lib/data/collab";
import { OrganizerAvatar } from "@/components/avatar";
import { getActivityBudget } from "@/lib/data/rewards";
import { getActivityStats, listPartnerStats } from "@/lib/data/dashboards";
import { DIFFICULTY_LABELS, JOIN_MODE_LABELS, PARTICIPATION_LABELS, PAYMENT_LABELS, formatPrice, formatSchedule, targetLabel, typeLabel, type ParticipationStatus, type PaymentStatus } from "@/lib/activities";
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
  ["partner", "Sebagai partner", []],
];

async function AktivitasList({ id, base, tab, approved }: { id: string; base: string; tab: string; approved: boolean }) {
  const all = await listOrganizerActivities(id);
  const statuses = (LIST_TABS.find(([key]) => key === tab) ?? LIST_TABS[0])[2];
  const items = all.filter((a) => statuses.includes(a.status));
  const partnerships = tab === "partner" ? (await listMyPartnerships(id)).filter((p) => p.status === "accepted") : [];
  return (
    <>
      <div className="flex gap-2">
        {LIST_TABS.map(([key, label]) => (
          <a key={key} href={`${base}/aktivitas${key ? `?tab=${key}` : ""}`} className={`${chipClass.base} ${key === tab ? chipClass.selected : chipClass.idle}`}>
            {label}
          </a>
        ))}
      </div>
      {tab === "partner" ? (
        partnerships.length === 0 ? (
          <div className={`${cardClass} flex flex-col gap-1 p-4`}>
            <span className="text-[15px] font-semibold">Belum jadi partner</span>
            <span className="text-[13px] leading-[1.5] text-fg-soft">Undangan dan open call ada di menu Lainnya → Kolaborasi.</span>
          </div>
        ) : (
          <div className={`${cardClass} overflow-hidden`}>
            {partnerships.map((p) => (
              <a key={p.id} href={`${base}/aktivitas/${p.activity_id}`} className="flex items-center gap-3 border-b border-line px-4 py-3.5 text-fg last:border-b-0">
                <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                  <span className="truncate text-[15px] font-semibold">{p.activity_title}</span>
                  <span className="text-[12px] text-fg-soft">host {p.host_name} · {p.role} · {formatSchedule(p.starts_at, p.ends_at)}</span>
                </span>
                <StatusTag status={p.activity_status} />
              </a>
            ))}
          </div>
        )
      ) : items.length === 0 ? (
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
          <h1 className="font-display text-[24px] font-bold">Buat aktivitas</h1>
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
  poin: "Poin per penyelesaian dan budget tersimpan.",
};

async function AktivitasDetail({ ctx, id, type, base, aid, hasil, error, edit }: { ctx: OrganizerContext; id: string; type: Kind; base: string; aid: string; hasil?: string; error?: string; edit?: boolean }) {
  const supabase = await createClient();
  const [card, checkpoints, { data: raw }, { count: participants }] = await Promise.all([
    getActivityCard(aid),
    getCheckpoints(aid),
    supabase.from("activities").select("review_note, created_at").eq("id", aid).maybeSingle(),
    supabase.from("participations").select("id", { count: "exact", head: true }).eq("activity_id", aid).in("status", ["invited", "registered", "in_progress", "completed"]),
  ]);
  if (!card) notFound();
  const isHost = card.host_organizer_id === id;
  const partners = await listActivityPartners(aid);
  const myPartner = partners.find((p) => p.organizer_id === id && p.status === "accepted");
  if (!isHost && !myPartner) notFound();
  const isLeader = ctx.org.role === "owner" || ctx.org.role === "chair";
  const editable = isHost && card.status === "draft";
  const liteEditable = isHost && (card.status === "published" || card.status === "running");
  const canAddCheckpoint = (isHost && ["draft", "awaiting_partners", "published"].includes(card.status)) || (!isHost && ["draft", "awaiting_partners", "published"].includes(card.status));
  const organizers = isHost && isLeader && ["draft", "awaiting_partners", "in_review", "published"].includes(card.status) ? await listApprovedOrganizers(id) : [];
  const activeCheckpoints = checkpoints.filter((c) => c.is_active).length;
  const self = `${base}/aktivitas/${aid}`;

  if (edit && editable) {
    return (
      <>
        <BackLink href={self} label={card.title} />
        <h1 className="font-display text-[24px] font-bold">Ubah draft</h1>
        <FormLoader id={id} type={type} initial={{ id: aid, type: card.type, difficulty: card.difficulty, target_scope: card.target_scope, target_kind: card.target_kind, target_count: card.target_count, join_mode: card.join_mode, group_min: card.group_min, group_max: card.group_max, goal: card.goal as ActivityFormValues["goal"], title: card.title, description: card.description ?? "", scope_region_id: card.scope_region_id, starts_at: card.starts_at, ends_at: card.ends_at, quota: card.quota, residency_rule: card.residency_rule, audience: card.audience }} />
      </>
    );
  }

  const outlets = type === "merchant" ? ((await supabase.from("merchant_outlets").select("id, name, address").eq("organizer_id", id).eq("is_active", true).order("name")).data ?? []) : [];
  const [budget, { data: hostPartner }] = type === "merchant"
    ? await Promise.all([getActivityBudget(aid, id), supabase.from("activity_partners").select("id").eq("activity_id", aid).eq("organizer_id", id).maybeSingle()])
    : [null, { data: null }];
  const pointsEditable = ["draft", "awaiting_partners"].includes(card.status);
  const live = ["running", "ended", "settled"].includes(card.status);
  const [stats, partnerStats] = live ? await Promise.all([getActivityStats(aid), listPartnerStats(aid)]) : [null, []];

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
          <span className="text-[12px] text-fg-soft">
            Pendaftaran: {JOIN_MODE_LABELS[card.join_mode]}{card.join_mode !== "individual" ? ` (${card.group_min}–${card.group_max} orang)` : ""}
            {card.type === "challenge" ? ` · ${DIFFICULTY_LABELS[card.difficulty ?? "easy"]} · target ${targetLabel(card.target_kind, card.target_count, card.target_scope)}` : ""}
          </span>
          {isHost && card.status === "draft" && raw?.review_note && (
            <p className="rounded-xl bg-danger-tint px-3 py-2 text-[12px] text-danger">Catatan tim Ramein: {raw.review_note}</p>
          )}
          <div className="flex flex-wrap gap-2 pt-1">
            {editable && (
              <Link href={`${self}?ubah=1`} className={smallButton.outline}>
                Ubah draft
              </Link>
            )}
            {isHost && (
              <Link href={`${self}/peserta`} className={smallButton.outline}>
                Peserta · {participants ?? 0}
              </Link>
            )}
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

      {stats && (
        <section className={`${cardClass} flex flex-col gap-3 p-4`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[18px] font-semibold">Statistik</h2>
            <span className="text-[12px] text-fg-soft">{stats.checkins_today} check-in hari ini</span>
          </div>
          <div className="grid grid-cols-4 gap-2 text-center">
            {[
              [stats.attended, "hadir"],
              [stats.completed, "selesai"],
              [stats.new_citizens, "warga baru"],
              [stats.returning_citizens, "kembali"],
            ].map(([v, k]) => (
              <div key={k} className="flex flex-col gap-0.5 rounded-xl bg-bg px-2 py-2.5">
                <span className="font-display text-[20px] font-semibold">{v}</span>
                <span className="text-[11px] text-fg-soft">{k}</span>
              </div>
            ))}
          </div>
          {stats.checkins_flagged > 0 && <span className="text-[12px] text-warn">{stats.checkins_flagged} check-in di luar radius menunggu tinjauan tim Ramein.</span>}
          {partnerStats.length > 1 && (
            <div className="flex flex-col gap-1.5 border-t border-line pt-3">
              {partnerStats.map((p) => (
                <div key={p.organizer_id} className="flex items-center justify-between text-[12px]">
                  <span className="font-semibold">
                    {p.organizer_name} <span className="font-normal text-fg-soft">· {p.role}</span>
                  </span>
                  <span className="text-fg-soft">
                    {p.checkins} check-in · {p.citizens} warga{p.organizer_type === "merchant" ? ` · ${p.vouchers_used}/${p.vouchers_redeemed} voucher` : ""}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

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
        {canAddCheckpoint && <CheckpointForm organizerId={id} type={type} activityId={aid} outlets={outlets as { id: string; name: string; address: string }[]} partnerOrganizerId={isHost ? undefined : id} />}
      </section>

      <section className="flex flex-col gap-2.5">
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Partner</h2>
          <span className="text-[12px] text-fg-soft">{partners.filter((p) => p.status === "accepted").length} terlibat</span>
        </div>
        {partners.filter((p) => p.status !== "removed" && p.status !== "declined").map((p) => (
          <div key={p.id} className={`${cardClass} flex items-center gap-3 p-3`}>
            <OrganizerAvatar name={p.organizer_name} type={p.organizer_type} logoUrl={p.organizer_logo_url} size={40} />
            <span className="flex flex-1 flex-col">
              <span className="text-[14px] font-semibold">{p.organizer_name}{p.organizer_id === id ? " (kamu)" : ""}</span>
              <span className="text-[12px] text-fg-soft">
                {p.role === "host" ? "Host" : p.role === "cohost" ? "Cohost" : "Sponsor"}
                {p.status === "invited" ? " · menunggu jawaban" : ""}
                {p.points_budget > 0 ? ` · budget ${p.points_budget} poin` : ""}
                {p.source === "admin" ? " · ditambahkan admin" : p.source === "open_call" ? " · dari open call" : ""}
              </span>
            </span>
            {isHost && isLeader && p.status === "invited" && (
              <form action={cancelPartnerInvite}>
                <input type="hidden" name="partner_id" value={p.id} />
                <input type="hidden" name="organizer_id" value={id} />
                <input type="hidden" name="type_org" value={type} />
                <button type="submit" className="text-[12px] font-semibold text-danger">Batalkan</button>
              </form>
            )}
          </div>
        ))}
        {organizers.length > 0 && (
          <details className={`${cardClass} p-4`}>
            <summary className="cursor-pointer list-none text-[14px] font-bold">Undang partner…</summary>
            <div className="pt-3">
              <InvitePartnerForm activityId={aid} organizers={organizers} ctx={{ organizerId: id, typeOrg: type }} />
            </div>
            <p className="pt-2 text-[11px] text-fg-muted">Undangan yang belum dijawab menahan pengajuan di status &ldquo;Menunggu partner&rdquo;. Atau cari partner lewat open call di menu Kolaborasi.</p>
          </details>
        )}
      </section>

      {!isHost ? (
        <section className={`${cardClass} flex flex-col gap-1 p-4`}>
          <h2 className="font-display text-[18px] font-semibold">Peranmu: {myPartner?.role === "cohost" ? "cohost" : "sponsor"}</h2>
          <p className="text-[13px] leading-[1.5] text-fg-soft">Kamu bisa menambah checkpoint milikmu, menampilkan QR-nya, dan melihat peserta yang check-in di sana. Budget poin diatur di menu Kolaborasi.</p>
        </section>
      ) : type === "merchant" && hostPartner ? (
        <section className={`${cardClass} flex flex-col gap-3 p-4`}>
          <div className="flex items-baseline justify-between">
            <h2 className="font-display text-[18px] font-semibold">Poin dari {ctx.org.name}</h2>
            {budget && <span className="text-[12px] font-semibold text-fg-soft">terpakai {budget.used} · sisa {budget.remaining}</span>}
          </div>
          <form action={saveActivityPoints} className="flex flex-col gap-3">
            <input type="hidden" name="organizer_id" value={id} />
            <input type="hidden" name="activity_id" value={aid} />
            <input type="hidden" name="partner_id" value={hostPartner.id as string} />
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-fg-label">
                Per penyelesaian
                <input name="points_per_completion" type="number" min={0} max={10000} inputMode="numeric" defaultValue={card.points_per_completion} disabled={!pointsEditable || !isLeader} className="h-[52px] w-full rounded-[14px] border border-line-strong bg-surface px-4 text-[15px] text-fg disabled:opacity-60" />
              </label>
              <label className="flex flex-col gap-1.5 text-[13px] font-semibold text-fg-label">
                Budget poin
                <input name="points_budget" type="number" min={0} max={1000000} inputMode="numeric" defaultValue={budget?.budget ?? 0} disabled={!["draft", "awaiting_partners", "in_review", "published"].includes(card.status) || !isLeader} className="h-[52px] w-full rounded-[14px] border border-line-strong bg-surface px-4 text-[15px] text-fg disabled:opacity-60" />
              </label>
            </div>
            <span className="text-[12px] text-fg-soft">
              {card.points_per_completion > 0 && (budget?.budget ?? 0) > 0
                ? `Cukup untuk ${Math.floor((budget?.remaining ?? 0) / card.points_per_completion)} peserta lagi yang menyelesaikan.`
                : "Poin diberikan ke warga yang menyelesaikan aktivitas, dipotong dari budget. Tanpa budget, warga tetap dapat XP."}
              {!pointsEditable ? " Poin per penyelesaian terkunci setelah diajukan." : ""}
            </span>
            {isLeader && ["draft", "awaiting_partners", "in_review", "published"].includes(card.status) && (
              <SubmitButton size="small" variant="dark" pendingText="Menyimpan…" className="self-end">
                Simpan poin
              </SubmitButton>
            )}
          </form>
        </section>
      ) : (
        <section className={`${cardClass} flex flex-col gap-1 p-4`}>
          <h2 className="font-display text-[18px] font-semibold">Poin</h2>
          <p className="text-[13px] leading-[1.5] text-fg-soft">Komunitas tidak punya budget poin. Poin untuk peserta hanya ada jika ada merchant sponsor (fitur kolaborasi menyusul).</p>
        </section>
      )}

      <section className={`${cardClass} flex flex-col gap-1 p-4`}>
        <div className="flex items-baseline justify-between">
          <h2 className="font-display text-[18px] font-semibold">Misi dan harga</h2>
          <span className="text-[12px] font-semibold text-fg-muted">segera hadir</span>
        </div>
        <p className="text-[13px] leading-[1.5] text-fg-soft">Misi dan aktivitas berbayar dibuka di irisan berikutnya.</p>
      </section>

      {liteEditable && <ActivityLiteForm organizerId={id} type={type} activityId={aid} description={card.description ?? ""} />}

      {isHost && <section className={`${cardClass} flex flex-col gap-3 p-4`}>
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
      </section>}
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
