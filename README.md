# Ramein

Platform gamifikasi kota — pilot Kota Cimahi. *Bikin kota makin rame, bareng-bareng.*

Stack: Next.js 16 (App Router) · TypeScript · Tailwind v4 · Supabase (Postgres, Auth, Storage, RLS) · PWA · Vercel.

## Dokumen

- [`CLAUDE.md`](CLAUDE.md) — aturan kerja untuk Claude Code
- [`docs/ALUR-SISTEM.md`](docs/ALUR-SISTEM.md) — alur dan aturan bisnis
- [`docs/DESAIN-DATABASE.md`](docs/DESAIN-DATABASE.md) — skema, fungsi, RLS, urutan migrasi
- [`docs/BRAND.md`](docs/BRAND.md) — identitas brand

## Mulai

```bash
npm install
cp .env.example .env.local   # isi URL dan publishable key Supabase
npm run dev
```

Lalu buka Claude Code di folder ini (`claude`) dan minta: "Mulai Irisan 1 sesuai CLAUDE.md".
