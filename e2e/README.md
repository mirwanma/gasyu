# Uji browser (E2E)

Uji ini membuka aplikasi seperti pengguna sungguhan (warga, pemilik merchant,
ketua komunitas, admin) dan memastikan halaman terbuka tanpa error serta aturan
akses berjalan. Semua uji **hanya membaca data**, jadi aman dijalankan berulang
di project yang berisi data dummy.

## Syarat

- `.env.local` berisi `NEXT_PUBLIC_SUPABASE_URL` dan `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
- Data dummy sudah dipasang (lihat `dummy-data/README.md`).

## Menjalankan

```bash
npm run build
npx playwright install chromium   # sekali saja
npm run e2e
```

Server dijalankan otomatis di port 3100. Untuk menguji situs yang sudah online,
isi `E2E_BASE_URL`, misalnya `E2E_BASE_URL=https://alamat-situs npm run e2e`.

Uji ini tidak dijalankan di GitHub Actions karena butuh project Supabase dan data dummy.
