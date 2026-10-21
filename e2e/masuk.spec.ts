import { expect, test } from "@playwright/test";
import { ACCOUNTS, PASSWORD } from "./helpers";

// Halaman masuk, daftar, dan lupa kata sandi. Tidak membuat akun baru, jadi aman diulang.
test.describe("masuk dengan kata sandi", () => {
  test("akun dummy bisa masuk dengan email dan kata sandi", async ({ page }) => {
    await page.goto("/masuk?next=/profil");
    await page.getByLabel("Email").fill(ACCOUNTS.warga);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/profil$/);
    await expect(page.getByRole("link", { name: "Kata sandi" })).toBeVisible();
  });

  test("kata sandi salah menampilkan pesan", async ({ page }) => {
    await page.goto("/masuk");
    await page.getByLabel("Email").fill(ACCOUNTS.warga);
    await page.locator("#password").fill("bukan-kata-sandinya");
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page.getByText("Email atau kata sandi salah")).toBeVisible();
    await expect(page).toHaveURL(/\/masuk/);
  });

  test("daftar menolak kata sandi yang tidak sama", async ({ page }) => {
    await page.goto("/masuk/daftar");
    await page.getByLabel("Email").fill("warga-baru@contoh.id");
    await page.locator("#password").fill("rahasia-123");
    await page.locator("#password_confirm").fill("rahasia-456");
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page.getByText("belum sama")).toBeVisible();
  });

  test("halaman lupa kata sandi dan kode email bisa dibuka", async ({ page }) => {
    await page.goto("/masuk/lupa");
    await expect(page.getByRole("heading", { name: "Lupa kata sandi" })).toBeVisible();
    await page.goto("/masuk?cara=kode");
    await expect(page.getByRole("button", { name: "Kirim kode masuk" })).toBeVisible();
  });
});
