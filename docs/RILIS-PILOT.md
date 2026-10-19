# Gasyu — Daftar Cek Rilis Pilot

Versi 1 · 19 Oktober 2026 · Pilot Kota Cimahi

Panduan langkah demi langkah sebelum warga sungguhan mulai memakai Gasyu.
Centang `[x]` setiap langkah yang sudah selesai. Langkah bertanda **(wajib)** harus beres sebelum rilis.
Langkah lain sangat disarankan, tetapi bisa menyusul.

Kode, database, dan uji otomatis sudah selesai (migrasi 0001–0026, uji SQL, dan uji browser lolos).
Yang tersisa di sini adalah **pengaturan di luar kode** yang hanya bisa dilakukan pemilik akun.

---

## 0. Kondisi saat ini (dicek 19 Oktober 2026)

| Hal | Kondisi | Perlu tindakan? |
| --- | --- | --- |
| Migrasi database | 26 dari 26 sudah terpasang | Tidak |
| Jadwal otomatis (cron) | 14 aktif, 0 gagal dalam 24 jam terakhir | Tidak |
| Bucket Storage | 6 bucket: `logos`, `covers`, `avatars` publik; `organizer-proofs`, `payment-proofs`, `mission-proofs` privat | Tidak |
| Wilayah | 1 kota, 3 kecamatan, 15 kelurahan Cimahi | Tidak |
| Penyelenggara platform | "Gasyu" sudah ada | Isi WhatsApp panitia (bagian 4) |
| Akun admin | `admin@dummy.ramein.id` (dummy) dan akun pemilik | **Hapus admin dummy** |
| Data dummy | 23 akun dummy beserta aktivitas, voucher, dan lainnya | **Bersihkan** |
| Kontak bantuan | `support.whatsapp`, `support.email`, `payment.gasyu_whatsapp` masih kosong | **Isi** |
| Halaman Syarat & Ketentuan dan Kebijakan Privasi | Belum ada, padahal onboarding meminta warga menyetujuinya | **Siapkan teksnya** |

---

## 1. Pilih project Supabase untuk produksi (wajib)

Ada dua pilihan:

- **A. Disarankan: buat project Supabase baru khusus produksi.**
  Project yang sekarang tetap dipakai untuk uji coba. Uji browser otomatis (`npm run e2e`) butuh data dummy,
  jadi lebih aman kalau uji coba dan data warga asli tidak tercampur.
  Setelah project baru dibuat, minta Claude memasang semua migrasi ke sana (`npx supabase db push`)
  dan membuat ulang file tipe database.
- **B. Pakai project yang sekarang.** Lebih cepat, tetapi data dummy wajib dibersihkan (bagian 4),
  dan uji browser otomatis tidak bisa dijalankan lagi di project itu.

Apa pun pilihannya:

- [ ] **Paket Supabase Pro** (sekitar US$25 per bulan). Paket gratis menghentikan project yang tidak aktif seminggu
      dan tidak punya cadangan harian. Untuk data warga asli, cadangan harian penting.
- [ ] Region project tetap **Southeast Asia (Singapore)** supaya cepat dari Indonesia.

---

## 2. Login email dengan kode (wajib)

Warga masuk dengan **kode 6 angka** yang dikirim ke email.
Bawaan Supabase mengirim tautan, bukan kode, jadi templatenya harus diganti.

Di Supabase → **Authentication**:

- [ ] **Emails → Templates → Magic Link**: ganti isi dengan isi file `supabase/templates/kode-masuk.html`.
      Judul email: `Kode masuk Gasyu`.
- [ ] **Emails → Templates → Confirm signup**: isi dengan file yang sama (warga baru juga menerima kode).
- [ ] **Sign In / Providers → Email**: panjang kode (Email OTP Length) **6**,
      masa berlaku (Email OTP Expiration) **600** detik (10 menit, sesuai tulisan di email).
- [ ] **Emails → SMTP Settings**: pakai layanan email sendiri (misalnya Resend, Brevo, atau Mailgun).
      **Ini penting:** pengirim bawaan Supabase hanya untuk uji coba. Batasnya sangat kecil (beberapa email per jam)
      dan hanya sampai ke alamat anggota tim project. Tanpa SMTP sendiri, warga tidak akan menerima kode.
  - Nama pengirim: `Gasyu`. Alamat pengirim misalnya `masuk@gasyu.id`.
  - Di pengelola domain, tambahkan catatan SPF dan DKIM dari layanan email itu supaya email tidak masuk spam.
