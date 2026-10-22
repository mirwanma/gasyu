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

  test("cookie sesi tidak bisa dibaca JavaScript (HttpOnly)", async ({ page, context }) => {
    await page.goto("/masuk?next=/profil");
    await page.getByLabel("Email").fill(ACCOUNTS.warga);
    await page.locator("#password").fill(PASSWORD);
    await page.getByRole("button", { name: "Masuk", exact: true }).click();
    await expect(page).toHaveURL(/\/profil$/);
    const session = (await context.cookies()).filter((cookie) => cookie.name.startsWith("sb-"));
    expect(session.length).toBeGreaterThan(0);
    expect(session.every((cookie) => cookie.httpOnly && cookie.sameSite === "Lax")).toBe(true);
    expect(await page.evaluate(() => document.cookie)).not.toContain("sb-");
  });

  test("email dikunci setelah 5 kali kata sandi salah", async ({ page }) => {
    // Email acak yang tidak terdaftar, supaya akun dummy tidak ikut terkunci.
    const email = `terkunci-${Date.now()}@contoh.id`;
    await page.goto("/masuk");
    for (let attempt = 1; attempt <= 5; attempt++) {
      await page.getByLabel("Email").fill(email);
      await page.locator("#password").fill(`salah-${attempt}-xyz`);
      await page.getByRole("button", { name: "Masuk", exact: true }).click();
      const expected = attempt < 5 ? "Email atau kata sandi salah" : "Terlalu banyak percobaan";
      await expect(page.getByText(expected)).toBeVisible();
    }
  });

  test("form daftar: nama lengkap, email, kata sandi sekali", async ({ page }) => {
    await page.goto("/masuk/daftar");
    await expect(page.getByLabel("Nama lengkap")).toBeVisible();
    await expect(page.locator("#password_confirm")).toHaveCount(0);
    await page.getByRole("button", { name: "Lihat" }).click();
    await expect(page.locator("#password")).toHaveAttribute("type", "text");

    // Nama berisi spasi saja lolos cek browser, tapi ditolak validasi server (Zod).
    await page.getByLabel("Nama lengkap").fill("   ");
    await page.getByLabel("Email").fill("warga-baru@contoh.id");
    await page.locator("#password").fill("rahasia-123");
    await page.getByRole("button", { name: "Daftar" }).click();
    await expect(page.getByText("Nama lengkap belum diisi.")).toBeVisible();
    await expect(page.getByLabel("Email")).toHaveValue("warga-baru@contoh.id");
  });

  test("halaman lupa kata sandi dan kode email bisa dibuka", async ({ page }) => {
    await page.goto("/masuk/lupa");
    await expect(page.getByRole("heading", { name: "Lupa kata sandi" })).toBeVisible();
    await page.goto("/masuk?cara=kode");
    await expect(page.getByRole("button", { name: "Kirim kode masuk" })).toBeVisible();
  });
});
