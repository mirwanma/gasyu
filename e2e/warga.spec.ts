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

  test("jelajah: kota warga terpilih otomatis dan bisa diganti ke semua kota", async ({ page }) => {
    await open(page, "/jelajah");
    await page.locator("summary", { hasText: "Kota Cimahi" }).click();
    await page.getByRole("navigation", { name: "Pilih kota" }).getByRole("link", { name: "Semua kota" }).click();
    await expect(page).toHaveURL(/kota=semua/);
    await expect(page.locator("summary", { hasText: "Semua kota" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Cimahi Night Run 5K/ }).first()).toBeVisible();
    // Pilihan kota ikut terbawa saat pindah filter
    await page.getByRole("link", { name: "Event", exact: true }).click();
    await expect(page).toHaveURL(/filter=event.*kota=semua|kota=semua.*filter=event/);
  });

  test("Event Global: tab Jelajah, halaman event, papan peringkat", async ({ page }) => {
    await open(page, "/jelajah");
    await expect(page.getByRole("link", { name: /Lomba Foto Wisata Cimahi/ })).toHaveCount(0);
    await open(page, "/jelajah?filter=global");
    await page.getByRole("link", { name: /Lomba Foto Wisata Cimahi/ }).first().click();
    await expect(page.getByRole("heading", { name: "Lomba Foto Wisata Cimahi" })).toBeVisible();
    await expect(page.getByText("+200 skor")).toBeVisible();
    await expect(page.getByText("Kamera mirrorless + medali").first()).toBeVisible();
    await expect(page.getByText(/^Posisi$/)).toBeVisible();
    await page.getByRole("link", { name: "Lihat papan peringkat" }).click();
    await expect(page.getByText("Papan peringkat", { exact: true })).toBeVisible();
    await expect(page.getByText("Live", { exact: true })).toBeVisible();
    await expect(page.getByText("vina").first()).toBeVisible();
  });

  test("Event Global: hadiah juara tampil di halaman Hadiah dan beranda", async ({ page }) => {
    // Rani juara 1 (data dummy). Pemilik proyek boleh mencoba klaim di HP, jadi uji ini menerima
    // dua keadaan: belum diklaim (formulir alamat + kartu di Beranda) atau sudah diklaim.
    await open(page, "/hadiah");
    await expect(page.getByText("Tumbler + kaos HUT Cimahi")).toBeVisible();
    const pending = (await page.getByText("Perlu diklaim").count()) > 0;
    if (pending) {
      await expect(page.getByLabel("Alamat lengkap")).toBeVisible();
      await expect(page.getByRole("button", { name: "Klaim hadiah" })).toBeVisible();
    } else {
      await expect(page.getByText(/Sedang diproses|Sudah diterima/).first()).toBeVisible();
    }
    const href = await page.getByRole("link", { name: "Tantangan Online HUT Cimahi" }).getAttribute("href");
    await open(page, href!);
    await expect(page.getByText("Final", { exact: true })).toBeVisible();
    await open(page, "/");
    await expect(page.getByRole("link", { name: /Hadiah perlu diklaim/ })).toHaveCount(pending ? 1 : 0);
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
