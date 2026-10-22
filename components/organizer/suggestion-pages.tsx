import { OrganizerShell } from "@/components/organizer/shell";
import { cardClass, chipClass, tagClass, textareaClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { respondSuggestion } from "@/lib/actions/suggestions";
import { listOrganizerSuggestions, type TeamSuggestion } from "@/lib/data/suggestions";
import { timeAgo } from "@/lib/format";
import { CATEGORY_LABELS, SUGGESTION_STATUS_LABELS, SUGGESTION_STATUS_TONE, type SuggestionStatus } from "@/lib/suggestions";

type Kind = "merchant" | "community";
export type SaranQuery = { tab?: string; hasil?: string; error?: string };

const TABS: [SuggestionStatus | "semua", string][] = [
  ["new", "Baru"],
  ["in_progress", "Ditindaklanjuti"],
  ["done", "Selesai"],
  ["archived", "Arsip"],
  ["semua", "Semua"],
];

const RESULT: Record<string, string> = {
  in_progress: "Saran ditandai ditindaklanjuti. Warga mendapat notifikasi.",
  done: "Saran ditandai selesai. Warga mendapat notifikasi.",
  archived: "Saran diarsipkan.",
};

// Saran warga untuk merchant/komunitas: semua anggota tim boleh membaca,
// membalas, dan mengubah status (aturan dicek ulang di respond_suggestion).
export function SaranPage({ id, type, query }: { id: string; type: Kind; query: SaranQuery }) {
  return (
    <OrganizerShell organizerId={id} type={type} active="Lainnya" title="Saran warga">
      {() => <SaranBody id={id} type={type} query={query} />}
    </OrganizerShell>
  );
}

async function SaranBody({ id, type, query }: { id: string; type: Kind; query: SaranQuery }) {
  const rows = await listOrganizerSuggestions(id);
  const base = `/${type === "merchant" ? "merchant" : "komunitas"}/${id}/saran`;
  const counts = Object.fromEntries(TABS.map(([k]) => [k, k === "semua" ? rows.length : rows.filter((r) => r.status === k).length]));
  const tab = TABS.some(([k]) => k === query.tab) ? query.tab! : counts.new > 0 ? "new" : "semua";
  const shown = tab === "semua" ? rows : rows.filter((r) => r.status === tab);
  const self = `${base}?tab=${tab}`;

  return (
    <>
      <p className="text-[16px] leading-[1.5] text-fg-soft">
        Saran dari warga lewat profil publik kamu. Balasanmu terlihat oleh pengirimnya saja. Saran tanpa nama tidak menampilkan identitas pengirim.
      </p>
      {query.hasil && RESULT[query.hasil] && (
        <p role="status" className="rounded-[14px] bg-success-tint px-4 py-3 text-[16px] font-semibold text-success">
          {RESULT[query.hasil]}
        </p>
      )}
      {query.error && (
        <p role="alert" className="rounded-[14px] bg-danger-tint px-4 py-3 text-[16px] text-danger">
          {query.error}
        </p>
      )}
      <nav aria-label="Status saran" className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1">
        {TABS.map(([key, label]) => (
          <a key={key} href={`${base}?tab=${key}`} className={`${chipClass.base} shrink-0 ${tab === key ? chipClass.selected : chipClass.idle}`}>
            {label}
            {counts[key] > 0 ? ` · ${counts[key]}` : ""}
          </a>
        ))}
      </nav>
      {shown.length === 0 ? (
        <p className={`${cardClass} p-4 text-[16px] leading-[1.5] text-fg-soft`}>
          {rows.length === 0 ? "Belum ada saran. Warga bisa mengirim saran dari halaman profil publik kamu." : "Tidak ada saran di tab ini."}
        </p>
      ) : (
        <ul className="flex flex-col gap-3">
          {shown.map((s) => (
            <SuggestionCard key={s.id} s={s} back={self} />
          ))}
        </ul>
      )}
    </>
  );
}

function SuggestionCard({ s, back }: { s: TeamSuggestion; back: string }) {
  return (
    <li className={`${cardClass} flex flex-col gap-2.5 p-4`}>
      <div className="flex items-start gap-2">
        <span className="flex flex-1 flex-col gap-0.5">
          <span className="text-[17px] font-semibold">
            {s.is_anonymous ? "Tanpa nama" : s.nickname}
            {s.village_name ? <span className="font-normal text-fg-soft"> · {s.village_name}</span> : null}
          </span>
          <span className="text-[13px] text-fg-muted">
            {CATEGORY_LABELS[s.category]} · {timeAgo(s.created_at)}
          </span>
        </span>
        <span className={`${tagClass.base} ${tagClass[SUGGESTION_STATUS_TONE[s.status]]}`}>{SUGGESTION_STATUS_LABELS[s.status]}</span>
      </div>
      <p className="whitespace-pre-line text-[17px] leading-[1.55]">{s.body}</p>
      {s.reply && (
        <p className="rounded-xl bg-primary-tint px-3 py-2 text-[14px] leading-[1.5] text-fg-label">
          <b>Balasan{s.replied_by_nickname ? ` ${s.replied_by_nickname}` : ""}:</b> {s.reply}
        </p>
      )}
      <form action={respondSuggestion} className="flex flex-col gap-2">
        <input type="hidden" name="suggestion_id" value={s.id} />
        <input type="hidden" name="back" value={back} />
        <label htmlFor={`balas-${s.id}`} className="sr-only">
          Balasan untuk warga
        </label>
        <textarea
          id={`balas-${s.id}`}
          name="reply"
          rows={2}
          maxLength={1000}
          defaultValue={s.reply ?? ""}
          placeholder="Tulis balasan untuk pengirim (opsional)"
          className={`${textareaClass} resize-none text-[16px]`}
        />
        <div className="flex flex-wrap gap-2">
          {s.status !== "in_progress" && s.status !== "done" && (
            <SubmitButton size="small" variant="dark" name="status" value="in_progress" pendingText="…">
              Tindak lanjuti
            </SubmitButton>
          )}
          {s.status !== "done" && (
            <SubmitButton size="small" variant="outline" name="status" value="done" pendingText="…">
              Selesai
            </SubmitButton>
          )}
          {s.status === "done" || s.status === "in_progress" ? (
            <SubmitButton size="small" variant="outline" name="status" value={s.status} pendingText="…">
              Simpan balasan
            </SubmitButton>
          ) : null}
          {s.status !== "archived" && (
            <SubmitButton size="small" variant="outline" name="status" value="archived" pendingText="…">
              Arsipkan
            </SubmitButton>
          )}
        </div>
      </form>
    </li>
  );
}
