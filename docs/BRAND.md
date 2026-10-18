# Gasyu — Brand Identity v1.2

Panduan brand untuk desain dan pengembangan aplikasi. `CLAUDE.md` merujuk ke file ini:

> Brand dan UI: ikuti `docs/BRAND.md` (warna, tipografi, logo, gaya bahasa). Jangan membuat warna atau font di luar token di sana.

Perubahan 1.2 (16 Oktober 2026): nama aplikasi berganti dari **Ramein** menjadi **Gasyu**. Simbol tiga lingkaran dan semua warna tetap; wordmark menjadi **gasyu**. Berkas logo yang memuat tulisan lama perlu dibuat ulang.

Perubahan 1.1: UI aplikasi memakai **tema gelap** mengikuti artifact **Ramein UI Mockup** (versi 15 Oktober 2026), dengan font judul **Outfit**. Palet krem v1.0 tetap dipakai untuk materi cetak dan presentasi (bagian 2b).

## 1. Logo

**Konsep: Irisan Bersama.** Tiga lingkaran mewakili tiga pihak. Bagian yang beririsan adalah keuntungan yang dibagi dua pihak, dan titik di tengah adalah Gasyu, tempat ketiganya bertemu dan saling menguntungkan.

| Lingkaran | Pihak | Posisi |
| --- | --- | --- |
| Oranye | Merchant | Atas |
| Hijau | Komunitas | Kiri bawah |
| Biru | Warga | Kanan bawah |

Posisi dan warna lingkaran tidak boleh ditukar.

**File** (`logo/`)

| File | Pakai untuk |
| --- | --- |
| `svg/gasyu-logo-horizontal.svg` | Logo utama: header web, dokumen, presentasi |
| `svg/gasyu-logo-horizontal-gelap.svg` | Di atas latar gelap (tinta) |
| `svg/gasyu-logo-bertumpuk.svg` | Poster, standee, layar pembuka |
| `svg/gasyu-simbol.svg` · `svg/gasyu-simbol-gelap.svg` | Avatar, stiker, ruang sempit |
| `svg/gasyu-logo-satu-warna.svg` | Stempel, sablon, cetak satu warna |
| `svg/gasyu-ikon-app.svg` · `png/gasyu-ikon-512.png` · `png/gasyu-ikon-192.png` | Ikon PWA (`purpose: any`) |
| `svg/gasyu-ikon-maskable.svg` · `png/gasyu-ikon-maskable-512.png` | Ikon PWA (`purpose: maskable`) |
| `png/apple-touch-icon-180.png` | Ikon iOS |
| `favicon.ico` · `svg/gasyu-favicon.svg` | Favicon (versi tanpa titik tengah, tetap jelas di 16–32 px) |

Wordmark di semua file sudah berupa outline, jadi tampil sama walau font belum terpasang. Di aplikasi, logo dipakai lewat komponen `Logo` (`components/ui.tsx`): simbol 48 px + wordmark krem `#FAF7F2`.

**Aturan**

- Ruang kosong minimal setengah lebar simbol di semua sisi.
- Ukuran minimum: logo horizontal 96 px layar / 25 mm cetak; simbol 24 px / 8 mm. Di bawah 32 px pakai favicon.
- Jangan memutar, menggepengkan, mengganti warna, menukar posisi lingkaran, mengganti huruf wordmark, atau menambah bayangan dan gradien.
- Wordmark selalu huruf kecil: **gasyu**. Dalam kalimat, tulis nama sebagai "Gasyu".

## 2. Warna UI aplikasi (tema gelap)

Sumber: artifact "Ramein UI Mockup" (judul lama artifact; isinya tetap acuan UI Gasyu). Token didefinisikan di `app/globals.css`; pakai nama token, jangan hex langsung.

| Token | Hex | Pakai untuk |
| --- | --- | --- |
| `bg` | `#0D1024` | Latar halaman |
| `surface` | `#171B33` | Kartu, input, chip |
| `surface-deep` | `#12152C` | Navigasi bawah |
| `line` | `#2A3058` | Garis dan border |
| `line-strong` | `#3A4072` | Border putus-putus (pilihan khusus, mis. "Luar Cimahi") |
| `fg` | `#F3F4FA` | Teks utama; latar tombol terang (Google) |
| `fg-label` | `#C9CCE4` | Label formulir, teks chip |
| `fg-soft` | `#A3A8C7` | Teks sekunder |
| `fg-muted` | `#8A8FB4` | Teks redup, ikon nonaktif, judul grup |
| `cream` | `#FAF7F2` | Wordmark |
| `primary` | `#5B5BF0` | Tombol utama, chip terpilih |
| `primary-soft` | `#8F93FF` | Fokus input, progres langkah |
| `link` | `#A9ACFF` | Tautan dan tombol teks |
| `hero-from` → `hero-to` | `#4B45E0` → `#6D2FD8` | Gradien kartu level (135°), satu-satunya gradien di UI |
| `on-hero` | `#E3E1FF` | Teks sekunder di atas kartu level |
| `avatar` / `avatar-ring` | `#2A2F63` / `#6D5BF0` | Lingkaran inisial pengguna |
| `xp` | `#5CCBF5` | XP, bar progres level |
| `points` | `#F7A1C2` | Poin |
| `hot` | `#F0508A` | Tombol Scan, titik notifikasi |
| `success` | `#34D399` | Sukses, siap check-in, badge |
| `warn` | `#F5B544` | Menunggu, peringkat |
| `danger` / `danger-tint` | `#FF8A8A` / `#3A1620` | Pesan error |
| `merchant` / `komunitas` / `warga` | `#F06A2A` / `#0F8B6D` / `#2D4FCF` | Warna tiga pihak di logo dan label pihak |

