# Gasyu — Brand Identity v1.3

Panduan brand untuk desain dan pengembangan aplikasi. `CLAUDE.md` merujuk ke file ini:

> Brand dan UI: ikuti `docs/BRAND.md` (warna, tipografi, logo, gaya bahasa). Jangan membuat warna atau font di luar token di sana.

Perubahan 1.3 (22 Oktober 2026): UI aplikasi pindah ke palet terang **Ramah Semua Umur 2026** (Cloud Dancer, Crail Orange, Bio-Mint Moss) untuk warga, merchant, komunitas, dan admin. Tema gelap dan gradien kartu level dihapus. Huruf dasar 18 px, judul 24 px, tombol wajib ikon + teks.

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

Wordmark di semua file sudah berupa outline, jadi tampil sama walau font belum terpasang. Di aplikasi, logo dipakai lewat komponen `Logo` (`components/ui.tsx`): simbol 48 px + wordmark tinta `#1A1A1A`.

**Aturan**

- Ruang kosong minimal setengah lebar simbol di semua sisi.
- Ukuran minimum: logo horizontal 96 px layar / 25 mm cetak; simbol 24 px / 8 mm. Di bawah 32 px pakai favicon.
- Jangan memutar, menggepengkan, mengganti warna, menukar posisi lingkaran, mengganti huruf wordmark, atau menambah bayangan dan gradien.
- Wordmark selalu huruf kecil: **gasyu**. Dalam kalimat, tulis nama sebagai "Gasyu".

## 2. Warna UI aplikasi (Ramah Semua Umur 2026)

Satu tema terang untuk seluruh aplikasi. Token didefinisikan di `app/globals.css`; pakai nama token, jangan hex langsung. Porsi: 60% latar, 30% kartu, 10% tombol utama.

| Token | Hex | Pakai untuk |
| --- | --- | --- |
| `bg` | `#F3F3F1` | Latar halaman (Cloud Dancer, 60%) |
| `surface` / `surface-deep` | `#FFFFFF` | Kartu, input, navigasi bawah (Pure White, 30%) |
| `line` / `track` | `#E5E5E2` | Garis pembatas, alur progress bar |
| `line-strong` | `#A3A39E` | Border input dan tombol garis |
| `scrim` | `#1A1A1A` 72% | Lapisan di atas foto sampul (teks `cream`) |
| `fg` | `#1A1A1A` | Teks utama (Ink Black) |
| `fg-label` | `#2E2E2E` | Label formulir |
| `fg-soft` | `#5A5A5A` | Teks sekunder (Slate Muted) |
| `fg-muted` | `#6B6B6B` | Teks redup, placeholder |
| `primary` | `#C15F3C` | Tombol utama / CTA, teks putih (Crail Orange, 10%) |
| `primary-hover` / `link` / `points` | `#A84F2E` | Hover tombol utama, tautan, angka poin |
| `primary-tint` / `avatar` / `hot-tint` | `#F8E9E3` | Latar lembut oranye, lingkaran inisial |
| `hot` | `#C15F3C` | Tombol Scan, titik notifikasi |
| `xp` / `success` | `#2B6E57` | Progress bar, sukses (Bio-Mint Moss) |
| `success-tint` | `#E3F0EA` | Latar pesan sukses |
| `warn` / `warn-tint` | `#8A5A00` / `#FBF0D9` | Menunggu, kedaluwarsa |
| `info` / `info-tint` | `#1F5F86` / `#E3EEF5` | Informasi |
| `danger` / `danger-tint` | `#B42318` / `#FBEDEB` | Pesan error |
| `bronze` | `#A0643A` | Peringkat 3 |
| `merchant` / `komunitas` / `warga` | `#F06A2A` / `#0F8B6D` / `#2D4FCF` | Warna tiga pihak di logo dan label pihak |

Warna irisan (`#7E7A2C`, `#9A4E80`, `#1A6AA6`) hanya untuk logo dan ilustrasi, bukan UI.
Kontras: teks putih di atas `primary` cukup untuk teks besar (18 px tebal), jadi teks tombol utama minimal 16 px semibold.

