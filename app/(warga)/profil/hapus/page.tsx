import { DeleteForm } from "./delete-form";
import { BottomNav, CITIZEN_NAV } from "@/components/bottom-nav";
import { Icon } from "@/components/icons";
import { cardClass, backLinkClass } from "@/components/styles";

// Hapus akun warga (soft delete lewat delete_my_account).
export default function HapusAkunPage() {
  return (
    <>
      <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-[18px] px-5 pb-32 pt-6">
        <div className="flex items-center gap-3">
          <a href="/profil/ubah" className={backLinkClass}>
            <Icon name="back" stroke={2} />
            Kembali
          </a>
          <h1 className="font-display text-[26px] font-bold">Hapus akun</h1>
        </div>
        <section className={`${cardClass} flex flex-col gap-3 p-4`}>
          <span className="text-[16px] font-semibold">Yang terjadi kalau akun dihapus</span>
          <ul className="flex list-disc flex-col gap-1.5 pl-5 text-[15px] leading-[1.5] text-fg-label">
            <li>Nama panggilan, nama lengkap, dan wilayah tempat tinggalmu dihapus. Kamu tidak muncul lagi di leaderboard.</li>
            <li>Pendaftaran aktivitas yang belum berjalan dibatalkan. Kamu keluar dari grup, komunitas, dan tim penyelenggara.</li>
            <li>XP, poin, dan voucher hangus dan tidak bisa dipulihkan.</li>
            <li>Catatan transaksi tetap disimpan tanpa identitas, demi keadilan leaderboard dan audit.</li>
            <li>Email yang sama tidak bisa dipakai lagi untuk masuk.</li>
          </ul>
          <span className="text-[15px] leading-[1.5] text-fg-soft">
            Kalau kamu satu-satunya pemilik merchant atau ketua komunitas, serahkan perannya dulu lewat menu Tim. Pembayaran yang masih berjalan juga harus selesai dulu.
          </span>
        </section>
        <DeleteForm />
      </main>
      <BottomNav items={CITIZEN_NAV} active="Profil" />
    </>
  );
}
