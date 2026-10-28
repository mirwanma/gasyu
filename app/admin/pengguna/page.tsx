import { Suspense } from "react";
import { OrganizerAvatar } from "@/components/avatar";
import { chipClass, cardClass, inputClass, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { suspendOrganizer, suspendUser } from "@/lib/actions/moderation";
import { listAdminUsers } from "@/lib/data/dashboards";
import { formatDate, formatDateTime, formatNumber } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Admin: cari warga, merchant, komunitas; bekukan atau aktifkan kembali.
export default function PenggunaPage({ searchParams }: PageProps<"/admin/pengguna">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Pengguna</h1>
        <span className="text-[15px] text-fg-soft">Cari warga dan penyelenggara. Akun beku tidak bisa check-in, menukar poin, atau mengelola dashboard.</span>
      </div>
      <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
        <Body searchParams={searchParams} />
      </Suspense>
    </>
  );
}

const ORG_STATUS: Record<string, { label: string; tone: string }> = {
  approved: { label: "Aktif", tone: tagClass.success },
  pending: { label: "Menunggu verifikasi", tone: tagClass.warn },
  rejected: { label: "Perlu perbaikan", tone: tagClass.hot },
  suspended: { label: "Dibekukan", tone: tagClass.hot },
};

async function Body({ searchParams }: Pick<PageProps<"/admin/pengguna">, "searchParams">) {
  const sp = await searchParams;
  const tab = sp.tab === "penyelenggara" ? "penyelenggara" : "warga";
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const hasil = typeof sp.hasil === "string" ? sp.hasil : undefined;
  const errorMsg = typeof sp.error === "string" ? sp.error : undefined;
  const base = `/admin/pengguna?tab=${tab}`;

  return (
    <>
      {hasil === "beku" && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">Akun dibekukan dan pemiliknya diberi tahu.</p>}
      {hasil === "aktif" && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[15px] font-semibold text-success">Akun aktif kembali.</p>}
      {errorMsg && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[15px] font-semibold text-danger">{errorMsg}</p>}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex gap-2">
          <a href="/admin/pengguna" className={`${chipClass.base} ${tab === "warga" ? chipClass.selected : chipClass.idle}`}>
            Warga
          </a>
          <a href="/admin/pengguna?tab=penyelenggara" className={`${chipClass.base} ${tab === "penyelenggara" ? chipClass.selected : chipClass.idle}`}>
            Merchant & komunitas
          </a>
        </div>
        <form className="flex flex-[1_1_280px] gap-2">
          <input type="hidden" name="tab" value={tab} />
          <input name="q" defaultValue={q} placeholder={tab === "warga" ? "Cari nickname atau nama" : "Cari nama penyelenggara"} className={`${inputClass} h-10 text-[15px]`} />
          <button type="submit" className="h-10 rounded-xl bg-fg px-4 text-[15px] font-semibold text-bg">
            Cari
          </button>
        </form>
      </div>
      {tab === "warga" ? <Citizens q={q} base={base} /> : <Organizers q={q} />}
    </>
  );
}

async function Citizens({ q, base }: { q: string; base: string }) {
  const users = await listAdminUsers({ q: q || undefined });
  return (
    <section className={`${cardClass} overflow-hidden`}>
      {users.length === 0 ? (
        <p className="p-5 text-[15px] text-fg-soft">Tidak ada warga yang cocok.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-[15px]">
            <thead>
              <tr className="text-left text-[12px] font-bold uppercase tracking-[0.06em] text-fg-soft">
                <th className="px-5 py-3 font-bold">Warga</th>
                <th className="px-3 py-3 font-bold">Kecamatan</th>
                <th className="px-3 py-3 font-bold">Jejak</th>
                <th className="px-3 py-3 font-bold">Check-in</th>
                <th className="px-3 py-3 font-bold">Flag</th>
                <th className="px-3 py-3 font-bold">Status</th>
                <th className="px-5 py-3 text-right font-bold">Tindakan</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id} className="border-t border-line align-middle">
                  <td className="px-5 py-3">
                    <div className="flex flex-col">
                      <b>{u.nickname}</b>
                      <span className="text-[13px] text-fg-soft">
                        {u.full_name ?? "—"} · daftar {formatDate(u.created_at)}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-3">{u.district_name ?? "Wilayah belum diisi"}</td>
                  <td className="px-3 py-3">{formatNumber(u.total_xp)}</td>
                  <td className="px-3 py-3">
                    {u.checkins}
                    {u.last_checkin_at && <span className="block text-[12px] text-fg-muted">terakhir {formatDateTime(u.last_checkin_at)}</span>}
                  </td>
                  <td className="px-3 py-3">{u.open_flags > 0 ? <span className={`${tagClass.base} ${tagClass.hot}`}>{u.open_flags} terbuka</span> : "—"}</td>
                  <td className="px-3 py-3">
                    {u.is_admin ? (
                      <span className={`${tagClass.base} ${tagClass.primary}`}>Admin</span>
                    ) : u.suspended_at ? (
                      <span className={`${tagClass.base} ${tagClass.hot}`}>Beku sejak {formatDate(u.suspended_at)}</span>
                    ) : u.onboarded_at ? (
                      <span className={`${tagClass.base} ${tagClass.success}`}>Aktif</span>
                    ) : (
                      <span className={`${tagClass.base} ${tagClass.neutral}`}>Belum onboarding</span>
                    )}
                  </td>
                  <td className="px-5 py-3">
                    {!u.is_admin && (
                      <form action={suspendUser} className="flex justify-end">
                        <input type="hidden" name="user_id" value={u.id} />
                        <input type="hidden" name="suspend" value={u.suspended_at ? "0" : "1"} />
                        <input type="hidden" name="kembali" value={base} />
                        <SubmitButton size="small" variant={u.suspended_at ? "outline" : "danger"} pendingText="…">
                          {u.suspended_at ? "Aktifkan" : "Bekukan"}
                        </SubmitButton>
                      </form>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

type OrgRow = { id: string; type: "merchant" | "community" | "platform"; name: string; logo_url: string | null; status: string; created_at: string; review_note: string | null };

async function Organizers({ q }: { q: string }) {
  const supabase = await createClient();
  let query = supabase.from("organizers").select("id, type, name, logo_url, status, created_at, review_note").neq("type", "platform").order("name").limit(100);
  if (q) query = query.ilike("name", `%${q}%`);
  const { data } = await query;
  const orgs = (data ?? []) as OrgRow[];
  return (
    <section className={`${cardClass} overflow-hidden`}>
      {orgs.length === 0 ? (
        <p className="p-5 text-[15px] text-fg-soft">Tidak ada penyelenggara yang cocok.</p>
      ) : (
        orgs.map((o) => {
          const st = ORG_STATUS[o.status] ?? ORG_STATUS.pending;
          return (
            <div key={o.id} className="flex flex-wrap items-center gap-3.5 border-b border-line px-5 py-3.5 last:border-b-0">
              <OrganizerAvatar name={o.name} type={o.type} logoUrl={o.logo_url} size={40} />
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-[15px] font-semibold">{o.name}</span>
                <span className="text-[13px] text-fg-soft">
                  {o.type === "merchant" ? "Merchant" : "Komunitas"} · daftar {formatDate(o.created_at)}
                  {o.status === "suspended" && o.review_note ? ` · ${o.review_note}` : ""}
                </span>
              </div>
              <span className={`${tagClass.base} ${st.tone}`}>{st.label}</span>
              {(o.status === "approved" || o.status === "suspended") && (
                <form action={suspendOrganizer} className="flex items-center gap-2">
                  <input type="hidden" name="organizer_id" value={o.id} />
                  <input type="hidden" name="suspend" value={o.status === "suspended" ? "0" : "1"} />
                  {o.status === "approved" && <input name="note" placeholder="Alasan" className={`${inputClass} h-10 w-[160px] text-[15px]`} />}
                  <SubmitButton size="small" variant={o.status === "suspended" ? "outline" : "danger"} pendingText="…">
                    {o.status === "suspended" ? "Aktifkan" : "Bekukan"}
                  </SubmitButton>
                </form>
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
