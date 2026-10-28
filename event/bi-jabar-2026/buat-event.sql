-- =============================================================================
-- EVENT KOLABORASI GASYU x BANK INDONESIA JAWA BARAT
--   1. Festival Rupiah & QRIS Cimahi  (event satu hari, 34 misi, total 500 XP)
--   2. Jelajah QRIS UMKM Cimahi       (challenge 14 hari, hingga 29 misi, total hingga 500 XP)
--
-- Cara pakai (Supabase Dashboard → SQL Editor, dijalankan sebagai postgres):
--   1. Pastikan BI Jabar, UMKM, dan komunitas yang ikut sudah terdaftar dan
--      disetujui di Gasyu. Nama yang belum ada tetap boleh: misinya sementara
--      tercatat atas nama Gasyu (panitia Gasyu yang menampilkan QR-nya).
--   2. Isi bagian KONFIGURASI di bawah (nama penyelenggara, tanggal, lokasi).
--   3. Jalankan seluruh file. Hasil akhirnya tabel kode rahasia tiap misi;
--      simpan baik-baik dan bagikan ke petugas booth, jangan disebar ke publik.
--   4. Kedua aktivitas dibuat sebagai DRAFT. Periksa di /admin, lalu ajukan
--      (event Gasyu langsung tayang saat diajukan).
--
-- Kode rahasia dibuat acak setiap skrip dijalankan, jadi tidak ada kode di repo.
-- Skrip berhenti jika aktivitas dengan judul yang sama sudah ada (selain yang dibatalkan).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- KONFIGURASI
-- -----------------------------------------------------------------------------
drop table if exists pg_temp.event_config;
create temp table event_config as
select
  null::text                                  as admin_email,      -- null = admin pertama
  timestamptz '2026-11-21 08:00:00+07'        as festival_mulai,   -- Sabtu
  timestamptz '2026-11-21 21:00:00+07'        as festival_selesai,
  'Alun-alun Kota Cimahi'::text               as festival_lokasi,
  'Jl. Amir Machmud, Cimahi'::text            as festival_alamat,
  -6.873700::numeric                          as festival_lat,
  107.543300::numeric                         as festival_lng,
  1000                                        as festival_kuota,
  timestamptz '2026-11-22 00:00:00+07'        as jelajah_mulai,    -- Minggu
  timestamptz '2026-12-06 23:59:00+07'        as jelajah_selesai;

