# Data dummy Gasyu

Folder ini berisi data contoh supaya alur Gasyu terlihat lengkap saat demo:
10 warga, 6 merchant, 5 komunitas, 1 admin, 4 aktivitas (2 event, 1 challenge, 1 menunggu review)
beserta misi, check-in, pembayaran, poin, voucher, badge, notifikasi, dan satu kasus moderasi.

Daftar akun dan kata sandinya ada di [`akun.md`](akun.md).

## Isi folder

| Berkas | Fungsi |
| --- | --- |
| `seed.sql` | Membuat semua akun dan data dummy lewat fungsi database (sama seperti aplikasi) |
| `unggah-gambar.cjs` | Mengunggah logo, cover, bukti bayar, dan foto misi ke Storage, lalu menjalankan alur yang butuh berkas |
| `bersihkan.sql` | Menghapus **semua** data dummy tanpa menyentuh data asli |
| `buat-gambar.py` | Pembuat gambar di `gambar/` (sudah dijalankan; hanya perlu jika ingin mengganti gambar) |
| `gambar/` | Logo, cover, bukti transfer, dan foto misi dummy |
| `akun.md` | Daftar akun, kata sandi, aktivitas, dan kode misi |

## Cara memasang

1. Buka Supabase Dashboard → SQL Editor, tempel seluruh isi `seed.sql`, jalankan.
   Jika data dummy sudah ada, skrip berhenti dengan pesan supaya `bersihkan.sql` dijalankan dulu.
2. Di komputer, pastikan `.env.local` terisi, lalu jalankan:

   ```bash
   node dummy-data/unggah-gambar.cjs
   ```

   Skrip ini masuk sebagai akun dummy memakai kata sandinya, jadi tidak butuh kunci `service_role`.

Waktu aktivitas dihitung relatif terhadap saat `seed.sql` dijalankan: Festival Kuliner "berjalan hari ini",
Night Run "3 hari lagi", challenge kopi "hari ke-5". Jika ingin suasana segar lagi, bersihkan lalu pasang ulang.

## Penanda data dummy

- Semua akun dummy punya id berawalan `dd000000-0000-4000-8000-` dan email `@dummy.gasyu.id`.
- Penyelenggara, aktivitas, grup, reward, transaksi, notifikasi, dan berkas Storage diturunkan dari akun itu
  (pembuat/pemilik), sehingga `bersihkan.sql` bisa menghapusnya tanpa daftar id.
- Data asli (misalnya akun Anda) tidak pernah tersentuh oleh skrip ini.

## Cara membersihkan

Buka SQL Editor, tempel seluruh isi `bersihkan.sql`, jalankan. Hasil akhir "Data dummy dihapus".
Skrip ini aman dijalankan berulang.

## Skenario demo yang enak ditunjukkan

- **Admin** (`admin@dummy.gasyu.id`): ada 2 penyelenggara menunggu verifikasi, 1 aktivitas menunggu review,
  1 check-in di luar radius di Moderasi, Ringkasan kota terisi.
- **Merchant Kopi Lereng** (`wisnu@`): dashboard dengan budget poin terpakai, challenge berjalan, voucher yang ditukar Nadia,
  ulasan foto menunggu tinjauan, QR checkpoint.
- **Merchant Seblak Teh Ai** (`tehai@`): Festival berjalan, check-in hari ini, foto misi Siti menunggu tinjauan,
  kolaborasi dengan Kopi Lereng.
- **Komunitas Cimahi Runners** (`andi@`): Night Run berbayar, halaman Peserta dan pembayaran dengan
  bukti bayar Dimas menunggu, Siti dan Fajar belum bayar, grup Baros Squad.
- **Warga Nadia** (`nadia@`): challenge selesai, badge, poin, voucher aktif di Dompet, peringkat.
- **Warga Dimas** (`dimas@`): status "Cek bukti" di Night Run, Festival sudah selesai.
- **Warga Siti** (`siti@`): foto misi "sedang ditinjau", belum bayar Night Run.

## Catatan setelah ganti nama ke Gasyu

- Email akun dummy memakai domain `@dummy.gasyu.id` dan kata sandi `GasyuDummy2026!` (sebelumnya `@dummy.ramein.id` / `RameinDummy2026!`; project yang sudah terisi diganti sekali dengan `ganti-email-gasyu.sql`).
- Kalau gambar cover dibuat ulang (`python3 dummy-data/buat-gambar.py`), unggah ulang cover saja dengan `node dummy-data/unggah-cover.cjs`.
- Foto profil contoh untuk akun rani (`gambar/avatar-rani.jpg`) dipasang oleh `unggah-gambar.cjs` dan dihapus oleh `bersihkan.sql`.
