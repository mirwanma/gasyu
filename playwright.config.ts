import { readFileSync, existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Uji browser (E2E) terhadap aplikasi yang berjalan dan project Supabase
// yang berisi data dummy (lihat dummy-data/README.md). Semua uji hanya
// membaca data, tidak mengubah apa pun, jadi aman diulang.
//
// Cara menjalankan:
//   npm run build
//   npx playwright install chromium   # sekali saja di laptop
//   npm run e2e

// Baca NEXT_PUBLIC_SUPABASE_* dari .env.local bila belum ada di lingkungan.
if (existsSync(".env.local")) {
  for (const line of readFileSync(".env.local", "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
  }
}

const PORT = Number(process.env.E2E_PORT ?? 3100);
const BASE_URL = process.env.E2E_BASE_URL ?? `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    // Lingkungan tertentu (mis. sesi cloud) memakai Chromium yang sudah terpasang.
    launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
  },
  projects: [
    { name: "hp", use: { ...devices["Pixel 7"], browserName: "chromium" } },
  ],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: `npx next start -p ${PORT}`,
        url: `${BASE_URL}/offline`,
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
