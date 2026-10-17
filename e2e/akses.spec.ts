import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, organizerHref } from "./helpers";

// Aturan akses dasar: tanpa login, warga biasa, dan halaman publik PWA.
test.describe("akses", () => {
  test("tanpa login diarahkan ke halaman masuk", async ({ page }) => {
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/masuk\?next=/);
    await expect(page.getByRole("heading", { name: /Ramaikan kotamu/ })).toBeVisible();
  });

  test("aset PWA dan halaman offline bisa dibuka tanpa login", async ({ request }) => {
    for (const path of ["/manifest.webmanifest", "/sw.js", "/offline", "/icons/gasyu-ikon-192.png"]) {
      const res = await request.get(path);
      expect(res.status(), path).toBe(200);
    }
    const manifest = await (await request.get("/manifest.webmanifest")).json();
    expect(manifest.name).toBe("Gasyu");
  });

  test("warga biasa tidak bisa membuka dashboard admin", async ({ page, context, baseURL }) => {
    await loginAs(context, ACCOUNTS.warga, baseURL!);
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/profil\?akses=admin/);
  });

  test("warga biasa tidak bisa membuka dashboard merchant orang lain", async ({ page, context, baseURL }) => {
    // Ambil alamat dashboard Kopi Lereng dari akun pemiliknya, lalu buka sebagai warga lain.
    await loginAs(context, ACCOUNTS.pemilikMerchant, baseURL!);
    const href = await organizerHref(page, "merchant");
    await context.clearCookies();
    await loginAs(context, ACCOUNTS.wargaLain, baseURL!);
    await page.goto(href);
    await expect(page).toHaveURL(/\/profil\?akses=ditolak/);
  });
});