Warna irisan (`#7E7A2C`, `#9A4E80`, `#1A6AA6`) hanya untuk logo dan ilustrasi, bukan UI.

### 2b. Warna materi cetak dan presentasi (latar terang, v1.0)

`cream #FAF7F2` (latar), `ink #17212B` (teks, tombol), `ink-soft #4A5560`, `line #E4DED3`, `merchant-text #B8481A`, `merchant-tint #FDE9DF`, `komunitas-text #0B6E57`, `komunitas-tint #E2F3EE`, `warga-tint #E6EBFB`, `danger #B42318`, `danger-tint #FBEDEB`. Porsi: sekitar 60% krem/putih, 25% tinta, 15% tiga warna pihak.

## 3. Tipografi

Dua keluarga dari Google Fonts:

- **Outfit** (500, 600, 700) untuk judul dan angka besar: kelas Tailwind `font-display`.
- **Plus Jakarta Sans** (400–800) untuk teks lain: bawaan `font-sans`.

| Gaya | Font | Ukuran | Bobot | Catatan |
| --- | --- | --- | --- | --- |
| hero | Outfit | 32 / 1.15 | 700 | judul layar masuk |
| title | Outfit | 28 | 700 | judul layar |
| section | Outfit | 19 | 600 | judul bagian ("Aktivitasku") |
| number | Outfit | 34 (XP), 22–24 | 700 | `tabular-nums` untuk XP, poin, peringkat |
| body | Jakarta | 15 / 1.55 | 400 | |
| body-sm | Jakarta | 14 / 1.55 | 400 | intro layar |
| caption | Jakarta | 13 | 500 | warna `fg-soft` |
| label | Jakarta | 13 | 600 | label formulir, warna `fg-label` |
| group | Jakarta | 12 | 700 | huruf kapital, letter-spacing 0.06em, warna `fg-muted` |
| nav | Jakarta | 11 | 600 | navigasi bawah |

## 4. Elemen UI

- **Tombol utama**: tinggi 54 px, sudut 16 px, latar `primary`, teks putih 16 px semibold. **Tombol terang** (Google): latar `fg`, teks `bg`. Kelas siap pakai: `buttonStyles` di `components/styles.ts`.
- **Input**: tinggi 52 px, sudut 14 px, latar `surface`, border `line`, fokus `primary-soft`.
- **Kartu**: sudut 18–20 px, latar `surface`, border `line`, tanpa bayangan. Kartu level: sudut 24 px dengan gradien `hero`.
- **Chip pilihan**: tinggi 44 px, sudut penuh, latar `surface`; terpilih: latar dan border `primary`, teks putih.
- **Kode OTP**: 6 kotak 52 px, sudut 12 px, latar `bg`, angka Outfit 22 px.
- **Progres langkah**: 3 bar 5 px; selesai `primary-soft`, belum `line`.
- **Navigasi bawah**: Beranda, Jelajah, Scan (tombol bulat 60 px `hot` yang menonjol ke atas), Dompet, Profil.
- **Ikon**: garis 1.8–2 px, ujung membulat (gaya Lucide).
- **Target sentuh** minimal 44 × 44 px.

## 5. Gaya bahasa

- **Akrab**: pakai "kamu", kalimat pendek, boleh santai.
- **Bersemangat**: rayakan langkah kecil tanpa tanda seru berlebihan.
- **Jujur**: angka dan aturan jelas, tidak menjanjikan yang tidak pasti.

| Pakai | Hindari |
| --- | --- |
| Mantap! Kamu dapat 100 XP. Tinggal 2 kedai lagi buat voucher. | Selamat!!! Anda telah berhasil memperoleh poin pengalaman. |
| QR ini sudah kedaluwarsa. Minta staf tampilkan yang baru, ya. | Error 403: token tidak valid. |

Tagline: **Bikin kota makin rame, bareng-bareng.**

## 6. Kode

- Token warna dan font: `app/globals.css` (`@theme`).
- Font: `app/layout.tsx` (`Plus_Jakarta_Sans` → `--font-jakarta`, `Outfit` → `--font-outfit`).
- PWA: `app/manifest.ts` dengan `background_color` dan `theme_color` `#0D1024`.
- Komponen dasar: `components/ui.tsx` (Logo, SubmitButton, ErrorMessage, GoogleIcon), `components/styles.ts` (kelas tombol, input, kartu), `components/otp-input.tsx`, `components/bottom-nav.tsx`.

Taruh `favicon.ico` di `app/`, `apple-touch-icon-180.png` sebagai `app/apple-icon.png`, ikon PNG di `public/icons/`, dan SVG logo di `public/brand/`.
