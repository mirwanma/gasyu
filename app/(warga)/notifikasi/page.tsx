import Link from "next/link";
import { Suspense } from "react";
import { markNotificationsRead } from "../actions";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/data/user";
import { timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Notification = { id: string; kind: string; payload: Record<string, unknown>; read_at: string | null; created_at: string };

// Teks notifikasi per jenis. Jenis lain menyusul di irisan berikutnya.
function describe(n: Notification): { title: string; body?: string; href?: string } {
  const p = n.payload;
  const community = typeof p.community_name === "string" ? p.community_name : "komunitas";
  switch (n.kind) {
    case "organizer_verified":
      return p.approved
        ? { title: `${p.organizer_name} sudah terverifikasi`, body: "Sekarang kamu bisa mengajukan aktivitas dan mengundang tim." }
        : { title: `${p.organizer_name} perlu perbaikan`, body: typeof p.note === "string" ? p.note : undefined };
    case "membership_requested":
      return { title: "Ada permintaan bergabung baru", body: "Buka halaman Member untuk meninjau." };
    case "membership_approved":
      return { title: `Selamat bergabung di ${community}`, body: "Kamu bisa ikut aktivitas khusus member." };
    case "membership_rejected":
      return { title: `Permintaan ke ${community} belum diterima`, body: p.auto ? "Tidak dijawab dalam 30 hari." : undefined };
    case "membership_removed":
      return { title: `Kamu dikeluarkan dari ${community}`, body: typeof p.reason === "string" ? p.reason : undefined };
    case "activity_approved":
      return { title: `"${p.title}" disetujui dan sudah terbit`, body: "Warga sudah bisa melihat dan mendaftar.", href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "activity_rejected":
      return { title: `"${p.title}" perlu perbaikan`, body: typeof p.note === "string" ? p.note : undefined };
    case "activity_cancelled":
      return { title: `"${p.title}" dibatalkan penyelenggara`, body: typeof p.reason === "string" ? p.reason : undefined };
    case "community_new_activity":
      return { title: `Aktivitas baru dari ${community}: ${p.title}`, body: "Lihat detail dan daftar sebelum kuota penuh.", href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "group_registration":
      return { title: `${p.leader_nickname} mendaftarkan ${p.group_name} ke ${p.title}`, body: "Jawab undangan di halaman Grup sebelum aktivitas mulai.", href: "/grup" };
    case "payment_refund_due":
      return { title: `Ada peserta "${p.title}" yang perlu refund`, body: "Peserta sudah bayar lalu aktivitas dibatalkan atau ia membatalkan." };
    default:
      return { title: n.kind };
  }
}

export default function NotifikasiPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <Link href="/" aria-label="Kembali" className="flex size-11 items-center justify-center rounded-full border border-line bg-surface text-fg">
            <Icon name="back" stroke={2} />
          </Link>
          <h1 className="font-display text-[22px] font-bold">Notifikasi</h1>
        </div>
        <Suspense fallback={<p className="text-[13px] text-fg-muted">Memuat…</p>}>
          <NotificationList />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="" />
    </>
  );
}

async function NotificationList() {
  const user = await getCurrentUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, payload, read_at, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50);
  const items = (data ?? []) as Notification[];
  const unread = items.filter((n) => !n.read_at).length;

  if (items.length === 0) {
    return <p className={`${cardClass} p-4 text-[13px] text-fg-soft`}>Belum ada notifikasi.</p>;
  }

  return (
    <>
      {unread > 0 && (
        <form action={markNotificationsRead} className="flex justify-end">
          <button type="submit" className="min-h-11 text-[13px] font-semibold text-link">
            Tandai semua dibaca
          </button>
        </form>
      )}
      <ul className="flex flex-col gap-2.5">
        {items.map((n) => {
          const { title, body, href } = describe(n);
          return (
            <li key={n.id} className={`${cardClass} flex gap-3 p-4 ${n.read_at ? "opacity-70" : ""}`}>
              <span className={`mt-1.5 size-2 shrink-0 rounded-full ${n.read_at ? "bg-transparent" : "bg-hot"}`} />
              <div className="flex flex-1 flex-col gap-1">
                <span className="text-[14px] font-semibold">{href ? <a href={href} className="text-fg">{title}</a> : title}</span>
                {body && <span className="text-[13px] leading-[1.5] text-fg-soft">{body}</span>}
                <span className="text-[11px] text-fg-muted">{timeAgo(n.created_at)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
