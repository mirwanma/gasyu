-- =============================================================================
-- DATA DUMMY GASYU (pilot Cimahi) — untuk demo dan uji alur, bukan data nyata.
--
-- Penanda supaya mudah dibersihkan (lihat bersihkan.sql):
--   * semua akun dummy memakai id dengan awalan  dd000000-0000-4000-8000-
--   * semua email dummy memakai domain          @dummy.ramein.id
--   * penyelenggara, aktivitas, grup, reward, dan transaksi lain diturunkan
--     dari akun-akun itu (pembuat/owner), jadi ikut terhapus.
--
-- Cara pakai: jalankan seluruh file ini di SQL editor Supabase (sebagai
-- postgres). Aman dijalankan ulang: berhenti jika data dummy sudah ada.
-- Setelah itu jalankan `node dummy-data/unggah-gambar.cjs` untuk logo, cover,
-- bukti bayar, dan foto misi.
-- Kata sandi semua akun dummy: RameinDummy2026!
-- =============================================================================

-- Helper: "masuk" sebagai akun tertentu supaya fungsi database berjalan atas nama akun itu.
create or replace function pg_temp.login(p_uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;

do $seed$
declare
  pw constant text := 'RameinDummy2026!';
  -- akun
  u_admin constant uuid := 'dd000000-0000-4000-8000-0000000000e1';
  w1 constant uuid := 'dd000000-0000-4000-8000-0000000000d1'; -- Rani
  w2 constant uuid := 'dd000000-0000-4000-8000-0000000000d2'; -- Dimas
  w3 constant uuid := 'dd000000-0000-4000-8000-0000000000d3'; -- Siti
  w4 constant uuid := 'dd000000-0000-4000-8000-0000000000d4'; -- Bagas
  w5 constant uuid := 'dd000000-0000-4000-8000-0000000000d5'; -- Ayu
  w6 constant uuid := 'dd000000-0000-4000-8000-0000000000d6'; -- Fajar
  w7 constant uuid := 'dd000000-0000-4000-8000-0000000000d7'; -- Nadia
  w8 constant uuid := 'dd000000-0000-4000-8000-0000000000d8'; -- Rizky
  w9 constant uuid := 'dd000000-0000-4000-8000-0000000000d9'; -- Pak Tono
  w10 constant uuid := 'dd000000-0000-4000-8000-0000000000da'; -- Vina (luar Cimahi)
  m1 constant uuid := 'dd000000-0000-4000-8000-0000000000a1'; -- Wisnu, Kopi Lereng
  m2 constant uuid := 'dd000000-0000-4000-8000-0000000000a2'; -- Teh Ai, Seblak Teh Ai
  m3 constant uuid := 'dd000000-0000-4000-8000-0000000000a3'; -- Dewi, Batik Cimahi Heritage
  m4 constant uuid := 'dd000000-0000-4000-8000-0000000000a4'; -- Pak Jaya, Bengkel Motor Jaya
  m5 constant uuid := 'dd000000-0000-4000-8000-0000000000a5'; -- Hendra, Toko Buku Cendekia
  m6 constant uuid := 'dd000000-0000-4000-8000-0000000000a6'; -- Mang Udin, Nasi Liwet Mang Udin
  k1 constant uuid := 'dd000000-0000-4000-8000-0000000000b1'; -- Andi, Cimahi Runners
  k2 constant uuid := 'dd000000-0000-4000-8000-0000000000b2'; -- Rudi, Cimahi Gowes
  k3 constant uuid := 'dd000000-0000-4000-8000-0000000000b3'; -- Mega, Cimahi Creative Hub
  k4 constant uuid := 'dd000000-0000-4000-8000-0000000000b4'; -- Lina, Sahabat Lingkungan Cimahi
  k5 constant uuid := 'dd000000-0000-4000-8000-0000000000b5'; -- Bayu, Cimahi Foodies
  acc record;
  v_district uuid;
  -- penyelenggara
  org_kopi uuid; org_seblak uuid; org_batik uuid; org_bengkel uuid; org_buku uuid; org_liwet uuid;
  org_run uuid; org_gowes uuid; org_hub uuid; org_hijau uuid; org_food uuid;
  out_kopi_baros uuid; out_kopi_cibabat uuid; out_seblak uuid; out_batik uuid; out_bengkel uuid; out_buku uuid;
  -- aktivitas
  ev_run uuid; ev_kuliner uuid; ch_kopi uuid; ev_mural uuid;
  cp_run_start uuid; cp_run_booth uuid; cp_kul_seblak uuid; cp_kul_kopi uuid; cp_ch1 uuid; cp_ch2 uuid; cp_ch3 uuid; cp_mural uuid;
  mis_run_finish uuid; mis_run_booth uuid; mis_run_foto uuid; mis_run_kode uuid;
  mis_kul_kode uuid; mis_kul_foto uuid; mis_kul_kuis uuid;
  mis_ch_foto uuid; mis_ch_kode uuid;
  inv uuid; grp uuid; grp_code text; rw_kopi uuid; rw_kopi2 uuid; rw_seblak uuid; rw_buku uuid;
  p_id uuid; tok text; v_checkin uuid; ms uuid;
  ev_global uuid; cp_global uuid; mis_g_foto uuid; mis_g_kode uuid; mis_g_tur uuid;
  ev_global2 uuid; mis_g2_kode uuid; mis_g2_tebak uuid; mis_g2_cerita uuid;
begin
  set constraints all immediate; -- badge dihitung langsung, bukan ditunda ke akhir transaksi
  if exists (select 1 from auth.users where email like '%@dummy.ramein.id') then
    raise exception 'Data dummy sudah ada. Jalankan dummy-data/bersihkan.sql dulu.';
  end if;

  -- ---------------------------------------------------------------------------
  -- 1. Akun (auth.users + profiles)
  -- ---------------------------------------------------------------------------
  for acc in
    select * from (values
      (u_admin, 'admin@dummy.ramein.id',  'tim_gasyu', 'Tim Gasyu',         'Cimahi',        true,  40),
      (w1,  'rani@dummy.ramein.id',        'rani',       'Rani Puspita',       'Baros',         false, 30),
      (w2,  'dimas@dummy.ramein.id',       'dimas',      'Dimas Aditya',       'Cibabat',       false, 25),
      (w3,  'siti@dummy.ramein.id',        'siti_nur',   'Siti Nurhaliza',     'Melong',        false, 20),
      (w4,  'bagas@dummy.ramein.id',       'bagas',      'Bagas Pratama',      'Padasuka',      false, 18),
      (w5,  'ayu@dummy.ramein.id',         'ayu',        'Ayu Lestari',        'Cipageran',     false, 15),
      (w6,  'fajar@dummy.ramein.id',       'fajar',      'Fajar Ramadhan',     'Leuwigajah',    false, 12),
      (w7,  'nadia@dummy.ramein.id',       'nadia',      'Nadia Safitri',      'Cibeureum',     false, 10),
      (w8,  'rizky@dummy.ramein.id',       'rizky',      'Rizky Maulana',      'Setiamanah',    false, 6),
      (w9,  'tono@dummy.ramein.id',        'pak_tono',   'Tono Suharto',       'Karangmekar',   false, 3),
      (w10, 'vina@dummy.ramein.id',        'vina',       'Vina Anggraini',     null,            false, 1),
      (m1,  'wisnu@dummy.ramein.id',       'wisnu',      'Wisnu Hadi',         'Baros',         false, 45),
      (m2,  'tehai@dummy.ramein.id',       'teh_ai',     'Ai Rohaeti',         'Melong',        false, 44),
      (m3,  'dewi@dummy.ramein.id',        'dewi',       'Dewi Kartika',       'Cimahi',        false, 43),
      (m4,  'jaya@dummy.ramein.id',        'pak_jaya',   'Jaya Sutisna',       'Cibeureum',     false, 42),
      (m5,  'hendra@dummy.ramein.id',      'hendra',     'Hendra Gunawan',     'Cimahi',        false, 41),
      (m6,  'udin@dummy.ramein.id',        'mang_udin',  'Udin Saefudin',      'Padasuka',      false, 2),
      (k1,  'andi@dummy.ramein.id',        'andi_run',   'Andi Firmansyah',    'Baros',         false, 50),
      (k2,  'rudi@dummy.ramein.id',        'rudi',       'Rudi Hartono',       'Cibabat',       false, 48),
      (k3,  'mega@dummy.ramein.id',        'mega',       'Mega Utami',         'Setiamanah',    false, 46),
      (k4,  'lina@dummy.ramein.id',        'lina',       'Lina Marlina',       'Citeureup',     false, 38),
      (k5,  'bayu@dummy.ramein.id',        'bayu',       'Bayu Nugraha',       'Cigugur Tengah',false, 2)
    ) as t(id, email, nickname, full_name, village, is_admin, days_ago)
  loop
    if exists (select 1 from information_schema.columns where table_schema = 'auth' and table_name = 'users' and column_name = 'encrypted_password') then
      insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, recovery_token, email_change_token_new, email_change)
      values ('00000000-0000-0000-0000-000000000000', acc.id, 'authenticated', 'authenticated', acc.email, extensions.crypt(pw, extensions.gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now() - make_interval(days => acc.days_ago), now(), '', '', '', '');
      insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
      values (gen_random_uuid(), acc.id, acc.id::text, 'email', jsonb_build_object('sub', acc.id::text, 'email', acc.email, 'email_verified', true), now(), now(), now());
    else
      -- DB uji lokal tanpa skema auth lengkap
      insert into auth.users (id, email) values (acc.id, acc.email);
    end if;
    -- Kecamatan dari nama kelurahan contoh; Vina (tanpa kelurahan) tinggal di Sukasari, Kota Bandung.
    select coalesce((select parent_id from public.regions where level = 'village' and name = acc.village),
                    (select id from public.regions where code = '32.73.01'))
    into v_district;
    update public.profiles
    set nickname = acc.nickname, full_name = acc.full_name, home_district_id = v_district, is_admin = acc.is_admin,
        terms_accepted_at = now() - make_interval(days => acc.days_ago), onboarded_at = now() - make_interval(days => acc.days_ago),
        created_at = now() - make_interval(days => acc.days_ago)
    where id = acc.id;
  end loop;

  -- ---------------------------------------------------------------------------
  -- 2. Merchant (6) — 5 disetujui, 1 masih menunggu verifikasi
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(m1);
  org_kopi := public.register_organizer('merchant', jsonb_build_object(
    'name', 'Kopi Lereng', 'whatsapp', '081220001001', 'merchant_category', 'kopi', 'nib', '1234567890123',
    'description', 'Kedai kopi lokal dengan biji dari Lereng Burangrang. Favorit: kopi susu gula aren dan roti bakar. Buka 07.00–22.00.',
    'outlets', jsonb_build_array(
      jsonb_build_object('name', 'Kopi Lereng Baros', 'address', 'Jl. Baros No. 10, Baros, Cimahi Tengah', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Baros'), 'lat', -6.8913, 'lng', 107.5412),
      jsonb_build_object('name', 'Kopi Lereng Cibabat', 'address', 'Jl. Kolonel Masturi No. 88, Cibabat, Cimahi Utara', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Cibabat'), 'lat', -6.8601, 'lng', 107.5428))));
  select id into out_kopi_baros from public.merchant_outlets where organizer_id = org_kopi and name like '%Baros';
  select id into out_kopi_cibabat from public.merchant_outlets where organizer_id = org_kopi and name like '%Cibabat';

  perform pg_temp.login(m2);
  org_seblak := public.register_organizer('merchant', jsonb_build_object(
    'name', 'Seblak Teh Ai', 'whatsapp', '081220001002', 'merchant_category', 'kuliner',
    'description', 'Seblak legendaris Melong sejak 2015, level pedas 0–5. Ada seblak seafood, ceker, dan kuah tulang.',
    'outlets', jsonb_build_array(jsonb_build_object('name', 'Warung Seblak Teh Ai', 'address', 'Jl. Melong Asih No. 21, Melong, Cimahi Selatan', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Melong'), 'lat', -6.9305, 'lng', 107.5465))));
  select id into out_seblak from public.merchant_outlets where organizer_id = org_seblak;

  perform pg_temp.login(m3);
  org_batik := public.register_organizer('merchant', jsonb_build_object(
    'name', 'Batik Cimahi Heritage', 'whatsapp', '081220001003', 'merchant_category', 'fesyen', 'nib', '9876543210987',
    'description', 'Batik tulis dan cap motif khas Cimahi: Ciawitali, Pusdik, dan Kujang. Workshop membatik tiap Sabtu.',
    'outlets', jsonb_build_array(jsonb_build_object('name', 'Galeri Batik Cimahi Heritage', 'address', 'Jl. Gatot Subroto No. 45, Cimahi, Cimahi Tengah', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Cimahi'), 'lat', -6.8731, 'lng', 107.5423))));
  select id into out_batik from public.merchant_outlets where organizer_id = org_batik;

  perform pg_temp.login(m4);
  org_bengkel := public.register_organizer('merchant', jsonb_build_object(
    'name', 'Bengkel Motor Jaya', 'whatsapp', '081220001004', 'merchant_category', 'otomotif',
    'description', 'Servis motor semua merek, ganti oli 15 menit, cek gratis untuk warga Cibeureum.',
    'outlets', jsonb_build_array(jsonb_build_object('name', 'Bengkel Motor Jaya', 'address', 'Jl. Cibeureum Raya No. 7, Cibeureum, Cimahi Selatan', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Cibeureum'), 'lat', -6.9108, 'lng', 107.5520))));
  select id into out_bengkel from public.merchant_outlets where organizer_id = org_bengkel;

  perform pg_temp.login(m5);
  org_buku := public.register_organizer('merchant', jsonb_build_object(
    'name', 'Toko Buku Cendekia', 'whatsapp', '081220001005', 'merchant_category', 'retail',
    'description', 'Toko buku dan alat tulis sejak 1998. Ada pojok baca gratis dan diskon pelajar.',
    'outlets', jsonb_build_array(jsonb_build_object('name', 'Toko Buku Cendekia', 'address', 'Jl. Amir Machmud No. 120, Cimahi, Cimahi Tengah', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Cimahi'), 'lat', -6.8745, 'lng', 107.5431))));
  select id into out_buku from public.merchant_outlets where organizer_id = org_buku;

  perform pg_temp.login(m6);
  org_liwet := public.register_organizer('merchant', jsonb_build_object(
    'name', 'Nasi Liwet Mang Udin', 'whatsapp', '081220001006', 'merchant_category', 'kuliner',
    'description', 'Nasi liwet kastrol untuk 4–6 orang, ikan asin peda, sambal terasi. Pesan H-1.',
    'outlets', jsonb_build_array(jsonb_build_object('name', 'Nasi Liwet Mang Udin', 'address', 'Jl. Padasuka No. 3, Padasuka, Cimahi Tengah', 'district_id', (select parent_id from public.regions where level = 'village' and name = 'Padasuka'), 'lat', -6.8810, 'lng', 107.5480))));

  -- ---------------------------------------------------------------------------
  -- 3. Komunitas (5) — 4 disetujui, 1 menunggu verifikasi
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(k1);
  org_run := public.register_organizer('community', jsonb_build_object(
    'name', 'Cimahi Runners', 'whatsapp', '081220002001', 'interest_category', 'olahraga', 'join_policy', 'open', 'est_members', 120,
    'description', 'Komunitas lari santai Cimahi. Lari bareng tiap Sabtu pagi dari Lapangan Rajawali, semua pace boleh ikut.',
    'activity_area_district_id', (select parent_id from public.regions where level = 'village' and name = 'Baros'),
    'basecamp_address', 'Lapangan Rajawali, Jl. Rajawali, Cimahi', 'basecamp_lat', -6.8842, 'basecamp_lng', 107.5365));
  perform pg_temp.login(k2);
  org_gowes := public.register_organizer('community', jsonb_build_object(
    'name', 'Cimahi Gowes', 'whatsapp', '081220002002', 'interest_category', 'olahraga', 'join_policy', 'approval', 'est_members', 80,
    'description', 'Komunitas sepeda santai dan touring. Gowes Minggu pagi keliling Cimahi Utara.',
    'activity_area_district_id', (select parent_id from public.regions where level = 'village' and name = 'Cibabat')));
  perform pg_temp.login(k3);
  org_hub := public.register_organizer('community', jsonb_build_object(
    'name', 'Cimahi Creative Hub', 'whatsapp', '081220002003', 'interest_category', 'seni', 'join_policy', 'approval', 'est_members', 45,
    'description', 'Wadah seniman muda Cimahi: mural, ilustrasi, dan musik indie. Workshop bulanan di Gedung Kesenian.',
    'activity_area_district_id', (select parent_id from public.regions where level = 'village' and name = 'Setiamanah')));
  perform pg_temp.login(k4);
  org_hijau := public.register_organizer('community', jsonb_build_object(
    'name', 'Sahabat Lingkungan Cimahi', 'whatsapp', '081220002004', 'interest_category', 'lingkungan', 'join_policy', 'open', 'est_members', 200,
    'description', 'Gerakan bersih sungai Cimahi dan bank sampah kelurahan. Aksi tiap akhir bulan.',
    'activity_area_district_id', (select parent_id from public.regions where level = 'village' and name = 'Citeureup')));
  perform pg_temp.login(k5);
  org_food := public.register_organizer('community', jsonb_build_object(
    'name', 'Cimahi Foodies', 'whatsapp', '081220002005', 'interest_category', 'hobi', 'join_policy', 'open', 'est_members', 300,
    'description', 'Komunitas pemburu kuliner Cimahi. Review jujur, jalan bareng tiap Jumat malam.',
    'activity_area_district_id', (select parent_id from public.regions where level = 'village' and name = 'Cigugur Tengah')));

  -- Verifikasi oleh admin (Mang Udin dan Cimahi Foodies dibiarkan menunggu untuk demo antrean admin)
  perform pg_temp.login(u_admin);
  perform public.review_organizer(org_kopi, true, null);
  perform public.review_organizer(org_seblak, true, null);
  perform public.review_organizer(org_batik, true, null);
  perform public.review_organizer(org_bengkel, true, null);
  perform public.review_organizer(org_buku, true, null);
  perform public.review_organizer(org_run, true, null);
  perform public.review_organizer(org_gowes, true, null);
  perform public.review_organizer(org_hub, true, null);
  perform public.review_organizer(org_hijau, true, null);

  -- Member komunitas
  perform pg_temp.login(w1); perform public.request_membership(org_run); perform public.request_membership(org_gowes, 'Suka gowes tiap Minggu, boleh gabung?');
  perform pg_temp.login(w2); perform public.request_membership(org_run);
  perform pg_temp.login(w3); perform public.request_membership(org_hijau);
  perform pg_temp.login(w4); perform public.request_membership(org_run); perform public.request_membership(org_hub, 'Saya ilustrator, mau ikut workshop mural.');
  perform pg_temp.login(w5); perform public.request_membership(org_hijau);
  perform pg_temp.login(w6); perform public.request_membership(org_run); perform public.request_membership(org_gowes, 'Punya sepeda lipat, ikut ya.');
  perform pg_temp.login(w7); perform public.request_membership(org_hub, 'Mau belajar mural.');
  perform pg_temp.login(w8); perform public.request_membership(org_run);
  perform pg_temp.login(w9); perform public.request_membership(org_hijau);
  -- Ketua memutuskan: Rani diterima di Gowes, Fajar masih menunggu; Bagas diterima di Hub, Nadia masih menunggu
  perform pg_temp.login(k2); perform public.decide_membership((select id from public.community_memberships where community_id = org_gowes and user_id = w1), true);
  perform pg_temp.login(k3); perform public.decide_membership((select id from public.community_memberships where community_id = org_hub and user_id = w4), true);

  -- ---------------------------------------------------------------------------
  -- 4. Reward merchant
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(m1);
  rw_kopi := public.upsert_reward(org_kopi, null, jsonb_build_object('title', 'Kopi Susu Gula Aren gratis', 'description', 'Tukar di kasir outlet mana pun. Satu voucher satu gelas.', 'price_points', 80, 'stock', 20, 'valid_days', 30));
  rw_kopi2 := public.upsert_reward(org_kopi, null, jsonb_build_object('title', 'Diskon 20% roti bakar', 'description', 'Berlaku untuk semua varian roti bakar.', 'price_points', 40, 'stock', 50, 'valid_days', 14));
  perform pg_temp.login(m2);
  rw_seblak := public.upsert_reward(org_seblak, null, jsonb_build_object('title', 'Seblak gratis level 1–3', 'description', 'Tunjukkan voucher sebelum pesan.', 'price_points', 60, 'stock', 15, 'valid_days', 30));
  perform pg_temp.login(m5);
  rw_buku := public.upsert_reward(org_buku, null, jsonb_build_object('title', 'Potongan Rp20.000 buku apa saja', 'description', 'Minimal belanja Rp50.000.', 'price_points', 100, 'stock', 10, 'valid_days', 60));

  -- ---------------------------------------------------------------------------
  -- 5. Aktivitas 1: Cimahi Night Run 5K (event berbayar, host komunitas, sponsor merchant) — terbit, 3 hari lagi
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(k1);
  ev_run := public.create_activity(org_run, jsonb_build_object(
    'type', 'event', 'goal', 'awareness', 'title', 'Cimahi Night Run 5K',
    'description', 'Lari malam santai 5 km keliling pusat kota Cimahi. Rute: Lapangan Rajawali → Jl. Gatot Subroto → Alun-alun → kembali. Dapat jersey, nomor dada, dan kopi dari Kopi Lereng di garis finish. Usia minimal 15 tahun.',
    'scope_region_id', (select id from public.regions where name = 'Kota Cimahi'),
    'starts_at', (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '3 days 19 hours') at time zone 'Asia/Jakarta',
    'ends_at', (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '3 days 21 hours 30 minutes') at time zone 'Asia/Jakarta',
    'quota', 150, 'join_mode', 'both', 'group_min', 2, 'group_max', 5, 'residency_rule', 'open', 'audience', 'public',
    'is_paid', true, 'price_idr', '35000', 'payment_instructions', 'Transfer ke BCA 7310 2233 44 a.n. Andi Firmansyah (Cimahi Runners), tulis nama + "NightRun" di berita transfer. Bisa juga bayar tunai saat ambil nomor dada di Lapangan Rajawali, H-1 jam 16.00–18.00.', 'payment_window_hours', '48'));
  cp_run_start := public.add_checkpoint(ev_run, jsonb_build_object('name', 'Start/Finish Lapangan Rajawali', 'address', 'Lapangan Rajawali, Jl. Rajawali, Cimahi', 'lat', -6.8842, 'lng', 107.5365, 'radius_m', 150));
  inv := public.invite_partner(ev_run, org_kopi, 'sponsor', 0, 'Halo Kopi Lereng, mau jadi sponsor kopi di garis finish? Booth disediakan.');
  perform pg_temp.login(m1);
  perform public.respond_partner_invite(inv, true, 500);
  cp_run_booth := public.add_checkpoint(ev_run, jsonb_build_object('partner_organizer_id', org_kopi, 'name', 'Booth Kopi Lereng (finish)', 'address', 'Sisi utara Lapangan Rajawali', 'lat', -6.8845, 'lng', 107.5368, 'radius_m', 150));
  mis_run_booth := public.upsert_mission(ev_run, jsonb_build_object('title', 'Mampir booth Kopi Lereng', 'description', 'Scan QR di booth setelah finish, dapat kopi susu gratis.', 'verification', 'qr_scan', 'checkpoint_id', cp_run_booth, 'partner_organizer_id', org_kopi, 'xp_reward', 30, 'is_required', true));
  perform pg_temp.login(k1);
  perform public.set_points_per_completion(ev_run, 50);
  mis_run_finish := public.upsert_mission(ev_run, jsonb_build_object('title', 'Selesaikan rute 5K', 'description', 'Ditandai panitia di garis finish.', 'verification', 'manual', 'xp_reward', 50, 'is_required', true));
  mis_run_foto := public.upsert_mission(ev_run, jsonb_build_object('title', 'Foto di garis finish', 'description', 'Unggah foto kamu dengan medali di gerbang finish.', 'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  mis_run_kode := public.upsert_mission(ev_run, jsonb_build_object('title', 'Kode rahasia dari MC', 'description', 'MC akan menyebut kode di panggung saat pembagian doorprize.', 'verification', 'secret_code', 'code', 'LARI2026', 'xp_reward', 40, 'is_required', false, 'reveal_mode', 'manual', 'show_teaser', true));
  perform public.submit_activity(ev_run);
  perform pg_temp.login(u_admin);
  perform public.review_activity(ev_run, true, null);

  -- Pendaftar: grup Rani (Rani ketua, Bagas, Ayu), Dimas, Siti, Fajar
  perform pg_temp.login(w1);
  grp := public.create_group('Baros Squad');
  select invite_code into grp_code from public.groups where id = grp;
  perform pg_temp.login(w4); perform public.join_group(grp_code);
  perform pg_temp.login(w5); perform public.join_group(grp_code);
  perform pg_temp.login(w1); perform public.register_group(ev_run, grp, array[w1, w4, w5]);
  perform pg_temp.login(w4); perform public.confirm_group_registration((select id from public.participations where activity_id = ev_run and user_id = w4), true);
  perform pg_temp.login(w2); perform public.join_activity(ev_run);
  perform pg_temp.login(w3); perform public.join_activity(ev_run);
  perform pg_temp.login(w6); perform public.join_activity(ev_run);
  -- Panitia menandai Rani dan Bagas lunas (bayar tunai saat ambil nomor dada); Dimas mengirim bukti lewat skrip unggah-gambar
  perform pg_temp.login(k1);
  perform public.confirm_payment((select id from public.participations where activity_id = ev_run and user_id = w1), true, 'Bayar tunai saat ambil nomor dada');
  perform public.confirm_payment((select id from public.participations where activity_id = ev_run and user_id = w4), true, 'Bayar tunai saat ambil nomor dada');

  -- ---------------------------------------------------------------------------
  -- 6. Aktivitas 2: Festival Kuliner Pasar Atas (event gratis, host merchant, cohost merchant) — sedang berjalan hari ini
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(m2);
  ev_kuliner := public.create_activity(org_seblak, jsonb_build_object(
    'type', 'event', 'goal', 'sales', 'title', 'Festival Kuliner Pasar Atas',
    'description', 'Satu hari penuh kuliner Cimahi di pelataran Pasar Atas: seblak level 5, kopi gula aren, cilok, surabi, dan live akustik. Check-in di stand Seblak Teh Ai atau Kopi Lereng, kerjakan misi, kumpulkan poin.',
    'scope_region_id', (select id from public.regions where name = 'Cimahi Tengah'),
    'starts_at', now() + interval '1 day', 'ends_at', now() + interval '1 day 8 hours',
    'quota', 300, 'join_mode', 'individual', 'residency_rule', 'open', 'audience', 'public'));
  cp_kul_seblak := public.add_checkpoint(ev_kuliner, jsonb_build_object('name', 'Stand Seblak Teh Ai', 'address', 'Pelataran Pasar Atas, Jl. Gatot Subroto, Cimahi', 'lat', -6.8728, 'lng', 107.5420, 'radius_m', 150));
  perform public.set_partner_budget((select id from public.activity_partners where activity_id = ev_kuliner and organizer_id = org_seblak), 400);
  perform public.set_points_per_completion(ev_kuliner, 40);
  inv := public.invite_partner(ev_kuliner, org_kopi, 'cohost', 0, 'Buka stand kopi bareng di festival yuk.');
  perform pg_temp.login(m1);
  perform public.respond_partner_invite(inv, true, 300);
  cp_kul_kopi := public.add_checkpoint(ev_kuliner, jsonb_build_object('partner_organizer_id', org_kopi, 'name', 'Stand Kopi Lereng', 'address', 'Pelataran Pasar Atas, sisi timur', 'lat', -6.8730, 'lng', 107.5424, 'radius_m', 150));
  perform pg_temp.login(m2);
  mis_kul_kode := public.upsert_mission(ev_kuliner, jsonb_build_object('title', 'Cicip seblak level 3', 'description', 'Pesan seblak level 3 di stand, kasir memberi kode rahasia di struk.', 'verification', 'secret_code', 'code', 'PEDAS3', 'xp_reward', 30, 'is_required', true));
  mis_kul_foto := public.upsert_mission(ev_kuliner, jsonb_build_object('title', 'Foto bareng Teh Ai', 'description', 'Foto di depan stand bersama Teh Ai, unggah di sini.', 'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  mis_kul_kuis := public.upsert_mission(ev_kuliner, jsonb_build_object('title', 'Kuis kuliner Cimahi', 'description', 'Jawab kuis di panggung jam 15.00, pemenang ditandai panitia.', 'verification', 'manual', 'xp_reward', 10, 'is_required', false, 'reveal_mode', 'manual'));
  perform public.submit_activity(ev_kuliner);
  perform pg_temp.login(u_admin);
  perform public.review_activity(ev_kuliner, true, null);
  update public.activities set starts_at = now() - interval '3 hours', ends_at = now() + interval '5 hours' where id = ev_kuliner; -- sedang berjalan hari ini
  perform public.advance_activity_status();

  -- Peserta dan check-in hari ini
  perform pg_temp.login(w1); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w2); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w3); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w6); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w7); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w8); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w9); perform public.join_activity(ev_kuliner);
  perform pg_temp.login(w10); perform public.join_activity(ev_kuliner);
  select public.qr_token(qr_secret, id, public.qr_slot()) into tok from public.activity_checkpoints where id = cp_kul_seblak;
  perform pg_temp.login(w1); perform public.perform_checkin(cp_kul_seblak, tok, -6.8729, 107.5421);
  perform pg_temp.login(w2); perform public.perform_checkin(cp_kul_seblak, tok, -6.8727, 107.5419);
  perform pg_temp.login(w3); perform public.perform_checkin(cp_kul_seblak, tok, -6.8730, 107.5422);
  perform pg_temp.login(w7); perform public.perform_checkin(cp_kul_seblak, tok, -6.8728, 107.5421);
  perform pg_temp.login(w10); perform public.perform_checkin(cp_kul_seblak, tok, -6.9502, 107.6011); -- di luar radius → ditandai
  select public.qr_token(qr_secret, id, public.qr_slot()) into tok from public.activity_checkpoints where id = cp_kul_kopi;
  perform pg_temp.login(w6); perform public.perform_checkin(cp_kul_kopi, tok, -6.8731, 107.5425);
  -- Misi kode: Rani, Dimas, Nadia selesai (Rani dan Nadia jadi "selesai" + poin); Fajar salah kode 2 kali
  perform pg_temp.login(w1); perform public.complete_mission(mis_kul_kode, null, 'pedas3', null, null, null);
  perform pg_temp.login(w2); perform public.complete_mission(mis_kul_kode, null, 'PEDAS3', null, null, null);
  perform pg_temp.login(w7); perform public.complete_mission(mis_kul_kode, null, 'PEDAS3', null, null, null);
  perform pg_temp.login(w6); perform public.complete_mission(mis_kul_kode, null, 'PEDAS1', null, null, null); perform public.complete_mission(mis_kul_kode, null, 'pedas2', null, null, null);
  -- Kuis dibuka panitia, Rani dan Siti menang
  perform pg_temp.login(m2);
  perform public.reveal_mission(mis_kul_kuis);
  perform public.mark_missions_manual(mis_kul_kuis, array[w1, w3]);

  -- ---------------------------------------------------------------------------
  -- 7. Aktivitas 3: challenge "Jelajah 3 Kedai Kopi Lereng" — berjalan 2 minggu, target 3 checkpoint berbeda
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(m1);
  ch_kopi := public.create_activity(org_kopi, jsonb_build_object(
    'type', 'challenge', 'difficulty', 'medium', 'target_kind', 'distinct_checkpoints', 'target_count', 3, 'target_scope', 'individual',
    'goal', 'visit', 'title', 'Jelajah 3 Kedai Kopi Lereng',
    'description', 'Kunjungi tiga titik Kopi Lereng dalam dua minggu: Baros, Cibabat, dan pop-up di Alun-alun. Scan QR di kasir tiap kunjungan (satu check-in per hari). Selesai = 250 Jejak + 60 poin.',
    'scope_region_id', (select id from public.regions where name = 'Kota Cimahi'),
    'starts_at', now() + interval '1 day', 'ends_at', now() + interval '15 days',
    'join_mode', 'individual', 'residency_rule', 'open', 'audience', 'public'));
  cp_ch1 := public.add_checkpoint(ch_kopi, jsonb_build_object('outlet_id', out_kopi_baros));
  cp_ch2 := public.add_checkpoint(ch_kopi, jsonb_build_object('outlet_id', out_kopi_cibabat));
  cp_ch3 := public.add_checkpoint(ch_kopi, jsonb_build_object('name', 'Pop-up Kopi Lereng Alun-alun', 'address', 'Alun-alun Kota Cimahi, Jl. Amir Machmud', 'lat', -6.8737, 'lng', 107.5433, 'radius_m', 150));
  perform public.set_partner_budget((select id from public.activity_partners where activity_id = ch_kopi and organizer_id = org_kopi), 600);
  perform public.set_points_per_completion(ch_kopi, 60);
  mis_ch_kode := public.upsert_mission(ch_kopi, jsonb_build_object('title', 'Kode di struk', 'description', 'Tiap struk Kopi Lereng ada kode. Masukkan sekali saja.', 'verification', 'secret_code', 'code', 'ARENKU', 'xp_reward', 30, 'is_required', false));
  mis_ch_foto := public.upsert_mission(ch_kopi, jsonb_build_object('title', 'Ulasan di media sosial', 'description', 'Unggah tangkapan layar ulasanmu tentang Kopi Lereng.', 'verification', 'photo', 'xp_reward', 20, 'is_required', false));
  perform public.submit_activity(ch_kopi);
  perform pg_temp.login(u_admin);
  perform public.review_activity(ch_kopi, true, null);
  update public.activities set starts_at = now() - interval '5 days', ends_at = now() + interval '9 days' where id = ch_kopi; -- sudah berjalan 5 hari
  perform public.advance_activity_status();

  perform pg_temp.login(w5); perform public.join_activity(ch_kopi);
  perform pg_temp.login(w4); perform public.join_activity(ch_kopi);
  perform pg_temp.login(w7); perform public.join_activity(ch_kopi);
  perform pg_temp.login(w8); perform public.join_activity(ch_kopi);
  -- Nadia: 3 kunjungan (2 di hari lalu, 1 hari ini) → selesai
  alter table public.checkins disable trigger checkins_guard;
  select public.qr_token(qr_secret, id, public.qr_slot()) into tok from public.activity_checkpoints where id = cp_ch1;
  perform pg_temp.login(w7); perform public.perform_checkin(cp_ch1, tok, -6.8914, 107.5413);
  update public.checkins set checked_in_at = checked_in_at - interval '4 days', local_date = local_date - 4 where user_id = w7 and checkpoint_id = cp_ch1;
  perform pg_temp.login(w5); perform public.perform_checkin(cp_ch1, tok, -6.8912, 107.5411);
  update public.checkins set checked_in_at = checked_in_at - interval '3 days', local_date = local_date - 3 where user_id = w5 and checkpoint_id = cp_ch1;
  perform pg_temp.login(w4); perform public.perform_checkin(cp_ch1, tok, -6.8915, 107.5410);
  select public.qr_token(qr_secret, id, public.qr_slot()) into tok from public.activity_checkpoints where id = cp_ch2;
  perform pg_temp.login(w7); perform public.perform_checkin(cp_ch2, tok, -6.8602, 107.5429);
  update public.checkins set checked_in_at = checked_in_at - interval '2 days', local_date = local_date - 2 where user_id = w7 and checkpoint_id = cp_ch2;
  perform pg_temp.login(w5); perform public.perform_checkin(cp_ch2, tok, -6.8600, 107.5427);
  alter table public.checkins enable trigger checkins_guard;
  -- Kode struk (misi bonus) dikerjakan sebelum kunjungan terakhir
  perform pg_temp.login(w7); perform public.complete_mission(mis_ch_kode, null, 'ARENKU', null, null, null);
  perform pg_temp.login(w5); perform public.complete_mission(mis_ch_kode, null, 'arenku', null, null, null);
  select public.qr_token(qr_secret, id, public.qr_slot()) into tok from public.activity_checkpoints where id = cp_ch3;
  perform pg_temp.login(w7); perform public.perform_checkin(cp_ch3, tok, -6.8738, 107.5434); -- kunjungan ke-3 → challenge selesai

  -- Nadia menukar poin jadi voucher kopi
  perform pg_temp.login(w7); perform public.redeem_reward(rw_kopi);

  -- ---------------------------------------------------------------------------
  -- 8. Aktivitas 4: Workshop Mural (host komunitas) — masih menunggu review admin
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(k3);
  ev_mural := public.create_activity(org_hub, jsonb_build_object(
    'type', 'event', 'goal', 'membership', 'title', 'Workshop Mural Tembok Pasar',
    'description', 'Belajar mural bareng seniman Cimahi Creative Hub, lalu mengecat tembok sepanjang 20 m di Pasar Antri. Cat dan kuas disediakan. Khusus member komunitas.',
    'scope_region_id', (select parent_id from public.regions where level = 'village' and name = 'Setiamanah'),
    'starts_at', (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '8 days 8 hours') at time zone 'Asia/Jakarta',
    'ends_at', (date_trunc('day', now() at time zone 'Asia/Jakarta') + interval '8 days 12 hours') at time zone 'Asia/Jakarta',
    'quota', 30, 'join_mode', 'individual', 'residency_rule', 'open', 'audience', 'members_only'));
  cp_mural := public.add_checkpoint(ev_mural, jsonb_build_object('name', 'Tembok Pasar Antri', 'address', 'Jl. Gandawijaya, Setiamanah, Cimahi', 'lat', -6.8768, 'lng', 107.5401, 'radius_m', 150));
  perform public.upsert_mission(ev_mural, jsonb_build_object('title', 'Selesaikan panel muralmu', 'description', 'Ditandai mentor setelah panel 2x2 m selesai.', 'verification', 'manual', 'xp_reward', 60, 'is_required', true));
  perform public.submit_activity(ev_mural);

  -- ---------------------------------------------------------------------------
  -- 8b. Event Global: Lomba Foto Wisata Cimahi (admin, online + di lokasi, terbuka untuk semua kota) — sedang berjalan
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(u_admin);
  ev_global := public.create_activity(public.platform_organizer_id(), jsonb_build_object(
    'type', 'event', 'goal', 'awareness', 'title', 'Lomba Foto Wisata Cimahi',
    'description', 'Abadikan sudut wisata Cimahi dan kumpulkan skor dari misi. Terbuka untuk pengunjung dari kota mana pun. Check-in di Alun-alun Cimahi, ikut tur sejarah, dan temukan kode rahasia di papan informasi. Skor tertinggi membawa pulang hadiah.',
    'starts_at', now() + interval '1 day', 'ends_at', now() + interval '8 days',
    'quota', 500, 'join_mode', 'individual', 'residency_rule', 'open', 'audience', 'public'));
  perform public.set_activity_reach(ev_global, 'global', 'hybrid');
  perform public.admin_add_partner(ev_global, org_kopi, 'sponsor', 'Penyedia voucher juara 2–3');
  cp_global := public.add_checkpoint(ev_global, jsonb_build_object('name', 'Alun-alun Cimahi', 'address', 'Jl. Raden Demang Hardjakusumah, Cimahi', 'lat', -6.8722, 'lng', 107.5425, 'radius_m', 150));
  mis_g_foto := public.upsert_mission(ev_global, jsonb_build_object('title', 'Foto ikon wisata Cimahi', 'description', 'Unggah foto kamu di salah satu ikon: Alun-alun, Masjid Agung, atau Taman Kartini.', 'verification', 'photo', 'score_reward', 300, 'is_required', false));
  mis_g_kode := public.upsert_mission(ev_global, jsonb_build_object('title', 'Kode di papan informasi', 'description', 'Cari kode rahasia di papan informasi wisata Alun-alun.', 'verification', 'secret_code', 'code', 'WISATA', 'score_reward', 200, 'is_required', false));
  mis_g_tur := public.upsert_mission(ev_global, jsonb_build_object('title', 'Ikut tur sejarah', 'description', 'Ikut tur jalan kaki bersama pemandu, ditandai panitia di akhir tur.', 'verification', 'manual', 'score_reward', 500, 'is_required', false));
  perform public.upsert_activity_prize(ev_global, jsonb_build_object('rank_from', 1, 'rank_to', 1, 'title', 'Kamera mirrorless + medali', 'description', 'Untuk skor tertinggi. Dikirim panitia Gasyu ke alamat pemenang.', 'kind', 'physical', 'fulfillment', 'shipping', 'min_score', 300));
  perform public.upsert_activity_prize(ev_global, jsonb_build_object('rank_from', 2, 'rank_to', 3, 'title', 'Voucher ngopi Rp150.000', 'kind', 'voucher', 'fulfillment', 'pickup', 'sponsor_organizer_id', org_kopi,
    'pickup_note', 'Ambil di Kopi Lereng Cabang Baros, tunjukkan halaman Hadiah. Senin–Sabtu 10.00–21.00.', 'min_score', 200));
  perform public.upsert_activity_prize(ev_global, jsonb_build_object('rank_from', 4, 'rank_to', 10, 'title', 'Badge Penjelajah Wisata Cimahi', 'kind', 'badge',
    'badge_id', public.create_prize_badge('Penjelajah Wisata Cimahi', 'Masuk 10 besar Lomba Foto Wisata Cimahi'), 'min_score', 100));
  perform public.submit_activity(ev_global);
  update public.activities set starts_at = now() - interval '2 days', ends_at = now() + interval '5 days' where id = ev_global; -- sedang berjalan
  perform public.advance_activity_status();

  -- Peserta dari Cimahi dan luar kota; skor dari check-in, kode, dan tur
  perform pg_temp.login(w1); perform public.join_activity(ev_global);
  perform pg_temp.login(w2); perform public.join_activity(ev_global);
  perform pg_temp.login(w3); perform public.join_activity(ev_global);
  perform pg_temp.login(w7); perform public.join_activity(ev_global);
  perform pg_temp.login(w10); perform public.join_activity(ev_global);
  select public.qr_token(qr_secret, id, public.qr_slot()) into tok from public.activity_checkpoints where id = cp_global;
  perform pg_temp.login(w1); perform public.perform_checkin(cp_global, tok, -6.8723, 107.5426);
  perform pg_temp.login(w10); perform public.perform_checkin(cp_global, tok, -6.8721, 107.5424);
  perform pg_temp.login(w2); perform public.perform_checkin(cp_global, tok, -6.8722, 107.5427);
  perform pg_temp.login(w10); perform public.complete_mission(mis_g_kode, null, 'wisata', null, null, null);
  perform pg_temp.login(w1); perform public.complete_mission(mis_g_kode, null, 'WISATA', null, null, null);
  perform pg_temp.login(w7); perform public.complete_mission(mis_g_kode, null, 'WISATA', null, null, null);
  perform pg_temp.login(u_admin);
  perform public.mark_missions_manual(mis_g_tur, array[w10]);

  -- ---------------------------------------------------------------------------
  -- 8c. Event Global yang sudah selesai: Tantangan Online HUT Cimahi (online) — pemenang ditetapkan, hadiah siap diklaim
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(u_admin);
  ev_global2 := public.create_activity(public.platform_organizer_id(), jsonb_build_object(
    'type', 'event', 'goal', 'awareness', 'title', 'Tantangan Online HUT Cimahi',
    'description', 'Tantangan online menyambut hari jadi Kota Cimahi. Jawab kuis sejarah lewat kode rahasia di siaran langsung dan ikut sesi tebak foto lawas. Terbuka untuk semua kota.',
    'starts_at', now() + interval '1 day', 'ends_at', now() + interval '2 days',
    'join_mode', 'individual', 'residency_rule', 'open', 'audience', 'public'));
  perform public.set_activity_reach(ev_global2, 'global', 'online');
  perform public.admin_add_partner(ev_global2, org_kopi, 'sponsor', 'Penyedia voucher juara 2–3');
  mis_g2_kode := public.upsert_mission(ev_global2, jsonb_build_object('title', 'Kode kuis siaran langsung', 'description', 'Kode diumumkan pembawa acara di akhir siaran.', 'verification', 'secret_code', 'code', 'HUTCIMAHI', 'score_reward', 300, 'is_required', false));
  mis_g2_tebak := public.upsert_mission(ev_global2, jsonb_build_object('title', 'Tebak foto lawas', 'description', 'Ditandai panitia untuk jawaban yang benar.', 'verification', 'manual', 'score_reward', 500, 'is_required', false));
  mis_g2_cerita := public.upsert_mission(ev_global2, jsonb_build_object('title', 'Cerita kenangan Cimahi', 'description', 'Kirim cerita singkat di kolom komentar siaran, cerita terpilih ditandai panitia.', 'verification', 'manual', 'score_reward', 150, 'is_required', false));
  perform public.upsert_activity_prize(ev_global2, jsonb_build_object('rank_from', 1, 'rank_to', 1, 'title', 'Tumbler + kaos HUT Cimahi', 'description', 'Dikirim panitia Gasyu ke alamat pemenang.', 'kind', 'physical', 'fulfillment', 'shipping', 'min_score', 100));
  perform public.upsert_activity_prize(ev_global2, jsonb_build_object('rank_from', 2, 'rank_to', 3, 'title', 'Voucher ngopi Rp100.000', 'kind', 'voucher', 'fulfillment', 'pickup', 'sponsor_organizer_id', org_kopi,
    'pickup_note', 'Ambil di Kopi Lereng Cabang Baros, tunjukkan halaman Hadiah. Senin–Sabtu 10.00–21.00.', 'min_score', 100));
  perform public.submit_activity(ev_global2);
  update public.activities set starts_at = now() - interval '5 days', ends_at = now() + interval '1 hour' where id = ev_global2;
  perform public.advance_activity_status();
  perform pg_temp.login(w1); perform public.join_activity(ev_global2);
  perform pg_temp.login(w3); perform public.join_activity(ev_global2);
  perform pg_temp.login(w10); perform public.join_activity(ev_global2);
  perform pg_temp.login(w1); perform public.complete_mission(mis_g2_kode, null, 'hutcimahi', null, null, null);
  perform pg_temp.login(w10); perform public.complete_mission(mis_g2_kode, null, 'HUTCIMAHI', null, null, null);
  perform pg_temp.login(u_admin);
  perform public.mark_missions_manual(mis_g2_tebak, array[w1]);
  perform public.mark_missions_manual(mis_g2_cerita, array[w3]);
  -- Acara berakhir 3 hari lalu: lewat masa verifikasi 48 jam, jadi settled dan pemenang ditetapkan otomatis.
  update public.activities set ends_at = now() - interval '3 days' where id = ev_global2;
  perform public.advance_activity_status();
  perform public.settle_ended_activities();
  -- Vina (juara 2) sudah mengklaim voucher; Rani (juara 1) dan Siti (juara 3) belum.
  perform pg_temp.login(w10);
  perform public.claim_prize((select id from public.activity_winners where activity_id = ev_global2 and user_id = w10), null);

  -- ---------------------------------------------------------------------------
  -- 10. Saran warga (fitur saran, migrasi 0014)
  -- ---------------------------------------------------------------------------
  perform pg_temp.login(w1);
  perform public.submit_suggestion(org_kopi, 'product', 'Tolong tambah pilihan kopi susu tanpa gula ya, sekarang semua menu susunya manis.');
  perform public.submit_suggestion(org_run, 'activity', 'Bagaimana kalau ada sesi lari pagi khusus pemula tiap Sabtu, pace santai 8 menit per km?');
  perform pg_temp.login(w2);
  perform public.submit_suggestion(org_kopi, 'place', 'Colokan di cabang Cibabat cuma dua. Kalau bisa tambah di meja panjang dekat jendela.', true);
  perform pg_temp.login(w3);
  perform public.submit_suggestion(org_seblak, 'service', 'Antrean di stand festival lama karena bayar dan ambil pesanan di satu tempat. Mungkin bisa dipisah?');
  perform pg_temp.login(w7);
  perform public.submit_suggestion(org_kopi, 'activity', 'Bikin kelas latte art buat pemula di akhir pekan dong, pasti banyak yang ikut.');
  perform pg_temp.login(w9);
  perform public.submit_suggestion(org_hijau, 'activity', 'Ajak warga Karangmekar bersih-bersih Sungai Cimahi, saya bisa bantu kumpulkan bapak-bapak RW.');
  -- Tanggapan tim: Wisnu menindaklanjuti, Andi menyelesaikan
  perform pg_temp.login(m1);
  perform public.respond_suggestion((select id from public.suggestions where organizer_id = org_kopi and user_id = w1 order by created_at desc limit 1),
    'in_progress', 'Siap, Kak Rani. Kami lagi uji resep kopi susu aren tanpa gula, rencananya masuk menu bulan depan.');
  perform pg_temp.login(k1);
  perform public.respond_suggestion((select id from public.suggestions where organizer_id = org_run and user_id = w1 order by created_at desc limit 1),
    'done', 'Sudah jalan mulai Sabtu ini jam 06.00 dari Lapangan Rajawali. Sampai ketemu!');

  -- ---------------------------------------------------------------------------
  -- 9. Deteksi pola (untuk antrean moderasi) dan catatan
  -- ---------------------------------------------------------------------------
  perform public.detect_fraud_patterns();
  raise notice 'Data dummy selesai. Night Run=% Festival=% Challenge=% Mural=% Event Global=%', ev_run, ev_kuliner, ch_kopi, ev_mural, ev_global;
end $seed$;

-- Ringkasan untuk dicatat
select o.type, o.name, o.slug, o.status, o.id from public.organizers o
where o.created_by::text like 'dd000000-%' order by o.type, o.name;
select a.title, a.type, a.status, a.id from public.activities a
where a.created_by::text like 'dd000000-%' order by a.starts_at;
