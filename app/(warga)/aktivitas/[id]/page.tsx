import { Suspense } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { JoinPanel } from "./join-panel";
import { GlobalSection } from "./global-section";
import { MissionSection } from "./missions";
import { PaymentSection } from "./payment";
import { coverStyle, cardTag } from "@/components/activity-card";
import { OrganizerAvatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { cardClass, tagClass, backLinkClass } from "@/components/styles";
import { DIFFICULTY_LABELS, LOCATION_MODE_LABELS, formatPrice, formatSchedule, targetLabel, typeLabel } from "@/lib/activities";
import { getActivityCard, getCheckpoints, getMyParticipation, getPartners, isResidentOf } from "@/lib/data/activities";
import { listGroupProgress, listMyGroups } from "@/lib/data/groups";
import { getClaimDays, getLeaderboard, listPrizes } from "@/lib/data/global-events";
import { getCitizenMissions } from "@/lib/data/missions";
import { getHostWhatsapp, getPaymentInstructions } from "@/lib/data/payments";
import { getCurrentUser } from "@/lib/data/user";

// Detail aktivitas untuk warga, mengikuti artboard "Warga · Detail aktivitas".
export default function AktivitasPage({ params }: PageProps<"/aktivitas/[id]">) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col pb-36">
      <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
        <Detail params={params} />
      </Suspense>
    </main>
  );
}

const ROLE_LABELS = { host: "host", cohost: "cohost", sponsor: "sponsor" };