### 2b. Warna materi cetak dan presentasi (latar terang, v1.0)

`cream #FAF7F2` (latar), `ink #17212B` (teks, tombol), `ink-soft #4A5560`, `line #E4DED3`, `merchant-text #B8481A`, `merchant-tint #FDE9DF`, `komunitas-text #0B6E57`, `komunitas-tint #E2F3EE`, `warga-tint #E6EBFB`, `danger #B42318`, `danger-tint #FBEDEB`. Porsi: sekitar 60% krem/putih, 25% tinta, 15% tiga warna pihak.

## 3. Tipografi

Dua keluarga dari Google Fonts:

- **Outfit** (500, 600, 700) untuk judul dan angka besar: kelas Tailwind `font-display`.
- **Plus Jakarta Sans** (400–800) untuk teks lain: bawaan `font-sans`.

Ukuran dibuat besar supaya terbaca jelas oleh anak-anak sampai lansia. Ukuran dasar `html` 18 px.

| Gaya | Font | Ukuran | Bobot | Catatan |
| --- | --- | --- | --- | --- |
| hero | Outfit | 34 / 1.15 | 700 | judul layar masuk |
| title | Outfit | 28–30 | 700 | judul layar |
| section | Outfit | 24 | 600–700 | judul bagian ("Misi Hari Ini") |
| number | Outfit | 26–44 | 700 | `tabular-nums` untuk XP, poin, peringkat |
| body | Jakarta | 18 / 1.55 | 400 | isi |
| body-sm | Jakarta | 16–17 / 1.5 | 400 | keterangan |
| label | Jakarta | 17 | 600 | label formulir, warna `fg-label` |
| caption | Jakarta | 14 | 500 | batas terkecil untuk teks penting |
| nav | Jakarta | 13 | 600 | navigasi bawah |

## 4. Elemen UI (ramah semua umur)

- **Tombol wajib ikon + teks** (mis. "🔥 5 Minggu Aktif", "🎁 Tukar Hadiah", "← Kembali"). Jangan pakai ikon saja, termasuk tombol Kembali, Tutup, Notifikasi, dan Scan.
- **Tombol utama**: tinggi minimal 58 px, sudut 16 px, latar `primary`, hover `primary-hover`, teks putih 18 px semibold. Kelas siap pakai: `buttonStyles` di `components/styles.ts`.
- **Tombol kecil**: tinggi minimal 48 px (`smallButton`). **Kembali**: `backLinkClass`.
- **Input**: tinggi 56 px, sudut 14 px, latar `surface`, border `line-strong`, fokus `primary` dengan cincin.
- **Kartu**: sudut 20 px, latar `surface`, border `line`, tanpa bayangan dan tanpa gradien.
- **Progress bar**: tinggi 16 px, alur `track`, isi `xp` (hijau).
- **Chip pilihan**: tinggi minimal 44 px, sudut penuh; terpilih: latar `primary`, teks putih.
- **Navigasi bawah**: Beranda, Jelajah, Scan (tombol bulat 60 px `hot` dengan label di bawahnya), Dompet, Profil.
- **Ikon**: garis 1.8–2 px, ujung membulat (gaya Lucide). Emoji boleh untuk kartu skor dan medali peringkat.
- **Jarak longgar**: target sentuh minimal 48 × 48 px, jarak antar tombol minimal 12 px.

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
- PWA: `app/manifest.ts` dengan `background_color` dan `theme_color` `#F3F3F1`.
- Komponen dasar: `components/ui.tsx` (Logo, SubmitButton, ErrorMessage, GoogleIcon), `components/styles.ts` (kelas tombol, input, kartu, tombol Kembali), `components/otp-input.tsx`, `components/bottom-nav.tsx`.

Taruh `favicon.ico` di `app/`, `apple-touch-icon-180.png` sebagai `app/apple-icon.png`, ikon PNG di `public/icons/`, dan SVG logo di `public/brand/`.
