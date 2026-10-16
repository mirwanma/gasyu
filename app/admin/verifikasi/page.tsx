import { Suspense } from "react";
import { reviewOrganizer } from "./actions";
import { OrganizerAvatar } from "@/components/avatar";
import { cardClass, tagClass, textareaClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { categoryLabel, type OrganizerType } from "@/lib/data/organizers";
import { formatDateTime, timeAgo } from "@/lib/format";
import { signedUrl } from "@/lib/storage";
import { createClient } from "@/lib/supabase/server";

const DAY_LABELS: Record<string, string> = { mon: "Sen", tue: "Sel", wed: "Rab", thu: "Kam", fri: "Jum", sat: "Sab", sun: "Min" };

export default function VerifikasiPage({ searchParams }: PageProps<"/admin/verifikasi">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Verifikasi penyelenggara</h1>
        <Suspense fallback={<span className="text-[14px] text-fg-soft">Memuat…</span>}>
          <QueueSummary />
        </Suspense>
      </div>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Queue searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function QueueSummary() {
  const supabase = await createClient();
  const { count } = await supabase.from("organizers").select("id", { count: "exact", head: true }).eq("status", "pending");
  return <span className="text-[14px] text-fg-soft">{count ?? 0} menunggu verifikasi</span>;
}

type QueueRow = {
  id: string;
  type: OrganizerType;
  name: string;
  logo_url: string | null;
  status: string;
  created_at: string;
  village: { name: string } | { name: string }[] | null;
};

async function Queue({ searchParams }: Pick<PageProps<"/admin/verifikasi">, "searchParams">) {
  const { pilih, hasil } = await searchParams;
  const supabase = await createClient();
  const { data } = await supabase
    .from("organizers")
    .select("id, type, name, logo_url, status, created_at, village:regions(name)")
    .eq("status", "pending")
    .order("created_at");
  const queue = (data ?? []) as QueueRow[];
  const selectedId = typeof pilih === "string" && queue.some((q) => q.id === pilih) ? pilih : queue[0]?.id;

  return (
    <div className="flex flex-wrap items-start gap-5">
      <section className={`${cardClass} min-w-0 flex-[1_1_360px] overflow-hidden`}>
        {hasil === "ok" && (
          <p className="border-b border-line bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">Keputusan tersimpan dan tim penyelenggara diberi tahu.</p>
        )}
        {queue.length === 0 && <p className="p-5 text-[13px] text-fg-soft">Antrean kosong. Semua pendaftar sudah diperiksa.</p>}
        {queue.map((q) => {
          const village = (Array.isArray(q.village) ? q.village[0] : q.village) as { name: string } | null;
          const selected = q.id === selectedId;
          return (
            <a
              key={q.id}
              href={`/admin/verifikasi?pilih=${q.id}`}
              className={`flex items-center gap-3.5 border-b border-line border-l-4 px-4 py-4 text-fg ${selected ? "border-l-primary bg-primary-tint/40" : "border-l-transparent"}`}
            >
              <OrganizerAvatar name={q.name} type={q.type} logoUrl={q.logo_url} size={44} />
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{q.name}</span>
                <span className="text-[12px] text-fg-soft">
                  {village?.name ?? "-"} · {timeAgo(q.created_at)}
                </span>
              </span>
              <span className={`${tagClass.base} ${q.type === "merchant" ? tagClass.warn : tagClass.hot}`}>
                {q.type === "merchant" ? "Merchant" : "Komunitas"}
              </span>
            </a>
          );
        })}
      </section>

      {selectedId && (
        <Suspense fallback={<section className={`${cardClass} flex-[1.4_1_420px] p-6 text-[13px] text-fg-muted`}>Memuat…</section>}>
          <Detail id={selectedId} />
        </Suspense>
      )}
    </div>
  );
}

async function Detail({ id }: { id: string }) {
  const supabase = await createClient();
  const { data: org } = await supabase
    .from("organizers")
    .select(
      "id, type, name, logo_url, description, created_at, review_note, creator:profiles!organizers_created_by_fkey(nickname), merchant:merchant_profiles(merchant_category, nib, whatsapp, proof_url), community:community_profiles(interest_category, whatsapp, social_links, est_members, basecamp_address, join_policy, proof_url, area:regions(name)), outlets:merchant_outlets(name, address, lat, lng, opening_hours, village:regions(name))",
    )
    .eq("id", id)
    .maybeSingle();
  if (!org) return null;

  const one = <T,>(v: T | T[] | null): T | null => (Array.isArray(v) ? v[0] ?? null : v);
  const creator = one(org.creator) as { nickname: string } | null;
  const merchant = one(org.merchant) as { merchant_category: string; nib: string | null; whatsapp: string; proof_url: string | null } | null;
  const community = one(org.community) as {
    interest_category: string;
    whatsapp: string;
    social_links: Record<string, string>;
    est_members: number | null;
    basecamp_address: string | null;
    join_policy: string;
    proof_url: string | null;
    area: { name: string } | { name: string }[] | null;
  } | null;
  const outlets = (org.outlets ?? []) as { name: string; address: string; lat: number; lng: number; opening_hours: Record<string, [string, string]> | null; village: { name: string } | { name: string }[] | null }[];
  const proofUrl = await signedUrl(supabase, "organizer-proofs", merchant?.proof_url ?? community?.proof_url ?? null);
  const type = org.type as OrganizerType;

  const facts: [string, string][] =
    type === "merchant"
      ? [
          ["WhatsApp", merchant?.whatsapp ?? "-"],
          ["Kategori", categoryLabel(merchant?.merchant_category ?? "")],
          ["NIB", merchant?.nib || "Tidak diisi (opsional)"],
          ["Outlet", `${outlets.length} outlet`],
        ]
      : [
          ["WhatsApp", community?.whatsapp ?? "-"],
          ["Kategori", categoryLabel(community?.interest_category ?? "")],
          ["Area kegiatan", (one(community?.area ?? null) as { name: string } | null)?.name ?? "-"],
          ["Perkiraan anggota", community?.est_members?.toString() ?? "-"],
          ["Media sosial", Object.entries(community?.social_links ?? {}).map(([k, v]) => `${k}: @${v}`).join(", ") || "-"],
          ["Cara bergabung", community?.join_policy === "open" ? "Terbuka" : "Perlu persetujuan"],
          ["Basecamp", community?.basecamp_address || "-"],
        ];

  return (
    <section className={`${cardClass} flex min-w-0 flex-[1.4_1_420px] flex-col gap-[18px] p-6`}>
      <div className="flex items-center gap-3.5">
        <OrganizerAvatar name={org.name} type={type} logoUrl={org.logo_url} size={56} radius={16} />
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="font-display text-[22px] font-semibold">{org.name}</span>
          <span className="text-[13px] text-fg-soft">
            {type === "merchant" ? "Merchant" : "Komunitas"} · didaftarkan oleh {creator?.nickname ?? "-"} · {formatDateTime(org.created_at)}
          </span>
        </div>
      </div>
      {org.description && <p className="text-[14px] leading-[1.55] text-fg-label">{org.description}</p>}
      {org.review_note && (
        <p className="rounded-[14px] bg-warn-tint px-3.5 py-3 text-[13px] text-warn">Pengajuan ulang. Catatan sebelumnya: {org.review_note}</p>
      )}

      <div className="grid gap-3 sm:grid-cols-2">
        {facts.map(([k, v]) => (
          <div key={k} className="flex flex-col gap-0.5 rounded-[14px] bg-bg px-3.5 py-3">
            <span className="text-[12px] text-fg-soft">{k}</span>
            <span className="text-[14px] font-semibold">{v}</span>
          </div>
        ))}
      </div>

      {outlets.map((o, i) => {
        const village = one(o.village) as { name: string } | null;
        const days = Object.keys(DAY_LABELS).filter((d) => o.opening_hours?.[d]);
        const hours = days.length > 0 ? `${days.map((d) => DAY_LABELS[d] ?? d).join(", ")} · ${o.opening_hours![days[0]][0]}–${o.opening_hours![days[0]][1]}` : "-";
        return (
          <div key={i} className="flex flex-col gap-1 rounded-[14px] border border-line p-3.5 text-[13px]">
            <span className="font-semibold">{o.name}</span>
            <span className="text-fg-soft">
              {o.address}
              {village ? ` · Kel. ${village.name}` : ""}
            </span>
            <span className="text-fg-soft">Jam buka: {hours}</span>
            <a
              href={`https://www.openstreetmap.org/?mlat=${o.lat}&mlon=${o.lng}#map=17/${o.lat}/${o.lng}`}
              target="_blank"
              rel="noreferrer"
              className="font-semibold text-link"
            >
              Cek titik di peta
            </a>
          </div>
        );
      })}

      <div className="flex flex-col gap-2">
        <span className="text-[13px] font-semibold">{type === "merchant" ? "Foto tempat usaha" : "Bukti kegiatan"}</span>
        {proofUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={proofUrl} alt="Foto bukti" className="max-h-[320px] w-full rounded-[14px] border border-line object-contain" />
        ) : (
          <span className="rounded-[14px] bg-danger-tint px-3.5 py-3 text-[13px] text-danger">Belum ada foto bukti.</span>
        )}
      </div>

      <form action={reviewOrganizer} className="flex flex-col gap-3">
        <input type="hidden" name="organizer_id" value={org.id} />
        <label htmlFor="note" className="text-[13px] font-semibold">
          Catatan untuk pendaftar (wajib jika ditolak)
        </label>
        <textarea id="note" name="note" rows={3} placeholder="Contoh: foto tempat usaha belum menampilkan papan nama" className={textareaClass} />
        <div className="flex flex-wrap justify-end gap-3">
          <SubmitButton name="decision" value="reject" variant="danger" pendingText="Menyimpan…" className="h-[46px] w-auto rounded-[14px] px-5 text-[14px]">
            Tolak
          </SubmitButton>
          <SubmitButton name="decision" value="approve" pendingText="Menyimpan…" className="h-[46px] w-auto rounded-[14px] bg-success px-6 text-[14px] text-white">
            Setujui
          </SubmitButton>
        </div>
      </form>
    </section>
  );
}
