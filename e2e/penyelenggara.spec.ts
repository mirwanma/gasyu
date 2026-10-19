import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, open, organizerHref } from "./helpers";

// Dashboard merchant (pemilik Kopi Lereng) dan komunitas (ketua Cimahi Runners).
test.describe("penyelenggara", () => {
  test("pemilik merchant membuka semua menu dashboard", async ({ page, context, baseURL }) => {
    await loginAs(context, ACCOUNTS.pemilikMerchant, baseURL!);
    const base = await organizerHref(page, "merchant");
    for (const sub of ["", "/aktivitas", "/qr", "/kasir", "/lainnya", "/tim", "/reward", "/outlet", "/kolaborasi", "/saran", "/profil"]) {
      await open(page, base + sub);
    }
    await open(page, base + "/lainnya");
    for (const label of ["Tim", "Reward & budget poin", "Kasir", "Kolaborasi"]) {
      await expect(page.getByRole("main").getByRole("link", { name: label, exact: true })).toBeVisible();
    }
    await expect(page.getByRole("main").getByRole("link", { name: /^Saran warga/ })).toBeVisible();
  });

  test("hadiah yang disponsori tampil tanpa identitas pemenang", async ({ page, context, baseURL }) => {
    await loginAs(context, ACCOUNTS.pemilikMerchant, baseURL!);
    await open(page, await organizerHref(page, "merchant"));
    await expect(page.getByRole("heading", { name: "Hadiah yang disponsori" })).toBeVisible();
    await expect(page.getByText("Tantangan Online HUT Cimahi")).toBeVisible();
    await expect(page.getByText(/#2 · (Perlu dikirim|Terkirim)/)).toBeVisible();
    // Privasi: nickname pemenang (vina) dan alamat tidak pernah tampil ke partner
    await expect(page.getByText("vina")).toHaveCount(0);
  });

  test("saran warga: saran tanpa nama tidak menampilkan identitas", async ({ page, context, baseURL }) => {
    await loginAs(context, ACCOUNTS.pemilikMerchant, baseURL!);
    const base = await organizerHref(page, "merchant");
    await open(page, base + "/saran?tab=semua");
    await expect(page.getByText("Tanpa nama").first()).toBeVisible();
  });

  test("ketua komunitas membuka dashboard dan member", async ({ page, context, baseURL }) => {
    await loginAs(context, ACCOUNTS.ketuaKomunitas, baseURL!);
    const base = await organizerHref(page, "komunitas");
    for (const sub of ["", "/aktivitas", "/member", "/lainnya", "/tim", "/saran"]) {
      await open(page, base + sub);
    }
  });
});
