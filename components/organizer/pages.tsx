import Link from "next/link";
import { redirect } from "next/navigation";
import { OrganizerAvatar } from "@/components/avatar";
import { MenuList, OrganizerShell, type OrganizerContext } from "@/components/organizer/shell";
import { ProfileForm } from "@/components/organizer/profile-form";
import { TeamInvite } from "@/components/organizer/team-invite";
import { cardClass, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { removeTeamMember, resubmitOrganizer } from "@/lib/actions/organizer";
import { ROLE_LABELS, STATUS_LABELS, getVillageOptions, type MemberRole } from "@/lib/data/organizers";
import { formatDate } from "@/lib/format";
import { countNewSuggestions } from "@/lib/data/suggestions";
import { createClient } from "@/lib/supabase/server";

type Kind = "merchant" | "community";
const basePath = (type: Kind, id: string) => `/${type === "merchant" ? "merchant" : "komunitas"}/${id}`;

// ---- Lainnya ---------------------------------------------------------

export function LainnyaPage({ id, type, akses }: { id: string; type: Kind; akses?: string }) {
  const base = basePath(type, id);
  return (
    <OrganizerShell organizerId={id} type={type} active="Lainnya" title="Lainnya">
      {async ({ org }) => {
        const newSuggestions = await countNewSuggestions(id);
        // Staf/pengurus tidak melihat Tim dan Reward (lihat ALUR-SISTEM bagian 2).
        const isLeader = org.role === "owner" || org.role === "chair";
        return (
        <>
          {akses === "peran" && (
            <p role="alert" className="rounded-[14px] bg-warn-tint px-4 py-3 text-[13px] text-warn">
              Menu itu hanya untuk {type === "merchant" ? "pemilik" : "ketua"}.
            </p>
          )}
          <MenuList
            items={[
              ...(type === "merchant" ? [{ label: "Outlet", href: `${base}/outlet` }] : []),
              ...(isLeader ? [{ label: "Tim", href: `${base}/tim` }] : []),
              { label: "Profil & verifikasi", href: `${base}/profil` },
              { label: "Lihat profil publik", href: `/${type === "merchant" ? "m" : "k"}/${org.slug}` },
              ...(type === "merchant" && isLeader ? [{ label: "Reward & budget poin", href: `${base}/reward` }] : []),
              ...(type === "merchant" ? [{ label: "Kasir", href: `${base}/kasir` }] : []),
              { label: "Kolaborasi", href: `${base}/kolaborasi` },
              { label: newSuggestions > 0 ? `Saran warga · ${newSuggestions} baru` : "Saran warga", href: `${base}/saran` },
            ]}
          />
          <Link href="/" className="flex h-12 items-center justify-center rounded-2xl border border-line-strong text-[14px] font-semibold text-fg">
            Kembali ke mode warga
          </Link>
        </>
        );
      }}
    </OrganizerShell>
  );
}

// ---- Tim -------------------------------------------------------------

export function TimPage({ id, type, error }: { id: string; type: Kind; error?: string }) {
  return (
    <OrganizerShell organizerId={id} type={type} active="Lainnya" title="Tim">
      {(ctx) => <TeamBody ctx={ctx} id={id} type={type} error={error} />}
    </OrganizerShell>
  );
}

async function TeamBody({ ctx, id, type, error }: { ctx: OrganizerContext; id: string; type: Kind; error?: string }) {
  if (ctx.org.role !== "owner" && ctx.org.role !== "chair") redirect(`${basePath(type, id)}/lainnya?akses=peran`);
  const supabase = await createClient();
  const { data: team } = await supabase.from("v_organizer_team").select("*").eq("organizer_id", id).order("created_at");
  const members = (team ?? []) as { user_id: string; role: MemberRole; nickname: string; created_at: string }[];
  const isLeader = ctx.org.role === "owner" || ctx.org.role === "chair";
  const roleName = type === "merchant" ? "staf" : "pengurus";

  return (
    <>
      {error === "terakhir" && (
        <p role="alert" className="rounded-[14px] bg-danger-tint px-4 py-3 text-[13px] text-danger">
          Harus tersisa minimal satu {type === "merchant" ? "pemilik" : "ketua"}.
        </p>
      )}
      <section className={`${cardClass} flex flex-col overflow-hidden`}>
        {members.map((m, i) => (
          <div key={m.user_id} className={`flex min-h-14 items-center gap-3 px-3.5 py-2 ${i > 0 ? "border-t border-line" : ""}`}>
            <span className="flex flex-1 flex-col gap-0.5">
              <span className="text-[14px] font-semibold">
                {m.nickname}{" "}
                <span className="text-[11px] font-bold uppercase text-hot">{ROLE_LABELS[m.role]}</span>
                {m.user_id === ctx.user.id && <span className="text-[11px] text-fg-muted"> · kamu</span>}
              </span>
              <span className="text-[12px] text-fg-soft">bergabung {formatDate(m.created_at)}</span>
            </span>
            {(isLeader || m.user_id === ctx.user.id) && (
              <form action={removeTeamMember}>
                <input type="hidden" name="organizer_id" value={id} />
                <input type="hidden" name="type" value={type} />
                <input type="hidden" name="user_id" value={m.user_id} />
                <SubmitButton size="small" variant="outline" pendingText="…">
                  {m.user_id === ctx.user.id ? "Keluar" : "Cabut"}
                </SubmitButton>
              </form>
            )}
          </div>
        ))}
      </section>

      {isLeader ? (
        <TeamInvite organizerId={id} type={type} roleName={roleName} />
      ) : (
        <p className="text-[12px] leading-[1.5] text-fg-soft">
          Hanya {type === "merchant" ? "pemilik" : "ketua"} yang bisa mengundang {roleName} baru.
        </p>
      )}
    </>
  );
}

// ---- Profil & verifikasi ----------------------------------------------

export function ProfilPage({ id, type, unggah }: { id: string; type: Kind; unggah?: string }) {
  return (
    <OrganizerShell organizerId={id} type={type} active="Lainnya" title="Profil & verifikasi">
      {(ctx) => <ProfilBody ctx={ctx} id={id} type={type} uploadFailed={unggah === "gagal"} />}
    </OrganizerShell>
  );
}

async function ProfilBody({ ctx, id, type, uploadFailed }: { ctx: OrganizerContext; id: string; type: Kind; uploadFailed: boolean }) {
  const supabase = await createClient();
  const [{ data: org }, districts] = await Promise.all([
    supabase
      .from("organizers")
      .select(
        "id, name, description, logo_url, status, review_note, village_id, merchant:merchant_profiles(merchant_category, nib, whatsapp, proof_url), community:community_profiles(interest_category, whatsapp, social_links, est_members, basecamp_address, activity_area_village_id, proof_url)",
      )
      .eq("id", id)
      .maybeSingle(),
    getVillageOptions(),
  ]);
  if (!org) return null;
  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const merchant = one(org.merchant) as { merchant_category: string; nib: string | null; whatsapp: string; proof_url: string | null } | null;
  const community = one(org.community) as {
    interest_category: string;
    whatsapp: string;
    social_links: Record<string, string>;
    est_members: number | null;
    basecamp_address: string | null;
    activity_area_village_id: string | null;
    proof_url: string | null;
  } | null;
  const status = org.status as keyof typeof STATUS_LABELS;
  const tone = { pending: tagClass.warn, approved: tagClass.success, rejected: tagClass.hot, suspended: tagClass.neutral }[status];
  const isLeader = ctx.org.role === "owner" || ctx.org.role === "chair";

  return (
    <>
      {uploadFailed && (
        <p role="alert" className="rounded-[14px] bg-warn-tint px-4 py-3 text-[13px] text-warn">
          Pendaftaran tersimpan, tetapi berkas gambar belum terunggah. Unggah lagi di bawah.
        </p>
      )}
      <section className={`${cardClass} flex flex-col gap-3 p-4`}>
        <div className="flex items-center gap-3">
          <OrganizerAvatar name={org.name} type={type} logoUrl={org.logo_url} size={56} radius={16} />
          <div className="flex flex-1 flex-col gap-1">
            <span className="text-[15px] font-bold">{org.name}</span>
            <span className={`${tagClass.base} ${tone} self-start`}>{STATUS_LABELS[status]}</span>
          </div>
        </div>
        {status === "rejected" && (
          <div className="flex flex-col gap-2 rounded-[14px] bg-danger-tint p-3 text-[13px] text-danger">
            <span className="font-semibold">Catatan tim Gasyu</span>
            <span className="leading-[1.5]">{org.review_note}</span>
            {isLeader && (
              <form action={resubmitOrganizer}>
                <input type="hidden" name="organizer_id" value={id} />
                <input type="hidden" name="type" value={type} />
                <SubmitButton size="small" variant="dark" pendingText="Mengajukan…">
                  Sudah diperbaiki, ajukan ulang
                </SubmitButton>
              </form>
            )}
          </div>
        )}
        {status === "pending" && (
          <p className="text-[12px] leading-[1.5] text-fg-soft">
            Tim Gasyu memeriksa data dan foto bukti, biasanya 1–2 hari kerja.
          </p>
        )}
      </section>

      <ProfileForm
        organizerId={id}
        type={type}
        districts={districts}
        values={{
          name: org.name,
          description: org.description ?? "",
          whatsapp: merchant?.whatsapp ?? community?.whatsapp ?? "",
          category: merchant?.merchant_category ?? community?.interest_category ?? "",
          nib: merchant?.nib ?? "",
          instagram: community?.social_links?.instagram ?? "",
          tiktok: community?.social_links?.tiktok ?? "",
          estMembers: community?.est_members?.toString() ?? "",
          basecamp: community?.basecamp_address ?? "",
          areaVillage: community?.activity_area_village_id ?? "",
          hasProof: Boolean(merchant?.proof_url ?? community?.proof_url),
        }}
      />
    </>
  );
}