async function Detail({ params }: Pick<PageProps<"/aktivitas/[id]">, "params">) {
  const { id } = await params;
  const [card, user] = await Promise.all([getActivityCard(id), getCurrentUser()]);
  if (!card || !user) notFound();
  const [checkpoints, partners, participation, groups, groupProgress, missions, payInfo, hostWhatsapp, isResident] = await Promise.all([
    getCheckpoints(id),
    getPartners(id),
    getMyParticipation(id, user.id),
    card.join_mode === "individual" ? Promise.resolve([]) : listMyGroups(user.id),
    card.target_scope === "group" ? listGroupProgress({ activityId: id }) : Promise.resolve([]),
    getCitizenMissions(id),
    card.is_paid ? getPaymentInstructions(id) : Promise.resolve(null),
    card.is_paid ? getHostWhatsapp(card.host_organizer_id, card.host_type) : Promise.resolve(null),
    card.residency_rule === "residents_only" && card.scope_region_id ? isResidentOf(user.id, card.scope_region_id) : Promise.resolve(true),
  ]);
  // Event Global: papan peringkat (cuplikan 3 besar + posisi saya) dan hadiah per peringkat.
  const isGlobal = card.reach === "global";
  const [board, prizes, claimDays] = isGlobal ? await Promise.all([getLeaderboard(id, 3), listPrizes(id), getClaimDays()]) : [null, [], 0];
  const leaderGroups = groups.filter((g) => g.isLeader).map((g) => ({ id: g.id, name: g.name, members: g.members.map((m) => ({ user_id: m.user_id, nickname: m.nickname })) }));
  const myGroupRow = participation?.group_id ? groupProgress.find((p) => p.group_id === participation.group_id) : undefined;
  const tag = cardTag(card);
  const open = card.status === "published" || card.status === "running";
  const quotaFull = card.quota !== null && card.seats_taken >= card.quota;
  // Tampilan saja; join_activity tetap memeriksa domisili di database.
  const residentsBlocked = card.residency_rule === "residents_only" && !isResident;

  let blockedReason: string | undefined;
  if (!open) blockedReason = card.status === "cancelled" ? "Aktivitas dibatalkan" : card.status === "ended" || card.status === "settled" ? "Aktivitas sudah selesai" : "Belum dibuka";
  else if (quotaFull) blockedReason = "Kuota penuh";
  else if (residentsBlocked) blockedReason = "Khusus warga wilayah cakupan";

  const facts: [string, string][] = [
    ["Waktu", formatSchedule(card.starts_at, card.ends_at)],
    isGlobal
      ? ["Lokasi", card.location_mode === "online" ? "Online" : `${LOCATION_MODE_LABELS[card.location_mode]}${checkpoints[0] ? ` · ${checkpoints[0].name}` : ""}`]
      : ["Lokasi", checkpoints[0]?.name ?? card.scope_region_name ?? "Diumumkan penyelenggara"],
    ["Kuota", card.quota ? `${card.seats_taken} dari ${card.quota.toLocaleString("id-ID")}` : `Tanpa batas · ${card.seats_taken} peserta`],
    isGlobal ? ["Hadiah", prizes[0] ? prizes[0].title : "Skor & hadiah per peringkat"] : ["Hadiah", `+${card.xp_base} Jejak${card.points_per_completion > 0 ? ` · +${card.points_per_completion} poin` : ""}`],
  ];
  if (card.type === "challenge") facts.splice(2, 0, ["Target", `${targetLabel(card.target_kind, card.target_count, card.target_scope)} · ${DIFFICULTY_LABELS[card.difficulty ?? "easy"]}`]);

  return (
    <>
      <div className="relative h-[220px]" style={coverStyle(card)}>
        <Link href={isGlobal ? "/jelajah?filter=global" : "/jelajah"} className={`${backLinkClass} border-transparent bg-scrim text-cream hover:bg-scrim absolute left-5 top-5`}>
          <Icon name="back" stroke={2} />
          Kembali
        </Link>
        <div className="absolute bottom-4 left-5 flex gap-2">
          {tag && <span className={`${tagClass.base} ${tagClass[tag.tone]}`}>{tag.label}</span>}
          <span className="rounded-full bg-scrim px-3 py-1 text-[12px] font-bold text-cream">{isGlobal ? LOCATION_MODE_LABELS[card.location_mode] : typeLabel(card.type)}</span>
        </div>
      </div>

      <div className="flex flex-col gap-5 px-5 pt-5">
        <div className="flex flex-col gap-1.5">
          <h1 className="font-display text-[28px] font-bold leading-tight">{card.title}</h1>
          <Link href={`/${card.host_type === "merchant" ? "m" : "k"}/${card.host_slug}`} className="text-[15px] font-semibold text-link">
            {card.host_name}
          </Link>
          {card.description && <p className="text-[15px] leading-[1.6] text-fg-label whitespace-pre-line">{card.description}</p>}
        </div>

        <dl className="grid grid-cols-2 gap-2.5">
          {facts.map(([k, v]) => (
            <div key={k} className={`${cardClass} flex flex-col gap-0.5 p-3`}>
              <dt className="text-[12px] text-fg-soft">{k}</dt>
              <dd className="text-[15px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        {isGlobal && (
          <p className="rounded-2xl bg-hot-tint px-4 py-3 text-[15px] leading-[1.5] text-hot">
            Event Global terbuka untuk pengguna dari kota mana pun. Check-in dan misi menambah skor event untuk papan peringkat ini, bukan Jejak atau poin.
          </p>
        )}

        {(card.audience === "members_only" || card.residency_rule === "residents_only") && (
          <p className="rounded-2xl bg-warn-tint px-4 py-3 text-[15px] text-warn">
            {card.audience === "members_only" ? `Khusus member ${card.host_name}. ` : ""}
            {card.residency_rule === "residents_only" ? `Khusus warga ${card.scope_region_name ?? "wilayah cakupan"}.` : ""}
          </p>
        )}

        <section className="flex flex-col gap-2.5">
          <h2 className="font-display text-[18px] font-semibold">Didukung oleh</h2>
          <div className="flex flex-col gap-2">
            {partners.map((p) => (
              <div key={p.id} className={`${cardClass} flex items-center gap-3 p-3`}>
                <OrganizerAvatar name={p.organizer.name} type={p.organizer.type} logoUrl={p.organizer.logo_url} size={40} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{p.organizer.name}</span>
                  <span className="text-[13px] text-fg-soft">{ROLE_LABELS[p.role]}</span>
                </span>
              </div>
            ))}
          </div>
        </section>

        {checkpoints.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="font-display text-[18px] font-semibold">Checkpoint</h2>
            <div className="flex flex-col gap-2">
              {checkpoints.filter((c) => c.is_active).map((c) => (
                <a key={c.id} href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className={`${cardClass} flex items-center gap-3 p-3 text-fg`}>
                  <span className="flex size-10 items-center justify-center rounded-xl bg-primary-tint text-link">
                    <Icon name="pin" size={18} stroke={2} />
                  </span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{c.name}</span>
                    <span className="text-[13px] text-fg-soft">{c.address ?? `${c.lat}, ${c.lng}`} · radius {c.radius_m} m</span>
                  </span>
                </a>
              ))}
            </div>
          </section>
        )}

        {card.type === "challenge" && participation && !["cancelled", "invited"].includes(participation.status) && (
          <section className={`${cardClass} flex flex-col gap-2 p-4`}>
            <div className="flex items-baseline justify-between">
              <h2 className="font-display text-[18px] font-semibold">Progress {card.target_scope === "group" ? "grup" : "kamu"}</h2>
              <span className="text-[15px] font-bold text-xp">
                {card.target_scope === "group" ? (myGroupRow?.progress ?? 0) : participation.progress}/{card.target_count ?? 1}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-lg bg-track">
              <div className="h-full bg-xp" style={{ width: `${Math.min(100, Math.round((((card.target_scope === "group" ? (myGroupRow?.progress ?? 0) : participation.progress) / (card.target_count ?? 1)) * 100)))}%` }} />
            </div>
            <span className="text-[13px] text-fg-soft">
              {card.target_scope === "group"
                ? `${myGroupRow?.group_name ?? "Grupmu"} · ${myGroupRow?.contributors ?? 0} anggota berkontribusi · peringkat #${myGroupRow?.rank ?? "-"}`
                : "Satu check-in per hari dihitung. Check-in lagi besok."}
            </span>
          </section>
        )}

        {card.target_scope === "group" && groupProgress.length > 0 && (
          <section className="flex flex-col gap-2.5">
            <h2 className="font-display text-[18px] font-semibold">Peringkat grup</h2>
            <div className={`${cardClass} overflow-hidden`}>
              {groupProgress.slice(0, 10).map((g) => (
                <div key={g.group_id} className={`flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0 ${g.group_id === participation?.group_id ? "bg-primary-tint/40" : ""}`}>
                  <span className="w-7 font-display text-[16px] font-bold text-fg-soft">#{g.rank}</span>
                  <span className="flex flex-1 flex-col">
                    <span className="text-[15px] font-semibold">{g.group_name}</span>
                    <span className="text-[13px] text-fg-soft">{g.contributors} dari {g.members} anggota berkontribusi</span>
                  </span>
                  <span className="text-[15px] font-bold text-xp">
                    {g.progress}/{g.target_count}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {participation && card.is_paid && participation.status !== "invited" && (
          <PaymentSection
            participationId={participation.id}
            activityId={id}
            paymentStatus={participation.payment_status}
            dueAt={participation.payment_due_at}
            note={participation.payment_note ?? null}
            priceIdr={card.price_idr}
            instructions={payInfo?.payment_instructions ?? null}
            cancelled={participation.status === "cancelled"}
            hostWhatsapp={hostWhatsapp}
            activityTitle={card.title}
          />
        )}

        {isGlobal && (
          <GlobalSection
            activityId={id}
            board={board}
            prizes={prizes}
            joined={!!participation && !["cancelled", "invited"].includes(participation.status)}
            claimDays={claimDays}
          />
        )}

        <MissionSection list={missions} activityId={id} activityType={card.type} targetKind={card.target_kind} />

        {participation && ["registered", "in_progress"].includes(participation.status) && card.status === "running" && ["not_required", "paid"].includes(participation.payment_status) && !(isGlobal && card.location_mode === "online") && (
          <Link href="/scan" className="flex h-[54px] items-center justify-center gap-2 rounded-2xl bg-hot text-[16px] font-semibold text-bg">
            <Icon name="scan" size={22} stroke={2.2} />
            Check-in: scan QR staf
          </Link>
        )}
        {participation?.status === "completed" && (
          <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] text-success">
            Kamu sudah check-in dan menyelesaikan aktivitas ini.
            {missions?.missions.some((m) => m.open && m.can_work) ? " Misi bonus masih bisa dikerjakan untuk tambahan Jejak." : ""}
          </p>
        )}
      </div>

      <JoinPanel
        activityId={id}
        participation={participation ? { id: participation.id, status: participation.status, paymentStatus: participation.payment_status } : null}
        canJoin={!blockedReason}
        blockedReason={blockedReason}
        priceLabel={formatPrice(card.price_idr, card.is_paid)}
        joinMode={card.join_mode}
        groupMin={card.group_min}
        groupMax={card.group_max}
        leaderGroups={leaderGroups}
        userId={user.id}
      />
    </>
  );
}
