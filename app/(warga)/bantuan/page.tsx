import { Suspense } from "react";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, backLinkClass } from "@/components/styles";
import { whatsappUrl } from "@/lib/format";
import { createClient } from "@/lib/supabase/server";

// Bantuan: pertanyaan umum dan kontak tim Gasyu. Angka aturan dan kontak
// dibaca dari app_settings supaya selalu sama dengan aturan yang berlaku.
export default function BantuanPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil" className={backLinkClass}>
            <Icon name="back" stroke={2} />
            Kembali
          </a>
          <h1 className="font-display text-[26px] font-bold">Bantuan</h1>
        </div>
        <Suspense fallback={<p className="text-[15px] text-fg-muted">Memuat…</p>}>
          <Content />
        </Suspense>
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}

async function Content() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("app_settings")
    .select("key, value")
    .in("key", ["support.whatsapp", "support.email", "checkin.radius_m_default", "xp.daily_cap", "points.expiry_months", "profile.district_change_days"]);
  const s = Object.fromEntries((data ?? []).map((r) => [r.key as string, r.value as unknown]));
  const text = (k: string) => (typeof s[k] === "string" ? (s[k] as string).trim() : "");
  const num = (k: string, fallback: number) => Number(s[k] ?? fallback);
  const wa = whatsappUrl(text("support.whatsapp"));
  const email = text("support.email");

  const faqs: [string, string][] = [
    ["Bagaimana cara dapat Jejak?", "Ikut event atau challenge, lalu scan QR check-in di lokasi. Kerjakan misinya untuk Jejak tambahan. Ada juga bonus kunjungan pertama, bonus grup, bonus kolaborasi, dan bonus streak mingguan."],
    ["Apa bedanya Jejak dan poin?", `Jejak adalah status: menentukan level dan peringkat, dan tidak bisa ditukar. Poin bisa ditukar dengan voucher merchant di Dompet dan berlaku ${num("points.expiry_months", 6)} bulan. Poin hanya ada jika merchant menyediakan budget poin.`],
    ["Kenapa Jejak saya tidak bertambah?", `Satu aktivitas hanya bisa check-in sekali per hari, dan Jejak harian dibatasi ${num("xp.daily_cap", 1000).toLocaleString("id-ID")} Jejak per orang. Lihat rinciannya di Profil, Riwayat Jejak & poin.`],
    ["Check-in saya ditandai atau ditinjau, kenapa?", `Jika lokasimu lebih dari ${num("checkin.radius_m_default", 150)} m dari checkpoint atau tidak terbaca, check-in tetap dicatat tetapi ditinjau tim Gasyu. Nyalakan lokasi di HP saat scan.`],
    ["Bagaimana cara bayar aktivitas berbayar?", "Pembayaran langsung ke penyelenggara sesuai instruksi di halaman aktivitas, lalu unggah foto bukti bayar. Penyelenggara yang menandai lunas. Gasyu tidak memegang uang."],
    ["Bagaimana kalau aktivitas berbayar dibatalkan?", "Pengembalian dana diurus penyelenggara. Kamu mendapat notifikasi saat refund ditandai selesai. Jika lama tidak ada kabar, hubungi tim Gasyu lewat kontak di bawah."],
    ["Bisakah saya ganti kota atau kecamatan?", `Bisa, di Profil, Ubah profil. Kota dan kecamatan hanya bisa diganti sekali setiap ${num("profile.district_change_days", 90)} hari supaya peringkat tetap adil.`],
    ["Kotaku belum ada peringkatnya, kenapa?", "Gasyu membuka kota satu per satu. Kamu tetap bisa ikut aktivitas dan mengumpulkan Jejak; peringkat kota dan kecamatanmu tampil begitu kotamu dibuka."],
    ["Lupa kata sandi, bagaimana?", "Di halaman masuk, pilih Lupa kata sandi. Kami kirim kode 6 angka ke email, lalu kamu bisa membuat kata sandi baru. Kata sandi juga bisa diganti kapan saja di Profil, Kata sandi."],
    ["Bagaimana mendaftarkan usaha atau komunitas?", "Buka Profil, lalu Daftarkan merchant atau komunitas. Tim Gasyu memverifikasi data, biasanya 1–2 hari kerja."],
    ["Akun saya dibekukan, apa yang harus dilakukan?", "Hubungi tim Gasyu lewat kontak di bawah dan sebutkan nama panggilanmu. Kami akan meninjau ulang."],
  ];

  return (
    <>
      <section className="flex flex-col gap-2">
        <h2 className="font-display text-[22px] font-semibold">Pertanyaan umum</h2>
        <div className={`${cardClass} flex flex-col overflow-hidden`}>
          {faqs.map(([q, a], i) => (
            <details key={q} className={`group px-4 py-3 ${i > 0 ? "border-t border-line" : ""}`}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-[15px] font-semibold">
                {q}
                <Icon name="chevronDown" size={16} stroke={2} className="shrink-0 text-fg-muted group-open:hidden" />
              </summary>
              <p className="pt-2 text-[15px] leading-[1.55] text-fg-soft">{a}</p>
            </details>
          ))}
        </div>
      </section>

      <section className={`${cardClass} flex flex-col gap-3 p-4`}>
        <span className="text-[16px] font-semibold">Hubungi tim Gasyu</span>
        {wa || email ? (
          <div className="flex flex-col gap-2">
            {wa && (
              <a href={wa} target="_blank" rel="noreferrer" className="flex h-12 items-center justify-center rounded-[14px] bg-success text-[15px] font-bold text-bg">
                Chat WhatsApp
              </a>
            )}
            {email && (
              <a href={`mailto:${email}`} className="flex h-12 items-center justify-center rounded-[14px] border border-line-strong text-[15px] font-semibold text-fg">
                Kirim email ke {email}
              </a>
            )}
          </div>
        ) : (
          <span className="text-[15px] leading-[1.5] text-fg-soft">Kontak tim Gasyu belum tersedia. Sementara, sampaikan kendalamu lewat penyelenggara aktivitas.</span>
        )}
      </section>
    </>
  );
}
