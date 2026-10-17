import { Suspense } from "react";
import { OrganizerAvatar } from "@/components/avatar";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, tagClass } from "@/components/styles";
import { listMySuggestions } from "@/lib/data/suggestions";
import { getCurrentUser } from "@/lib/data/user";
import { formatDateTime } from "@/lib/format";
import { CATEGORY_LABELS, SUGGESTION_STATUS_LABELS, SUGGESTION_STATUS_TONE } from "@/lib/suggestions";

// Saran saya: saran yang dikirim warga beserta status dan balasan tim penyelenggara.
export default function SaranSayaPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
            <Icon name="back" stroke={2} />
          </a>
          <h1 className="font-display text-[24px] font-bold">Saran saya</h1>
        </div>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <Content />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="" />
    </>
  );
}

async function Content() {
  const user = await getCurrentUser();
  if (!user) return null;
  const rows = await listMySuggestions(user.id);

  if (rows.length === 0) {
    return (
      <p className={`${cardClass} p-4 text-[13px] leading-[1.5] text-fg-soft`}>
        Belum ada saran. Buka profil merchant atau komunitas, lalu isi bagian Kasih saran.
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {rows.map((s) => {
        const org = s.organizer;
        const href = org ? `/${org.type === "merchant" ? "m" : "k"}/${org.slug}` : undefined;
        return (
          <li key={s.id} className={`${cardClass} flex flex-col gap-2.5 p-4`}>
            <div className="flex items-center gap-2.5">
              {org && <OrganizerAvatar name={org.name} type={org.type} logoUrl={org.logo_url} size={36} radius={10} />}
              <span className="flex flex-1 flex-col">
                {href ? (
                  <a href={href} className="text-[14px] font-semibold text-fg">
                    {org?.name}
                  </a>
                ) : (
                  <span className="text-[14px] font-semibold">Penyelenggara</span>
                )}
                <span className="text-[11px] text-fg-muted">
                  {CATEGORY_LABELS[s.category]} · {formatDateTime(s.created_at)}
                  {s.is_anonymous ? " · tanpa nama" : ""}
                </span>
              </span>
              <span className={`${tagClass.base} ${tagClass[SUGGESTION_STATUS_TONE[s.status]]}`}>{SUGGESTION_STATUS_LABELS[s.status]}</span>
            </div>
            <p className="whitespace-pre-line text-[14px] leading-[1.55] text-fg-label">{s.body}</p>
            {s.reply && (
              <div className="flex flex-col gap-1 rounded-[14px] bg-primary-tint px-3.5 py-3">
                <span className="text-[12px] font-bold text-link">Balasan {org?.name ?? "penyelenggara"}</span>
                <p className="whitespace-pre-line text-[13px] leading-[1.5] text-fg">{s.reply}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
