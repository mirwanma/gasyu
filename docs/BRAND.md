# Ramein — Brand Identity v1.0

Panduan brand untuk desain dan pengembangan aplikasi. Simpan di repo sebagai `docs/BRAND.md`, lalu tambahkan satu baris ini ke `CLAUDE.md` di bagian Stack:

> Brand dan UI: ikuti `docs/BRAND.md` (warna, tipografi, logo, gaya bahasa). Jangan membuat warna atau font di luar token di sana.

## 1. Logo

**Konsep: Irisan Bersama.** Tiga lingkaran mewakili tiga pihak. Bagian yang beririsan adalah keuntungan yang dibagi dua pihak, dan titik di tengah adalah Ramein, tempat ketiganya bertemu dan saling menguntungkan.

| Lingkaran | Pihak | Posisi |
| --- | --- | --- |
| Oranye | Merchant | Atas |
| Hijau | Komunitas | Kiri bawah |
| Biru | Warga | Kanan bawah |

Posisi dan warna lingkaran tidak boleh ditukar.

**File** (`logo/`)

| File | Pakai untuk |
| --- | --- |
| `svg/ramein-logo-horizontal.svg` | Logo utama: header web, dokumen, presentasi |
| `svg/ramein-logo-horizontal-gelap.svg` | Di atas latar gelap (tinta) |
| `svg/ramein-logo-bertumpuk.svg` | Poster, standee, layar pembuka |
| `svg/ramein-simbol.svg` · `svg/ramein-simbol-gelap.svg` | Avatar, stiker, ruang sempit |
| `svg/ramein-logo-satu-warna.svg` | Stempel, sablon, cetak satu warna |
| `svg/ramein-ikon-app.svg` · `png/ramein-ikon-512.png` · `png/ramein-ikon-192.png` | Ikon PWA (`purpose: any`) |
| `svg/ramein-ikon-maskable.svg` · `png/ramein-ikon-maskable-512.png` | Ikon PWA (`purpose: maskable`) |
| `png/apple-touch-icon-180.png` | Ikon iOS |
| `favicon.ico` · `svg/ramein-favicon.svg` | Favicon (versi tanpa titik tengah, tetap jelas di 16–32 px) |

Wordmark di semua file sudah berupa outline, jadi tampil sama walau font belum terpasang.

**Aturan**

- Ruang kosong minimal setengah lebar simbol di semua sisi.
- Ukuran minimum: logo horizontal 96 px layar / 25 mm cetak; simbol 24 px / 8 mm. Di bawah 32 px pakai favicon.
- Jangan memutar, menggepengkan, mengganti warna, menukar posisi lingkaran, mengganti huruf wordmark, atau menambah bayangan dan gradien.
- Wordmark selalu huruf kecil: **ramein**. Dalam kalimat, tulis nama sebagai "Ramein".

## 2. Warna

| Token | Hex | Pakai untuk |
| --- | --- | --- |
| `merchant` | `#F06A2A` | Aksen merchant, poin, voucher. Teks di atasnya selalu `ink` |
| `merchant-text` | `#B8481A` | Teks oranye di latar terang (kontras ≥ 4.5:1) |
| `merchant-tint` | `#FDE9DF` | Latar label/kartu merchant dan poin |
| `komunitas` | `#0F8B6D` | Aksen komunitas, status sukses. Teks putih di atasnya hanya untuk teks tebal ≥ 18 px |
| `komunitas-text` | `#0B6E57` | Teks hijau di latar terang |
| `komunitas-tint` | `#E2F3EE` | Latar label komunitas, pesan sukses |
| `warga` | `#2D4FCF` | XP, level, peringkat, tautan |
| `warga-tint` | `#E6EBFB` | Latar label XP |
| `ink` | `#17212B` | Teks utama, tombol utama, latar gelap |
| `ink-soft` | `#4A5560` | Teks sekunder |
| `line` | `#E4DED3` | Garis dan border kartu |
| `cream` | `#FAF7F2` | Latar halaman |
| `white` | `#FFFFFF` | Kartu, permukaan |
| `danger` | `#B42318` | Error, aksi berbahaya |
| `danger-tint` | `#FBEDEB` | Latar pesan error |

