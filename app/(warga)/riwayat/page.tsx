import { Suspense } from "react";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, chipClass, backLinkClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/data/user";
import { formatDateTime } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Riwayat XP dan poin warga, dibaca langsung dari ledger (RLS: hanya miliknya).
const XP_LABELS: Record<string, string> = {
  profile_complete: "Profil lengkap",
  event_checkin: "Check-in event",
  challenge_complete: "Challenge selesai",
  mission_complete: "Misi selesai",
  first_visit_bonus: "Bonus kunjungan pertama",
  collab_bonus: "Bonus kolaborasi",
  group_bonus: "Bonus grup",
  streak: "Bonus streak mingguan",
  reversal: "Dibatalkan",
  adjustment: "Penyesuaian",
};
const POINT_LABELS: Record<string, string> = {
  activity_reward: "Hadiah aktivitas",
  redemption: "Tukar voucher",
  refund: "Voucher dikembalikan",
  expiry: "Kedaluwarsa",
  reversal: "Dibatalkan",
  adjustment: "Penyesuaian",
};

type Row = { id: string; amount: number; reason: string; note: string | null; created_at: string; activity: { title: string } | { title: string }[] | null };

export default function RiwayatPage({ searchParams }: PageProps<"/riwayat">) {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" className={backLinkClass}>
            <Icon name="back" stroke={2} />
            Kembali
          </a>
          <h1 className="font-display text-[28px] font-bold">Riwayat</h1>
        </div>
        <Suspense fallback={<p className="text-[16px] text-fg-muted">Memuat…</p>}>
          <Content searchParams={searchParams} />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}

async function Content({ searchParams }: Pick<PageProps<"/riwayat">, "searchParams">) {
  const { tab: rawTab } = await searchParams;
  const tab = rawTab === "poin" ? "poin" : "xp";
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from(tab === "xp" ? "xp_ledger" : "point_ledger")
    .select("id, amount, reason, note, created_at, activity:activities(title)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(200);
  const rows = (data ?? []) as unknown as Row[];
  const labels = tab === "xp" ? XP_LABELS : POINT_LABELS;
  const unit = tab === "xp" ? "XP" : "poin";

  return (
    <>
      <nav aria-label="Jenis riwayat" className="flex gap-2">
        <a href="/riwayat?tab=xp" className={`${chipClass.base} ${tab === "xp" ? chipClass.selected : chipClass.idle}`}>
          XP
        </a>
        <a href="/riwayat?tab=poin" className={`${chipClass.base} ${tab === "poin" ? chipClass.selected : chipClass.idle}`}>
          Poin
        </a>
      </nav>
      <p className="text-[16px] leading-[1.5] text-fg-soft">
        {tab === "xp" ? "XP menentukan level dan peringkat. XP tidak bisa ditukar." : "Poin bisa ditukar dengan voucher merchant di Dompet. Poin punya masa berlaku."}
      </p>
      {rows.length === 0 ? (
        <p className={`${cardClass} p-4 text-[16px] text-fg-soft`}>Belum ada riwayat {unit}.</p>
      ) : (
        <ul className={`${cardClass} flex flex-col overflow-hidden`}>
          {rows.map((r, i) => {
            const activity = Array.isArray(r.activity) ? r.activity[0] : r.activity;
            return (
              <li key={r.id} className={`flex items-center gap-3 px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="text-[17px] font-semibold">{labels[r.reason] ?? r.reason}</span>
                  <span className="text-[14px] text-fg-soft">
                    {activity?.title ?? r.note ?? ""}
                    {(activity?.title ?? r.note) ? " · " : ""}
                    {formatDateTime(r.created_at)}
                  </span>
                </span>
                <span className={`font-display text-[18px] font-semibold tabular-nums ${r.amount < 0 ? "text-danger" : tab === "xp" ? "text-xp" : "text-points"}`}>
                  {r.amount > 0 ? "+" : ""}
                  {r.amount.toLocaleString("id-ID")}
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
