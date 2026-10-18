import { createServerClient } from "@supabase/ssr";
import { expect, type BrowserContext, type Page } from "@playwright/test";

// Akun dummy (dummy-data/akun.md). Semua memakai kata sandi yang sama.
export const PASSWORD = process.env.E2E_PASSWORD ?? "RameinDummy2026!";
export const ACCOUNTS = {
  warga: "rani@dummy.ramein.id",
  wargaLain: "rizky@dummy.ramein.id",
  wargaMenungguBayar: "dimas@dummy.ramein.id", // bukti bayar Night Run menunggu konfirmasi
  wargaKeluarSemua: "tono@dummy.ramein.id", // dipakai uji keluar dari semua perangkat
  pemilikMerchant: "wisnu@dummy.ramein.id",
  ketuaKomunitas: "andi@dummy.ramein.id",
  admin: "admin@dummy.ramein.id",
} as const;

// Masuk lewat Supabase (email + kata sandi) lalu pasang cookie sesi di browser,
// sama seperti yang dilakukan @supabase/ssr setelah login sungguhan.
export async function loginAs(context: BrowserContext, email: string, baseURL: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) throw new Error("Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local");

  const res = await fetch(`${url}/auth/v1/token?grant_type=password`, {
    method: "POST",
    headers: { apikey: key, "Content-Type": "application/json" },
    body: JSON.stringify({ email, password: PASSWORD }),
  });
  const session = await res.json();
  if (!session.access_token) throw new Error(`Login gagal untuk ${email}. Sudahkah data dummy dipasang?`);

  const jar: { name: string; value: string }[] = [];
  const supabase = createServerClient(url, key, {
    cookies: { getAll: () => jar, setAll: (items) => items.forEach((c) => jar.push({ name: c.name, value: c.value })) },
  });
  await supabase.auth.setSession({ access_token: session.access_token, refresh_token: session.refresh_token });
  const domain = new URL(baseURL).hostname;
  await context.addCookies(jar.map((c) => ({ name: c.name, value: c.value, domain, path: "/" })));
}

// Buka halaman, tunggu semua bagian "Memuat…" selesai, dan pastikan tidak ada error server.
export async function open(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.status(), `status ${path}`).toBeLessThan(400);
  await page.waitForLoadState("networkidle");
  await expect(page.getByText("Memuat…")).toHaveCount(0);
  await expect(page.getByText(/Application error|Internal Server Error/)).toHaveCount(0);
}

// Id merchant/komunitas pertama di pemilih mode profil.
export async function organizerHref(page: Page, kind: "merchant" | "komunitas") {
  await open(page, "/profil");
  const href = await page.locator(`a[href^="/${kind}/"]`).first().getAttribute("href");
  if (!href) throw new Error(`Akun ini tidak punya ${kind}`);
  return href;
}
