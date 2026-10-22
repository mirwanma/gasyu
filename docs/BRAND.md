# Gasyu — Brand Identity v1.4

Panduan brand untuk desain dan pengembangan aplikasi. `CLAUDE.md` merujuk ke file ini:

> Brand dan UI: ikuti `docs/BRAND.md` (warna, tipografi, logo, gaya bahasa). Jangan membuat warna atau font di luar token di sana.

Perubahan 1.4 (22 Oktober 2026): tema **Hangat & Menantang**. Dua tema yang bisa dipilih warga di Profil (Terang krem hangat, Gelap espresso hangat; tanpa pilihan mengikuti HP). Font **Bricolage Grotesque** (judul, angka) + **Figtree** (teks). Ikon **Phosphor**. Tombol 3D, navigasi kaca melayang, kartu level bergradien senja, bento skor, podium 3 besar. Ukuran huruf dasar kembali 16 px dengan skala bervariasi. Menggantikan palet v1.3.

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

Wordmark di semua file sudah berupa outline, jadi tampil sama walau font belum terpasang. Di aplikasi, logo dipakai lewat komponen `Logo` (`components/ui.tsx`): simbol 48 px + wordmark warna teks utama (`fg`), jadi otomatis gelap di tema terang dan krem di tema gelap.

**Aturan**

- Ruang kosong minimal setengah lebar simbol di semua sisi.
- Ukuran minimum: logo horizontal 96 px layar / 25 mm cetak; simbol 24 px / 8 mm. Di bawah 32 px pakai favicon.
- Jangan memutar, menggepengkan, mengganti warna, menukar posisi lingkaran, mengganti huruf wordmark, atau menambah bayangan dan gradien.
- Wordmark selalu huruf kecil: **gasyu**. Dalam kalimat, tulis nama sebagai "Gasyu".

## 2. Warna UI aplikasi (Hangat & Menantang, dua tema)

Token didefinisikan di `app/globals.css`; pakai nama token, jangan hex langsung. Nilai `--ui-*` berganti per tema lewat `<html data-theme="light|dark">`. Pilihan warga disimpan di cookie `gasyu-theme` (komponen `components/theme-picker.tsx` di Profil); tanpa pilihan, tema mengikuti pengaturan HP.

Referensi: Material 3 Expressive (aksen ketiga, gerak pegas, satu–dua "hero moment" per layar), Liquid Glass iOS 26 (kaca hanya untuk lapisan kontrol), palet tanah hangat 2026, dan pola gamifikasi Duolingo/Strava.

| Token | Terang | Gelap | Pakai untuk |
| --- | --- | --- | --- |
| `bg` | `#FFF7EF` | `#17100C` | Latar halaman (krem hangat / espresso) |
| `surface` | `#FFFFFF` | `#241912` | Kartu, input |
| `surface-2` | `#FFF1E6` | `#2E2018` | Latar lembut di dalam kartu, hover |
| `line` / `track` | `#F1E2D3` / `#F4E3D3` | `#3A2A20` | Garis, alur progress bar |
| `line-strong` | `#D9C3B0` | `#5A4436` | Border input dan tombol garis |
| `glass` | putih krem 70% | espresso 68% | Navigasi bawah melayang (dengan blur) |
| `fg` | `#2A1A14` | `#FFF3E8` | Teks utama (cokelat tua / krem) |
| `fg-label` / `fg-soft` / `fg-muted` | `#45322A` / `#6E5A4E` / `#8A7466` | `#F0DDCD` / `#CDB6A4` / `#A8907E` | Label, teks sekunder, teks redup |
| `primary` | `#E2622F` | sama | Tombol utama (oranye terakota), tepi 3D `primary-press` `#B8471C` |
| `primary-tint` | `#FFE7D8` | `#3B2417` | Latar oranye muda, menu aktif |
| `link` | `#C2501F` | `#FF9A6B` | Tautan |
| `sun` | `#FFB938` | sama | Aksen kedua: cincin XP, juara 1, streak |
| `gold-from` → `gold-to` | `#FFF0C2` → `#FFC85C` | `#4D3611` → `#8A5B10` | Kartu poin (teks `on-gold`) |
| `berry` / `berry-tint` | `#C2375F` / `#FCE4EC` | `#FF7AA2` / `#3D1A26` | Aksen ketiga: tantangan, hitung mundur, hadiah |
| `success` (= `xp`) | `#2B8A63` | `#4CC08E` | Sukses, XP |
| `points` | `#B06A00` | `#FFC85C` | Angka poin |
| `warn` / `info` / `danger` | `#8A5A00` / `#1F6A94` / `#B42318` | `#FFC85C` / `#7CC4EE` / `#FF8A80` | Status (masing-masing punya `-tint`) |
| `hero-from` → `hero-via` → `hero-to` | `#FF9A3D` → `#E2622F` → `#C2375F` | sama | Gradien senja kartu level (satu-satunya hero di layar) |
| `silver` / `bronze` | `#A9A39C` / `#C9814E` | sama | Podium peringkat 2 dan 3 |
| `merchant` / `komunitas` / `warga` | `#F06A2A` / `#0F8B6D` / `#2D4FCF` | sama | Warna tiga pihak di logo dan label pihak |

