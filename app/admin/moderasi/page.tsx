import { Suspense } from "react";
import { chipClass, cardClass, inputClass, smallButton, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { approveCheckin, reverseCheckin, reviewFlag, suspendUser } from "@/lib/actions/moderation";
import { getAdminOverview, listModerationCheckins, listModerationFlags, type ModerationFlag } from "@/lib/data/dashboards";
import { formatDateTime, formatNumber } from "@/lib/format";

// Admin: antrean moderasi dan anti-curang, mengikuti artboard "Admin · Moderasi".
// Keputusan dieksekusi fungsi database (approve_checkin, reverse_checkin, review_fraud_flag).
export default function ModerasiPage({ searchParams }: PageProps<"/admin/moderasi">) {
  return (
    <>
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[30px] font-bold">Moderasi & anti-curang</h1>
        <Suspense fallback={<span className="text-[14px] text-fg-soft">Memuat…</span>}>
          <Summary />
        </Suspense>
      </div>
      <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
        <Board searchParams={searchParams} />
      </Suspense>
    </>
  );
}

async function Summary() {
  const o = await getAdminOverview();
  const total = (o?.flagged_checkins ?? 0) + (o?.open_pattern_flags ?? 0);
  return (
    <span className="text-[14px] text-fg-soft">
      {total} terbuka · {o?.flagged_checkins ?? 0} di luar radius · {o?.open_pattern_flags ?? 0} pola mencurigakan
    </span>
  );
}

const FLAG_LABELS: Record<ModerationFlag["kind"], { label: string; tone: string }> = {
  burst_accounts: { label: "Akun beruntun", tone: "bg-hot-tint text-hot border-hot/30" },
  impossible_travel: { label: "Perjalanan mustahil", tone: "bg-warn-tint text-warn border-warn/30" },
  shared_device: { label: "Perangkat sama", tone: "bg-info-tint text-info border-info/30" },
  manual: { label: "Laporan manual", tone: "bg-track text-fg-label border-line" },
};

function describeFlag(f: ModerationFlag) {
  const d = f.detail as Record<string, string | number | undefined>;
  if (f.kind === "burst_accounts") {
    return {
      title: `${d.accounts ?? "?"} akun baru check-in dari titik yang sama dalam ${d.window_minutes ?? 10} menit`,
      detail: [f.activity_title, f.partner_name && f.checkpoint_name ? `${f.partner_name} · ${f.checkpoint_name}` : f.checkpoint_name, "semua akun dibuat kurang dari 2 hari sebelumnya"].filter(Boolean).join(" · "),
    };
  }
  if (f.kind === "impossible_travel") {
    return {
      title: `Check-in ${d.distance_km ?? "?"} km dari titik sebelumnya dalam ${d.minutes ?? "?"} menit`,
      detail: [f.activity_title, f.checkpoint_name].filter(Boolean).join(" · "),
    };
  }
  return { title: typeof d.title === "string" ? d.title : "Pola mencurigakan", detail: [f.activity_title, f.checkpoint_name].filter(Boolean).join(" · ") };
}

async function Board({ searchParams }: Pick<PageProps<"/admin/moderasi">, "searchParams">) {
  const sp = await searchParams;
  const mode = sp.tab === "riwayat" ? "history" : "open";
  const hasil = typeof sp.hasil === "string" ? sp.hasil : undefined;
  const errorMsg = typeof sp.error === "string" ? sp.error : undefined;
  const [flags, checkins] = await Promise.all([listModerationFlags(mode), listModerationCheckins(mode)]);
  const notices: Record<string, string> = {
    sah: "Check-in dinyatakan sah. XP dan poin tetap.",
    balik: "Check-in ditolak. XP dan poin warga dibalik dan warga diberi tahu.",
    dismiss: "Laporan diabaikan.",
    warn: "Peringatan dikirim ke warga.",
    suspend: "Akun warga dibekukan.",
    beku: "Akun dibekukan.",
    aktif: "Akun diaktifkan kembali.",
  };

  return (
    <>
      {hasil && notices[hasil] && <p className="rounded-2xl bg-success-tint px-4 py-3 text-[13px] font-semibold text-success">{notices[hasil]}</p>}
      {errorMsg && <p className="rounded-2xl bg-danger-tint px-4 py-3 text-[13px] font-semibold text-danger">{errorMsg}</p>}
      <div className="flex gap-2">
        <a href="/admin/moderasi" className={`${chipClass.base} ${mode === "open" ? chipClass.selected : chipClass.idle}`}>
          Terbuka
        </a>
        <a href="/admin/moderasi?tab=riwayat" className={`${chipClass.base} ${mode === "history" ? chipClass.selected : chipClass.idle}`}>
          Riwayat
        </a>
      </div>

      {flags.length > 0 && (
        <div className="grid gap-4 lg:grid-cols-2">
          {flags.map((f) => {
            const meta = FLAG_LABELS[f.kind] ?? FLAG_LABELS.manual;
            const text = describeFlag(f);
            return (
              <section key={f.id} className={`flex flex-col gap-3 rounded-[20px] border p-5 ${meta.tone.includes("hot") ? "border-hot/30 bg-hot-tint/40" : meta.tone.includes("warn") ? "border-warn/30 bg-warn-tint/40" : "border-line bg-surface"}`}>
                <div className="flex items-center justify-between gap-3">
                  <span className={`${tagClass.base} ${meta.tone}`}>{meta.label}</span>
                  <span className="text-[12px] text-fg-soft">{formatDateTime(f.created_at)}</span>
                </div>
                <span className="text-[16px] font-semibold leading-[1.35]">{text.title}</span>
                <span className="text-[13px] leading-[1.5] text-fg-soft">
                  <b className="text-fg">@{f.nickname}</b> · {f.village_name ?? "Luar Cimahi"}
                  {text.detail ? ` · ${text.detail}` : ""}
                  {f.suspended_at ? " · akun sedang beku" : ""}
                </span>
                {mode === "open" ? (
                  <form action={reviewFlag} className="flex flex-wrap items-center gap-2">
                    <input type="hidden" name="flag_id" value={f.id} />
                    <input name="note" placeholder="Catatan (opsional)" className={`${inputClass} h-10 flex-[1_1_180px] text-[13px]`} />
                    <SubmitButton size="small" variant="outline" name="flag_action" value="dismiss" pendingText="…">
                      Abaikan
                    </SubmitButton>
                    <SubmitButton size="small" variant="outline" name="flag_action" value="warn" pendingText="…">
                      Beri peringatan
                    </SubmitButton>
                    {!f.suspended_at && (
                      <SubmitButton size="small" variant="danger" name="flag_action" value="suspend" pendingText="…">
                        Bekukan akun
                      </SubmitButton>
                    )}
                  </form>
                ) : (
                  <span className="text-[12px] font-semibold text-fg-label">
                    {f.status === "dismissed" ? "Diabaikan" : f.detail.admin_action === "suspend" ? "Akun dibekukan" : "Peringatan dikirim"}
                    {f.reviewed_at ? ` · ${formatDateTime(f.reviewed_at)}` : ""}
                  </span>
                )}
              </section>
            );
          })}
        </div>
      )}

      <section className={`${cardClass} overflow-hidden`}>
        <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-line px-5 py-4">
          <h2 className="font-display text-[18px] font-semibold">Check-in dan misi QR ditandai</h2>
          <span className="text-[12px] text-fg-soft">XP sudah diberikan · tolak = XP dan poin dibalik</span>
        </div>
        {checkins.length === 0 ? (
          <p className="p-5 text-[13px] text-fg-soft">{mode === "open" ? "Tidak ada check-in yang menunggu keputusan." : "Belum ada riwayat keputusan."}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead>
                <tr className="text-left text-[11px] font-bold uppercase tracking-[0.06em] text-fg-soft">
                  <th className="px-5 py-3 font-bold">Warga</th>
                  <th className="px-3 py-3 font-bold">Aktivitas · checkpoint</th>
                  <th className="px-3 py-3 font-bold">Jarak</th>
                  <th className="px-3 py-3 font-bold">Waktu</th>
                  <th className="px-3 py-3 font-bold">XP</th>
                  <th className="px-5 py-3 text-right font-bold">Keputusan</th>
                </tr>
              </thead>
              <tbody>
                {checkins.map((c) => (
                  <tr key={c.id} className="border-t border-line align-top">
                    <td className="px-5 py-3">
                      <div className="flex flex-col">
                        <b>{c.nickname}</b>
                        <span className="text-[12px] text-fg-soft">{c.village_name ?? "Luar Cimahi"}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex flex-col">
                        <span className="font-semibold">{c.activity_title}</span>
                        <span className="text-[12px] text-fg-soft">
                          {c.partner_name} · {c.checkpoint_name}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      {c.distance_m === null ? <span className="text-fg-soft">tanpa lokasi</span> : c.distance_m >= 1000 ? `${(c.distance_m / 1000).toLocaleString("id-ID", { maximumFractionDigits: 1 })} km` : `${c.distance_m} m`}
                      <span className="block text-[11px] text-fg-muted">radius {c.radius_m} m</span>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatDateTime(c.checked_in_at)}</td>
                    <td className="px-3 py-3 whitespace-nowrap">{formatNumber(c.xp_awarded)}</td>
                    <td className="px-5 py-3">
                      {c.review_status === "flagged" ? (
                        <div className="flex justify-end gap-2">
                          <form action={approveCheckin}>
                            <input type="hidden" name="checkin_id" value={c.id} />
                            <SubmitButton size="small" variant="outline" pendingText="…">
                              Sah
                            </SubmitButton>
                          </form>
                          <form action={reverseCheckin}>
                            <input type="hidden" name="checkin_id" value={c.id} />
                            <input type="hidden" name="note" value="Di luar radius checkpoint" />
                            <SubmitButton size="small" variant="danger" pendingText="…">
                              Tolak & balikkan
                            </SubmitButton>
                          </form>
                        </div>
                      ) : (
                        <div className="flex flex-col items-end gap-1">
                          <span className={`${tagClass.base} ${c.review_status === "approved" ? tagClass.success : tagClass.hot}`}>
                            {c.review_status === "approved" ? "Sah" : "Ditolak"}
                          </span>
                          {c.review_status === "rejected" && (
                            <form action={suspendUser}>
                              <input type="hidden" name="user_id" value={c.user_id} />
                              <input type="hidden" name="suspend" value="1" />
                              <input type="hidden" name="kembali" value="/admin/moderasi?tab=riwayat" />
                              <button type="submit" className={`${smallButton.outline} h-8 px-3 text-[12px]`}>
                                Bekukan akun
                              </button>
                            </form>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
