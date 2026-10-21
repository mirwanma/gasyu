# Event kolaborasi Gasyu x Bank Indonesia Jawa Barat

Skrip `buat-event.sql` langsung membuat dua aktivitas Gasyu (host `platform`) lengkap dengan partner, checkpoint, dan misi.
Keduanya dibuat sebagai **draft**, jadi belum tampil ke warga sebelum diajukan dari `/admin`.

| Aktivitas | Jenis | Waktu (bisa diubah di KONFIGURASI) | Misi | XP misi |
| --- | --- | --- | --- | --- |
| Festival Rupiah & QRIS Cimahi | event, terbuka untuk semua | Sabtu 21 Nov 2026, 08.00–21.00 WIB, Alun-alun Kota Cimahi | 34 (3 wajib, 31 bonus) | 500 |
| Jelajah QRIS UMKM Cimahi | challenge sedang, selesai = 10 misi apa saja | 22 Nov – 6 Des 2026 | 9 + 1 per outlet UMKM (maks. 20) | 200 + 15 per outlet (maks. 500) |

## Isi misi Festival

- **Wajib:** Kenali Rupiah (QR booth BI), Belajar QRIS (QR booth BI), Bayar pertama pakai QRIS di UMKM (foto).
- **Edukasi BI:** kuis Cinta Bangga Paham Rupiah, kuis anti-penipuan, talkshow (terbuka 13.00), foto pojok Rupiah, kas keliling, ekonomi syariah, kelas atur uang saku.
- **UMKM:** mampir dan belanja di 8 booth (QR tiap booth), ulasan, selfie dengan pemilik.
- **Komunitas:** kelas foto produk, Eco Station, Pojok Komunitas, bawa tumbler.
- **Panggung:** pembukaan (terbuka 09.00), misi kejutan MC (dibuka manual), lomba yel-yel antarkelurahan, misi malam budaya Sunda (terbuka 19.00).
- **Jejak Rupiah:** 3 petunjuk berantai di banner. Petunjuk berikutnya baru terbuka setelah petunjuk sebelumnya selesai.
- **Penutup:** survei kepuasan, story di media sosial.

## Cara pakai

1. Daftarkan dan setujui dulu BI Jabar (saran: sebagai komunitas, karena tidak punya budget poin), UMKM, dan komunitas yang ikut.
2. Buka `buat-event.sql`, isi bagian **KONFIGURASI**:
   - `event_config`: tanggal, lokasi, koordinat, kuota, email admin.
   - `event_partner`: nama penyelenggara per slot (BI, `umkm1`–`umkm8` harus merchant, kreator, lingkungan, komunitas).
     Slot yang kosong atau namanya tidak ditemukan tetap dibuat atas nama Gasyu, dan panitia Gasyu yang menampilkan QR-nya.
   - `event_jelajah`: nama merchant untuk challenge. Semua outlet aktifnya otomatis jadi titik jelajah.
3. Supabase Dashboard → SQL Editor → tempel seluruh isi file → Run.
4. Hasil akhirnya **tabel kode rahasia** (dibuat acak tiap kali dijalankan). Simpan dan bagikan hanya ke petugas yang tertulis di kolom "dibagikan_oleh".
5. Cek kedua aktivitas di `/admin`: ganti cover, ubah teks misi kalau perlu, nonaktifkan misi yang tidak jadi (misalnya kas keliling).
   Merchant yang mau memberi poin mengisi budget poinnya sendiri, lalu admin mengatur poin per penyelesaian.
6. Ajukan dari `/admin`. Event Gasyu langsung tayang.

Skrip berhenti jika aktivitas dengan judul yang sama sudah ada. Pesan `schema "pg_temp" does not exist` di awal boleh diabaikan.

## Catatan

- Partner yang ditambahkan langsung mendapat notifikasi "Kamu ditambahkan ke event Gasyu". Jalankan skrip setelah kesepakatan dengan mereka beres.
- QR misi dan checkpoint berganti tiap 60 detik, jadi tiap booth butuh HP atau tablet untuk menampilkannya. QR ini tidak bisa dicetak.
- Ada 6 misi foto dan 3 misi manual di Festival, jadi siapkan petugas untuk meninjaunya.
- Nama dan logo Bank Indonesia di cover atau materi promosi harus mendapat izin dari BI.
