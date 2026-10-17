# CLAUDE.md — Gasyu (Platform Gamifikasi Kota, Pilot Cimahi)

Panduan kerja untuk Claude di proyek ini. Baca seluruh file ini di awal setiap sesi.

**Sumber kebenaran** (baca bagian yang relevan sebelum menulis kode):

- `docs/ALUR-SISTEM.md` — alur, peran, aturan bisnis (v0.8)
- `docs/DESAIN-DATABASE.md` — tabel, enum, fungsi, RLS, urutan migrasi (v0.8)
- `docs/BRAND.md` — warna, tipografi, logo, gaya bahasa
- PRD (PDF milik pemilik proyek, tidak disimpan di repo)

Jika `CLAUDE.md` dan dokumen di `docs/` berbeda, ikuti `docs/` dan beri tahu pemilik proyek supaya file ini diperbarui.

## Ringkasan produk

Gasyu adalah platform gamifikasi kota sebagai alat marketing bergamifikasi untuk merchant/UMKM dan komunitas lokal.
Merchant dan komunitas (disebut bersama **penyelenggara**) membuat event atau challenge, sendiri atau berkolaborasi, lengkap dengan misi.
Warga ikut, check-in via QR, mengerjakan misi, dapat XP (status) dan poin (ditukar voucher merchant), dan kelurahannya bersaing di leaderboard.
Admin (tim Gasyu) memverifikasi, memoderasi, dan bisa membuat event atas nama Gasyu.
Pilot: Kota Cimahi (3 kecamatan, 15 kelurahan). Struktur wilayah harus generik untuk kota lain.

## Stack

- Next.js 16 (App Router) + TypeScript (strict). **Next.js 16 berbeda dari versi lama**: middleware sekarang `proxy.ts`. Baca `node_modules/next/dist/docs/` sebelum memakai API yang belum pasti.
- Supabase: Postgres, Auth, Storage, Row Level Security, pg_cron. Library `@supabase/ssr`.
- Tailwind CSS v4 (token di `app/globals.css`)
- PWA (manifest + service worker), mobile-first. Dashboard admin desktop-first.
- Hosting: Vercel
- Bahasa antarmuka: Bahasa Indonesia. Kode, nama tabel, dan nama variabel: bahasa Inggris.
- Brand dan UI: ikuti `docs/BRAND.md` (warna, tipografi, logo, gaya bahasa). Jangan membuat warna atau font di luar token di sana.

## Istilah domain (pakai nama ini secara konsisten)

| Istilah di aplikasi | Arti | Nama di kode |
| --- | --- | --- |
| Wilayah | kota / kecamatan / kelurahan | `regions` (`level`: city, district, village) |
| Penyelenggara | induk bersama merchant dan komunitas; kata "organizer" tidak tampil di UI | `organizers` (`type`: merchant, community, platform) |
| Merchant/UMKM | usaha apa pun; punya outlet, budget poin, voucher, mode kasir | `merchant_profiles`, `merchant_outlets` |
| Komunitas | komunitas apa pun; tanpa budget poin, punya member | `community_profiles`, `community_memberships` |
| Tim | pengelola dashboard (owner/staff atau chair/officer) | `organizer_members` |
| Aktivitas | event atau challenge | `activities` (`type`: event, challenge) |
| Misi | tugas di dalam aktivitas | `activity_missions`, `mission_completions` |
| Master misi | template misi dari admin, disalin saat dipakai | `mission_templates` |
| Partner | penyelenggara dalam aktivitas | `activity_partners` (`role`: host, cohost, sponsor) |
| Open call | tawaran kolaborasi atau sponsor | `collab_posts`, `collab_applications` |
| Checkpoint | lokasi check-in milik partner | `activity_checkpoints` |
| Partisipasi | warga ikut aktivitas, pribadi atau lewat grup | `participations` |
| Grup | 2–10 warga yang join bersama | `groups`, `group_members` |
| XP | poin status, tidak bisa ditukar | `xp_ledger` |
| Poin | mata uang reward, dari budget merchant | `point_ledger`, `point_allocations` |
| Reward / voucher | hadiah dari merchant | `rewards`, `redemptions` |
| Event Gasyu | event buatan admin, host organizer `platform` | `organizers.type = 'platform'` |
| Saran | saran warga untuk merchant/komunitas, dibalas tim | `suggestions` |

## Aturan yang tidak boleh dilanggar

