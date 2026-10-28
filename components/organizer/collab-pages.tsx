import Link from "next/link";
import { OrganizerAvatar } from "@/components/avatar";
import { Icon } from "@/components/icons";
import { ApplyForm, NewPostForm, PartnerBudgetForm, RespondInviteForm } from "@/components/organizer/collab-forms";
import { OrganizerShell } from "@/components/organizer/shell";
import { cardClass, chipClass, smallButton, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { closeCollabPost, decideApplication, leaveActivity, withdrawApplication } from "@/lib/actions/collab";
import { STATUS_LABELS, formatSchedule } from "@/lib/activities";
import { listOrganizerActivities } from "@/lib/data/activities";
import { listMyApplications, listMyPartnerships, listMyPosts, listOpenPosts } from "@/lib/data/collab";
import { listScopeOptions } from "@/lib/data/regions";
import { formatDate, timeAgo } from "@/lib/format";

type Kind = "merchant" | "community";
const basePath = (type: Kind, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;
const ROLE = { host: "Host", cohost: "Cohost", sponsor: "Sponsor" };
const APP_STATUS = { pending: "Menunggu", accepted: "Diterima", rejected: "Ditolak", withdrawn: "Ditarik" };

// Halaman Kolaborasi penyelenggara, mengikuti artboard "Papan kolaborasi & open call".
export function KolaborasiPage({ id, type, filter, buka }: { id: string; type: Kind; filter: { kind?: string; regionId?: string }; buka?: boolean }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="Lainnya" title="Kolaborasi">
      {({ org }) => <Body id={id} type={type} base={base} filter={filter} buka={buka} approved={org.status === "approved"} isLeader={org.role === "owner" || org.role === "chair"} />}
    </OrganizerShell>
  );
}

async function Body({ id, type, base, filter, buka, approved, isLeader }: { id: string; type: Kind; base: string; filter: { kind?: string; regionId?: string }; buka?: boolean; approved: boolean; isLeader: boolean }) {
  const ctx = { organizerId: id, typeOrg: type };
  const [partnerships, openPosts, mine, myApps, activities, scopeCities] = await Promise.all([
    listMyPartnerships(id),
    listOpenPosts(id, filter),
    listMyPosts(id),
    listMyApplications(id),
    listOrganizerActivities(id),
    listScopeOptions(),
  ]);
  const invites = partnerships.filter((p) => p.status === "invited");
  const active = partnerships.filter((p) => p.status === "accepted");
  const canLeave = (s: string) => ["draft", "awaiting_partners", "in_review", "published"].includes(s);
  const pendingApps = mine.applications.filter((a) => a.status === "pending");

  return (
    <>
      <Link href={`${base}/lainnya`} className="flex items-center gap-1.5 text-[15px] font-semibold text-link">
        <Icon name="back" size={16} stroke={2} />
        Lainnya
      </Link>

      {!approved && <p className="rounded-2xl bg-warn-tint px-4 py-3 text-[15px] text-warn">Kolaborasi terbuka setelah penyelenggara terverifikasi.</p>}

      {active.filter((p) => p.source === "admin").map((p) => (
        <section key={p.id} className="flex flex-col gap-2.5 rounded-[20px] border border-primary/30 bg-primary-tint p-4">
          <span className="text-[12px] font-bold tracking-[0.05em] text-link">DITAMBAHKAN OLEH GASYU</span>
          <span className="text-[16px] font-bold">{p.activity_title}</span>
          <span className="text-[15px] leading-[1.5] text-fg-label">
            Peran: {ROLE[p.role].toLowerCase()} · {formatSchedule(p.starts_at, p.ends_at)}
            {p.contribution_note ? ` · ${p.contribution_note}` : ""}. {type === "merchant" ? "Isi budget poin kalau mau memberi poin ke peserta." : "Tambahkan checkpoint milikmu dari halaman aktivitas."}
          </span>
          {type === "merchant" && isLeader && canLeave(p.activity_status) && <PartnerBudgetForm partnerId={p.id} budget={p.points_budget} ctx={ctx} />}
          <div className="flex items-center gap-2.5">
            <Link href={`${base}/aktivitas/${p.activity_id}`} className={smallButton.outline}>Buka aktivitas</Link>
            {isLeader && canLeave(p.activity_status) && (
              <form action={leaveActivity}>
                <input type="hidden" name="partner_id" value={p.id} />
                <input type="hidden" name="organizer_id" value={id} />
                <input type="hidden" name="type_org" value={type} />
                <SubmitButton size="small" variant="danger" pendingText="…">Keluar dari event</SubmitButton>
              </form>
            )}
          </div>
          <span className="text-[12px] text-fg-soft">Bisa keluar sampai event mulai berjalan.</span>
        </section>
      ))}

      {invites.map((p) => (
        <section key={p.id} className={`${cardClass} flex flex-col gap-2.5 p-4`}>
          <span className="text-[12px] font-bold tracking-[0.05em] text-fg-soft">UNDANGAN MASUK</span>
          <div className="flex items-center gap-3">
            <OrganizerAvatar name={p.host_name} type={p.host_type} logoUrl={null} size={44} />
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[16px] font-semibold">{p.host_name}</span>
              <span className="text-[13px] text-fg-soft">
                {p.activity_title} · sebagai {ROLE[p.role].toLowerCase()} · {formatSchedule(p.starts_at, p.ends_at)}
              </span>
            </span>
          </div>
          {p.contribution_note && <span className="text-[15px] leading-[1.5] text-fg-label">&ldquo;{p.contribution_note}&rdquo;</span>}
          {p.points_budget > 0 && <span className="text-[13px] text-fg-soft">Usulan budget poin: {p.points_budget}</span>}
          {isLeader ? <RespondInviteForm partnerId={p.id} isMerchant={type === "merchant"} ctx={ctx} /> : <span className="text-[13px] text-fg-soft">Hanya {type === "merchant" ? "pemilik" : "ketua"} yang bisa menjawab undangan.</span>}
        </section>
      ))}

      {active.filter((p) => p.source !== "admin").length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[18px] font-semibold">Kolaborasi aktif</h2>
          {active.filter((p) => p.source !== "admin").map((p) => (
            <div key={p.id} className={`${cardClass} flex items-center gap-3 p-3.5`}>
              <OrganizerAvatar name={p.host_name} type={p.host_type} logoUrl={null} size={40} />
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold">{p.activity_title}</span>
                <span className="text-[13px] text-fg-soft">
                  host {p.host_name} · {ROLE[p.role].toLowerCase()} · {STATUS_LABELS[p.activity_status]}
                  {p.points_budget > 0 ? ` · budget ${p.points_budget} poin` : ""}
                </span>
              </span>
              <Link href={`${base}/aktivitas/${p.activity_id}`} className="text-[13px] font-semibold text-link">Buka</Link>
            </div>
          ))}
        </section>
      )}

      {pendingApps.length > 0 && (
        <section className={`${cardClass} flex flex-col gap-3 p-4`}>
          <span className="text-[12px] font-bold tracking-[0.05em] text-fg-soft">PENGAJUAN MASUK · {pendingApps.length}</span>
          {pendingApps.map((a) => (
            <div key={a.id} className="flex flex-col gap-2 border-t border-line pt-3 first:border-t-0 first:pt-0">
              <div className="flex items-center gap-3">
                <OrganizerAvatar name={a.organizer.name} type={a.organizer.type} logoUrl={a.organizer.logo_url} size={40} />
                <span className="flex flex-1 flex-col">
                  <span className="text-[15px] font-semibold">{a.organizer.name}</span>
                  <span className="text-[13px] text-fg-soft">
                    ke &ldquo;{a.post.title}&rdquo; · sebagai {a.proposed_role}{a.proposed_points_budget > 0 ? ` · ${a.proposed_points_budget} poin` : ""} · {timeAgo(a.created_at)}
                  </span>
                </span>
              </div>
              {(a.contribution || a.message) && <span className="text-[15px] leading-[1.5] text-fg-label">{[a.contribution, a.message].filter(Boolean).join(" — ")}</span>}
              {isLeader && (
                <form action={decideApplication} className="grid grid-cols-2 gap-2.5">
                  <input type="hidden" name="application_id" value={a.id} />
                  <input type="hidden" name="organizer_id" value={id} />
                  <input type="hidden" name="type_org" value={type} />
                  <SubmitButton size="small" variant="outline" name="decision" value="reject" pendingText="…">Tolak</SubmitButton>
                  <SubmitButton size="small" variant="dark" name="decision" value="accept" pendingText="…">Terima</SubmitButton>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      <div className="flex items-baseline justify-between">
        <h2 className="font-display text-[18px] font-semibold">Open call</h2>
        {approved && isLeader && !buka && (
          <Link href={`${base}/kolaborasi?buka=1`} className="text-[15px] font-semibold text-link">+ Buka open call</Link>
        )}
      </div>
      {buka && approved && isLeader && (
        <NewPostForm ctx={ctx} activities={activities.filter((a) => ["draft", "awaiting_partners", "in_review", "published"].includes(a.status)).map((a) => ({ id: a.id, title: a.title }))} scopeCities={scopeCities} />
      )}
      <div className="flex flex-wrap gap-2">
        {([["", "Semua"], ["sponsor", "Sponsor"], ["collab", "Kolaborasi"]] as const).map(([v, l]) => (
          <a key={l} href={`${base}/kolaborasi${v ? `?kind=${v}` : ""}`} className={`${chipClass.base} ${(filter.kind ?? "") === v ? chipClass.selected : chipClass.idle}`}>
            {l}
          </a>
        ))}
      </div>
      {openPosts.length === 0 && <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>Belum ada open call dari penyelenggara lain.</p>}
      {openPosts.map((p) => {
        const myApp = myApps.find((a) => a.post_id === p.id && a.status !== "withdrawn" && a.status !== "rejected");
        return (
          <div key={p.id} className={`${cardClass} flex flex-col gap-2 p-3.5`}>
            <div className="flex items-center justify-between">
              <span className={`${tagClass.base} ${p.kind === "sponsor" ? tagClass.hot : tagClass.info}`}>{p.kind === "sponsor" ? "Sponsor" : "Kolaborasi"}</span>
              <span className="text-[13px] text-fg-soft">{p.deadline ? `Tenggat ${formatDate(p.deadline)}` : "Tanpa tenggat"}</span>
            </div>
            <span className="text-[16px] font-semibold">{p.title}</span>
            <span className="text-[13px] text-fg-soft">
              {p.organizer.name} · {p.organizer.type === "merchant" ? "merchant" : "komunitas"}
              {p.region ? ` · ${p.region.name}` : ""}
              {p.activity ? ` · ${p.activity.title}` : " · tawaran umum"}
            </span>
            <span className="text-[15px] leading-[1.5]"><b>Butuh:</b> {p.needs}</span>
            <span className="text-[15px] leading-[1.5]"><b>Kamu dapat:</b> {p.benefits}</span>
            {myApp ? (
              <span className="text-[13px] font-semibold text-success">Pengajuanmu: {APP_STATUS[myApp.status]}</span>
            ) : approved && isLeader ? (
              <ApplyForm postId={p.id} isMerchant={type === "merchant"} ctx={ctx} />
            ) : null}
          </div>
        );
      })}

      {mine.posts.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[18px] font-semibold">Open call saya</h2>
          {mine.posts.map((p) => {
            const apps = mine.applications.filter((a) => a.post_id === p.id);
            return (
              <div key={p.id} className={`${cardClass} flex flex-col gap-1.5 p-3.5 ${p.status === "closed" ? "opacity-70" : ""}`}>
                <div className="flex items-center justify-between">
                  <span className="text-[15px] font-semibold">{p.title}</span>
                  <span className={`${tagClass.base} ${p.status === "open" ? tagClass.success : tagClass.neutral}`}>{p.status === "open" ? "Terbuka" : "Ditutup"}</span>
                </div>
                <span className="text-[13px] text-fg-soft">
                  {apps.length} pengajuan · {apps.filter((a) => a.status === "accepted").length} diterima{p.deadline ? ` · tenggat ${formatDate(p.deadline)}` : ""}
                </span>
                {p.status === "open" && isLeader && (
                  <form action={closeCollabPost} className="self-start">
                    <input type="hidden" name="post_id" value={p.id} />
                    <input type="hidden" name="organizer_id" value={id} />
                    <input type="hidden" name="type_org" value={type} />
                    <button type="submit" className="text-[13px] font-semibold text-danger">Tutup open call</button>
                  </form>
                )}
              </div>
            );
          })}
        </section>
      )}

      {myApps.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="font-display text-[18px] font-semibold">Pengajuan saya</h2>
          {myApps.map((a) => (
            <div key={a.id} className={`${cardClass} flex items-center gap-3 p-3.5`}>
              <span className="flex flex-1 flex-col">
                <span className="text-[15px] font-semibold">{a.post.title}</span>
                <span className="text-[13px] text-fg-soft">
                  {a.post.organizer.name} · sebagai {a.proposed_role} · {APP_STATUS[a.status]}
                </span>
              </span>
              {a.status === "pending" && isLeader && (
                <form action={withdrawApplication}>
                  <input type="hidden" name="application_id" value={a.id} />
                  <input type="hidden" name="organizer_id" value={id} />
                  <input type="hidden" name="type_org" value={type} />
                  <button type="submit" className="text-[13px] font-semibold text-danger">Tarik</button>
                </form>
              )}
            </div>
          ))}
        </section>
      )}
    </>
  );
}
