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

  test("master misi menampilkan template awal", async ({ page }) => {
    await open(page, "/admin/misi");
    await expect(page.getByRole("heading", { name: "Master misi" })).toBeVisible();
    await expect(page.getByText("Mampir ke booth atau outlet")).toBeVisible();
  });
});
