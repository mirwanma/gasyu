// Mengunggah ulang cover aktivitas dummy saja (mis. setelah gambar dibuat ulang).
// Path dan URL tetap sama, jadi data aktivitas tidak perlu diubah.
// Jalankan: node dummy-data/unggah-cover.cjs
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envFile = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, "utf8").split("\n")) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const PW = "GasyuDummy2026!";
const COVERS = [
  ["andi@dummy.gasyu.id", "Cimahi Night Run 5K", "cover-night-run.png"],
  ["tehai@dummy.gasyu.id", "Festival Kuliner Pasar Atas", "cover-festival-kuliner.png"],
  ["wisnu@dummy.gasyu.id", "Jelajah 3 Kedai Kopi Lereng", "cover-jelajah-kopi.png"],
  ["mega@dummy.gasyu.id", "Workshop Mural Tembok Pasar", "cover-workshop-mural.png"],
];

(async () => {
  for (const [email, title, file] of COVERS) {
    const sb = createClient(URL, KEY, { auth: { persistSession: false } });
    const { error: e1 } = await sb.auth.signInWithPassword({ email, password: PW });
    if (e1) throw new Error(`login ${email}: ${e1.message}`);
    const { data: act } = await sb.from("activities").select("id, cover_url").eq("title", title).maybeSingle();
    if (!act) { console.log("• lewati", title, "(tidak ditemukan)"); continue; }
    const objectPath = `${act.id}/cover-dummy.png`;
    const { error } = await sb.storage.from("covers").upload(objectPath, fs.readFileSync(path.join(__dirname, "gambar", file)), { contentType: "image/png", upsert: true });
    if (error) throw new Error(`unggah ${title}: ${error.message}`);
    console.log("•", title, act.cover_url ? "diperbarui" : "diunggah (cover belum dipasang; jalankan unggah-gambar.cjs setelah disetujui)");
  }
})().catch((e) => { console.error(e.message); process.exit(1); });
