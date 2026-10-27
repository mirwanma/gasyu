import { Suspense } from "react";
import { OrganizerShell, type OrganizerContext } from "@/components/organizer/shell";
import { cardClass, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { decideMembership, removeMember, setJoinPolicy } from "@/lib/actions/organizer";
import { formatMonthYear, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type MemberRow = {
  id: string;
  user_id: string;
  status: "pending" | "active" | "rejected" | "left" | "removed";
  message: string | null;
  joined_at: string | null;
  ended_at: string | null;
  removed_reason: string | null;
  created_at: string;
  nickname: string;
  district_name: string | null;
  team_role: "chair" | "officer" | null;
};

export default function Page(props: PageProps<"/komunitas/[id]/member">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[15px] text-fg-muted">Memuat…</p>}>
      <Loader {...props} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/komunitas/[id]/member">) {
  const { id } = await params;
  const { tab, error } = await searchParams;
  const activeTab = tab === "aktif" ? "aktif" : tab === "riwayat" ? "riwayat" : "permintaan";
  return (
    <OrganizerShell organizerId={id} type="community" active="Member" title="Member">
      {(ctx) => <MemberBody ctx={ctx} id={id} tab={activeTab} error={typeof error === "string" ? error : undefined} />}
    </OrganizerShell>
  );
}

async function MemberBody({ ctx, id, tab, error }: { ctx: OrganizerContext; id: string; tab: string; error?: string }) {
  const supabase = await createClient();
  const [{ data: rows }, { data: profile }] = await Promise.all([
    supabase.from("v_community_members").select("*").eq("community_id", id).order("created_at", { ascending: false }),
    supabase.from("community_profiles").select("join_policy").eq("organizer_id", id).maybeSingle(),
  ]);
  const members = (rows ?? []) as MemberRow[];
  const pending = members.filter((m) => m.status === "pending");
  const active = members.filter((m) => m.status === "active");
  const history = members.filter((m) => ["rejected", "left", "removed"].includes(m.status));
  const policy = (profile as { join_policy?: string } | null)?.join_policy ?? "approval";
  const isChair = ctx.org.role === "chair";
  const base = `/komunitas/${id}/member`;

  return (
    <>
      {error === "tim" && (
        <p role="alert" className="rounded-[14px] bg-danger-tint px-4 py-3 text-[15px] text-danger">
          Ketua dan pengurus lain tidak bisa dikeluarkan dari sini. Atur lewat halaman Tim.
        </p>
      )}

      <section className={`${cardClass} flex flex-col gap-2.5 p-3.5`}>
        <div className="flex items-center justify-between">
          <span className="text-[15px] font-bold">Cara bergabung</span>
          <span className="text-[12px] text-fg-soft">Hanya ketua yang bisa mengubah</span>
        </div>
        <form action={setJoinPolicy} role="radiogroup" aria-label="Kebijakan bergabung" className="grid grid-cols-2 gap-1.5 rounded-xl bg-bg p-1">
          <input type="hidden" name="community_id" value={id} />
          {(["open", "approval"] as const).map((value) => {
            const selected = policy === value;
            return (
              <button
                key={value}
                type="submit"
                name="policy"
                value={value}
                role="radio"
                aria-checked={selected}
                disabled={!isChair}
                className={`h-10 rounded-[9px] text-[15px] font-semibold ${
                  selected ? "bg-surface text-fg shadow-sm" : "text-fg-label"
                } disabled:cursor-not-allowed`}
              >
                {value === "open" ? "Terbuka" : "Perlu persetujuan"}
              </button>
            );
          })}
        </form>
      </section>

      <div role="tablist" className="grid grid-cols-3 gap-1.5 rounded-[14px] border border-line bg-surface p-1">
        {[
          ["permintaan", `Permintaan · ${pending.length}`],
          ["aktif", `Aktif · ${active.length}`],
          ["riwayat", "Riwayat"],
        ].map(([key, label]) => (
          <a
            key={key}
            href={`${base}?tab=${key}`}
            role="tab"
            aria-selected={tab === key}
            className={`flex h-10 items-center justify-center rounded-[10px] text-[15px] font-semibold ${
              tab === key ? "bg-fg text-bg" : "text-fg-label"
            }`}
          >
            {label}
          </a>
        ))}
      </div>

      {tab === "permintaan" && (
        <>
          {pending.length === 0 && <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>Tidak ada permintaan baru.</p>}
          {pending.map((m) => (
            <div key={m.id} className={`${cardClass} flex flex-col gap-2.5 p-3.5`}>
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-full bg-primary-tint text-[15px] font-bold uppercase text-link">
                  {m.nickname.slice(0, 2)}
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[15px] font-semibold">{m.nickname}</span>
                  <span className="text-[13px] text-fg-soft">
                    {m.district_name ?? "Wilayah belum diisi"} · {timeAgo(m.created_at)}
                  </span>
                </span>
              </div>
              <span className="text-[15px] leading-[1.5] text-fg-label">{m.message ? `"${m.message}"` : "Tidak ada pesan"}</span>
              <form action={decideMembership} className="grid grid-cols-2 gap-2">
                <input type="hidden" name="community_id" value={id} />
                <input type="hidden" name="membership_id" value={m.id} />
                <SubmitButton size="small" variant="outline" name="decision" value="reject" pendingText="…">
                  Tolak
                </SubmitButton>
                <SubmitButton size="small" variant="dark" name="decision" value="accept" pendingText="…">
                  Terima
                </SubmitButton>
              </form>
            </div>
          ))}
          <span className="text-[13px] leading-[1.5] text-fg-soft">
            Kamu hanya melihat nama panggilan, kecamatan, dan keaktifan member. Permintaan yang tidak dijawab 30 hari otomatis
            ditolak.
          </span>
        </>
      )}

      {tab === "aktif" && (
        <section className={`${cardClass} flex flex-col overflow-hidden`}>
          {active.map((m, i) => (
            <div key={m.id} className={`flex min-h-14 items-center gap-3 px-3.5 py-2 ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">
                  {m.nickname}{" "}
                  {m.team_role && (
                    <span className="text-[12px] font-bold uppercase text-hot">{m.team_role === "chair" ? "Ketua" : "Pengurus"}</span>
                  )}
                </span>
                <span className="text-[13px] text-fg-soft">
                  {m.district_name ?? "Wilayah belum diisi"} · gabung {m.joined_at ? formatMonthYear(m.joined_at) : "-"}
                </span>
              </span>
              {!m.team_role && (
                <form action={removeMember}>
                  <input type="hidden" name="community_id" value={id} />
                  <input type="hidden" name="membership_id" value={m.id} />
                  <SubmitButton size="small" variant="outline" pendingText="…">
                    Keluarkan
                  </SubmitButton>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      {tab === "riwayat" && (
        <section className={`${cardClass} flex flex-col overflow-hidden`}>
          {history.length === 0 && <p className="p-4 text-[15px] text-fg-soft">Belum ada riwayat.</p>}
          {history.map((m, i) => (
            <div key={m.id} className={`flex min-h-14 items-center gap-3 px-3.5 py-2 ${i > 0 ? "border-t border-line" : ""}`}>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="text-[15px] font-semibold">{m.nickname}</span>
                <span className="text-[13px] text-fg-soft">
                  {m.removed_reason ? `${m.removed_reason} · ` : ""}
                  {timeAgo(m.ended_at ?? m.created_at)}
                </span>
              </span>
              <span className={`${tagClass.base} ${m.status === "removed" ? tagClass.hot : tagClass.neutral}`}>
                {{ rejected: "Ditolak", left: "Keluar", removed: "Dikeluarkan" }[m.status as "rejected" | "left" | "removed"]}
              </span>
            </div>
          ))}
        </section>
      )}
    </>
  );
}