Versi untuk latar gelap: `merchant #F47B42`, `komunitas #1FB08D`, `warga #5B78E6`.
Warna irisan (`#7E7A2C`, `#9A4E80`, `#1A6AA6`) hanya untuk logo dan ilustrasi, bukan UI.

Porsi: sekitar 60% krem/putih, 25% tinta, 15% tiga warna pihak.

## 3. Tipografi

Satu keluarga: **Plus Jakarta Sans** (Google Fonts, bobot 400, 500, 600, 800).

| Gaya | Ukuran / baris | Bobot | Catatan |
| --- | --- | --- | --- |
| display | 40 / 44 | 800 | letter-spacing -0.03em |
| title | 24 / 30 | 800 | |
| subtitle | 17 / 24 | 600 | |
| body | 15 / 22 | 400 | |
| caption | 13 / 18 | 500 | warna `ink-soft` |
| label | 12 / 16 | 600 | huruf kapital, letter-spacing 0.08em |
| number | 32 | 800 | `font-variant-numeric: tabular-nums` untuk XP, poin, peringkat |

## 4. Elemen UI

- **Tombol**: tinggi 48 px, sudut penuh (`rounded-full`). Utama: latar `ink`, teks `cream`. Sekunder: garis 1.5 px `ink`.
- **Kartu**: sudut 16 px, border `line`, tanpa bayangan.
- **Label/chip**: sudut penuh, latar `*-tint`, teks `*-text`.
- **Ikon**: garis 2 px, ujung membulat (gaya Lucide).
- **Target sentuh** minimal 44 × 44 px.
- **Level/badge**: lingkaran dengan cincin `warga`, angka level di tengah.

## 5. Gaya bahasa

- **Akrab**: pakai "kamu", kalimat pendek, boleh santai.
- **Bersemangat**: rayakan langkah kecil tanpa tanda seru berlebihan.
- **Jujur**: angka dan aturan jelas, tidak menjanjikan yang tidak pasti.

| Pakai | Hindari |
| --- | --- |
| Mantap! Kamu dapat 100 XP. Tinggal 2 kedai lagi buat voucher. | Selamat!!! Anda telah berhasil memperoleh poin pengalaman. |
| QR ini sudah kedaluwarsa. Minta staf tampilkan yang baru, ya. | Error 403: token tidak valid. |

Tagline: **Bikin kota makin rame, bareng-bareng.**

## 6. Kode siap pakai

**`app/globals.css`** (Tailwind v4)

```css
@import "tailwindcss";

@theme {
  --font-sans: "Plus Jakarta Sans", ui-sans-serif, system-ui, sans-serif;

  --color-merchant: #F06A2A;
  --color-merchant-text: #B8481A;
  --color-merchant-tint: #FDE9DF;
  --color-komunitas: #0F8B6D;
  --color-komunitas-text: #0B6E57;
  --color-komunitas-tint: #E2F3EE;
  --color-warga: #2D4FCF;
  --color-warga-tint: #E6EBFB;
  --color-ink: #17212B;
  --color-ink-soft: #4A5560;
  --color-line: #E4DED3;
  --color-cream: #FAF7F2;
  --color-danger: #B42318;
  --color-danger-tint: #FBEDEB;

  --radius-card: 16px;
}

body {
  background: var(--color-cream);
  color: var(--color-ink);
  font-family: var(--font-sans);
}
```

**`app/layout.tsx`** (font)

```tsx
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "800"],
  variable: "--font-sans",
});
// <html lang="id" className={jakarta.variable}>
```

**`app/manifest.ts`** (PWA)

```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Ramein",
    short_name: "Ramein",
    description: "Bikin kota makin rame, bareng-bareng.",
    start_url: "/",
    display: "standalone",
    background_color: "#FAF7F2",
    theme_color: "#17212B",
    icons: [
      { src: "/icons/ramein-ikon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/ramein-ikon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/ramein-ikon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
```

Taruh `favicon.ico` di `app/`, `apple-touch-icon-180.png` sebagai `app/apple-icon.png`, ikon PNG di `public/icons/`, dan SVG logo di `public/brand/`.
