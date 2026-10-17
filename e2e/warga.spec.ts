import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, open } from "./helpers";

// Halaman utama warga (akun rani). Hanya membaca, tidak mengirim apa pun.
test.describe("warga", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await loginAs(context, ACCOUNTS.warga, baseURL!);
  });

  test("beranda menampilkan XP, dompet, dan aktivitasku", async ({ page }) => {
    await open(page, "/");
    await expect(page.getByLabel("Level dan XP")).toBeVisible();
    await expect(page.getByText("Saldo poin")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Aktivitasku" })).toBeVisible();
  });

  test("jelajah menampilkan aktivitas yang terbit", async ({ page }) => {
    await open(page, "/jelajah");
    await expect(page.getByRole("link", { name: /Cimahi Night Run 5K/ }).first()).toBeVisible();
  });

  test("halaman akun dan dompet terbuka", async ({ page }) => {
    for (const path of ["/dompet", "/peringkat", "/riwayat", "/riwayat?tab=poin", "/saran", "/komunitas-saya", "/notifikasi", "/grup", "/bantuan", "/profil/ubah"]) {
      await open(page, path);
    }
  });

  test("menu profil lengkap", async ({ page }) => {
    await open(page, "/profil");
    for (const label of ["Ubah profil", "Riwayat XP & poin", "Notifikasi", "Grup saya", "Komunitas saya", "Saran saya", "Peringkat", "Bantuan"]) {
      await expect(page.getByRole("navigation", { name: "Menu profil" }).getByRole("link", { name: label })).toBeVisible();
    }
  });

  test("profil publik merchant menampilkan formulir saran", async ({ page }) => {
    await open(page, "/m/kopi-lereng");
    await expect(page.getByRole("heading", { name: "Kopi Lereng" })).toBeVisible();
    await expect(page.getByText("Kasih saran")).toBeVisible();
  });

  test("saran saya menampilkan balasan penyelenggara", async ({ page }) => {
    await open(page, "/saran");
    await expect(page.getByText(/Balasan (Kopi Lereng|Cimahi Runners)/).first()).toBeVisible();
  });
});