Warna irisan (`#7E7A2C`, `#9A4E80`, `#1A6AA6`) hanya untuk logo dan ilustrasi, bukan UI.
Teks di atas warna status (`success`, `danger`, `berry`) memakai `text-bg` supaya tetap kontras di dua tema.

### 2b. Warna materi cetak dan presentasi (latar terang, v1.0)

`cream #FAF7F2` (latar), `ink #17212B` (teks, tombol), `ink-soft #4A5560`, `line #E4DED3`, `merchant-text #B8481A`, `merchant-tint #FDE9DF`, `komunitas-text #0B6E57`, `komunitas-tint #E2F3EE`, `warga-tint #E6EBFB`, `danger #B42318`, `danger-tint #FBEDEB`. Porsi: sekitar 60% krem/putih, 25% tinta, 15% tiga warna pihak.

## 3. Tipografi

Dua keluarga dari Google Fonts (variable font, dipasang di `app/layout.tsx`):

- **Bricolage Grotesque** untuk judul dan angka besar: kelas Tailwind `font-display`. Grotesk ekspresif sesuai tren 2026, tegas dan menantang.
- **Figtree** untuk teks lain: bawaan `font-sans`. Huruf kecil tinggi, jelas di layar kecil.

Ukuran dasar 16 px. Skala sengaja bervariasi supaya mata langsung tertuju ke yang penting:

| Gaya | Font | Ukuran | Bobot | Catatan |
| --- | --- | --- | --- | --- |
| angka hero | Bricolage | 34–42 | 800 | poin, level; `tabular-nums` |
| title | Bricolage | 24–28 | 700–800 | judul layar, nama level |
| section | Bricolage | 22 | 700 | judul bagian ("Misi Hari Ini") |
| body | Figtree | 15–16 / 1.5 | 400–700 | isi, judul kartu |
| caption | Figtree | 13–14 | 500–700 | keterangan, chip |
| label kapital | Figtree | 12 | 800 | label kartu skor, letter-spacing 0.05em |
| nav | Figtree | 12 | 700 | navigasi bawah |

## 4. Elemen UI

- **Ikon + teks** di setiap tombol dan menu; jangan ikon saja.
- **Ikon**: Phosphor Icons (`@phosphor-icons/react`, lewat komponen `Icon` di `components/icons.tsx`). `regular` untuk menu biasa, `fill` untuk menu aktif dan ikon di kotak berwarna, `bold` untuk tombol kecil. Ikon penting diletakkan di kotak bulat 28–56 px berwarna `*-tint`.
- **Tombol utama 3D**: tinggi minimal 54 px, sudut 16 px, latar `primary`, tepi bawah 4 px `primary-press` (kelas `.btn-3d`), turun dan memantul saat ditekan (`ease-spring`). Kelas siap pakai: `buttonStyles` dan `smallButton` di `components/styles.ts`.
- **Kartu**: sudut 24 px, latar `surface`, border `line`, bayangan hangat `shadow-card`. Bento boleh asimetris (satu sudut lebih kecil).
- **Kartu level**: sudut 30 px, gradien senja `hero`, cincin progres `sun`, chip putih transparan.
- **Navigasi bawah**: pil kaca melayang (`NavShell` di `components/nav-shell.tsx`), mengecil saat digulir ke bawah. Menu aktif berlatar `primary-tint`, tombol Scan oranye 3D.
- **Bottom sheet**: detail misi muncul dari bawah (`app/(warga)/daily-missions.tsx`), tombol aksi dalam jangkauan jempol.
- **Animasi**: kartu muncul dengan pegas (`animate-pop`); semua animasi mati bila HP diatur "kurangi gerakan".
- **Input**: tinggi 52 px, sudut 16 px, fokus `primary` dengan cincin.
- **Target sentuh** minimal 48 × 48 px.

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
- Font: `app/layout.tsx` (`Figtree` → `--font-figtree`, `Bricolage_Grotesque` → `--font-bricolage`).
- PWA: `app/manifest.ts` dengan `background_color` dan `theme_color` `#FFF7EF`; `themeColor` di `app/layout.tsx` mengikuti tema HP.
- Komponen dasar: `components/ui.tsx` (Logo, SubmitButton, ErrorMessage, GoogleIcon), `components/styles.ts` (kelas tombol, input, kartu, tombol Kembali), `components/otp-input.tsx`, `components/bottom-nav.tsx`.

Taruh `favicon.ico` di `app/`, `apple-touch-icon-180.png` sebagai `app/apple-icon.png`, ikon PNG di `public/icons/`, dan SVG logo di `public/brand/`.
