import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, open } from "./helpers";

// Dashboard admin (desktop-first, tapi tetap harus terbuka tanpa error).
test.describe("admin", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await loginAs(context, ACCOUNTS.admin, baseURL!);
  });

  test("semua halaman admin terbuka", async ({ page }) => {
    for (const path of ["/admin", "/admin/verifikasi", "/admin/aktivitas", "/admin/misi", "/admin/moderasi", "/admin/pembayaran", "/admin/pengguna", "/admin/pengaturan", "/admin/audit"]) {
      await open(page, path);
    }
  });

  test("Event Global: hadiah, misi skor, serta peringkat dan statistik", async ({ page }) => {
    await open(page, "/admin/aktivitas?tab=global");
    await page.getByRole("link", { name: /Lomba Foto Wisata Cimahi/ }).first().click();
    await expect(page.getByText(/Event Global · Online \+ di lokasi/)).toBeVisible();

    await page.getByRole("link", { name: "Kelola hadiah" }).click();
    await expect(page.getByRole("heading", { name: "Lomba Foto Wisata Cimahi" })).toBeVisible();
    await expect(page.getByText("Kamera mirrorless + medali")).toBeVisible();
    await expect(page.getByText("Hadiah dari Kopi Lereng", { exact: false })).toBeVisible();

    await page.getByRole("link", { name: "Kembali" }).click();
    await page.getByRole("link", { name: "Kelola misi event ini" }).click();
    await expect(page.getByText("+200 skor")).toBeVisible();
    await expect(page.getByText("1.000 / 5.000")).toBeVisible();

    await page.goto(page.url().replace("/misi?", "/peringkat?"));
    await expect(page.getByRole("heading", { name: "Papan peringkat" })).toBeVisible();
    await expect(page.getByText(/Live · \d+ peserta/)).toBeVisible();
    await expect(page.getByText("Kota Bandung", { exact: true }).first()).toBeVisible();
  });

  test("master misi menampilkan template awal", async ({ page }) => {
    await open(page, "/admin/misi");
    await expect(page.getByRole("heading", { name: "Master misi" })).toBeVisible();
    await expect(page.getByText("Mampir ke booth atau outlet")).toBeVisible();
  });
});
