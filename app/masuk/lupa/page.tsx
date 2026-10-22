import { CodeLoginForm } from "../login-form";
import { Logo } from "@/components/ui";

// Lupa kata sandi: masuk dengan kode email, lalu langsung ke halaman buat kata sandi baru.
// Memakai template email kode masuk yang sudah ada, jadi tidak perlu template "Reset password".
export default function LupaPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-7 px-6 pb-8 pt-14">
      <div className="flex flex-col gap-[18px]">
        <Logo />
        <h1 className="font-display text-[32px] font-bold leading-[1.15]">Lupa kata sandi</h1>
        <p className="text-[16px] leading-[1.55] text-fg-soft">
          Masukkan email akunmu. Kami kirim kode 6 angka, lalu kamu bisa membuat kata sandi baru.
        </p>
      </div>
      <CodeLoginForm next="/profil/kata-sandi?baru=1" mode="reset" />
      <a href="/masuk" className="-mt-3 text-center text-[15px] font-semibold text-fg-soft underline underline-offset-4">
        Kembali ke halaman masuk
      </a>
    </main>
  );
}
