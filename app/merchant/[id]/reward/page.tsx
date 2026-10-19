import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RewardForm } from "./reward-form";
import { Icon } from "@/components/icons";
import { OrganizerShell } from "@/components/organizer/shell";
import { cardClass, smallButton, tagClass } from "@/components/styles";
import { SubmitButton } from "@/components/ui";
import { refundRedemption, setRewardStatus } from "@/lib/actions/rewards";
import { getMerchantPointsSummary, listMerchantRedemptions, listMerchantRewards } from "@/lib/data/rewards";
import { formatDate, formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Reward & budget poin merchant: daftar voucher, tambah/ubah, voucher yang ditukar.
export default function Page({ params, searchParams }: PageProps<"/merchant/[id]/reward">) {
  return (
    <Suspense fallback={<p className="px-5 pt-6 text-[13px] text-fg-muted">Memuat…</p>}>
      <Loader params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function Loader({ params, searchParams }: PageProps<"/merchant/[id]/reward">) {
  const [{ id }, sp] = await Promise.all([params, searchParams]);
  const edit = typeof sp.ubah === "string" ? sp.ubah : undefined;
  return (
    <OrganizerShell organizerId={id} type="merchant" active="Lainnya" title="Reward & budget poin">
      {({ org }) => <Body id={id} edit={edit} approved={org.status === "approved"} isLeader={org.role === "owner"} />}
    </OrganizerShell>
  );
}

async function Body({ id, edit, approved, isLeader }: { id: string; edit?: string; approved: boolean; isLeader: boolean }) {
  // Reward & budget poin hanya untuk pemilik (ALUR-SISTEM bagian 2).
  if (!isLeader) redirect(`/merchant/${id}/lainnya?akses=peran`);
  const supabase = await createClient();
  const [rewards, summary, redemptions, { data: outletRows }] = await Promise.all([
    listMerchantRewards(id),
    getMerchantPointsSummary(id),
    listMerchantRedemptions(id),
    supabase.from("merchant_outlets").select("id, name, is_active").eq("organizer_id", id).order("name"),
  ]);
  const editing = rewards.find((r) => r.id === edit);
  // Refund oleh pemilik hanya untuk reward yang sudah nonaktif (fungsi refund_redemption menolak selain itu).
  const inactiveRewards = new Set(rewards.filter((r) => r.status === "inactive").map((r) => r.id));
  // Outlet aktif, ditambah outlet nonaktif yang masih tercatat di reward yang sedang diubah.
  const outlets = (outletRows ?? [])
    .filter((o) => o.is_active || editing?.valid_outlet_ids?.includes(o.id))
    .map((o) => ({ id: o.id, name: o.is_active ? o.name : `${o.name} (nonaktif)` }));
  const base = `/merchant/${id}`;

  return (
    <>
      <Link href={`${base}/lainnya`} className="flex items-center gap-1.5 text-[13px] font-semibold text-link">
        <Icon name="back" size={16} stroke={2} />
        Lainnya
      </Link>

      <div className="grid grid-cols-3 gap-2.5">
        {[
          [summary.remaining.toLocaleString("id-ID"), "sisa budget poin"],
          [summary.used.toLocaleString("id-ID"), "poin diberikan"],
          [`${summary.vouchersUsed}/${summary.redeemed}`, "voucher dipakai/ditukar"],
        ].map(([v, k]) => (
          <div key={k} className={`${cardClass} flex flex-col gap-1 p-3`}>
            <span className="font-display text-[20px] font-semibold">{v}</span>
            <span className="text-[11px] text-fg-soft">{k}</span>
          </div>
        ))}
      </div>
      <p className="text-[12px] leading-[1.5] text-fg-soft">Budget poin diisi per aktivitas di halaman kelola aktivitas. Poin hanya diberikan ke warga selama budget masih cukup.</p>

      {!approved ? (
        <p className="rounded-2xl bg-warn-tint px-4 py-3 text-[13px] text-warn">Reward bisa dibuat setelah merchant terverifikasi.</p>
      ) : !isLeader ? (
        <p className="rounded-2xl bg-info-tint px-4 py-3 text-[13px] text-info">Hanya pemilik yang bisa mengatur reward dan budget poin.</p>
      ) : (
        <RewardForm
          key={editing?.id ?? "baru"}
          organizerId={id}
          outlets={outlets}
          initial={editing ? { id: editing.id, title: editing.title, description: editing.description ?? "", price_points: editing.price_points, stock: editing.stock, valid_days: editing.valid_days, available_until: editing.available_until, valid_outlet_ids: editing.valid_outlet_ids } : undefined}
        />
      )}

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-[18px] font-semibold">Reward</h2>
        {rewards.length === 0 && <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada reward. Tambahkan voucher pertama, misalnya gratis satu menu.</p>}
        {rewards.map((r) => (
          <div key={r.id} className={`${cardClass} flex flex-col gap-2 p-4 ${r.status === "inactive" ? "opacity-70" : ""}`}>
            <div className="flex items-start justify-between gap-2">
              <span className="flex flex-col">
                <span className="text-[15px] font-semibold">{r.title}</span>
                <span className="text-[12px] text-fg-soft">
                  {r.price_points} poin · stok {r.stock} · berlaku {r.valid_days} hari
                  {r.available_until ? ` · s.d. ${formatDate(r.available_until)}` : ""}
                </span>
                <span className="text-[12px] text-fg-soft">{!r.outlet_names ? "Berlaku di semua outlet" : `Berlaku di: ${r.outlet_names.join(", ") || "outlet nonaktif"}`}</span>
              </span>
              <span className={`${tagClass.base} ${r.status === "active" ? tagClass.success : tagClass.neutral}`}>{r.status === "active" ? "Aktif" : "Nonaktif"}</span>
            </div>
            {isLeader && (
              <div className="flex gap-2">
                <Link href={`${base}/reward?ubah=${r.id}`} className={smallButton.outline}>
                  Ubah
                </Link>
                <form action={setRewardStatus}>
                  <input type="hidden" name="organizer_id" value={id} />
                  <input type="hidden" name="reward_id" value={r.id} />
                  <input type="hidden" name="status" value={r.status === "active" ? "inactive" : "active"} />
                  <SubmitButton size="small" variant="outline" pendingText="…">
                    {r.status === "active" ? "Nonaktifkan" : "Aktifkan"}
                  </SubmitButton>
                </form>
              </div>
            )}
          </div>
        ))}
      </section>

      <section className="flex flex-col gap-2.5">
        <h2 className="font-display text-[18px] font-semibold">Voucher ditukar</h2>
        {isLeader && redemptions.some((rd) => rd.status === "active") && (
          <p className="text-[12px] text-fg-soft">Refund hanya untuk reward yang sudah dinonaktifkan, misalnya karena stok habis.</p>
        )}
        {redemptions.length === 0 && <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada warga yang menukar poin.</p>}
        {redemptions.length > 0 && (
          <div className={`${cardClass} overflow-hidden`}>
            {redemptions.slice(0, 30).map((rd) => (
              <div key={rd.id} className="flex items-center gap-3 border-b border-line px-4 py-3 last:border-b-0">
                <span className="flex flex-1 flex-col">
                  <span className="text-[14px] font-semibold">
                    {rd.nickname} · {rd.title}
                  </span>
                  <span className="text-[12px] text-fg-soft">
                    {rd.code ? `${rd.code} · ` : ""}{rd.status === "used" && rd.used_at ? `dipakai ${formatDateTime(rd.used_at)}${rd.outlet_name ? ` di ${rd.outlet_name}` : ""}` : rd.status === "active" ? `berlaku s.d. ${formatDate(rd.expires_at)}` : rd.status}
                  </span>
                </span>
                {rd.status === "active" && isLeader && inactiveRewards.has(rd.reward_id) && (
                  <form action={refundRedemption}>
                    <input type="hidden" name="organizer_id" value={id} />
                    <input type="hidden" name="redemption_id" value={rd.id} />
                    <button type="submit" className="text-[12px] font-semibold text-danger">Refund</button>
                  </form>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
