// Mengunggah gambar dummy ke Supabase Storage dan menjalankan alur yang butuh berkas
// (logo penyelenggara, cover aktivitas, bukti bayar Dimas, foto misi Dimas/Siti/Nadia).
// Jalankan SETELAH seed.sql:  node dummy-data/unggah-gambar.cjs
// Membaca NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dari .env.local.
const fs = require("fs");
const path = require("path");
const { createClient } = require("@supabase/supabase-js");

const envFile = path.join(__dirname, "..", ".env.local");
if (fs.existsSync(envFile)) for (const line of fs.readFileSync(envFile, "utf8").split("\n")) { const m = line.match(/^([A-Z_]+)=(.*)$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim(); }
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!URL || !KEY) { console.error("Isi NEXT_PUBLIC_SUPABASE_URL dan NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY di .env.local"); process.exit(1); }
const PW = "RameinDummy2026!";
const IMG = (name) => fs.readFileSync(path.join(__dirname, "gambar", name));
const log = (...a) => console.log("•", ...a);

async function as(email) {
  const sb = createClient(URL, KEY, { auth: { persistSession: false } });
  const { error } = await sb.auth.signInWithPassword({ email, password: PW });
  if (error) throw new Error(`login ${email}: ${error.message}`);
  return sb;
}
async function upload(sb, bucket, objectPath, file) {
  const { error } = await sb.storage.from(bucket).upload(objectPath, file, { contentType: "image/png", upsert: true });
  if (error) throw new Error(`unggah ${bucket}/${objectPath}: ${error.message}`);
  return sb.storage.from(bucket).getPublicUrl(objectPath).data.publicUrl;
}

// Pemilik/ketua → slug penyelenggara → berkas logo
const LOGOS = [
  ["wisnu@dummy.ramein.id", "kopi-lereng", "logo-kopi-lereng.png"],
  ["tehai@dummy.ramein.id", "seblak-teh-ai", "logo-seblak-teh-ai.png"],
  ["dewi@dummy.ramein.id", "batik-cimahi-heritage", "logo-batik-cimahi.png"],
  ["jaya@dummy.ramein.id", "bengkel-motor-jaya", "logo-bengkel-jaya.png"],
  ["hendra@dummy.ramein.id", "toko-buku-cendekia", "logo-toko-buku.png"],
  ["udin@dummy.ramein.id", "nasi-liwet-mang-udin", "logo-nasi-liwet.png"],
  ["andi@dummy.ramein.id", "cimahi-runners", "logo-cimahi-runners.png"],
  ["rudi@dummy.ramein.id", "cimahi-gowes", "logo-cimahi-gowes.png"],
  ["mega@dummy.ramein.id", "cimahi-creative-hub", "logo-creative-hub.png"],
  ["lina@dummy.ramein.id", "sahabat-lingkungan-cimahi", "logo-sahabat-lingkungan.png"],
  ["bayu@dummy.ramein.id", "cimahi-foodies", "logo-cimahi-foodies.png"],
];
// Pemilik/ketua host → judul aktivitas → berkas cover
const COVERS = [
  ["andi@dummy.ramein.id", "Cimahi Night Run 5K", "cover-night-run.png"],
  ["tehai@dummy.ramein.id", "Festival Kuliner Pasar Atas", "cover-festival-kuliner.png"],
  ["wisnu@dummy.ramein.id", "Jelajah 3 Kedai Kopi Lereng", "cover-jelajah-kopi.png"],
  ["mega@dummy.ramein.id", "Workshop Mural Tembok Pasar", "cover-workshop-mural.png"],
];

