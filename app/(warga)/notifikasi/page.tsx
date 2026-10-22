import Link from "next/link";
import { Suspense } from "react";
import { markNotificationsRead } from "../actions";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, backLinkClass } from "@/components/styles";
import { getCurrentUser } from "@/lib/data/user";
import { formatDate, timeAgo } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

type Notification = { id: string; kind: string; payload: Record<string, unknown>; read_at: string | null; created_at: string };

// Teks notifikasi per jenis (kind). Jenis yang tidak dikenal tampil apa adanya.
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
    case "partner_invite":
      return { title: `${p.host_name} mengundang kamu ke "${p.title}"`, body: `Sebagai ${p.role}. Jawab di menu Kolaborasi.` };
    case "partner_accepted":
      return { title: `${p.partner_name} menerima undangan "${p.title}"`, body: `Bergabung sebagai ${p.role}.` };
    case "partner_declined":
      return { title: `${p.partner_name} menolak undangan "${p.title}"` };
    case "partner_added_by_admin":
      return { title: `Kamu ditambahkan ke event Gasyu "${p.title}"`, body: `Sebagai ${p.role}. Lihat di menu Kolaborasi; kamu boleh keluar sebelum event berjalan.` };
    case "partner_left":
      return { title: `${p.partner_name} keluar dari "${p.title}"`, body: "Checkpoint miliknya dinonaktifkan." };
    case "application_received":
      return { title: `${p.applicant_name} mengajukan diri ke open call "${p.post_title}"`, body: `Sebagai ${p.role}. Tinjau di menu Kolaborasi.` };
    case "application_accepted":
      return { title: `Pengajuanmu ke "${p.post_title}" diterima`, body: `${p.host_name} menjadikanmu partner.` };
    case "application_rejected":
      return { title: `Pengajuanmu ke "${p.post_title}" belum diterima` };
    case "voucher_refunded":
      return { title: `Voucher "${p.title}" di-refund`, body: `${p.points} poin kembali ke dompetmu.`, href: "/dompet" };
    case "mission_proof_submitted":
      return { title: `Bukti foto baru: ${p.mission_title}`, body: `Dari aktivitas "${p.title}". Tinjau di halaman Misi.` };
    case "mission_approved":
      // Event Global memberi skor event, bukan XP.
      if (Number(p.score) > 0) return { title: `Misi "${p.mission_title}" disetujui · +${Number(p.score).toLocaleString("id-ID")} skor`, body: `Event Global "${p.title}".`, href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
      return { title: `Misi "${p.mission_title}" disetujui · +${p.xp ?? 0} XP`, body: p.completed ? `Aktivitas "${p.title}" selesai!` : `Aktivitas "${p.title}".`, href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "mission_rejected":
      return { title: `Bukti misi "${p.mission_title}" ditolak`, body: typeof p.note === "string" && p.note ? `${p.note} · unggah ulang selama aktivitas berjalan.` : "Unggah ulang selama aktivitas berjalan.", href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "mission_reversed":
      return {
        title: `Misi "${p.mission_title}" dibatalkan tim Gasyu`,
        body: `${Number(p.score) > 0 ? `${Number(p.score).toLocaleString("id-ID")} skor event` : `${p.xp ?? 0} XP`} ditarik kembali.${typeof p.note === "string" && p.note ? ` Catatan: ${p.note}` : ""}`,
        href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined,
      };
    case "mission_revealed":
      return { title: `Misi baru terbuka: ${p.mission_title}`, body: Number(p.score) > 0 ? `+${Number(p.score).toLocaleString("id-ID")} skor di "${p.title}".` : `+${p.xp ?? 0} XP di "${p.title}".`, href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "badge_awarded":
      return { title: `Badge baru: ${p.badge_name}`, body: "Lihat koleksi badge kamu di Profil.", href: "/profil" };
    case "checkin_rejected":
      return {
        title: `Check-in di "${p.activity_title}" ditolak tim Gasyu`,
        body: `${Number(p.score) > 0 ? `${Number(p.score).toLocaleString("id-ID")} skor event` : `${p.xp ?? 0} XP${Number(p.points) > 0 ? ` dan ${p.points} poin` : ""}`} ditarik kembali.${typeof p.note === "string" && p.note ? ` Catatan: ${p.note}` : ""}`,
      };
    // Event Global: hadiah per peringkat (ALUR bagian 22d)
    case "prize_won":
      return {
        title: `Selamat! Kamu peringkat ${p.rank} di "${p.activity_title}"`,
        body: `Hadiah: ${p.prize_title}.${p.kind === "badge" ? " Badge sudah masuk ke profilmu." : ` Klaim sebelum ${typeof p.claim_deadline === "string" ? formatDate(p.claim_deadline) : "batas waktu"}.`}`,
        href: "/hadiah",
      };
    case "prize_claim_reminder":
      return { title: `Hadiah "${p.prize_title}" belum diklaim`, body: `Batas klaim ${typeof p.claim_deadline === "string" ? formatDate(p.claim_deadline) : "sebentar lagi"}. Lewat dari itu hadiah hangus.`, href: "/hadiah" };
    case "prize_delivered":
      return { title: `Hadiah "${p.prize_title}" sudah dikirim`, body: typeof p.note === "string" && p.note ? p.note : "Panitia Gasyu menandai hadiahmu sudah diserahkan.", href: "/hadiah" };
    case "prize_forfeited":
      return { title: `Hadiah "${p.prize_title}" hangus`, body: typeof p.reason === "string" ? p.reason : undefined, href: "/hadiah" };
    case "prize_claimed":
      return { title: `Hadiah "${p.prize_title}" diklaim pemenang peringkat ${p.rank}`, body: "Cek flag kecurangan lalu kirim dari dashboard admin (Peringkat & pemenang)." };
    case "fraud_warning":
      return {
        title: "Peringatan dari tim Gasyu",
        body: typeof p.note === "string" && p.note
          ? p.note
          : p.kind === "reviewer_burst"
            ? "Kamu menyetujui banyak bukti foto misi dalam waktu sangat singkat. Periksa setiap bukti sebelum menyetujui, atau akun bisa dibekukan."
            : p.kind === "code_bruteforce"
              ? "Kami menemukan banyak tebakan kode misi yang salah. Kode misi didapat di lokasi, bukan ditebak. Ulangi dan akun bisa dibekukan."
              : "Kami menemukan pola check-in yang tidak wajar di akunmu. Ulangi dan akun bisa dibekukan.",
      };
    case "account_suspended":
      return { title: "Akunmu dibekukan", body: typeof p.note === "string" && p.note ? p.note : "Hubungi tim Gasyu lewat halaman Bantuan untuk peninjauan." };
    case "account_restored":
      return { title: "Akunmu aktif kembali", body: "Kamu bisa check-in dan menukar poin lagi." };
    case "organizer_suspended":
      return { title: `${p.organizer_name} dibekukan tim Gasyu`, body: typeof p.note === "string" && p.note ? p.note : "Aktivitas yang berjalan dibatalkan. Hubungi tim Gasyu untuk peninjauan." };
    case "organizer_restored":
      return { title: `${p.organizer_name} aktif kembali`, body: "Kamu bisa mengajukan aktivitas lagi." };
    case "payment_refund_due":
      return typeof p.count === "number"
        ? { title: `${p.count} peserta "${p.title}" perlu refund`, body: "Aktivitas dibatalkan. Kembalikan dana di luar aplikasi, lalu tandai refund di halaman Peserta." }
        : { title: `Ada peserta "${p.title}" yang perlu refund`, body: "Peserta sudah bayar lalu membatalkan. Kembalikan dana di luar aplikasi, lalu tandai refund di halaman Peserta." };
    case "payment_proof_submitted":
      return { title: `Bukti bayar masuk untuk "${p.title}"`, body: "Cek bukti dan tandai lunas di halaman Peserta." };
    case "payment_confirmed":
      return { title: `Pembayaran "${p.title}" lunas`, body: "Kamu sudah bisa check-in dan mengerjakan misi.", href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "payment_rejected":
      return { title: `Bukti bayar "${p.title}" ditolak`, body: typeof p.note === "string" ? p.note : "Cek catatan panitia lalu kirim bukti lagi.", href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "payment_expired":
      return { title: `Pendaftaran "${p.title}" dibatalkan`, body: "Lewat batas waktu bayar. Kamu bisa mendaftar lagi selama kuota masih ada.", href: typeof p.activity_id === "string" ? `/aktivitas/${p.activity_id}` : undefined };
    case "payment_refunded":
      return { title: `Dana "${p.title}" dikembalikan`, body: typeof p.note === "string" && p.note ? p.note : "Penyelenggara menandai pengembalian dana selesai." };
    case "team_role_changed":
      return {
        title: `Peranmu di ${p.organizer_name} sekarang ${({ owner: "pemilik", staff: "staf", chair: "ketua", officer: "pengurus" } as Record<string, string>)[String(p.role)] ?? p.role}`,
        href: typeof p.organizer_id === "string" ? `/${p.organizer_type === "community" ? "komunitas" : "merchant"}/${p.organizer_id}` : undefined,
      };
    case "voucher_expiring":
      return {
        title: `Voucher "${p.reward_title}" dari ${p.merchant_name} kedaluwarsa ${typeof p.expires_at === "string" ? formatDate(p.expires_at) : "sebentar lagi"}`,
        body: "Pakai sebelum hangus: tunjukkan kode voucher di kasir.",
        href: "/dompet",
      };
    case "points_expiring":
      return {
        title: `${Number(p.points ?? 0).toLocaleString("id-ID")} poin akan kedaluwarsa ${typeof p.expires_at === "string" ? formatDate(p.expires_at) : "sebentar lagi"}`,
        body: "Tukar dengan voucher di Dompet sebelum hangus.",
        href: "/dompet",
      };
    case "suggestion_received":
      return {
        title: `Saran baru untuk ${p.organizer_name ?? "penyelenggaramu"}`,
        body: "Baca dan balas saran dari warga.",
        href: typeof p.organizer_id === "string" ? `/${p.organizer_type === "community" ? "komunitas" : "merchant"}/${p.organizer_id}/saran` : undefined,
      };
    case "suggestion_answered":
      return {
        title: p.has_reply ? `${p.organizer_name} membalas saranmu` : `Saranmu ${p.status === "done" ? "sudah diwujudkan" : "sedang ditindaklanjuti"} ${p.organizer_name}`,
        body: p.status === "done" ? "Terima kasih sudah ikut memberi ide." : undefined,
        href: "/saran",
      };
    default:
      return { title: n.kind };
  }
}

export default function NotifikasiPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <Link href="/" className={backLinkClass}>
            <Icon name="back" stroke={2} />
            Kembali
          </Link>
          <h1 className="font-display text-[24px] font-bold">Notifikasi</h1>
        </div>
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
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
    return <p className={`${cardClass} p-4 text-[15px] text-fg-soft`}>Belum ada notifikasi.</p>;
  }

  return (
    <>
      {unread > 0 && (
        <form action={markNotificationsRead} className="flex justify-end">
          <button type="submit" className="min-h-11 text-[15px] font-semibold text-link">
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
                <span className="text-[15px] font-semibold">{href ? <a href={href} className="text-fg">{title}</a> : title}</span>
                {body && <span className="text-[15px] leading-[1.5] text-fg-soft">{body}</span>}
                <span className="text-[12px] text-fg-muted">{timeAgo(n.created_at)}</span>
              </div>
            </li>
          );
        })}
      </ul>
    </>
  );
}