-- Penyelenggara yang terlibat. Isi kolom nama persis seperti terdaftar di Gasyu.
-- Baris dengan nama kosong atau belum terdaftar → misinya atas nama Gasyu.
drop table if exists pg_temp.event_partner;
create temp table event_partner (slot text primary key, organizer_name text, label text not null, note text);
insert into event_partner (slot, organizer_name, label, note) values
  ('bi',         'Bank Indonesia Jawa Barat', 'Bank Indonesia Jawa Barat', 'Co-host: materi edukasi Rupiah, QRIS, perlindungan konsumen, narasumber talkshow'),
  ('umkm1',      null, 'Booth UMKM 1', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm2',      null, 'Booth UMKM 2', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm3',      null, 'Booth UMKM 3', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm4',      null, 'Booth UMKM 4', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm5',      null, 'Booth UMKM 5', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm6',      null, 'Booth UMKM 6', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm7',      null, 'Booth UMKM 7', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('umkm8',      null, 'Booth UMKM 8', 'Booth UMKM di Festival Rupiah & QRIS'),
  ('kreator',    null, 'Komunitas kreator', 'Kelas foto produk pakai HP'),
  ('lingkungan', null, 'Komunitas lingkungan', 'Eco Station pilah sampah'),
  ('komunitas',  null, 'Pojok Komunitas', 'Booth kenalan komunitas');

-- Merchant untuk challenge Jelajah QRIS. Semua outlet aktif mereka jadi titik
-- jelajah (maksimal 20 outlet). Tiap outlet = 1 misi "Bayar pakai QRIS" (15 XP).
drop table if exists pg_temp.event_jelajah;
create temp table event_jelajah (merchant_name text primary key);
-- insert into event_jelajah values ('Nama UMKM 1'), ('Nama UMKM 2');

-- -----------------------------------------------------------------------------
-- Helper
-- -----------------------------------------------------------------------------
create or replace function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

-- Kode acak 8 karakter tanpa huruf/angka yang mirip (O/0, I/1).
create or replace function pg_temp.new_code() returns text language sql volatile as $$
  select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
  from generate_series(1, 8);
$$;

drop table if exists pg_temp.event_codes;
create temp table event_codes (aktivitas text, urutan smallint, misi text, kode text, dibagikan_oleh text);

do $event$
declare
  cfg record;
  v_admin uuid;
  v_gasyu uuid := public.platform_organizer_id();
  v_city uuid := (select id from public.regions where level = 'city' and name = 'Kota Cimahi');
  ev uuid; ch uuid;
  r record;
  p jsonb := '{}'::jsonb;   -- slot -> organizer_id (atau Gasyu)
  cp jsonb := '{}'::jsonb;  -- nama checkpoint -> id
  v_org uuid; v_id uuid; v_code text;
  m_jejak1 uuid; m_jejak2 uuid; m_struk uuid;
  i integer := 0;
  t0 timestamptz;
begin
  select * into cfg from pg_temp.event_config;
  select id into v_admin from public.profiles p2
  where p2.is_admin and (cfg.admin_email is null or p2.id = (select u.id from auth.users u where lower(u.email) = lower(cfg.admin_email)))
  order by p2.created_at limit 1;
  if v_admin is null then
    raise exception 'Akun admin tidak ditemukan. Isi admin_email di KONFIGURASI.';
  end if;
  if v_gasyu is null or v_city is null then
    raise exception 'Penyelenggara Gasyu atau wilayah Kota Cimahi tidak ditemukan.';
  end if;
  if exists (select 1 from public.activities where host_organizer_id = v_gasyu and status <> 'cancelled'
             and title in ('Festival Rupiah & QRIS Cimahi', 'Jelajah QRIS UMKM Cimahi')) then
    raise exception 'Aktivitas sudah pernah dibuat. Batalkan atau ganti judulnya dulu.';
  end if;
  perform pg_temp.login(v_admin);
  t0 := cfg.festival_mulai;

  -- ===========================================================================
  -- 1. FESTIVAL RUPIAH & QRIS CIMAHI
  -- ===========================================================================
  ev := public.create_activity(v_gasyu, jsonb_build_object(
    'type', 'event', 'goal', 'awareness',
    'title', 'Festival Rupiah & QRIS Cimahi',
    'description', 'Gasyu bersama Bank Indonesia Jawa Barat, UMKM, dan komunitas Cimahi menggelar festival satu hari: '
      || 'kenali ciri keaslian Rupiah, belajar QRIS dan transaksi digital yang aman, belanja produk UMKM pakai QRIS, '
      || 'ikut kelas, dan seru-seruan di panggung. Check-in di gerbang, selesaikan 3 misi wajib, dan kumpulkan Jejak dari 31 misi bonus. '
      || 'Gratis dan terbuka untuk semua, termasuk warga luar Cimahi.',
    'scope_region_id', v_city,
    'starts_at', cfg.festival_mulai, 'ends_at', cfg.festival_selesai,
    'quota', cfg.festival_kuota, 'join_mode', 'both', 'group_min', 2, 'group_max', 10,
    'residency_rule', 'open', 'audience', 'public'));

  -- Partner
  for r in select * from pg_temp.event_partner order by slot loop
    select o.id into v_org from public.organizers o
    where r.organizer_name is not null and lower(o.name) = lower(btrim(r.organizer_name))
      and o.status = 'approved' and o.type <> 'platform'
      and (r.slot not like 'umkm%' or o.type = 'merchant')
    limit 1;
    if v_org is null then
      if r.organizer_name is not null then
        raise notice 'Penyelenggara "%" tidak ditemukan, belum disetujui, atau jenisnya tidak cocok (slot umkm harus merchant); misi slot % atas nama Gasyu.', r.organizer_name, r.slot;
      end if;
      p := p || jsonb_build_object(r.slot, v_gasyu);
    elsif not exists (select 1 from public.activity_partners where activity_id = ev and organizer_id = v_org) then
      perform public.admin_add_partner(ev, v_org, 'cohost', r.note);
      p := p || jsonb_build_object(r.slot, v_org);
    else
      p := p || jsonb_build_object(r.slot, v_org);
    end if;
    v_org := null;
  end loop;

  -- Checkpoint (sedikit digeser dari titik lokasi supaya tiap booth beda titik di peta)
  cp := cp || jsonb_build_object('gerbang', public.add_checkpoint(ev, jsonb_build_object(
    'name', 'Gerbang & Registrasi', 'address', cfg.festival_lokasi || ', ' || cfg.festival_alamat,
    'lat', cfg.festival_lat, 'lng', cfg.festival_lng, 'radius_m', 150)));
  cp := cp || jsonb_build_object('panggung', public.add_checkpoint(ev, jsonb_build_object(
    'name', 'Panggung Utama', 'address', cfg.festival_lokasi, 'lat', cfg.festival_lat + 0.0004, 'lng', cfg.festival_lng, 'radius_m', 150)));
  cp := cp || jsonb_build_object('bi_rupiah', public.add_checkpoint(ev, jsonb_build_object(
    'partner_organizer_id', p ->> 'bi', 'name', 'Booth Edukasi Rupiah (BI Jabar)', 'address', cfg.festival_lokasi,
    'lat', cfg.festival_lat + 0.0002, 'lng', cfg.festival_lng + 0.0002, 'radius_m', 150)));
  cp := cp || jsonb_build_object('bi_qris', public.add_checkpoint(ev, jsonb_build_object(
    'partner_organizer_id', p ->> 'bi', 'name', 'Booth QRIS & Transaksi Aman (BI Jabar)', 'address', cfg.festival_lokasi,
    'lat', cfg.festival_lat + 0.0002, 'lng', cfg.festival_lng - 0.0002, 'radius_m', 150)));
  cp := cp || jsonb_build_object('bi_kas', public.add_checkpoint(ev, jsonb_build_object(
    'partner_organizer_id', p ->> 'bi', 'name', 'Kas Keliling Penukaran Uang (BI Jabar)', 'address', cfg.festival_lokasi,
    'lat', cfg.festival_lat + 0.0003, 'lng', cfg.festival_lng + 0.0003, 'radius_m', 150)));
  for i in 1..8 loop
    cp := cp || jsonb_build_object('umkm' || i, public.add_checkpoint(ev, jsonb_build_object(
      'partner_organizer_id', p ->> ('umkm' || i),
      'name', coalesce((select o.name from public.organizers o where o.id = (p ->> ('umkm' || i))::uuid and o.type <> 'platform'), 'Booth UMKM ' || i),
      'address', cfg.festival_lokasi || ', Zona UMKM',
      'lat', cfg.festival_lat - 0.0003, 'lng', cfg.festival_lng - 0.0004 + i * 0.0001, 'radius_m', 150)));
  end loop;
  cp := cp || jsonb_build_object('eco', public.add_checkpoint(ev, jsonb_build_object(
    'partner_organizer_id', p ->> 'lingkungan', 'name', 'Eco Station', 'address', cfg.festival_lokasi,
    'lat', cfg.festival_lat - 0.0002, 'lng', cfg.festival_lng + 0.0004, 'radius_m', 150)));
  cp := cp || jsonb_build_object('komunitas', public.add_checkpoint(ev, jsonb_build_object(
    'partner_organizer_id', p ->> 'komunitas', 'name', 'Pojok Komunitas', 'address', cfg.festival_lokasi,
    'lat', cfg.festival_lat - 0.0002, 'lng', cfg.festival_lng - 0.0005, 'radius_m', 150)));

  -- --- A. Pembuka ---
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 1, 'icon', 'sunrise',
    'title', 'Datang pagi',
    'description', 'Datang sebelum pukul 09.30 dan pindai QR misi di meja registrasi.',
    'verification', 'qr_scan', 'checkpoint_id', cp ->> 'gerbang', 'xp_reward', 10, 'is_required', false,
    'available_from', t0, 'available_until', t0 + interval '90 minutes'));

  -- --- B. Edukasi Rupiah (BI) ---
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 2, 'icon', 'banknote', 'partner_organizer_id', p ->> 'bi',
    'title', 'Kenali Rupiah: Dilihat, Diraba, Diterawang',
    'description', 'Kunjungi Booth Edukasi Rupiah, pelajari cara mengenali ciri keaslian uang Rupiah, lalu pindai QR misi dari petugas.',
    'verification', 'qr_scan', 'checkpoint_id', cp ->> 'bi_rupiah', 'xp_reward', 25, 'is_required', true));
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 3, 'icon', 'quiz', 'partner_organizer_id', p ->> 'bi',
    'title', 'Kuis Cinta, Bangga, Paham Rupiah',
    'description', 'Jawab kuis singkat di Booth Edukasi Rupiah. Kalau lulus, petugas memberi kode rahasia untuk diketik di sini.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 20, 'is_required', false));
  insert into pg_temp.event_codes values ('Festival', 3, 'Kuis Cinta, Bangga, Paham Rupiah', v_code, 'Petugas Booth Edukasi Rupiah, ke peserta yang lulus kuis');
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 4, 'icon', 'camera', 'partner_organizer_id', p ->> 'bi',
    'title', 'Foto di pojok "Rupiah Kita"',
    'description', 'Foto kamu di photo booth Rupiah. Wajah dan latar photo booth harus terlihat jelas.',
    'verification', 'photo', 'xp_reward', 10, 'is_required', false));
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 5, 'icon', 'refresh', 'partner_organizer_id', p ->> 'bi',
    'title', 'Tukar uang lusuh di kas keliling',
    'description', 'Tukarkan uang lusuh atau uang kecil di layanan kas keliling, lalu pindai QR misi dari petugas. Bawa uangmu sendiri, ya.',
    'verification', 'qr_scan', 'checkpoint_id', cp ->> 'bi_kas', 'xp_reward', 15, 'is_required', false));

  -- --- C. QRIS & transaksi aman (BI) ---
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 6, 'icon', 'qr', 'partner_organizer_id', p ->> 'bi',
    'title', 'Belajar QRIS & cara cek QR asli',
    'description', 'Kunjungi Booth QRIS, pelajari cara bayar pakai QRIS dan cara memastikan nama merchant sebelum bayar, lalu pindai QR misi dari petugas.',
    'verification', 'qr_scan', 'checkpoint_id', cp ->> 'bi_qris', 'xp_reward', 25, 'is_required', true));
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 7, 'icon', 'shield', 'partner_organizer_id', p ->> 'bi',
    'title', 'Kuis anti-penipuan digital',
    'description', 'Tebak mana pesan penipuan dan mana yang aman di Booth QRIS. Kalau lulus, petugas memberi kode rahasia.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 20, 'is_required', false));
  insert into pg_temp.event_codes values ('Festival', 7, 'Kuis anti-penipuan digital', v_code, 'Petugas Booth QRIS, ke peserta yang lulus kuis');
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 8, 'icon', 'mic', 'partner_organizer_id', p ->> 'bi',
    'title', 'Talkshow Bijak Bertransaksi Digital',
    'description', 'Ikuti talkshow di Panggung Utama pukul 13.00 sampai selesai. Kode rahasia diumumkan di akhir sesi.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 15, 'is_required', false,
    'reveal_mode', 'scheduled', 'reveal_at', t0 + interval '5 hours', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Festival', 8, 'Talkshow Bijak Bertransaksi Digital', v_code, 'Narasumber/MC di akhir talkshow (±14.00)');

  -- --- D. Zona UMKM ---
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 9, 'icon', 'wallet',
    'title', 'Bayar pertama pakai QRIS di UMKM',
    'description', 'Belanja di booth UMKM mana saja dan bayar pakai QRIS. Unggah foto bukti bayar di HP-mu bersama produk yang dibeli.',
    'verification', 'photo', 'xp_reward', 30, 'is_required', true));
  for i in 1..8 loop
    perform public.upsert_mission(ev, jsonb_build_object('sort_order', 9 + i, 'icon', 'store', 'partner_organizer_id', p ->> ('umkm' || i),
      'title', 'Mampir & belanja di ' || left((select name from public.activity_checkpoints where id = (cp ->> ('umkm' || i))::uuid), 60),
      'description', 'Belanja di booth ini pakai QRIS, lalu minta petugas booth menunjukkan QR misi untuk dipindai.',
      'verification', 'qr_scan', 'checkpoint_id', cp ->> ('umkm' || i), 'xp_reward', 10, 'is_required', false));
  end loop;
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 18, 'icon', 'star',
    'title', 'Ulas UMKM favoritmu',
    'description', 'Tulis ulasan UMKM favoritmu di festival ini di Google Maps atau media sosial. Unggah tangkapan layarnya.',
    'verification', 'photo', 'xp_reward', 15, 'is_required', false));
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 19, 'icon', 'smile',
    'title', 'Selfie dengan pemilik UMKM',
    'description', 'Kenalan dengan pemilik salah satu UMKM, tanya cerita usahanya, lalu unggah selfie kalian berdua.',
    'verification', 'photo', 'xp_reward', 10, 'is_required', false));

  -- --- E. Kelas & workshop ---
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 20, 'icon', 'camera',
    'partner_organizer_id', p ->> 'kreator',
    'title', 'Kelas foto produk pakai HP',
    'description', 'Ikuti kelas foto produk sampai selesai. Mentor menandai peserta yang hadir penuh.',
    'verification', 'manual', 'xp_reward', 25, 'is_required', false));
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 21, 'icon', 'piggy',
    'partner_organizer_id', p ->> 'bi',
    'title', 'Kelas atur uang saku keluarga',
    'description', 'Ikuti kelas literasi keuangan untuk keluarga dan pelajar sampai selesai. Panitia menandai peserta yang hadir penuh.',
    'verification', 'manual', 'xp_reward', 25, 'is_required', false));
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 22, 'icon', 'book',
    'partner_organizer_id', p ->> 'bi',
    'title', 'Kenal ekonomi syariah',
    'description', 'Dengarkan penjelasan singkat ekonomi dan keuangan syariah di Booth Edukasi Rupiah. Petugas memberi kode rahasia di akhir sesi.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 15, 'is_required', false));
  insert into pg_temp.event_codes values ('Festival', 22, 'Kenal ekonomi syariah', v_code, 'Petugas Booth Edukasi Rupiah, di akhir sesi syariah');

  -- --- F. Komunitas & lingkungan ---
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 23, 'icon', 'recycle',
    'partner_organizer_id', p ->> 'lingkungan',
    'title', 'Pilah sampah di Eco Station',
    'description', 'Buang sampahmu sesuai jenisnya di Eco Station, lalu pindai QR misi dari relawan.',
    'verification', 'qr_scan', 'checkpoint_id', cp ->> 'eco', 'xp_reward', 15, 'is_required', false));
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 24, 'icon', 'bottle',
    'title', 'Bawa tumbler atau tas belanja sendiri',
    'description', 'Unggah foto tumbler atau tas belanja yang kamu bawa ke festival.',
    'verification', 'photo', 'xp_reward', 10, 'is_required', false));
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 25, 'icon', 'users',
    'partner_organizer_id', p ->> 'komunitas',
    'title', 'Kenalan dengan komunitas',
    'description', 'Mampir ke Pojok Komunitas, ngobrol dengan pengurusnya, lalu pindai QR misi.',
    'verification', 'qr_scan', 'checkpoint_id', cp ->> 'komunitas', 'xp_reward', 10, 'is_required', false));

  -- --- G. Panggung ---
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 26, 'icon', 'flag',
    'title', 'Tonton pembukaan festival',
    'description', 'Kode rahasia diumumkan MC saat pembukaan festival pukul 09.00.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 10, 'is_required', false,
    'reveal_mode', 'scheduled', 'reveal_at', t0 + interval '1 hour', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Festival', 26, 'Tonton pembukaan festival', v_code, 'MC saat pembukaan (09.00)');
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 27, 'icon', 'gift',
    'title', 'Misi kejutan MC',
    'description', 'Misi rahasia dari panggung. Kodenya diumumkan MC saat misi dibuka.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 20, 'is_required', false,
    'reveal_mode', 'manual', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Festival', 27, 'Misi kejutan MC', v_code, 'MC, setelah admin menekan "Buka misi"');
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 28, 'icon', 'trophy',
    'title', 'Lomba yel-yel antarkelurahan',
    'description', 'Tampil bareng grup kelurahanmu di lomba yel-yel. Panitia menandai semua peserta yang tampil.',
    'verification', 'manual', 'xp_reward', 20, 'is_required', false));
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 29, 'icon', 'moon',
    'title', 'Misi malam: panggung budaya Sunda',
    'description', 'Saksikan penampilan budaya Sunda di Panggung Utama. Kode rahasia diumumkan di tengah penampilan.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 15, 'is_required', false,
    'reveal_mode', 'scheduled', 'reveal_at', t0 + interval '11 hours', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Festival', 29, 'Misi malam: panggung budaya Sunda', v_code, 'MC saat penampilan budaya (setelah 19.00)');

  -- --- H. Jejak Rupiah (rantai petunjuk) ---
  v_code := pg_temp.new_code();
  m_jejak1 := public.upsert_mission(ev, jsonb_build_object('sort_order', 30, 'icon', 'search',
    'title', 'Jejak Rupiah 1: mural pahlawan',
    'description', 'Cari banner bergambar pahlawan di uang Rupiah di area festival. Kode tertulis di pojok banner.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 10, 'is_required', false));
  insert into pg_temp.event_codes values ('Festival', 30, 'Jejak Rupiah 1', v_code, 'Cetak di pojok banner petunjuk 1');
  v_code := pg_temp.new_code();
  m_jejak2 := public.upsert_mission(ev, jsonb_build_object('sort_order', 31, 'icon', 'search',
    'title', 'Jejak Rupiah 2: rumah adat',
    'description', 'Petunjuk berikutnya ada di banner bergambar rumah adat. Kode tertulis di pojok banner.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 10, 'is_required', false,
    'reveal_mode', 'after_mission', 'prerequisite_mission_id', m_jejak1, 'show_teaser', true));
  insert into pg_temp.event_codes values ('Festival', 31, 'Jejak Rupiah 2', v_code, 'Cetak di pojok banner petunjuk 2');
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 32, 'icon', 'search',
    'title', 'Jejak Rupiah 3: finale',
    'description', 'Petunjuk terakhir ada di banner bergambar tarian daerah. Selamat, kamu menuntaskan Jejak Rupiah!',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 15, 'is_required', false,
    'reveal_mode', 'after_mission', 'prerequisite_mission_id', m_jejak2, 'show_teaser', true));
  insert into pg_temp.event_codes values ('Festival', 32, 'Jejak Rupiah 3', v_code, 'Cetak di pojok banner petunjuk 3');

  -- --- I. Penutup ---
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 33, 'icon', 'clipboard',
    'title', 'Isi survei kepuasan',
    'description', 'Isi survei singkat dari panitia (tautan/QR di meja registrasi). Kode rahasia muncul di akhir survei.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 10, 'is_required', false));
  insert into pg_temp.event_codes values ('Festival', 33, 'Isi survei kepuasan', v_code, 'Halaman terima kasih di formulir survei');
  perform public.upsert_mission(ev, jsonb_build_object('sort_order', 34, 'icon', 'share',
    'title', 'Bagikan story festival',
    'description', 'Unggah story/postingan tentang festival dengan tagar #FestivalRupiahCimahi dan tandai akun Gasyu. Unggah tangkapan layarnya.',
    'verification', 'photo', 'xp_reward', 15, 'is_required', false));

  -- ===========================================================================
  -- 2. JELAJAH QRIS UMKM CIMAHI (challenge)
  -- ===========================================================================
  ch := public.create_activity(v_gasyu, jsonb_build_object(
    'type', 'challenge', 'difficulty', 'medium',
    'target_kind', 'missions_completed', 'target_count', 10, 'target_scope', 'individual',
    'goal', 'sales',
    'title', 'Jelajah QRIS UMKM Cimahi',
    'description', 'Lanjutan Festival Rupiah & QRIS bersama Bank Indonesia Jawa Barat. Selama dua minggu, belanja di UMKM Cimahi '
      || 'pakai QRIS, kerjakan misi, dan selesaikan 10 misi apa saja untuk menuntaskan challenge. Boleh sendiri atau bareng grup.',
    'scope_region_id', v_city,
    'starts_at', cfg.jelajah_mulai, 'ends_at', cfg.jelajah_selesai,
    'join_mode', 'both', 'group_min', 2, 'group_max', 5,
    'residency_rule', 'open', 'audience', 'public'));

  if exists (select 1 from pg_temp.event_partner where slot = 'bi' and (p ->> 'bi')::uuid <> v_gasyu) then
    perform public.admin_add_partner(ch, (p ->> 'bi')::uuid, 'cohost', 'Co-host: materi kuis QRIS dan transaksi aman');
  end if;

  i := 0;
  for r in
    select o.id as org_id, o.name as org_name, mo.id as outlet_id, mo.name as outlet_name
    from pg_temp.event_jelajah j
    join public.organizers o on lower(o.name) = lower(btrim(j.merchant_name)) and o.type = 'merchant' and o.status = 'approved'
    join public.merchant_outlets mo on mo.organizer_id = o.id and mo.is_active
    order by o.name, mo.name
    limit 20
  loop
    if not exists (select 1 from public.activity_partners where activity_id = ch and organizer_id = r.org_id) then
      perform public.admin_add_partner(ch, r.org_id, 'cohost', 'Titik Jelajah QRIS');
    end if;
    v_id := public.add_checkpoint(ch, jsonb_build_object('partner_organizer_id', r.org_id, 'outlet_id', r.outlet_id));
    i := i + 1;
    perform public.upsert_mission(ch, jsonb_build_object('sort_order', i, 'icon', 'qr', 'partner_organizer_id', r.org_id,
      'title', left('Bayar QRIS di ' || r.outlet_name, 80),
      'description', 'Belanja di ' || r.org_name || ' (' || r.outlet_name || ') dan bayar pakai QRIS. Setelah bayar, pindai QR misi yang ditunjukkan kasir.',
      'verification', 'qr_scan', 'checkpoint_id', v_id, 'xp_reward', 15, 'is_required', false));
  end loop;
  if i = 0 then
    raise notice 'Belum ada outlet merchant untuk Jelajah QRIS (isi event_jelajah). Challenge dibuat tanpa checkpoint; tambahkan sebelum diajukan.';
  end if;

  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 21, 'icon', 'basket',
    'title', 'Belanja di pasar tradisional pakai QRIS',
    'description', 'Belanja di pedagang pasar tradisional di Cimahi yang menerima QRIS. Unggah foto bukti bayar bersama lapaknya.',
    'verification', 'photo', 'xp_reward', 30, 'is_required', false));
  m_struk := public.upsert_mission(ch, jsonb_build_object('sort_order', 22, 'icon', 'receipt',
    'title', 'Kenali struk & cek mutasi QRIS',
    'description', 'Setelah bayar pakai QRIS, buka riwayat transaksi di aplikasimu dan cocokkan nama merchant serta nominalnya. Unggah tangkapan layarnya (tutup saldo dan nomor rekening).',
    'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 23, 'icon', 'car',
    'title', 'Bayar parkir atau transportasi pakai QRIS',
    'description', 'Bayar parkir, angkot, atau ojek pakai QRIS. Unggah foto bukti bayarnya.',
    'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 24, 'icon', 'home',
    'title', 'Ajak keluarga belanja pakai QRIS',
    'description', 'Ajari anggota keluarga (orang tua, kakek/nenek, atau adik) bayar pakai QRIS di UMKM. Unggah foto kalian saat bertransaksi.',
    'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 25, 'icon', 'star',
    'title', 'Ulas UMKM yang kamu kunjungi',
    'description', 'Tulis ulasan salah satu UMKM yang kamu kunjungi di Google Maps atau media sosial. Unggah tangkapan layarnya.',
    'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 26, 'icon', 'quiz', 'partner_organizer_id', p ->> 'bi',
    'title', 'Kuis QRIS minggu ke-1',
    'description', 'Jawab kuis QRIS minggu pertama (tautan diumumkan di media sosial Gasyu dan BI Jabar). Kode rahasia muncul setelah kuis selesai.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 20, 'is_required', false,
    'reveal_mode', 'scheduled', 'reveal_at', cfg.jelajah_mulai + interval '8 hours', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Jelajah', 26, 'Kuis QRIS minggu ke-1', v_code, 'Halaman akhir kuis minggu ke-1');
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 27, 'icon', 'quiz', 'partner_organizer_id', p ->> 'bi',
    'title', 'Kuis transaksi aman minggu ke-2',
    'description', 'Jawab kuis transaksi digital aman minggu kedua. Kode rahasia muncul setelah kuis selesai.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 20, 'is_required', false,
    'reveal_mode', 'scheduled', 'reveal_at', cfg.jelajah_mulai + interval '7 days 8 hours', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Jelajah', 27, 'Kuis transaksi aman minggu ke-2', v_code, 'Halaman akhir kuis minggu ke-2');
  v_code := pg_temp.new_code();
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 28, 'icon', 'gift',
    'title', 'Bonus akhir pekan',
    'description', 'Misi kilat akhir pekan! Kode rahasia diumumkan di media sosial Gasyu hari Sabtu. Berlaku sampai Minggu malam.',
    'verification', 'secret_code', 'code', v_code, 'xp_reward', 20, 'is_required', false,
    'reveal_mode', 'scheduled', 'reveal_at', cfg.jelajah_mulai + interval '6 days 8 hours',
    'available_until', cfg.jelajah_mulai + interval '7 days 23 hours 59 minutes', 'show_teaser', true));
  insert into pg_temp.event_codes values ('Jelajah', 28, 'Bonus akhir pekan', v_code, 'Postingan media sosial Gasyu hari Sabtu');
  perform public.upsert_mission(ch, jsonb_build_object('sort_order', 29, 'icon', 'megaphone',
    'title', 'Jadi Duta QRIS',
    'description', 'Bagikan pengalamanmu bayar pakai QRIS di media sosial (tips, cerita, atau video singkat) dengan tagar #JelajahQRISCimahi. Unggah tangkapan layarnya.',
    'verification', 'photo', 'xp_reward', 30, 'is_required', false,
    'reveal_mode', 'after_mission', 'prerequisite_mission_id', m_struk, 'show_teaser', true));

  raise notice 'Selesai. Festival=% (% misi, % XP). Jelajah=% (% misi, % XP, % titik outlet).',
    ev, (select count(*) from public.activity_missions where activity_id = ev), (select sum(xp_reward) from public.activity_missions where activity_id = ev),
    ch, (select count(*) from public.activity_missions where activity_id = ch), (select sum(xp_reward) from public.activity_missions where activity_id = ch), i;
end;
$event$;

-- Kode rahasia: simpan dan bagikan hanya ke petugas yang tertulis.
select aktivitas, urutan, misi, kode, dibagikan_oleh from pg_temp.event_codes order by aktivitas desc, urutan;