(async () => {
  for (const [email, slug, file] of LOGOS) {
    const sb = await as(email);
    const { data: org } = await sb.from("organizers").select("id").eq("slug", slug).single();
    const url = await upload(sb, "logos", `${org.id}/logo.png`, IMG(file));
    const { error } = await sb.from("organizers").update({ logo_url: url }).eq("id", org.id);
    if (error) throw new Error(`logo ${slug}: ${error.message}`);
    log("logo", slug);
  }
  for (const [email, title, file] of COVERS) {
    const sb = await as(email);
    const { data: act } = await sb.from("activities").select("id").eq("title", title).single();
    const url = await upload(sb, "covers", `${act.id}/cover-dummy.png`, IMG(file));
    const { error } = await sb.rpc("update_activity", { p_activity_id: act.id, p_data: { cover_url: url } });
    if (error) log(`cover ${title} dilewati (${error.message}; aktivitas yang menunggu review tidak bisa diubah)`);
    else log("cover", title);
  }

  // Dimas mengirim bukti bayar Night Run (menunggu konfirmasi panitia)
  let sb = await as("dimas@dummy.ramein.id");
  let { data: me } = await sb.auth.getUser();
  let { data: run } = await sb.from("activities").select("id").eq("title", "Cimahi Night Run 5K").single();
  let { data: part } = await sb.from("participations").select("id, payment_status").eq("activity_id", run.id).eq("user_id", me.user.id).single();
  if (part.payment_status === "unpaid") {
    const p = `${run.id}/${me.user.id}/bukti-transfer.png`;
    await upload(sb, "payment-proofs", p, IMG("bukti-night-run-dimas.png"));
    const { error } = await sb.rpc("submit_payment_proof", { p_participation_id: part.id, p_proof_path: p });
    if (error) throw new Error(`bukti bayar: ${error.message}`);
    log("bukti bayar Dimas terkirim");
  }

  // Foto misi festival: Siti (menunggu tinjauan), Fajar (disetujui Teh Ai).
  // Catatan: peserta yang sudah "selesai" (Rani, Dimas, Nadia) tidak bisa mengirim misi bonus lagi.
  let { data: fest } = await sb.from("activities").select("id").eq("title", "Festival Kuliner Pasar Atas").single();
  async function sendPhoto(email, activityId, missionTitle, file) {
    const s = await as(email);
    const { data: u } = await s.auth.getUser();
    const { data: list } = await s.rpc("get_activity_missions", { p_activity_id: activityId });
    const mission = (list?.missions ?? []).find((m) => m.title === missionTitle);
    if (!mission || mission.my_status) return null;
    const p = `${activityId}/${u.user.id}/${mission.id}.png`;
    await upload(s, "mission-proofs", p, IMG(file));
    const { data, error } = await s.rpc("complete_mission", { p_mission_id: mission.id, p_token: null, p_code: null, p_proof_path: p, p_lat: null, p_lng: null });
    if (error) throw new Error(`foto misi ${email}: ${error.message}`);
    log("foto misi", email, missionTitle);
    return data.completion_id;
  }
  await sendPhoto("siti@dummy.ramein.id", fest.id, "Foto bareng Teh Ai", "foto-festival-siti.png");
  const fajarId = await sendPhoto("fajar@dummy.ramein.id", fest.id, "Foto bareng Teh Ai", "foto-festival-dimas.png");
  if (fajarId) {
    sb = await as("tehai@dummy.ramein.id");
    const { error } = await sb.rpc("review_mission_completion", { p_completion_id: fajarId, p_approve: true, p_note: null });
    if (error) throw new Error(`tinjau foto Fajar: ${error.message}`);
    log("foto Fajar disetujui Teh Ai");
  }
  // Ulasan Ayu di challenge kopi (menunggu tinjauan Wisnu)
  let { data: ch } = await sb.from("activities").select("id").eq("title", "Jelajah 3 Kedai Kopi Lereng").single();
  await sendPhoto("ayu@dummy.ramein.id", ch.id, "Ulasan di media sosial", "foto-kopi-nadia.png").catch((e) => log("ulasan Ayu dilewati:", e.message));
  // Foto profil Rani (contoh fitur foto profil, migrasi 0017)
  sb = await as("rani@dummy.ramein.id");
  {
    const { data: me } = await sb.auth.getUser();
    const path = `${me.user.id}/avatar-dummy.jpg`;
    const { error: upErr } = await sb.storage.from("avatars").upload(path, IMG("avatar-rani.jpg"), { contentType: "image/jpeg", upsert: true });
    if (upErr) log("foto profil Rani dilewati:", upErr.message);
    else {
      const { error } = await sb.rpc("set_my_avatar", { p_url: sb.storage.from("avatars").getPublicUrl(path).data.publicUrl });
      log(error ? `foto profil Rani dilewati: ${error.message}` : "foto profil Rani");
    }
  }
  log("SELESAI. Semua gambar dummy terpasang.");
})().catch((e) => { console.error(e.message); process.exit(1); });
