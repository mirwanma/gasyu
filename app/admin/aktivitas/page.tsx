import { Suspense } from "react";
import { ActivityRow, StatusTag, coverStyle } from "@/components/activity-card";
import { OrganizerAvatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, smallButton, tagClass, textareaClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { adminCancelActivity, adminPublishActivity, reviewActivity } from "@/lib/actions/activities";
import { AdminAddPartnerForm } from "@/components/organizer/collab-forms";
import { CheckpointForm } from "@/components/organizer/checkpoint-form";
import { listActivityPartners, listApprovedOrganizers } from "@/lib/data/collab";
import Link from "next/link";
import { formatPrice, formatSchedule, typeLabel } from "@/lib/activities";
import { getActivityCard, getCheckpoints, type ActivityCard } from "@/lib/data/activities";
import { formatDateTime, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Admin: review aktivitas penyelenggara dan daftar semua aktivitas.
export default function AdminAktivitasPage({ searchParams }: PageProps<"/admin/aktivitas">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Aktivitas & event Gasyu</h1>
        <span className="text-[14px] text-fg-soft">Tinjau pengajuan penyelenggara sebelum terbit di Jelajah, atau buat event atas nama Gasyu.</span>
      </div>
      <Link href="/admin/aktivitas/baru" className="flex h-11 w-fit items-center rounded-full bg-primary px-5 text-[14px] font-semibold text-on-primary">
        + Buat event Gasyu
      </Link>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Board({ searchParams }: Pick<PageProps<"/admin/aktivitas">, "searchParams">) {
  const sp = await searchParams;
  const tab = sp.tab === "semua" ? "semua" : "review";
  const hasil = typeof sp.hasil === "string" ? sp.hasil : undefined;
  const errorMsg = typeof sp.error === "string" ? sp.error : undefined;
  const supabase = await createClient();
  let query = supabase.from("v_activity_cards").select("*").order("starts_at", { ascending: tab === "review" }).limit(100);
  if (tab === "review") query = query.eq("status", "in_review");
  const [{ data }, { count: pending }] = await Promise.all([query, supabase.from("v_activity_cards").select("id", { count: "exact", head: true }).eq("status", "in_review")]);
  const items = (data ?? []) as ActivityCard[];
  const selectedId = typeof sp.pilih === "string" && items.some((a) => a.id === sp.pilih) ? sp.pilih : items[0]?.id;

  return (
    <>
      <div className="flex gap-2">
        <a href="/admin/aktivitas" className={`${chipClass.base} ${tab === "review" ? chipClass.selected : chipClass.idle}`}>
          Menunggu review · {pending ?? 0}
        </a>
        <a href="/admin/aktivitas?tab=semua" className={`${chipClass.base} ${tab === "semua" ? chipClass.selected : chipClass.idle}`}>
          Semua aktivitas
        </a>
      </div>
      <div className="flex flex-wrap items-start gap-5">
        <section className={`${cardClass} min-w-0 flex-[1_1_360px] overflow-hidden`}>
          {hasil === "ok" && <p className="border-b border-line bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">Keputusan tersimpan dan tim penyelenggara diberi tahu.</p>}
          {hasil === "gagal" && <p className="border-b border-line bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">Keputusan belum tersimpan. Mungkin statusnya sudah berubah.</p>}
          {hasil === "catatan" && <p className="border-b border-line bg-warn-tint px-4 py-3 text-[13px] font-semibold text-warn">Tulis catatan untuk penyelenggara saat menolak.</p>}
          {hasil === "terbit" && <p className="border-b border-line bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">Event Gasyu terbit dan tampil di Jelajah.</p>}
          {errorMsg && <p className="border-b border-line bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">{errorMsg}</p>}
          {items.length === 0 && <p className="p-5 text-[13px] text-fg-soft">{tab === "review" ? "Tidak ada pengajuan yang menunggu." : "Belum ada aktivitas."}</p>}
          {items.map((card) => (
            <ActivityRow key={card.id} card={card} href={`/admin/aktivitas?tab=${tab}&pilih=${card.id}`} selected={card.id === selectedId} />
          ))}
        </section>
        {selectedId && (
          <Suspense fallback={<section className={`${cardClass} flex-[1.4_1_420px] p-6 text-[13px] text-fg-muted`}>Memuat…</section>}>
            <Detail id={selectedId} tab={tab} />
          </Suspense>
        )}
      </div>
    </>
  );
}

async function Detail({ id, tab }: { id: string; tab: string }) {
  const supabase = await createClient();
  const [card, checkpoints, { data: raw }, { count: participants }] = await Promise.all([
    getActivityCard(id),
    getCheckpoints(id),
    supabase.from("activities").select("review_note, created_at, creator:profiles!activities_created_by_fkey(nickname)").eq("id", id).maybeSingle(),
    supabase.from("participations").select("id", { count: "exact", head: true }).eq("activity_id", id).in("status", ["invited", "registered", "in_progress", "completed"]),
  ]);
  if (!card) return null;
  const creator = (Array.isArray(raw?.creator) ? raw?.creator[0] : raw?.creator) as { nickname: string } | null | undefined;
  const isPlatform = card.host_type === "platform";
  const [partners, organizers] = isPlatform ? await Promise.all([listActivityPartners(id), listApprovedOrganizers()]) : [[], []];
  const partnerOutlets = isPlatform
    ? ((await supabase.from("merchant_outlets").select("id, name, address, organizer_id").in("organizer_id", partners.filter((p) => p.status === "accepted" && p.organizer_type === "merchant").map((p) => p.organizer_id)).eq("is_active", true)).data ?? [])
    : [];
  const platformEditable = isPlatform && ["draft", "awaiting_partners", "in_review", "published"].includes(card.status);
  const facts: [string, string][] = [
    ["Jadwal", formatSchedule(card.starts_at, card.ends_at)],
    ["Harga", formatPrice(card.price_idr, card.is_paid)],
    ["Audiens", card.audience === "members_only" ? "Khusus member" : "Publik"],
    ["Cakupan", card.scope_region_name ? `${card.scope_region_name}${card.residency_rule === "residents_only" ? " · khusus warga" : ""}` : "Tanpa cakupan"],
    ["Kuota", card.quota ? card.quota.toLocaleString("id-ID") : "Tanpa batas"],
    ["Hadiah", `+${card.xp_base} XP${card.points_per_completion ? ` · +${card.points_per_completion} poin` : ""}`],
    ["Peserta", String(participants ?? 0)],
    ["Diajukan", `${creator?.nickname ?? "-"} · ${raw?.created_at ? timeAgo(raw.created_at) : "-"}`],
  ];

  return (
    <section className={`${cardClass} flex min-w-0 flex-[1.4_1_420px] flex-col gap-[18px] overflow-hidden`}>
      <div className="h-[140px]" style={coverStyle(card)} />
      <div className="flex flex-col gap-[18px] px-6 pb-6">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-col gap-1">
            <span className="text-[12px] font-bold uppercase tracking-wide text-fg-soft">
              {typeLabel(card.type)} · host {card.host_name}
            </span>
            <h2 className="font-display text-[24px] font-semibold leading-tight">{card.title}</h2>
          </div>
          <StatusTag status={card.status} />
        </div>
        <div className="flex items-center gap-3">
          <OrganizerAvatar name={card.host_name} type={card.host_type} logoUrl={card.host_logo_url} size={40} />
          <a href={`/admin/verifikasi?pilih=${card.host_organizer_id}`} className="text-[14px] font-semibold text-link">
            {card.host_name}
          </a>
        </div>
        {card.description && <p className="text-[14px] leading-[1.6] text-fg-label whitespace-pre-line">{card.description}</p>}
        <dl className="grid grid-cols-2 gap-x-6 gap-y-2.5 md:grid-cols-4">
          {facts.map(([k, v]) => (
            <div key={k} className="flex flex-col gap-0.5">
              <dt className="text-[11px] text-fg-soft">{k}</dt>
              <dd className="text-[14px] font-semibold">{v}</dd>
            </div>
          ))}
        </dl>

        {isPlatform && (
          <div className="flex flex-wrap gap-2">
            <Link href={`/admin/aktivitas/misi?aid=${id}`} className="flex h-10 w-fit items-center rounded-full border border-line-strong bg-surface px-4 text-[13px] font-semibold text-fg">
              Kelola misi event ini
            </Link>
            <Link href={`/admin/aktivitas/peserta?aid=${id}`} className="flex h-10 w-fit items-center rounded-full border border-line-strong bg-surface px-4 text-[13px] font-semibold text-fg">
              {card.is_paid ? "Peserta & pembayaran" : "Peserta"} · {participants ?? 0}
            </Link>
          </div>
        )}
        {isPlatform && (
          <div className="flex flex-col gap-2">
            <h3 className="text-[15px] font-bold">Merchant & komunitas terlibat</h3>
            <p className="text-[12px] text-fg-soft">Ditambahkan langsung tanpa undangan. Mereka mendapat notifikasi dan boleh keluar sebelum event berjalan.</p>
            {partners.filter((p) => p.role !== "host" && p.status !== "declined").map((p) => (
              <div key={p.id} className={`flex items-center gap-3 rounded-2xl border border-line p-3 ${p.status === "removed" ? "opacity-60" : ""}`}>
                <OrganizerAvatar name={p.organizer_name} type={p.organizer_type} logoUrl={p.organizer_logo_url} size={36} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-semibold">{p.organizer_name}</span>
                  <span className="text-[12px] text-fg-soft">
                    {p.role === "cohost" ? "Cohost" : "Sponsor"} · {p.status === "removed" ? `keluar ${p.responded_at ? formatDateTime(p.responded_at) : ""}` : "ditambahkan admin"}
                    {p.contribution_note ? ` · ${p.contribution_note}` : ""}
                  </span>
                </span>
                <span className={`${tagClass.base} ${p.status === "removed" ? tagClass.hot : p.points_budget > 0 ? tagClass.success : p.organizer_type === "merchant" ? tagClass.warn : tagClass.neutral}`}>
                  {p.status === "removed" ? "Keluar" : p.points_budget > 0 ? `${p.points_budget} poin` : p.organizer_type === "merchant" ? "Belum isi budget" : "Non-poin"}
                </span>
              </div>
            ))}
            {platformEditable && organizers.length > 0 && <AdminAddPartnerForm activityId={id} organizers={organizers.filter((o) => !partners.some((p) => p.organizer_id === o.id && p.status === "accepted"))} />}
            <p className="text-[11px] text-fg-muted">Gasyu tidak punya budget poin. Poin hanya ada jika merchant mengisi budget-nya sendiri.</p>
          </div>
        )}

        <div className="flex flex-col gap-2">
          <h3 className="text-[15px] font-bold">Checkpoint</h3>
          {checkpoints.length === 0 && <p className="text-[13px] text-fg-soft">Belum ada checkpoint.</p>}
          {checkpoints.map((c) => (
            <div key={c.id} className="flex items-center gap-3 rounded-2xl border border-line p-3">
              <span className="flex size-9 items-center justify-center rounded-xl bg-primary-tint text-link">
                <Icon name="pin" size={16} stroke={2} />
              </span>
              <span className="flex flex-1 flex-col">
                <span className="text-[14px] font-semibold">{c.name}</span>
                <span className="text-[12px] text-fg-soft">{c.address ?? `${c.lat}, ${c.lng}`} · radius {c.radius_m} m{c.is_active ? "" : " · nonaktif"}</span>
              </span>
              {isPlatform && c.partner_organizer_id === card.host_organizer_id && c.is_active && ["published", "running"].includes(card.status) && (
                <Link href={`/admin/aktivitas/qr?cp=${c.id}`} className="text-[12px] font-semibold text-link">Tampilkan QR</Link>
              )}
              <a href={`https://maps.google.com/?q=${c.lat},${c.lng}`} target="_blank" rel="noreferrer" className="text-[12px] font-semibold text-link">
                Peta
              </a>
            </div>
          ))}
          {platformEditable && (
            <div className="grid gap-3 md:grid-cols-2">
              <CheckpointForm organizerId={card.host_organizer_id} type="admin" activityId={id} outlets={[]} />
              {partners.filter((p) => p.status === "accepted" && p.role !== "host").map((p) => (
                <details key={p.id} className="rounded-[20px] border border-line p-4">
                  <summary className="cursor-pointer list-none text-[14px] font-bold">Checkpoint atas nama {p.organizer_name}…</summary>
                  <div className="pt-3">
                    <CheckpointForm organizerId={card.host_organizer_id} type="admin" activityId={id} outlets={partnerOutlets.filter((o) => o.organizer_id === p.organizer_id) as { id: string; name: string; address: string }[]} partnerOrganizerId={p.organizer_id} />
                  </div>
                </details>
              ))}
            </div>
          )}
        </div>

        {raw?.review_note && card.status !== "in_review" && <p className="rounded-xl bg-track px-3 py-2 text-[12px] text-fg-label">Catatan terakhir: {raw.review_note}</p>}

        {card.status === "in_review" ? (
          <form action={reviewActivity} className="flex flex-col gap-3 border-t border-line pt-4">
            <input type="hidden" name="activity_id" value={id} />
            <label className="flex flex-col gap-1.5">
              <span className="text-[13px] font-semibold text-fg-label">Catatan untuk penyelenggara (wajib jika menolak)</span>
              <textarea name="note" rows={3} maxLength={500} className={textareaClass} placeholder="contoh: Checkpoint belum sesuai alamat outlet." />
            </label>
            <div className="flex gap-2.5">
              <SubmitButton size="small" variant="dark" name="decision" value="approve" pendingText="Menyimpan…">
                Setujui & terbitkan
              </SubmitButton>
              <SubmitButton size="small" variant="danger" name="decision" value="reject" pendingText="Menyimpan…">
                Tolak
              </SubmitButton>
              <a href={`/aktivitas/${id}`} className={`${smallButton.outline} ml-auto`}>
                Pratinjau warga
              </a>
            </div>
          </form>
        ) : (
          <div className="flex flex-wrap items-center gap-2.5 border-t border-line pt-4">
            <a href={`/aktivitas/${id}`} className={smallButton.outline}>
              Pratinjau warga
            </a>
            {isPlatform && card.status === "draft" && (
              <>
                <Link href={`/admin/aktivitas/baru?ubah=${id}`} className={smallButton.outline}>Ubah draft</Link>
                <form action={adminPublishActivity}>
                  <input type="hidden" name="activity_id" value={id} />
                  <SubmitButton size="small" variant="dark" pendingText="Menerbitkan…">Terbitkan</SubmitButton>
                </form>
              </>
            )}
            {card.published_at && <span className="text-[12px] text-fg-soft">Terbit {formatDateTime(card.published_at)}</span>}
            {["draft", "in_review", "published", "running"].includes(card.status) && (
              <details className="ml-auto">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-danger">Batalkan…</summary>
                <form action={adminCancelActivity} className="mt-2 flex flex-col gap-2">
                  <input type="hidden" name="activity_id" value={id} />
                  <input type="hidden" name="tab" value={tab} />
                  <textarea name="reason" rows={2} maxLength={300} className={textareaClass} placeholder="Alasan (dikirim ke peserta dan tim)" />
                  <SubmitButton size="small" variant="danger" pendingText="Membatalkan…">
                    Ya, batalkan
                  </SubmitButton>
                </form>
              </details>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