- [ ] **Rate Limits**: setelah SMTP aktif, naikkan batas email per jam sesuai perkiraan pendaftar hari pertama
      (misalnya 100–300 per jam saat peluncuran).
- [ ] **Attack Protection → Leaked password protection**: nyalakan. Ini satu-satunya catatan dari
      pemeriksa keamanan Supabase yang masih tersisa.

## 3. Alamat situs dan login Google (wajib)

Di Supabase → **Authentication → URL Configuration**:

- [ ] **Site URL**: `https://gasyu.id`
- [ ] **Redirect URLs**: tambahkan
  - `https://gasyu.id/auth/callback`
  - `https://admin.gasyu.id/auth/callback`
  - `http://localhost:3000/auth/callback` (untuk uji di komputer, boleh tetap ada)

Login Google (tombol "Masuk dengan Google"):

- [ ] Di **Google Cloud Console** → APIs & Services:
  - **OAuth consent screen**: nama aplikasi `Gasyu`, logo Gasyu, email bantuan, domain `gasyu.id`,
    dan tautan Kebijakan Privasi (bagian 6). Ubah status ke **In production**.
  - **Credentials → Create OAuth client ID** (Web application).
    Authorized redirect URI: `https://<ref-project>.supabase.co/auth/v1/callback`
    (alamat persisnya ada di Supabase → Authentication → Providers → Google).
- [ ] Di Supabase → **Providers → Google**: nyalakan, lalu tempel Client ID dan Client Secret.
- [ ] Jika belum sempat, login Google boleh dimatikan dulu. Login email tetap jalan.

---

## 4. Data dan pengaturan (wajib)

**Bersihkan data dummy** (jika memakai project yang sekarang):

- [ ] Buka Supabase → SQL Editor, tempel seluruh isi `dummy-data/bersihkan.sql`, lalu jalankan.
      Hasil akhirnya harus "Data dummy dihapus".
- [ ] Pastikan tidak ada lagi akun `@dummy.ramein.id`, terutama **admin dummy**, karena kata sandinya tertulis di repo.
      Cek dengan:
      ```sql
      select email from auth.users where email like '%@dummy.ramein.id';
      ```
      Hasilnya harus kosong.

**Akun admin asli:**

- [ ] Setiap anggota tim Gasyu masuk sekali ke aplikasi dan menyelesaikan onboarding.
- [ ] Jadikan admin lewat SQL Editor (ganti emailnya):
      ```sql
      update public.profiles set is_admin = true
      where id = (select id from auth.users where email = 'nama@gasyu.id');
      ```
- [ ] Cek daftar admin:
      ```sql
      select u.email from public.profiles p join auth.users u on u.id = p.id where p.is_admin;
      ```

**Pengaturan** (dashboard admin → Pengaturan). Nilai teks ditulis dengan tanda kutip, misalnya `"081234567890"`:

- [ ] `support.whatsapp`: nomor WhatsApp bantuan Gasyu (tampil di halaman Bantuan).
- [ ] `support.email`: email bantuan, misalnya `"halo@gasyu.id"`.
- [ ] `payment.gasyu_whatsapp`: nomor WhatsApp panitia untuk event berbayar buatan Gasyu.
      Jika kosong, aplikasi memakai `support.whatsapp`.
- [ ] Tinjau angka aturan main lain. Nilai sekarang sesuai dokumen: radius 150 m, XP harian maks. 1.000,
      poin berlaku 6 bulan, leaderboard kelurahan minimal 10 warga aktif, dan seterusnya.
      Ubah hanya jika memang diputuskan berbeda.

**Isi awal:**

- [ ] Penyelenggara "Gasyu" untuk sementara tampil sebagai inisial berwarna, karena logonya belum bisa diunggah dari dashboard admin. Opsional: minta Claude menambahkan tombol unggah logo.
- [ ] Master misi (dashboard admin → Master misi): tinjau template awal, nonaktifkan yang tidak dipakai.
- [ ] Siapkan 1–2 event pertama dan undang merchant/komunitas pilot untuk mendaftar.

---

## 5. Vercel (wajib)

- [ ] Hubungkan repo `mirwanma/gasyu` ke Vercel. Production Branch: `main`.
- [ ] **Environment Variables** (Production, juga Preview jika dipakai). Hanya dua:
  - `NEXT_PUBLIC_SUPABASE_URL`: dari Supabase → Project Settings → API.
  - `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`: kunci **publishable** (diawali `sb_publishable_`).
  - **Jangan pernah** memasukkan kunci `service_role` atau secret key. Aplikasi tidak membutuhkannya.
