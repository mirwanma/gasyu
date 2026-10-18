import { expect, test } from "@playwright/test";
import { ACCOUNTS, loginAs, open } from "./helpers";

// Keluar dari semua perangkat (ALUR bagian 3), ganti bukti bayar dan chat panitia (ALUR bagian 8).
test.describe("akun dan pembayaran", () => {
  test("keluar dari semua perangkat meminta konfirmasi lalu kembali ke halaman masuk", async ({ context, page, baseURL }) => {
    await loginAs(context, ACCOUNTS.wargaKeluarSemua, baseURL!);
    await open(page, "/profil");
    await page.getByRole("button", { name: "Keluar dari semua perangkat" }).click();
    await expect(page.getByText(/Semua HP dan browser yang memakai akun ini akan keluar/)).toBeVisible();
    await page.getByRole("button", { name: "Batal" }).click();
    await page.getByRole("button", { name: "Keluar dari semua perangkat" }).click();
    await page.getByRole("button", { name: "Ya, keluar dari semua" }).click();
    await page.waitForURL(/\/masuk\?akun=keluar-semua/);
    await expect(page.getByRole("status")).toContainText("Kamu sudah keluar dari semua perangkat");
    await page.goto("/profil");
    await expect(page).toHaveURL(/\/masuk/);
  });

  test("bukti bayar yang menunggu konfirmasi bisa diganti dan panitia bisa dihubungi", async ({ context, page, baseURL }) => {
    await loginAs(context, ACCOUNTS.wargaMenungguBayar, baseURL!);
    await open(page, "/jelajah");
    await page.getByRole("link", { name: /Cimahi Night Run 5K/ }).first().click();
    await page.waitForLoadState("networkidle");
    const bayar = page.locator("#bayar");
    await expect(bayar).toContainText("Bukti bayar sedang dicek panitia");
    await expect(bayar.getByRole("link", { name: "Chat panitia di WhatsApp" })).toHaveAttribute("href", /^https:\/\/wa\.me\/62\d+\?text=/);
    await bayar.getByRole("button", { name: "Ganti bukti" }).click();
    await expect(bayar.getByText("Bukti baru menggantikan bukti yang sudah kamu kirim.")).toBeVisible();
    await expect(bayar.getByRole("button", { name: "Kirim bukti baru" })).toBeVisible();
    await bayar.getByRole("button", { name: "Batal" }).click();
    await expect(bayar.getByRole("button", { name: "Ganti bukti" })).toBeVisible();
  });
});

// Voucher berlaku di outlet tertentu (ALUR bagian 16).
test.describe("voucher per outlet", () => {
  test("pemilik merchant bisa memilih outlet tempat voucher berlaku", async ({ context, page, baseURL }) => {
    await loginAs(context, ACCOUNTS.pemilikMerchant, baseURL!);
    await open(page, "/profil");
    const href = await page.locator('a[href^="/merchant/"]').first().getAttribute("href");
    await open(page, `${href}/reward`);
    const form = page.locator("form").filter({ hasText: "Tambah reward" });
    await expect(form.getByText("Berlaku di outlet")).toBeVisible();
    await expect(form.getByRole("checkbox")).toHaveCount(0);
    await form.getByText("Outlet tertentu").click();
    await expect(form.getByRole("checkbox", { name: /Baros/ })).toBeVisible();
    await expect(page.getByText(/Berlaku di (semua outlet|: )/).first()).toBeVisible();
  });

  test("dompet warga menampilkan outlet tempat voucher berlaku", async ({ context, page, baseURL }) => {
    await loginAs(context, ACCOUNTS.warga, baseURL!);
    await open(page, "/dompet");
    await expect(page.getByText(/Berlaku di (semua outlet|: )/).first()).toBeVisible();
  });
});