1. **Akses ditegakkan di database.** Setiap tabel baru wajib punya RLS policy di migrasi yang sama. Jangan pernah mengandalkan pengecekan di UI saja.
2. **XP dan poin hanya ditulis oleh server** (fungsi database `security definer` yang dipanggil dari server action), tidak pernah dari client.
3. **Saldo dihitung dari ledger.** Ledger hanya insert; koreksi berupa baris negatif. Jangan menyimpan kolom saldo.
4. **Dua mata uang terpisah.** XP tidak pernah bisa ditukar. Poin hanya diberikan jika budget poin partner merchant masih cukup. Komunitas dan Gasyu tidak punya budget poin sendiri.
5. **Anti-curang:** satu check-in per aktivitas per warga per hari (WIB); maksimal 1.000 XP per warga per hari; QR check-in dan QR misi berganti tiap 60 detik; di luar radius checkpoint (150 m) dicatat dengan flag; kode misi maks. 5 percobaan per 15 menit; XP misi 10–100, total maks. 500 per aktivitas.
6. **Privasi:** partner hanya melihat identitas peserta yang check-in di checkpoint miliknya; data warga lain hanya `nickname`, tidak pernah `full_name`; bukti bayar dan foto misi di bucket privat.
7. **Aktivitas penyelenggara selalu melalui persetujuan admin** sebelum `published`. Pengecualian: event Gasyu (host `platform`) langsung `published` saat diajukan admin.
8. **Pembayaran di luar aplikasi.** Aktivitas boleh berbayar, tetapi Gasyu hanya mencatat harga dan `payment_status` yang dikonfirmasi manual. Jangan menambahkan payment gateway.
9. **Warga luar Cimahi** boleh mendaftar (`home_village_id` NULL). Mereka dapat XP dan poin, tidak dihitung di leaderboard kelurahan, dan tidak lolos aktivitas `residents_only`.
10. **Zona waktu tunggal:** semua batas harian dan bulanan memakai `Asia/Jakarta`.
11. **Merchant dan komunitas dipisah** di UI, registrasi, peran tim, dan dashboard. Cek tipe penyelenggara di server dan RLS, bukan hanya menyembunyikan tombol.
12. **Angka aturan main** dibaca dari `app_settings`, jangan di-hardcode di banyak tempat.

Aturan rinci (kolaborasi, grup, misi, keanggotaan, domisili, berbayar, leaderboard) ada di `docs/ALUR-SISTEM.md`. Jangan menebak; baca bagiannya.

## Cara bekerja di proyek ini

- Kerjakan **satu irisan per sesi** sesuai urutan di `docs/DESAIN-DATABASE.md` bagian 9. Jangan mengerjakan fitur di luar irisan yang diminta.
- Sebelum menulis kode, tampilkan rencana singkat: file yang akan dibuat/diubah, migrasi, dan cara mengujinya. Tunggu persetujuan.
- Perubahan database selalu lewat file migrasi di `supabase/migrations/` (buat dengan `npx supabase migration new <nama>`), tidak lewat dashboard Supabase. Sertakan uji SQL di `supabase/tests/` untuk aturan yang tidak boleh dilanggar.
- Setelah selesai: jalankan `npm run lint` dan `npm run build`, lalu jelaskan cara menguji di HP dan apa yang perlu dicek pemilik proyek.
- Jika ada aturan bisnis yang tidak jelas, tanyakan dulu; jangan menebak.
- Jaga komponen kecil dan mudah dibaca. Pemilik proyek bukan programmer penuh waktu, jadi jelaskan dengan bahasa sederhana.
- Commit kecil dengan pesan jelas dalam bahasa Indonesia. Jangan pernah commit `.env.local` atau kunci rahasia (terutama `service_role`).

## Perintah

```bash
npm run dev                      # jalankan di http://localhost:3000
npm run lint                     # cek kode
npm run build                    # cek build produksi
PGHOST=localhost PGUSER=postgres supabase/tests/run.sh   # semua uji SQL di Postgres lokal (database dibuat ulang)
npx supabase login               # sekali saja
npx supabase link --project-ref <ref>   # hubungkan ke project Supabase
npx supabase migration new <nama>       # buat file migrasi
npx supabase db push             # terapkan migrasi ke project Supabase
npx supabase gen types typescript --linked > lib/supabase/database.types.ts   # ulangi setiap ada migrasi baru
```

## Struktur folder (target)

```
app/                  # route Next.js
  (warga)/            # beranda, jelajah, aktivitas, scan, dompet, grup, peringkat, profil
  merchant/[id]/      # dashboard merchant
  komunitas/[id]/     # dashboard komunitas
  admin/              # dashboard admin (admin.gasyu.id)
  masuk/, onboarding/
components/
lib/
  supabase/           # client.ts (browser), server.ts, proxy.ts (sesi), database.types.ts (otomatis), types.ts
  gamification/       # helper tampilan XP, level, badge (aturan tetap di database)
proxy.ts              # pengganti middleware: refresh sesi, wajib onboarding
supabase/
  migrations/
  tests/
  seed.sql            # data wilayah Cimahi, levels, badges, app_settings
docs/
```

## Urutan build

Ikuti `docs/DESAIN-DATABASE.md` bagian 9 (irisan 1–11).

Irisan saat ini: **selesai (1–11)** + saran warga (0014), akun warga (0015), peran tim (0016), foto profil (0017), master misi (0018) — pemolesan, E2E, dan rilis pilot — perbarui baris ini setiap pindah irisan.
