import { Suspense } from "react";
import Link from "next/link";
import { TemplateForm } from "./template-form";
import { cardClass, chipClass, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { toggleMissionTemplate } from "@/lib/actions/mission-templates";
import { listTemplatesWithStats } from "@/lib/data/mission-templates";
import { timeAgo } from "@/lib/format";
import { CATEGORY_LABELS, MISSION_CATEGORIES, audienceLabel } from "@/lib/mission-templates";
import { VERIFICATION_LABELS } from "@/lib/missions";
import { createClient } from "@/lib/supabase/server";

// Admin · Master misi: katalog template misi yang bisa dipakai penyelenggara.
// Template disalin saat dipakai, jadi mengubahnya tidak mengubah misi lama.
export default function MasterMisiPage({ searchParams }: PageProps<"/admin/misi">) {
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="flex flex-col gap-1">
          <h1 className="font-display text-[30px] font-bold">Master misi</h1>
          <span className="text-[15px] text-fg-soft">Template misi siap pakai untuk penyelenggara. Isinya disalin saat dipakai dan tetap bisa diubah penyelenggara.</span>
        </div>
        <Link href="/admin/misi?tambah=1" className="flex h-11 items-center rounded-xl bg-fg px-4 text-[15px] font-semibold text-bg">
          + Template baru
        </Link>
      </div>
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const RESULT: Record<string, string> = {
  tambah: "Template ditambahkan dan langsung bisa dipilih penyelenggara.",
  ubah: "Template diperbarui. Misi yang sudah dibuat dari template ini tidak berubah.",
  aktif: "Template diaktifkan kembali.",
  nonaktif: "Template dinonaktifkan. Penyelenggara tidak bisa memilihnya lagi.",
};

async function Body({ searchParams }: Pick<PageProps<"/admin/misi">, "searchParams">) {
  const sp = await searchParams;
  const str = (v: unknown) => (typeof v === "string" ? v : undefined);
  const kategori = str(sp.kategori);
  const status = str(sp.status) === "nonaktif" ? "nonaktif" : "aktif";
  const supabase = await createClient();
  const [rows, { data: settings }] = await Promise.all([
    listTemplatesWithStats(),
    supabase.from("app_settings").select("key, value").in("key", ["mission.xp_min", "mission.xp_max"]),
  ]);
  const setting = (k: string, d: number) => Number((settings ?? []).find((s) => s.key === k)?.value ?? d);
  const editing = str(sp.ubah) ? rows.find((r) => r.id === sp.ubah) : undefined;
  const showForm = str(sp.tambah) === "1" || !!editing;

  const active = rows.filter((r) => r.is_active);
  const shown = rows.filter((r) => (status === "aktif" ? r.is_active : !r.is_active) && (!kategori || r.category === kategori));
  const used = active.filter((r) => r.stats.missions > 0).length;
  const totalMissions = rows.reduce((s, r) => s + r.stats.missions, 0);
  const qs = (patch: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const next = { kategori, status, ...patch };
    Object.entries(next).forEach(([k, v]) => v && !(k === "status" && v === "aktif") && p.set(k, v));
    const s = p.toString();
    return `/admin/misi${s ? `?${s}` : ""}`;
  };

  return (
    <>
      {str(sp.hasil) && RESULT[str(sp.hasil)!] && (
        <p role="status" className="rounded-[14px] bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">{RESULT[str(sp.hasil)!]}</p>
      )}
      {str(sp.error) && <p role="alert" className="rounded-[14px] bg-danger-tint px-4 py-3 text-[15px] text-danger">{str(sp.error)}</p>}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="font-display text-[28px] font-semibold">{active.length}</span>
          <span className="text-[13px] text-fg-soft">template aktif</span>
        </div>
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="font-display text-[28px] font-semibold">{used}</span>
          <span className="text-[13px] text-fg-soft">template sudah dipakai penyelenggara</span>
        </div>
        <div className={`${cardClass} flex flex-col gap-1 p-4`}>
          <span className="font-display text-[28px] font-semibold">{totalMissions}</span>
          <span className="text-[13px] text-fg-soft">misi dibuat dari master misi</span>
        </div>
      </div>

      {showForm && <TemplateForm initial={editing} xpMin={setting("mission.xp_min", 10)} xpMax={setting("mission.xp_max", 100)} />}

      <nav aria-label="Filter template" className="flex flex-wrap gap-2">
        <Link href={qs({ status: "aktif" })} className={`${chipClass.base} ${status === "aktif" ? chipClass.selected : chipClass.idle}`}>Aktif · {active.length}</Link>
        <Link href={qs({ status: "nonaktif" })} className={`${chipClass.base} ${status === "nonaktif" ? chipClass.selected : chipClass.idle}`}>Nonaktif · {rows.length - active.length}</Link>
        <span className="mx-1 w-px bg-line" aria-hidden="true" />
        <Link href={qs({ kategori: undefined })} className={`${chipClass.base} ${!kategori ? chipClass.selected : chipClass.idle}`}>Semua kategori</Link>
        {MISSION_CATEGORIES.map(([value, label]) => (
          <Link key={value} href={qs({ kategori: value })} className={`${chipClass.base} ${kategori === value ? chipClass.selected : chipClass.idle}`}>{label}</Link>
        ))}
      </nav>

      {shown.length === 0 ? (
        <p className={`${cardClass} p-5 text-[15px] text-fg-soft`}>Tidak ada template di filter ini.</p>
      ) : (
        <section className={`${cardClass} overflow-hidden`}>
          {shown.map((t) => {
            const rate = t.stats.participant_slots > 0 ? Math.round((t.stats.completions / t.stats.participant_slots) * 100) : null;
            return (
              <div key={t.id} className="flex flex-wrap items-start gap-4 border-b border-line px-5 py-4 last:border-b-0">
                <span className="flex min-w-[260px] flex-1 flex-col gap-1">
                  <span className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[16px] font-semibold">{t.title}</span>
                    <span className={`${tagClass.base} ${tagClass.primary}`}>{CATEGORY_LABELS[t.category]}</span>
                    <span className={`${tagClass.base} ${tagClass.neutral}`}>{VERIFICATION_LABELS[t.verification]}</span>
                    <span className={`${tagClass.base} ${t.is_required ? tagClass.warn : tagClass.info}`}>{t.is_required ? "Wajib" : "Bonus"}</span>
                  </span>
                  {t.description && <span className="text-[15px] leading-[1.5] text-fg-label">{t.description}</span>}
                  {t.organizer_tips && <span className="text-[13px] leading-[1.5] text-fg-soft">Tips: {t.organizer_tips}</span>}
                  <span className="text-[13px] text-fg-muted">{audienceLabel(t)} · {t.xp_reward} Jejak</span>
                </span>
                <span className="flex min-w-[170px] flex-col gap-0.5 text-[13px] text-fg-soft">
                  <span><b className="text-fg">{t.stats.activities}</b> aktivitas · <b className="text-fg">{t.stats.missions}</b> misi</span>
                  <span>{rate === null ? "Belum ada peserta" : `${rate}% peserta menyelesaikan`}</span>
                  {t.stats.last_used_at && <span>terakhir dipakai {timeAgo(t.stats.last_used_at)}</span>}
                </span>
                <span className="flex gap-2">
                  <Link href={`/admin/misi?ubah=${t.id}`} className="flex h-10 items-center rounded-xl border border-line-strong bg-surface px-4 text-[15px] font-semibold text-fg">
                    Ubah
                  </Link>
                  <form action={toggleMissionTemplate}>
                    <input type="hidden" name="template_id" value={t.id} />
                    <input type="hidden" name="active" value={t.is_active ? "false" : "true"} />
                    <SubmitButton size="small" variant={t.is_active ? "outline" : "dark"} pendingText="…">
                      {t.is_active ? "Nonaktifkan" : "Aktifkan"}
                    </SubmitButton>
                  </form>
                </span>
              </div>
            );
          })}
        </section>
      )}
    </>
  );
}