- [ ] **Domains**: tambahkan `gasyu.id` dan `admin.gasyu.id` ke project yang sama.
      Aplikasi otomatis membuka dashboard admin jika dibuka dari `admin.gasyu.id`.
      Ikuti petunjuk Vercel untuk catatan DNS di pengelola domain.
- [ ] **Paket Vercel**: paket Hobby (gratis) hanya untuk pemakaian non-komersial.
      Karena Gasyu adalah layanan untuk merchant, pakai paket **Pro**.
- [ ] Setelah deploy, buka `https://gasyu.id`, pastikan halaman masuk tampil dan gembok HTTPS aktif.

---

## 6. Konten hukum dan bantuan (wajib)

Onboarding meminta warga mencentang "Saya setuju dengan syarat & ketentuan dan kebijakan privasi Gasyu",
tetapi halamannya belum ada. UU Pelindungan Data Pribadi (UU PDP) mewajibkan pemberitahuan
tentang data apa yang dikumpulkan dan untuk apa.

- [ ] Pemilik proyek menyiapkan teks **Syarat & Ketentuan** dan **Kebijakan Privasi**
      (sebaiknya ditinjau orang yang paham hukum). Isi minimal:
  - Data yang dikumpulkan: nama, nickname, email, kelurahan, lokasi saat check-in, foto bukti misi, bukti bayar,
    serta nomor HP dan alamat pemenang Event Global.
  - Kegunaannya, siapa yang bisa melihatnya (partner hanya melihat peserta di checkpoint miliknya),
    dan berapa lama disimpan (alamat pemenang dihapus 30 hari setelah hadiah dikirim).
  - Cara menghapus akun (sudah ada di Profil → Hapus akun) dan kontak Gasyu.
  - Aturan poin dan voucher: tidak bisa diuangkan, berlaku 6 bulan, dan bisa dibatalkan jika curang.
- [ ] Setelah teks siap, minta Claude membuat halaman `/syarat` dan `/privasi`,
      lalu menautkannya dari onboarding, halaman masuk, dan Bantuan.

---

## 7. Uji akhir di HP setelah deploy (wajib)

Lakukan di HP sungguhan, di alamat produksi, dengan akun asli (bukan dummy):

- [ ] Masuk dengan email: kode tiba dalam 1 menit, tidak masuk spam, dan kodenya bisa dipakai.
- [ ] Masuk dengan Google (jika diaktifkan).
- [ ] Onboarding: pilih kelurahan, lalu warga luar Cimahi pilih kota asal.
- [ ] Pasang aplikasi ke layar utama ("Tambahkan ke Layar Utama"), lalu buka dari ikon.
- [ ] Admin: buka `https://admin.gasyu.id`, lalu verifikasi satu merchant uji dan satu komunitas uji.
- [ ] Merchant uji membuat event dengan checkpoint, admin menyetujui, dan warga check-in dengan memindai QR di lokasi.
- [ ] Misi: scan QR misi, kode rahasia, dan foto (ditinjau tim merchant).
- [ ] Poin: warga menukar voucher, lalu kasir merchant memakainya di mode kasir.
- [ ] Notifikasi muncul di menu Notifikasi.
- [ ] Setelah selesai, hapus atau bekukan penyelenggara uji supaya tidak tampil ke warga.

---

## 8. Hari peluncuran dan sesudahnya

- [ ] Dashboard admin → **Moderasi**: cek tiap hari, terutama check-in di luar radius dan laporan pola mencurigakan.
- [ ] Dashboard admin → **Verifikasi** dan **Aktivitas**: setujui pendaftaran dan event yang masuk.
- [ ] Dashboard admin → **Pembayaran**: konfirmasi bukti bayar event Gasyu yang berbayar.
- [ ] Seminggu sekali, cek jadwal otomatis di SQL Editor. Hasilnya harus `0`:
      ```sql
      select count(*) from cron.job_run_details where status = 'failed' and start_time > now() - interval '7 days';
      ```
- [ ] Supabase → **Database → Backups**: pastikan cadangan harian berjalan (paket Pro).
- [ ] Supabase → **Advisors**: buka sebulan sekali, lalu teruskan catatan baru ke Claude.
- [ ] Perubahan kode berikutnya tetap lewat PR ke `main`. GitHub menjalankan cek otomatis (lint, build, uji SQL) sebelum digabung.
