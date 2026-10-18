-- 0022: Event Global (ALUR-SISTEM bagian 22) dan kota asal warga luar Cimahi.
--
-- Event Global terbuka untuk pengguna dari kota mana pun. Check-in dan misinya menghasilkan
-- skor event (activity_score_ledger), terpisah total dari XP dan poin; peringkat per event;
-- hadiah per rentang peringkat diklaim pemenang.
--
-- Isi:
--   * cities (514 kota/kabupaten, kode Kemendagri) + profiles.home_city_code + set_home_city.
--   * enum activity_reach, activity_location_mode, score_reason, prize_kind, prize_fulfillment,
--     winner_status; kolom activities.reach/location_mode dan activity_missions.score_reward.
--   * Penjaga: trigger aturan Event Global di activities, checkpoint, partner; xp_ledger dan
--     point_ledger menolak aktivitas global; misi global hanya skor.
--   * activity_score_ledger, activity_prizes, activity_winners + RLS (alamat hanya pemenang/admin).
--   * award_activity_score (satu-satunya jalan skor positif), v_activity_scoreboard,
--     get_activity_leaderboard, set_activity_reach, upsert/remove_activity_prize, create_prize_badge,
--     finalize_activity_winners, claim_prize, mark_prize_delivered, forfeit_prize,
--     get_winner_shipping, process_prizes (cron), v_global_event_stats.
--   * Fungsi lama yang bercabang pada reach: perform_checkin, apply_mission_approval,
--     evaluate_completion, review_mission_completion, mark_missions_manual, reverse_checkin,
--     submit_activity, settle_ended_activities, upsert_mission, check_mission_row,
--     get_activity_missions; change_home_village dan delete_my_account ikut kota asal.

insert into public.app_settings (key, value) values
  ('global_event.checkin_score', '100'),
  ('global_event.score_min', '10'),
  ('global_event.score_max', '1000'),
  ('global_event.max_total_score', '5000'),
  ('global_event.max_prize_rank', '100'),
  ('global_event.claim_days', '14'),
  ('global_event.claim_reminder_days', '3'),
  ('global_event.shipping_retention_days', '30')
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Kota asal warga luar Cimahi
-- -----------------------------------------------------------------------------

-- Daftar kota/kabupaten Indonesia (kode Kemendagri, sumber paket idn-area-data 4.0.1, lisensi MIT).
create table public.cities (
  code text primary key check (code ~ '^[0-9]{2}\.[0-9]{2}$'),
  province_code text not null,
  province_name text not null,
  name text not null
);

insert into public.cities (code, province_code, province_name, name) values
  ('11.01', '11', 'Aceh', 'Kabupaten Aceh Selatan'),
  ('11.02', '11', 'Aceh', 'Kabupaten Aceh Tenggara'),
  ('11.03', '11', 'Aceh', 'Kabupaten Aceh Timur'),
  ('11.04', '11', 'Aceh', 'Kabupaten Aceh Tengah'),
  ('11.05', '11', 'Aceh', 'Kabupaten Aceh Barat'),
  ('11.06', '11', 'Aceh', 'Kabupaten Aceh Besar'),
  ('11.07', '11', 'Aceh', 'Kabupaten Pidie'),
  ('11.08', '11', 'Aceh', 'Kabupaten Aceh Utara'),
  ('11.09', '11', 'Aceh', 'Kabupaten Simeulue'),
  ('11.10', '11', 'Aceh', 'Kabupaten Aceh Singkil'),
  ('11.11', '11', 'Aceh', 'Kabupaten Bireuen'),
  ('11.12', '11', 'Aceh', 'Kabupaten Aceh Barat Daya'),
  ('11.13', '11', 'Aceh', 'Kabupaten Gayo Lues'),
  ('11.14', '11', 'Aceh', 'Kabupaten Aceh Jaya'),
  ('11.15', '11', 'Aceh', 'Kabupaten Nagan Raya'),
  ('11.16', '11', 'Aceh', 'Kabupaten Aceh Tamiang'),
  ('11.17', '11', 'Aceh', 'Kabupaten Bener Meriah'),
  ('11.18', '11', 'Aceh', 'Kabupaten Pidie Jaya'),
  ('11.71', '11', 'Aceh', 'Kota Banda Aceh'),
  ('11.72', '11', 'Aceh', 'Kota Sabang'),
  ('11.73', '11', 'Aceh', 'Kota Lhokseumawe'),
  ('11.74', '11', 'Aceh', 'Kota Langsa'),
  ('11.75', '11', 'Aceh', 'Kota Subulussalam'),
  ('12.01', '12', 'Sumatera Utara', 'Kabupaten Tapanuli Tengah'),
  ('12.02', '12', 'Sumatera Utara', 'Kabupaten Tapanuli Utara'),
  ('12.03', '12', 'Sumatera Utara', 'Kabupaten Tapanuli Selatan'),
  ('12.04', '12', 'Sumatera Utara', 'Kabupaten Nias'),
  ('12.05', '12', 'Sumatera Utara', 'Kabupaten Langkat'),
  ('12.06', '12', 'Sumatera Utara', 'Kabupaten Karo'),
  ('12.07', '12', 'Sumatera Utara', 'Kabupaten Deli Serdang'),
  ('12.08', '12', 'Sumatera Utara', 'Kabupaten Simalungun'),
  ('12.09', '12', 'Sumatera Utara', 'Kabupaten Asahan'),
  ('12.10', '12', 'Sumatera Utara', 'Kabupaten Labuhanbatu'),
  ('12.11', '12', 'Sumatera Utara', 'Kabupaten Dairi'),
  ('12.12', '12', 'Sumatera Utara', 'Kabupaten Toba'),
  ('12.13', '12', 'Sumatera Utara', 'Kabupaten Mandailing Natal'),
  ('12.14', '12', 'Sumatera Utara', 'Kabupaten Nias Selatan'),
  ('12.15', '12', 'Sumatera Utara', 'Kabupaten Pakpak Bharat'),
  ('12.16', '12', 'Sumatera Utara', 'Kabupaten Humbang Hasundutan'),
  ('12.17', '12', 'Sumatera Utara', 'Kabupaten Samosir'),
  ('12.18', '12', 'Sumatera Utara', 'Kabupaten Serdang Bedagai'),
  ('12.19', '12', 'Sumatera Utara', 'Kabupaten Batu Bara'),
  ('12.20', '12', 'Sumatera Utara', 'Kabupaten Padang Lawas Utara'),
  ('12.21', '12', 'Sumatera Utara', 'Kabupaten Padang Lawas'),
  ('12.22', '12', 'Sumatera Utara', 'Kabupaten Labuhanbatu Selatan'),
  ('12.23', '12', 'Sumatera Utara', 'Kabupaten Labuhanbatu Utara'),
  ('12.24', '12', 'Sumatera Utara', 'Kabupaten Nias Utara'),
  ('12.25', '12', 'Sumatera Utara', 'Kabupaten Nias Barat'),
  ('12.71', '12', 'Sumatera Utara', 'Kota Medan'),
  ('12.72', '12', 'Sumatera Utara', 'Kota Pematangsiantar'),
  ('12.73', '12', 'Sumatera Utara', 'Kota Sibolga'),
  ('12.74', '12', 'Sumatera Utara', 'Kota Tanjungbalai'),
  ('12.75', '12', 'Sumatera Utara', 'Kota Binjai'),
  ('12.76', '12', 'Sumatera Utara', 'Kota Tebing Tinggi'),
  ('12.77', '12', 'Sumatera Utara', 'Kota Padangsidimpuan'),
  ('12.78', '12', 'Sumatera Utara', 'Kota Gunungsitoli'),
  ('13.01', '13', 'Sumatera Barat', 'Kabupaten Pesisir Selatan'),
  ('13.02', '13', 'Sumatera Barat', 'Kabupaten Solok'),
  ('13.03', '13', 'Sumatera Barat', 'Kabupaten Sijunjung'),
  ('13.04', '13', 'Sumatera Barat', 'Kabupaten Tanah Datar'),
  ('13.05', '13', 'Sumatera Barat', 'Kabupaten Padang Pariaman'),
  ('13.06', '13', 'Sumatera Barat', 'Kabupaten Agam'),
  ('13.07', '13', 'Sumatera Barat', 'Kabupaten Lima Puluh Kota'),
  ('13.08', '13', 'Sumatera Barat', 'Kabupaten Pasaman'),
  ('13.09', '13', 'Sumatera Barat', 'Kabupaten Kepulauan Mentawai'),
  ('13.10', '13', 'Sumatera Barat', 'Kabupaten Dharmasraya'),
  ('13.11', '13', 'Sumatera Barat', 'Kabupaten Solok Selatan'),
  ('13.12', '13', 'Sumatera Barat', 'Kabupaten Pasaman Barat'),
  ('13.71', '13', 'Sumatera Barat', 'Kota Padang'),
  ('13.72', '13', 'Sumatera Barat', 'Kota Solok'),
  ('13.73', '13', 'Sumatera Barat', 'Kota Sawahlunto'),
  ('13.74', '13', 'Sumatera Barat', 'Kota Padang Panjang'),
  ('13.75', '13', 'Sumatera Barat', 'Kota Bukittinggi'),
  ('13.76', '13', 'Sumatera Barat', 'Kota Payakumbuh'),
  ('13.77', '13', 'Sumatera Barat', 'Kota Pariaman'),
  ('14.01', '14', 'Riau', 'Kabupaten Kampar'),
  ('14.02', '14', 'Riau', 'Kabupaten Indragiri Hulu'),
  ('14.03', '14', 'Riau', 'Kabupaten Bengkalis'),
  ('14.04', '14', 'Riau', 'Kabupaten Indragiri Hilir'),
  ('14.05', '14', 'Riau', 'Kabupaten Pelalawan'),
  ('14.06', '14', 'Riau', 'Kabupaten Rokan Hulu'),
  ('14.07', '14', 'Riau', 'Kabupaten Rokan Hilir'),
  ('14.08', '14', 'Riau', 'Kabupaten Siak'),
  ('14.09', '14', 'Riau', 'Kabupaten Kuantan Singingi'),
  ('14.10', '14', 'Riau', 'Kabupaten Kepulauan Meranti'),
  ('14.71', '14', 'Riau', 'Kota Pekanbaru'),
  ('14.72', '14', 'Riau', 'Kota Dumai'),
  ('15.01', '15', 'Jambi', 'Kabupaten Kerinci'),
  ('15.02', '15', 'Jambi', 'Kabupaten Merangin'),
  ('15.03', '15', 'Jambi', 'Kabupaten Sarolangun'),
  ('15.04', '15', 'Jambi', 'Kabupaten Batanghari'),
  ('15.05', '15', 'Jambi', 'Kabupaten Muaro Jambi'),
  ('15.06', '15', 'Jambi', 'Kabupaten Tanjung Jabung Barat'),
  ('15.07', '15', 'Jambi', 'Kabupaten Tanjung Jabung Timur'),
  ('15.08', '15', 'Jambi', 'Kabupaten Bungo'),
  ('15.09', '15', 'Jambi', 'Kabupaten Tebo'),
  ('15.71', '15', 'Jambi', 'Kota Jambi'),
  ('15.72', '15', 'Jambi', 'Kota Sungai Penuh'),
  ('16.01', '16', 'Sumatera Selatan', 'Kabupaten Ogan Komering Ulu'),
  ('16.02', '16', 'Sumatera Selatan', 'Kabupaten Ogan Komering Ilir'),
  ('16.03', '16', 'Sumatera Selatan', 'Kabupaten Muara Enim'),
  ('16.04', '16', 'Sumatera Selatan', 'Kabupaten Lahat'),
  ('16.05', '16', 'Sumatera Selatan', 'Kabupaten Musi Rawas'),
  ('16.06', '16', 'Sumatera Selatan', 'Kabupaten Musi Banyuasin'),
  ('16.07', '16', 'Sumatera Selatan', 'Kabupaten Banyuasin'),
  ('16.08', '16', 'Sumatera Selatan', 'Kabupaten Ogan Komering Ulu Timur'),
  ('16.09', '16', 'Sumatera Selatan', 'Kabupaten Ogan Komering Ulu Selatan'),
  ('16.10', '16', 'Sumatera Selatan', 'Kabupaten Ogan Ilir'),
  ('16.11', '16', 'Sumatera Selatan', 'Kabupaten Empat Lawang'),
  ('16.12', '16', 'Sumatera Selatan', 'Kabupaten Penukal Abab Lematang Ilir'),
  ('16.13', '16', 'Sumatera Selatan', 'Kabupaten Musi Rawas Utara'),
  ('16.71', '16', 'Sumatera Selatan', 'Kota Palembang'),
  ('16.72', '16', 'Sumatera Selatan', 'Kota Pagar Alam'),
  ('16.73', '16', 'Sumatera Selatan', 'Kota Lubuk Linggau'),
  ('16.74', '16', 'Sumatera Selatan', 'Kota Prabumulih'),
  ('17.01', '17', 'Bengkulu', 'Kabupaten Bengkulu Selatan'),
  ('17.02', '17', 'Bengkulu', 'Kabupaten Rejang Lebong'),
  ('17.03', '17', 'Bengkulu', 'Kabupaten Bengkulu Utara'),
  ('17.04', '17', 'Bengkulu', 'Kabupaten Kaur'),
  ('17.05', '17', 'Bengkulu', 'Kabupaten Seluma'),
  ('17.06', '17', 'Bengkulu', 'Kabupaten Mukomuko'),
  ('17.07', '17', 'Bengkulu', 'Kabupaten Lebong'),
  ('17.08', '17', 'Bengkulu', 'Kabupaten Kepahiang'),
  ('17.09', '17', 'Bengkulu', 'Kabupaten Bengkulu Tengah'),
  ('17.71', '17', 'Bengkulu', 'Kota Bengkulu'),
  ('18.01', '18', 'Lampung', 'Kabupaten Lampung Selatan'),
  ('18.02', '18', 'Lampung', 'Kabupaten Lampung Tengah'),
  ('18.03', '18', 'Lampung', 'Kabupaten Lampung Utara'),
  ('18.04', '18', 'Lampung', 'Kabupaten Lampung Barat'),
  ('18.05', '18', 'Lampung', 'Kabupaten Tulang Bawang'),
  ('18.06', '18', 'Lampung', 'Kabupaten Tanggamus'),
  ('18.07', '18', 'Lampung', 'Kabupaten Lampung Timur'),
  ('18.08', '18', 'Lampung', 'Kabupaten Way Kanan'),
  ('18.09', '18', 'Lampung', 'Kabupaten Pesawaran'),
  ('18.10', '18', 'Lampung', 'Kabupaten Pringsewu'),
  ('18.11', '18', 'Lampung', 'Kabupaten Mesuji'),
  ('18.12', '18', 'Lampung', 'Kabupaten Tulang Bawang Barat'),
  ('18.13', '18', 'Lampung', 'Kabupaten Pesisir Barat'),
  ('18.71', '18', 'Lampung', 'Kota Bandar Lampung'),
  ('18.72', '18', 'Lampung', 'Kota Metro'),
  ('19.01', '19', 'Kepulauan Bangka Belitung', 'Kabupaten Bangka'),
  ('19.02', '19', 'Kepulauan Bangka Belitung', 'Kabupaten Belitung'),
  ('19.03', '19', 'Kepulauan Bangka Belitung', 'Kabupaten Bangka Selatan'),
  ('19.04', '19', 'Kepulauan Bangka Belitung', 'Kabupaten Bangka Tengah'),
  ('19.05', '19', 'Kepulauan Bangka Belitung', 'Kabupaten Bangka Barat'),
  ('19.06', '19', 'Kepulauan Bangka Belitung', 'Kabupaten Belitung Timur'),
  ('19.71', '19', 'Kepulauan Bangka Belitung', 'Kota Pangkal Pinang'),
  ('21.01', '21', 'Kepulauan Riau', 'Kabupaten Bintan'),
  ('21.02', '21', 'Kepulauan Riau', 'Kabupaten Karimun'),
  ('21.03', '21', 'Kepulauan Riau', 'Kabupaten Natuna'),
  ('21.04', '21', 'Kepulauan Riau', 'Kabupaten Lingga'),
  ('21.05', '21', 'Kepulauan Riau', 'Kabupaten Kepulauan Anambas'),
  ('21.71', '21', 'Kepulauan Riau', 'Kota Batam'),
  ('21.72', '21', 'Kepulauan Riau', 'Kota Tanjung Pinang'),
  ('31.01', '31', 'Daerah Khusus Ibukota Jakarta', 'Kabupaten Administrasi Kepulauan Seribu'),
  ('31.71', '31', 'Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Pusat'),
  ('31.72', '31', 'Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Utara'),
  ('31.73', '31', 'Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Barat'),
  ('31.74', '31', 'Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Selatan'),
  ('31.75', '31', 'Daerah Khusus Ibukota Jakarta', 'Kota Administrasi Jakarta Timur'),
  ('32.01', '32', 'Jawa Barat', 'Kabupaten Bogor'),
  ('32.02', '32', 'Jawa Barat', 'Kabupaten Sukabumi'),
  ('32.03', '32', 'Jawa Barat', 'Kabupaten Cianjur'),
  ('32.04', '32', 'Jawa Barat', 'Kabupaten Bandung'),
  ('32.05', '32', 'Jawa Barat', 'Kabupaten Garut'),
  ('32.06', '32', 'Jawa Barat', 'Kabupaten Tasikmalaya'),
  ('32.07', '32', 'Jawa Barat', 'Kabupaten Ciamis'),
  ('32.08', '32', 'Jawa Barat', 'Kabupaten Kuningan'),
  ('32.09', '32', 'Jawa Barat', 'Kabupaten Cirebon'),
  ('32.10', '32', 'Jawa Barat', 'Kabupaten Majalengka'),
  ('32.11', '32', 'Jawa Barat', 'Kabupaten Sumedang'),
  ('32.12', '32', 'Jawa Barat', 'Kabupaten Indramayu'),
  ('32.13', '32', 'Jawa Barat', 'Kabupaten Subang'),
  ('32.14', '32', 'Jawa Barat', 'Kabupaten Purwakarta'),
  ('32.15', '32', 'Jawa Barat', 'Kabupaten Karawang'),
  ('32.16', '32', 'Jawa Barat', 'Kabupaten Bekasi'),
  ('32.17', '32', 'Jawa Barat', 'Kabupaten Bandung Barat'),
  ('32.18', '32', 'Jawa Barat', 'Kabupaten Pangandaran'),
  ('32.71', '32', 'Jawa Barat', 'Kota Bogor'),
  ('32.72', '32', 'Jawa Barat', 'Kota Sukabumi'),
  ('32.73', '32', 'Jawa Barat', 'Kota Bandung'),
  ('32.74', '32', 'Jawa Barat', 'Kota Cirebon'),
  ('32.75', '32', 'Jawa Barat', 'Kota Bekasi'),
  ('32.76', '32', 'Jawa Barat', 'Kota Depok'),
  ('32.77', '32', 'Jawa Barat', 'Kota Cimahi'),
  ('32.78', '32', 'Jawa Barat', 'Kota Tasikmalaya'),
  ('32.79', '32', 'Jawa Barat', 'Kota Banjar'),
  ('33.01', '33', 'Jawa Tengah', 'Kabupaten Cilacap'),
  ('33.02', '33', 'Jawa Tengah', 'Kabupaten Banyumas'),
  ('33.03', '33', 'Jawa Tengah', 'Kabupaten Purbalingga'),
  ('33.04', '33', 'Jawa Tengah', 'Kabupaten Banjarnegara'),
  ('33.05', '33', 'Jawa Tengah', 'Kabupaten Kebumen'),
  ('33.06', '33', 'Jawa Tengah', 'Kabupaten Purworejo'),
  ('33.07', '33', 'Jawa Tengah', 'Kabupaten Wonosobo'),
  ('33.08', '33', 'Jawa Tengah', 'Kabupaten Magelang'),
  ('33.09', '33', 'Jawa Tengah', 'Kabupaten Boyolali'),
  ('33.10', '33', 'Jawa Tengah', 'Kabupaten Klaten'),
  ('33.11', '33', 'Jawa Tengah', 'Kabupaten Sukoharjo'),
  ('33.12', '33', 'Jawa Tengah', 'Kabupaten Wonogiri'),
  ('33.13', '33', 'Jawa Tengah', 'Kabupaten Karanganyar'),
  ('33.14', '33', 'Jawa Tengah', 'Kabupaten Sragen'),
  ('33.15', '33', 'Jawa Tengah', 'Kabupaten Grobogan'),
  ('33.16', '33', 'Jawa Tengah', 'Kabupaten Blora'),
  ('33.17', '33', 'Jawa Tengah', 'Kabupaten Rembang'),
  ('33.18', '33', 'Jawa Tengah', 'Kabupaten Pati'),
  ('33.19', '33', 'Jawa Tengah', 'Kabupaten Kudus'),
  ('33.20', '33', 'Jawa Tengah', 'Kabupaten Jepara'),
  ('33.21', '33', 'Jawa Tengah', 'Kabupaten Demak'),
  ('33.22', '33', 'Jawa Tengah', 'Kabupaten Semarang'),
  ('33.23', '33', 'Jawa Tengah', 'Kabupaten Temanggung'),
  ('33.24', '33', 'Jawa Tengah', 'Kabupaten Kendal'),
  ('33.25', '33', 'Jawa Tengah', 'Kabupaten Batang'),
  ('33.26', '33', 'Jawa Tengah', 'Kabupaten Pekalongan'),
  ('33.27', '33', 'Jawa Tengah', 'Kabupaten Pemalang'),
  ('33.28', '33', 'Jawa Tengah', 'Kabupaten Tegal'),
  ('33.29', '33', 'Jawa Tengah', 'Kabupaten Brebes'),
  ('33.71', '33', 'Jawa Tengah', 'Kota Magelang'),
  ('33.72', '33', 'Jawa Tengah', 'Kota Surakarta'),
  ('33.73', '33', 'Jawa Tengah', 'Kota Salatiga'),
  ('33.74', '33', 'Jawa Tengah', 'Kota Semarang'),
  ('33.75', '33', 'Jawa Tengah', 'Kota Pekalongan'),
  ('33.76', '33', 'Jawa Tengah', 'Kota Tegal'),
  ('34.01', '34', 'Daerah Istimewa Yogyakarta', 'Kabupaten Kulon Progo'),
  ('34.02', '34', 'Daerah Istimewa Yogyakarta', 'Kabupaten Bantul'),
  ('34.03', '34', 'Daerah Istimewa Yogyakarta', 'Kabupaten Gunungkidul'),
  ('34.04', '34', 'Daerah Istimewa Yogyakarta', 'Kabupaten Sleman'),
  ('34.71', '34', 'Daerah Istimewa Yogyakarta', 'Kota Yogyakarta'),
  ('35.01', '35', 'Jawa Timur', 'Kabupaten Pacitan'),
  ('35.02', '35', 'Jawa Timur', 'Kabupaten Ponorogo'),
  ('35.03', '35', 'Jawa Timur', 'Kabupaten Trenggalek'),
  ('35.04', '35', 'Jawa Timur', 'Kabupaten Tulungagung'),
  ('35.05', '35', 'Jawa Timur', 'Kabupaten Blitar'),
  ('35.06', '35', 'Jawa Timur', 'Kabupaten Kediri'),
  ('35.07', '35', 'Jawa Timur', 'Kabupaten Malang'),
  ('35.08', '35', 'Jawa Timur', 'Kabupaten Lumajang'),
  ('35.09', '35', 'Jawa Timur', 'Kabupaten Jember'),
  ('35.10', '35', 'Jawa Timur', 'Kabupaten Banyuwangi'),
  ('35.11', '35', 'Jawa Timur', 'Kabupaten Bondowoso'),
  ('35.12', '35', 'Jawa Timur', 'Kabupaten Situbondo'),
  ('35.13', '35', 'Jawa Timur', 'Kabupaten Probolinggo'),
  ('35.14', '35', 'Jawa Timur', 'Kabupaten Pasuruan'),
  ('35.15', '35', 'Jawa Timur', 'Kabupaten Sidoarjo'),
  ('35.16', '35', 'Jawa Timur', 'Kabupaten Mojokerto'),
  ('35.17', '35', 'Jawa Timur', 'Kabupaten Jombang'),
  ('35.18', '35', 'Jawa Timur', 'Kabupaten Nganjuk'),
  ('35.19', '35', 'Jawa Timur', 'Kabupaten Madiun'),
  ('35.20', '35', 'Jawa Timur', 'Kabupaten Magetan'),
  ('35.21', '35', 'Jawa Timur', 'Kabupaten Ngawi'),
  ('35.22', '35', 'Jawa Timur', 'Kabupaten Bojonegoro'),
  ('35.23', '35', 'Jawa Timur', 'Kabupaten Tuban'),
  ('35.24', '35', 'Jawa Timur', 'Kabupaten Lamongan'),
  ('35.25', '35', 'Jawa Timur', 'Kabupaten Gresik'),
  ('35.26', '35', 'Jawa Timur', 'Kabupaten Bangkalan'),
  ('35.27', '35', 'Jawa Timur', 'Kabupaten Sampang'),
  ('35.28', '35', 'Jawa Timur', 'Kabupaten Pamekasan'),
  ('35.29', '35', 'Jawa Timur', 'Kabupaten Sumenep'),
  ('35.71', '35', 'Jawa Timur', 'Kota Kediri'),
  ('35.72', '35', 'Jawa Timur', 'Kota Blitar'),
  ('35.73', '35', 'Jawa Timur', 'Kota Malang'),
  ('35.74', '35', 'Jawa Timur', 'Kota Probolinggo'),
  ('35.75', '35', 'Jawa Timur', 'Kota Pasuruan'),
  ('35.76', '35', 'Jawa Timur', 'Kota Mojokerto'),
  ('35.77', '35', 'Jawa Timur', 'Kota Madiun'),
  ('35.78', '35', 'Jawa Timur', 'Kota Surabaya'),
  ('35.79', '35', 'Jawa Timur', 'Kota Batu'),
  ('36.01', '36', 'Banten', 'Kabupaten Pandeglang'),
  ('36.02', '36', 'Banten', 'Kabupaten Lebak'),
  ('36.03', '36', 'Banten', 'Kabupaten Tangerang'),
  ('36.04', '36', 'Banten', 'Kabupaten Serang'),
  ('36.71', '36', 'Banten', 'Kota Tangerang'),
  ('36.72', '36', 'Banten', 'Kota Cilegon'),
  ('36.73', '36', 'Banten', 'Kota Serang'),
  ('36.74', '36', 'Banten', 'Kota Tangerang Selatan'),
  ('51.01', '51', 'Bali', 'Kabupaten Jembrana'),
  ('51.02', '51', 'Bali', 'Kabupaten Tabanan'),
  ('51.03', '51', 'Bali', 'Kabupaten Badung'),
  ('51.04', '51', 'Bali', 'Kabupaten Gianyar'),
  ('51.05', '51', 'Bali', 'Kabupaten Klungkung'),
  ('51.06', '51', 'Bali', 'Kabupaten Bangli'),
  ('51.07', '51', 'Bali', 'Kabupaten Karangasem'),
  ('51.08', '51', 'Bali', 'Kabupaten Buleleng'),
  ('51.71', '51', 'Bali', 'Kota Denpasar'),
  ('52.01', '52', 'Nusa Tenggara Barat', 'Kabupaten Lombok Barat'),
  ('52.02', '52', 'Nusa Tenggara Barat', 'Kabupaten Lombok Tengah'),
  ('52.03', '52', 'Nusa Tenggara Barat', 'Kabupaten Lombok Timur'),
  ('52.04', '52', 'Nusa Tenggara Barat', 'Kabupaten Sumbawa'),
  ('52.05', '52', 'Nusa Tenggara Barat', 'Kabupaten Dompu'),
  ('52.06', '52', 'Nusa Tenggara Barat', 'Kabupaten Bima'),
  ('52.07', '52', 'Nusa Tenggara Barat', 'Kabupaten Sumbawa Barat'),
  ('52.08', '52', 'Nusa Tenggara Barat', 'Kabupaten Lombok Utara'),
  ('52.71', '52', 'Nusa Tenggara Barat', 'Kota Mataram'),
  ('52.72', '52', 'Nusa Tenggara Barat', 'Kota Bima'),
  ('53.01', '53', 'Nusa Tenggara Timur', 'Kabupaten Kupang'),
  ('53.02', '53', 'Nusa Tenggara Timur', 'Kabupaten Timor Tengah Selatan'),
  ('53.03', '53', 'Nusa Tenggara Timur', 'Kabupaten Timor Tengah Utara'),
  ('53.04', '53', 'Nusa Tenggara Timur', 'Kabupaten Belu'),
  ('53.05', '53', 'Nusa Tenggara Timur', 'Kabupaten Alor'),
  ('53.06', '53', 'Nusa Tenggara Timur', 'Kabupaten Flores Timur'),
  ('53.07', '53', 'Nusa Tenggara Timur', 'Kabupaten Sikka'),
  ('53.08', '53', 'Nusa Tenggara Timur', 'Kabupaten Ende'),
  ('53.09', '53', 'Nusa Tenggara Timur', 'Kabupaten Ngada'),
  ('53.10', '53', 'Nusa Tenggara Timur', 'Kabupaten Manggarai'),
  ('53.11', '53', 'Nusa Tenggara Timur', 'Kabupaten Sumba Timur'),
  ('53.12', '53', 'Nusa Tenggara Timur', 'Kabupaten Sumba Barat'),
  ('53.13', '53', 'Nusa Tenggara Timur', 'Kabupaten Lembata'),
  ('53.14', '53', 'Nusa Tenggara Timur', 'Kabupaten Rote Ndao'),
  ('53.15', '53', 'Nusa Tenggara Timur', 'Kabupaten Manggarai Barat'),
  ('53.16', '53', 'Nusa Tenggara Timur', 'Kabupaten Nagekeo'),
  ('53.17', '53', 'Nusa Tenggara Timur', 'Kabupaten Sumba Tengah'),
  ('53.18', '53', 'Nusa Tenggara Timur', 'Kabupaten Sumba Barat Daya'),
  ('53.19', '53', 'Nusa Tenggara Timur', 'Kabupaten Manggarai Timur'),
  ('53.20', '53', 'Nusa Tenggara Timur', 'Kabupaten Sabu Raijua'),
  ('53.21', '53', 'Nusa Tenggara Timur', 'Kabupaten Malaka'),
  ('53.71', '53', 'Nusa Tenggara Timur', 'Kota Kupang'),
  ('61.01', '61', 'Kalimantan Barat', 'Kabupaten Sambas'),
  ('61.02', '61', 'Kalimantan Barat', 'Kabupaten Mempawah'),
  ('61.03', '61', 'Kalimantan Barat', 'Kabupaten Sanggau'),
  ('61.04', '61', 'Kalimantan Barat', 'Kabupaten Ketapang'),
  ('61.05', '61', 'Kalimantan Barat', 'Kabupaten Sintang'),
  ('61.06', '61', 'Kalimantan Barat', 'Kabupaten Kapuas Hulu'),
  ('61.07', '61', 'Kalimantan Barat', 'Kabupaten Bengkayang'),
  ('61.08', '61', 'Kalimantan Barat', 'Kabupaten Landak'),
  ('61.09', '61', 'Kalimantan Barat', 'Kabupaten Sekadau'),
  ('61.10', '61', 'Kalimantan Barat', 'Kabupaten Melawi'),
  ('61.11', '61', 'Kalimantan Barat', 'Kabupaten Kayong Utara'),
  ('61.12', '61', 'Kalimantan Barat', 'Kabupaten Kubu Raya'),
  ('61.71', '61', 'Kalimantan Barat', 'Kota Pontianak'),
  ('61.72', '61', 'Kalimantan Barat', 'Kota Singkawang'),
  ('62.01', '62', 'Kalimantan Tengah', 'Kabupaten Kotawaringin Barat'),
  ('62.02', '62', 'Kalimantan Tengah', 'Kabupaten Kotawaringin Timur'),
  ('62.03', '62', 'Kalimantan Tengah', 'Kabupaten Kapuas'),
  ('62.04', '62', 'Kalimantan Tengah', 'Kabupaten Barito Selatan'),
  ('62.05', '62', 'Kalimantan Tengah', 'Kabupaten Barito Utara'),
  ('62.06', '62', 'Kalimantan Tengah', 'Kabupaten Katingan'),
  ('62.07', '62', 'Kalimantan Tengah', 'Kabupaten Seruyan'),
  ('62.08', '62', 'Kalimantan Tengah', 'Kabupaten Sukamara'),
  ('62.09', '62', 'Kalimantan Tengah', 'Kabupaten Lamandau'),
  ('62.10', '62', 'Kalimantan Tengah', 'Kabupaten Gunung Mas'),
  ('62.11', '62', 'Kalimantan Tengah', 'Kabupaten Pulang Pisau'),
  ('62.12', '62', 'Kalimantan Tengah', 'Kabupaten Murung Raya'),
  ('62.13', '62', 'Kalimantan Tengah', 'Kabupaten Barito Timur'),
  ('62.71', '62', 'Kalimantan Tengah', 'Kota Palangkaraya'),
  ('63.01', '63', 'Kalimantan Selatan', 'Kabupaten Tanah Laut'),
  ('63.02', '63', 'Kalimantan Selatan', 'Kabupaten Kotabaru'),
  ('63.03', '63', 'Kalimantan Selatan', 'Kabupaten Banjar'),
  ('63.04', '63', 'Kalimantan Selatan', 'Kabupaten Barito Kuala'),
  ('63.05', '63', 'Kalimantan Selatan', 'Kabupaten Tapin'),
  ('63.06', '63', 'Kalimantan Selatan', 'Kabupaten Hulu Sungai Selatan'),
  ('63.07', '63', 'Kalimantan Selatan', 'Kabupaten Hulu Sungai Tengah'),
  ('63.08', '63', 'Kalimantan Selatan', 'Kabupaten Hulu Sungai Utara'),
  ('63.09', '63', 'Kalimantan Selatan', 'Kabupaten Tabalong'),
  ('63.10', '63', 'Kalimantan Selatan', 'Kabupaten Tanah Bumbu'),
  ('63.11', '63', 'Kalimantan Selatan', 'Kabupaten Balangan'),
  ('63.71', '63', 'Kalimantan Selatan', 'Kota Banjarmasin'),
  ('63.72', '63', 'Kalimantan Selatan', 'Kota Banjarbaru'),
  ('64.01', '64', 'Kalimantan Timur', 'Kabupaten Paser'),
  ('64.02', '64', 'Kalimantan Timur', 'Kabupaten Kutai Kartanegara'),
  ('64.03', '64', 'Kalimantan Timur', 'Kabupaten Berau'),
  ('64.07', '64', 'Kalimantan Timur', 'Kabupaten Kutai Barat'),
  ('64.08', '64', 'Kalimantan Timur', 'Kabupaten Kutai Timur'),
  ('64.09', '64', 'Kalimantan Timur', 'Kabupaten Penajam Paser Utara'),
  ('64.11', '64', 'Kalimantan Timur', 'Kabupaten Mahakam Ulu'),
  ('64.71', '64', 'Kalimantan Timur', 'Kota Balikpapan'),
  ('64.72', '64', 'Kalimantan Timur', 'Kota Samarinda'),
  ('64.74', '64', 'Kalimantan Timur', 'Kota Bontang'),
  ('65.01', '65', 'Kalimantan Utara', 'Kabupaten Bulungan'),
  ('65.02', '65', 'Kalimantan Utara', 'Kabupaten Malinau'),
  ('65.03', '65', 'Kalimantan Utara', 'Kabupaten Nunukan'),
  ('65.04', '65', 'Kalimantan Utara', 'Kabupaten Tana Tidung'),
  ('65.71', '65', 'Kalimantan Utara', 'Kota Tarakan'),
  ('71.01', '71', 'Sulawesi Utara', 'Kabupaten Bolaang Mongondow'),
  ('71.02', '71', 'Sulawesi Utara', 'Kabupaten Minahasa'),
  ('71.03', '71', 'Sulawesi Utara', 'Kabupaten Kepulauan Sangihe'),
  ('71.04', '71', 'Sulawesi Utara', 'Kabupaten Kepulauan Talaud'),
  ('71.05', '71', 'Sulawesi Utara', 'Kabupaten Minahasa Selatan'),
  ('71.06', '71', 'Sulawesi Utara', 'Kabupaten Minahasa Utara'),
  ('71.07', '71', 'Sulawesi Utara', 'Kabupaten Minahasa Tenggara'),
  ('71.08', '71', 'Sulawesi Utara', 'Kabupaten Bolaang Mongondow Utara'),
  ('71.09', '71', 'Sulawesi Utara', 'Kabupaten Kepulauan Siau Tagulandang Biaro'),
  ('71.10', '71', 'Sulawesi Utara', 'Kabupaten Bolaang Mongondow Timur'),
  ('71.11', '71', 'Sulawesi Utara', 'Kabupaten Bolaang Mongondow Selatan'),
  ('71.71', '71', 'Sulawesi Utara', 'Kota Manado'),
  ('71.72', '71', 'Sulawesi Utara', 'Kota Bitung'),
  ('71.73', '71', 'Sulawesi Utara', 'Kota Tomohon'),
  ('71.74', '71', 'Sulawesi Utara', 'Kota Kotamobagu'),
  ('72.01', '72', 'Sulawesi Tengah', 'Kabupaten Banggai'),
  ('72.02', '72', 'Sulawesi Tengah', 'Kabupaten Poso'),
  ('72.03', '72', 'Sulawesi Tengah', 'Kabupaten Donggala'),
  ('72.04', '72', 'Sulawesi Tengah', 'Kabupaten Toli-Toli'),
  ('72.05', '72', 'Sulawesi Tengah', 'Kabupaten Buol'),
  ('72.06', '72', 'Sulawesi Tengah', 'Kabupaten Morowali'),
  ('72.07', '72', 'Sulawesi Tengah', 'Kabupaten Banggai Kepulauan'),
  ('72.08', '72', 'Sulawesi Tengah', 'Kabupaten Parigi Moutong'),
  ('72.09', '72', 'Sulawesi Tengah', 'Kabupaten Tojo Una Una'),
  ('72.10', '72', 'Sulawesi Tengah', 'Kabupaten Sigi'),
  ('72.11', '72', 'Sulawesi Tengah', 'Kabupaten Banggai Laut'),
  ('72.12', '72', 'Sulawesi Tengah', 'Kabupaten Morowali Utara'),
  ('72.71', '72', 'Sulawesi Tengah', 'Kota Palu'),
  ('73.01', '73', 'Sulawesi Selatan', 'Kabupaten Kepulauan Selayar'),
  ('73.02', '73', 'Sulawesi Selatan', 'Kabupaten Bulukumba'),
  ('73.03', '73', 'Sulawesi Selatan', 'Kabupaten Bantaeng'),
  ('73.04', '73', 'Sulawesi Selatan', 'Kabupaten Jeneponto'),
  ('73.05', '73', 'Sulawesi Selatan', 'Kabupaten Takalar'),
  ('73.06', '73', 'Sulawesi Selatan', 'Kabupaten Gowa'),
  ('73.07', '73', 'Sulawesi Selatan', 'Kabupaten Sinjai'),
  ('73.08', '73', 'Sulawesi Selatan', 'Kabupaten Bone'),
  ('73.09', '73', 'Sulawesi Selatan', 'Kabupaten Maros'),
  ('73.10', '73', 'Sulawesi Selatan', 'Kabupaten Pangkajene dan Kepulauan'),
  ('73.11', '73', 'Sulawesi Selatan', 'Kabupaten Barru'),
  ('73.12', '73', 'Sulawesi Selatan', 'Kabupaten Soppeng'),
  ('73.13', '73', 'Sulawesi Selatan', 'Kabupaten Wajo'),
  ('73.14', '73', 'Sulawesi Selatan', 'Kabupaten Sidenreng Rappang'),
  ('73.15', '73', 'Sulawesi Selatan', 'Kabupaten Pinrang'),
  ('73.16', '73', 'Sulawesi Selatan', 'Kabupaten Enrekang'),
  ('73.17', '73', 'Sulawesi Selatan', 'Kabupaten Luwu'),
  ('73.18', '73', 'Sulawesi Selatan', 'Kabupaten Tana Toraja'),
  ('73.22', '73', 'Sulawesi Selatan', 'Kabupaten Luwu Utara'),
  ('73.24', '73', 'Sulawesi Selatan', 'Kabupaten Luwu Timur'),
  ('73.26', '73', 'Sulawesi Selatan', 'Kabupaten Toraja Utara'),
  ('73.71', '73', 'Sulawesi Selatan', 'Kota Makassar'),
  ('73.72', '73', 'Sulawesi Selatan', 'Kota Parepare'),
  ('73.73', '73', 'Sulawesi Selatan', 'Kota Palopo'),
  ('74.01', '74', 'Sulawesi Tenggara', 'Kabupaten Kolaka'),
  ('74.02', '74', 'Sulawesi Tenggara', 'Kabupaten Konawe'),
  ('74.03', '74', 'Sulawesi Tenggara', 'Kabupaten Muna'),
  ('74.04', '74', 'Sulawesi Tenggara', 'Kabupaten Buton'),
  ('74.05', '74', 'Sulawesi Tenggara', 'Kabupaten Konawe Selatan'),
  ('74.06', '74', 'Sulawesi Tenggara', 'Kabupaten Bombana'),
  ('74.07', '74', 'Sulawesi Tenggara', 'Kabupaten Wakatobi'),
  ('74.08', '74', 'Sulawesi Tenggara', 'Kabupaten Kolaka Utara'),
  ('74.09', '74', 'Sulawesi Tenggara', 'Kabupaten Konawe Utara'),
  ('74.10', '74', 'Sulawesi Tenggara', 'Kabupaten Buton Utara'),
  ('74.11', '74', 'Sulawesi Tenggara', 'Kabupaten Kolaka Timur'),
  ('74.12', '74', 'Sulawesi Tenggara', 'Kabupaten Konawe Kepulauan'),
  ('74.13', '74', 'Sulawesi Tenggara', 'Kabupaten Muna Barat'),
  ('74.14', '74', 'Sulawesi Tenggara', 'Kabupaten Buton Tengah'),
  ('74.15', '74', 'Sulawesi Tenggara', 'Kabupaten Buton Selatan'),
  ('74.71', '74', 'Sulawesi Tenggara', 'Kota Kendari'),
  ('74.72', '74', 'Sulawesi Tenggara', 'Kota Bau Bau'),
  ('75.01', '75', 'Gorontalo', 'Kabupaten Gorontalo'),
  ('75.02', '75', 'Gorontalo', 'Kabupaten Boalemo'),
  ('75.03', '75', 'Gorontalo', 'Kabupaten Bone Bolango'),
  ('75.04', '75', 'Gorontalo', 'Kabupaten Pohuwato'),
  ('75.05', '75', 'Gorontalo', 'Kabupaten Gorontalo Utara'),
  ('75.71', '75', 'Gorontalo', 'Kota Gorontalo'),
  ('76.01', '76', 'Sulawesi Barat', 'Kabupaten Pasangkayu'),
  ('76.02', '76', 'Sulawesi Barat', 'Kabupaten Mamuju'),
  ('76.03', '76', 'Sulawesi Barat', 'Kabupaten Mamasa'),
  ('76.04', '76', 'Sulawesi Barat', 'Kabupaten Polewali Mandar'),
  ('76.05', '76', 'Sulawesi Barat', 'Kabupaten Majene'),
  ('76.06', '76', 'Sulawesi Barat', 'Kabupaten Mamuju Tengah'),
  ('81.01', '81', 'Maluku', 'Kabupaten Maluku Tengah'),
  ('81.02', '81', 'Maluku', 'Kabupaten Maluku Tenggara'),
  ('81.03', '81', 'Maluku', 'Kabupaten Kepulauan Tanimbar'),
  ('81.04', '81', 'Maluku', 'Kabupaten Buru'),
  ('81.05', '81', 'Maluku', 'Kabupaten Seram Bagian Timur'),
  ('81.06', '81', 'Maluku', 'Kabupaten Seram Bagian Barat'),
  ('81.07', '81', 'Maluku', 'Kabupaten Kepulauan Aru'),
  ('81.08', '81', 'Maluku', 'Kabupaten Maluku Barat Daya'),
  ('81.09', '81', 'Maluku', 'Kabupaten Buru Selatan'),
  ('81.71', '81', 'Maluku', 'Kota Ambon'),
  ('81.72', '81', 'Maluku', 'Kota Tual'),
  ('82.01', '82', 'Maluku Utara', 'Kabupaten Halmahera Barat'),
  ('82.02', '82', 'Maluku Utara', 'Kabupaten Halmahera Tengah'),
  ('82.03', '82', 'Maluku Utara', 'Kabupaten Halmahera Utara'),
  ('82.04', '82', 'Maluku Utara', 'Kabupaten Halmahera Selatan'),
  ('82.05', '82', 'Maluku Utara', 'Kabupaten Kepulauan Sula'),
  ('82.06', '82', 'Maluku Utara', 'Kabupaten Halmahera Timur'),
  ('82.07', '82', 'Maluku Utara', 'Kabupaten Pulau Morotai'),
  ('82.08', '82', 'Maluku Utara', 'Kabupaten Pulau Taliabu'),
  ('82.71', '82', 'Maluku Utara', 'Kota Ternate'),
  ('82.72', '82', 'Maluku Utara', 'Kota Tidore Kepulauan'),
  ('91.03', '91', 'Papua', 'Kabupaten Jayapura'),
  ('91.05', '91', 'Papua', 'Kabupaten Kepulauan Yapen'),
  ('91.06', '91', 'Papua', 'Kabupaten Biak Numfor'),
  ('91.10', '91', 'Papua', 'Kabupaten Sarmi'),
  ('91.11', '91', 'Papua', 'Kabupaten Keerom'),
  ('91.15', '91', 'Papua', 'Kabupaten Waropen'),
  ('91.19', '91', 'Papua', 'Kabupaten Supiori'),
  ('91.20', '91', 'Papua', 'Kabupaten Mamberamo Raya'),
  ('91.71', '91', 'Papua', 'Kota Jayapura'),
  ('92.02', '92', 'Papua Barat', 'Kabupaten Manokwari'),
  ('92.03', '92', 'Papua Barat', 'Kabupaten Fak Fak'),
  ('92.06', '92', 'Papua Barat', 'Kabupaten Teluk Bintuni'),
  ('92.07', '92', 'Papua Barat', 'Kabupaten Teluk Wondama'),
  ('92.08', '92', 'Papua Barat', 'Kabupaten Kaimana'),
  ('92.11', '92', 'Papua Barat', 'Kabupaten Manokwari Selatan'),
  ('92.12', '92', 'Papua Barat', 'Kabupaten Pegunungan Arfak'),
  ('93.01', '93', 'Papua Selatan', 'Kabupaten Merauke'),
  ('93.02', '93', 'Papua Selatan', 'Kabupaten Boven Digoel'),
  ('93.03', '93', 'Papua Selatan', 'Kabupaten Mappi'),
  ('93.04', '93', 'Papua Selatan', 'Kabupaten Asmat'),
  ('94.01', '94', 'Papua Tengah', 'Kabupaten Nabire'),
  ('94.02', '94', 'Papua Tengah', 'Kabupaten Puncak Jaya'),
  ('94.03', '94', 'Papua Tengah', 'Kabupaten Paniai'),
  ('94.04', '94', 'Papua Tengah', 'Kabupaten Mimika'),
  ('94.05', '94', 'Papua Tengah', 'Kabupaten Puncak'),
  ('94.06', '94', 'Papua Tengah', 'Kabupaten Dogiyai'),
  ('94.07', '94', 'Papua Tengah', 'Kabupaten Intan Jaya'),
  ('94.08', '94', 'Papua Tengah', 'Kabupaten Deiyai'),
  ('95.01', '95', 'Papua Pegunungan', 'Kabupaten Jayawijaya'),
  ('95.02', '95', 'Papua Pegunungan', 'Kabupaten Pegunungan Bintang'),
  ('95.03', '95', 'Papua Pegunungan', 'Kabupaten Yahukimo'),
  ('95.04', '95', 'Papua Pegunungan', 'Kabupaten Tolikara'),
  ('95.05', '95', 'Papua Pegunungan', 'Kabupaten Mamberamo Tengah'),
  ('95.06', '95', 'Papua Pegunungan', 'Kabupaten Yalimo'),
  ('95.07', '95', 'Papua Pegunungan', 'Kabupaten Lanny Jaya'),
  ('95.08', '95', 'Papua Pegunungan', 'Kabupaten Nduga'),
  ('96.01', '96', 'Papua Barat Daya', 'Kabupaten Sorong'),
  ('96.02', '96', 'Papua Barat Daya', 'Kabupaten Sorong Selatan'),
  ('96.03', '96', 'Papua Barat Daya', 'Kabupaten Raja Ampat'),
  ('96.04', '96', 'Papua Barat Daya', 'Kabupaten Tambrauw'),
  ('96.05', '96', 'Papua Barat Daya', 'Kabupaten Maybrat'),
  ('96.71', '96', 'Papua Barat Daya', 'Kota Sorong');

alter table public.cities enable row level security;
revoke all on table public.cities from anon, authenticated;
grant select on public.cities to anon, authenticated;
create policy cities_select on public.cities for select to anon, authenticated using (true);

alter table public.profiles add column home_city_code text references public.cities (code);
-- Warga Cimahi memakai kelurahan; kota asal hanya untuk warga luar Cimahi.
alter table public.profiles add constraint profiles_home_city_outside check (home_village_id is null or home_city_code is null);

create function public.set_home_city(p_code text) -- null = tidak diisi
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_code text := nullif(btrim(coalesce(p_code, '')), '');
begin
  if v_code is not null and exists (select 1 from public.profiles where id = v_uid and home_village_id is not null) then
    raise exception 'city_only_outside_cimahi';
  end if;
  if v_code is not null and not exists (select 1 from public.cities where code = v_code) then
    raise exception 'invalid_city';
  end if;
  update public.profiles set home_city_code = v_code where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Tipe dan kolom
-- -----------------------------------------------------------------------------

create type public.activity_reach as enum ('regional', 'global');
create type public.activity_location_mode as enum ('onsite', 'online', 'hybrid');
create type public.score_reason as enum ('checkin', 'mission_complete', 'reversal', 'adjustment');
create type public.prize_kind as enum ('physical', 'voucher', 'badge', 'other');
create type public.prize_fulfillment as enum ('pickup', 'shipping', 'digital');
create type public.winner_status as enum ('pending_claim', 'claimed', 'delivered', 'forfeited');

alter table public.activities
  add column reach public.activity_reach not null default 'regional',
  add column location_mode public.activity_location_mode not null default 'onsite';
create index activities_global_idx on public.activities (status, starts_at) where reach = 'global';

alter table public.activity_missions add column score_reward integer not null default 0 check (score_reward >= 0);
grant select (score_reward) on public.activity_missions to authenticated;

-- Hak membuat Event Global dicek di satu tempat, supaya nanti bisa dibuka untuk peran lain
-- (misalnya merchant terverifikasi) tanpa mengubah tabel. Selama pilot: admin, host platform.
create function public.can_create_global_event(p_host_organizer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.is_admin() and exists (select 1 from public.organizers where id = p_host_organizer_id and type = 'platform');
$$;

-- -----------------------------------------------------------------------------
-- Penjaga aturan Event Global
-- -----------------------------------------------------------------------------

-- Berjalan setelah check_activity_row (urutan nama trigger), jadi xp_base 0 tidak tertimpa.
create function public.check_activity_reach()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_host_type public.organizer_type;
begin
  if new.reach = 'global' then
    select type into v_host_type from public.organizers where id = new.host_organizer_id;
    if v_host_type is distinct from 'platform' then
      raise exception 'global_requires_platform_host';
    end if;
    if new.type <> 'event' then
      raise exception 'global_requires_event';
    end if;
    if new.audience <> 'public' or new.residency_rule <> 'open' or new.join_mode <> 'individual' then
      raise exception 'global_requires_open_individual';
    end if;
    if new.points_per_completion <> 0 then
      raise exception 'global_no_points';
    end if;
    new.xp_base := 0;
  elsif new.location_mode <> 'onsite' then
    raise exception 'location_mode_requires_global';
  end if;
  if tg_op = 'UPDATE' and old.status not in ('draft', 'awaiting_partners', 'in_review')
     and (new.reach <> old.reach or new.location_mode <> old.location_mode) then
    raise exception 'reach_locked_after_publish';
  end if;
  return new;
end;
$$;

create trigger activities_global_rules
  before insert or update on public.activities
  for each row execute function public.check_activity_reach();

-- Event online tidak punya checkpoint.
create function public.check_checkpoint_location_mode()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (select 1 from public.activities where id = new.activity_id and location_mode = 'online') then
    raise exception 'online_no_checkpoint';
  end if;
  return new;
end;
$$;

create trigger activity_checkpoints_location_mode
  before insert on public.activity_checkpoints
  for each row execute function public.check_checkpoint_location_mode();

-- XP dan poin tidak pernah ditulis untuk aktivitas global, dari jalur mana pun.
create function public.reject_global_activity_ledger()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.activity_id is not null and exists (select 1 from public.activities where id = new.activity_id and reach = 'global') then
    raise exception 'global_activity_no_xp_or_points';
  end if;
  return new;
end;
$$;

create trigger xp_ledger_reject_global
  before insert on public.xp_ledger
  for each row execute function public.reject_global_activity_ledger();
create trigger point_ledger_reject_global
  before insert on public.point_ledger
  for each row execute function public.reject_global_activity_ledger();

-- Admin memilih jangkauan dan mode lokasi saat aktivitas masih draft.
create function public.set_activity_reach(p_activity_id uuid, p_reach public.activity_reach, p_location_mode public.activity_location_mode default 'onsite')
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_mode public.activity_location_mode := case when p_reach = 'regional' then 'onsite'::public.activity_location_mode else coalesce(p_location_mode, 'onsite') end;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found then
    raise exception 'invalid_activity';
  end if;
  if not public.can_create_global_event(v_a.host_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners') then
    raise exception 'reach_locked_after_publish';
  end if;
  if p_reach = v_a.reach and v_mode = v_a.location_mode then
    return;
  end if;
  if p_reach <> v_a.reach and exists (select 1 from public.activity_missions where activity_id = p_activity_id and is_active) then
    raise exception 'reach_change_with_missions';
  end if;
  if p_reach = 'regional' and exists (select 1 from public.activity_prizes where activity_id = p_activity_id) then
    raise exception 'reach_change_with_prizes';
  end if;
  if v_mode = 'online' and exists (select 1 from public.activity_checkpoints where activity_id = p_activity_id and is_active) then
    raise exception 'online_no_checkpoint';
  end if;
  update public.activities
  set reach = p_reach,
      location_mode = v_mode,
      audience = case when p_reach = 'global' then 'public'::public.activity_audience else audience end,
      residency_rule = case when p_reach = 'global' then 'open'::public.residency_rule else residency_rule end,
      join_mode = case when p_reach = 'global' then 'individual'::public.join_mode else join_mode end,
      group_min = case when p_reach = 'global' then null else group_min end,
      group_max = case when p_reach = 'global' then null else group_max end,
      points_per_completion = case when p_reach = 'global' then 0 else points_per_completion end
  where id = p_activity_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'set_activity_reach', 'activities', p_activity_id, p_reach::text || ' · ' || v_mode::text);
end;
$$;

-- -----------------------------------------------------------------------------
-- Skor event
-- -----------------------------------------------------------------------------

create table public.activity_score_ledger (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id),
  user_id uuid not null references public.profiles (id),
  amount integer not null check (amount <> 0),
  reason public.score_reason not null,
  checkin_id uuid references public.checkins (id),
  mission_completion_id uuid references public.mission_completions (id),
  occurred_at timestamptz not null default now(), -- waktu aksi warga; dipakai untuk aturan seri
  note text,
  created_at timestamptz not null default now()
);

create index activity_score_ledger_activity_user_idx on public.activity_score_ledger (activity_id, user_id);
create index activity_score_ledger_user_idx on public.activity_score_ledger (user_id);
create unique index activity_score_ledger_mission_once_idx on public.activity_score_ledger (mission_completion_id) where reason = 'mission_complete';
create unique index activity_score_ledger_checkin_once_idx on public.activity_score_ledger (checkin_id) where reason = 'checkin';

create trigger activity_score_ledger_append_only
  before update or delete on public.activity_score_ledger
  for each row execute function public.prevent_ledger_change();

create function public.check_score_activity()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from public.activities where id = new.activity_id and reach = 'global') then
    raise exception 'score_requires_global';
  end if;
  return new;
end;
$$;

create trigger activity_score_ledger_check_activity
  before insert on public.activity_score_ledger
  for each row execute function public.check_score_activity();

alter table public.activity_score_ledger enable row level security;
revoke all on table public.activity_score_ledger from anon, authenticated;
grant select on public.activity_score_ledger to authenticated;
create policy activity_score_ledger_select on public.activity_score_ledger
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- Satu-satunya jalan menulis skor positif. Tanpa batas harian (skor sudah dibatasi jumlah misi
-- dan satu check-in per hari).
create function public.award_activity_score(
  p_user_id uuid, p_activity_id uuid, p_amount integer, p_reason public.score_reason,
  p_checkin_id uuid default null, p_mission_completion_id uuid default null,
  p_occurred_at timestamptz default null, p_note text default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'award_score_requires_positive_amount';
  end if;
  if p_reason = 'reversal' then
    raise exception 'invalid_score_reason';
  end if;
  if not exists (select 1 from public.activities where id = p_activity_id and reach = 'global' and status in ('running', 'ended')) then
    raise exception 'activity_not_running';
  end if;
  begin
    insert into public.activity_score_ledger (activity_id, user_id, amount, reason, checkin_id, mission_completion_id, occurred_at, note)
    values (p_activity_id, p_user_id, p_amount, p_reason, p_checkin_id, p_mission_completion_id, coalesce(p_occurred_at, now()), p_note);
  exception when unique_violation then
    return 0; -- check-in atau misi ini sudah tercatat
  end;
  return p_amount;
end;
$$;

create function public.activity_score(p_user_id uuid, p_activity_id uuid)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(sum(amount), 0)::integer from public.activity_score_ledger where user_id = p_user_id and activity_id = p_activity_id;
$$;

-- Peringkat per Event Global. Seri: yang lebih dulu mencapai skornya (occurred_at aksi terakhir
-- yang menambah skor), lalu yang lebih dulu mendaftar. Peringkat selalu unik (satu pemenang per
-- peringkat). Hanya dibaca lewat fungsi security definer; client tidak membaca view ini.
create view public.v_activity_scoreboard as
with s as (
  select l.activity_id, l.user_id, sum(l.amount)::integer as score,
    max(l.occurred_at) filter (where l.amount > 0) as last_scored_at
  from public.activity_score_ledger l
  group by l.activity_id, l.user_id
)
select
  s.activity_id, s.user_id, pr.nickname::text as nickname, s.score, s.last_scored_at, p.created_at as registered_at,
  (row_number() over (partition by s.activity_id order by s.score desc, s.last_scored_at asc, p.created_at asc, s.user_id))::integer as rank
from s
join public.participations p on p.activity_id = s.activity_id and p.user_id = s.user_id
join public.profiles pr on pr.id = s.user_id
where s.score > 0
  and p.status not in ('cancelled', 'invited')
  and p.payment_status in ('not_required', 'paid')
  and pr.suspended_at is null and pr.deleted_at is null;

revoke all on public.v_activity_scoreboard from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Hadiah per peringkat
-- -----------------------------------------------------------------------------

create table public.activity_prizes (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id) on delete cascade,
  rank_from smallint not null check (rank_from >= 1),
  rank_to smallint not null,
  title text not null check (char_length(btrim(title)) between 3 and 100),
  description text check (description is null or char_length(description) <= 1000),
  image_url text,
  kind public.prize_kind not null,
  fulfillment public.prize_fulfillment not null,
  badge_id uuid references public.badges (id),
  sponsor_organizer_id uuid references public.organizers (id),
  pickup_note text,
  min_score integer not null default 1 check (min_score >= 1),
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_prizes_rank_order check (rank_to >= rank_from),
  constraint activity_prizes_badge check (kind <> 'badge' or (badge_id is not null and fulfillment = 'digital')),
  constraint activity_prizes_pickup check (fulfillment <> 'pickup' or nullif(btrim(pickup_note), '') is not null)
);

create index activity_prizes_activity_idx on public.activity_prizes (activity_id, rank_from);

create trigger activity_prizes_set_updated_at
  before update on public.activity_prizes
  for each row execute function public.set_updated_at();

-- Rentang tidak tumpang tindih, sponsor partner accepted, dan hadiah terkunci setelah terbit
-- (hanya boleh tambah baris baru atau ubah deskripsi dan gambar).
create function public.check_activity_prize()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a public.activities;
begin
  if tg_op = 'DELETE' then
    select * into v_a from public.activities where id = old.activity_id;
    if v_a.status not in ('draft', 'awaiting_partners', 'in_review') then
      raise exception 'prize_locked_after_publish';
    end if;
    return old;
  end if;
  select * into v_a from public.activities where id = new.activity_id;
  if v_a.reach <> 'global' then
    raise exception 'prize_requires_global';
  end if;
  if tg_op = 'INSERT' and v_a.status in ('ended', 'settled', 'cancelled') then
    raise exception 'activity_locked';
  end if;
  if tg_op = 'UPDATE' and v_a.status not in ('draft', 'awaiting_partners', 'in_review')
     and (new.activity_id, new.rank_from, new.rank_to, new.title, new.kind, new.fulfillment, new.badge_id, new.sponsor_organizer_id, new.pickup_note, new.min_score)
         is distinct from (old.activity_id, old.rank_from, old.rank_to, old.title, old.kind, old.fulfillment, old.badge_id, old.sponsor_organizer_id, old.pickup_note, old.min_score) then
    raise exception 'prize_locked_after_publish';
  end if;
  if new.rank_to > public.setting_int('global_event.max_prize_rank') then
    raise exception 'invalid_prize_rank';
  end if;
  if exists (
    select 1 from public.activity_prizes p
    where p.activity_id = new.activity_id and p.id <> new.id and p.rank_from <= new.rank_to and p.rank_to >= new.rank_from
  ) then
    raise exception 'prize_rank_overlap';
  end if;
  if new.sponsor_organizer_id is not null and not exists (
    select 1 from public.activity_partners ap
    where ap.activity_id = new.activity_id and ap.organizer_id = new.sponsor_organizer_id and ap.status = 'accepted' and ap.role <> 'host'
  ) then
    raise exception 'prize_sponsor_not_partner';
  end if;
  if new.kind = 'badge' and not exists (select 1 from public.badges where id = new.badge_id and rule ->> 'type' = 'activity_prize') then
    raise exception 'invalid_prize_badge';
  end if;
  return new;
end;
$$;

create trigger activity_prizes_check
  before insert or update or delete on public.activity_prizes
  for each row execute function public.check_activity_prize();

alter table public.activity_prizes enable row level security;
revoke all on table public.activity_prizes from anon, authenticated;
grant select on public.activity_prizes to authenticated;
-- Terlihat jika aktivitasnya terlihat (RLS activities ikut berlaku di subquery).
create policy activity_prizes_select on public.activity_prizes
  for select to authenticated
  using (exists (select 1 from public.activities a where a.id = activity_id));

-- Partner penyedia hadiah tidak boleh keluar setelah Event Global terbit; Event Global tanpa budget poin.
create function public.check_partner_global()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a public.activities;
begin
  select * into v_a from public.activities where id = new.activity_id;
  if v_a.reach = 'global' and new.points_budget > 0 then
    raise exception 'global_no_points';
  end if;
  if tg_op = 'UPDATE' and old.status = 'accepted' and new.status <> 'accepted' and v_a.reach = 'global'
     and v_a.status not in ('draft', 'awaiting_partners', 'in_review')
     and exists (select 1 from public.activity_prizes where activity_id = new.activity_id and sponsor_organizer_id = new.organizer_id) then
    raise exception 'partner_has_prize';
  end if;
  return new;
end;
$$;

create trigger activity_partners_global
  before insert or update on public.activity_partners
  for each row execute function public.check_partner_global();

create function public.upsert_activity_prize(p_activity_id uuid, p_prize jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_id uuid := nullif(p_prize ->> 'id', '')::uuid;
  v_locked boolean;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.can_create_global_event(v_a.host_organizer_id) then
    raise exception 'not_allowed';
  end if;
  v_locked := v_a.status not in ('draft', 'awaiting_partners', 'in_review');
  begin
    if v_id is null then
      insert into public.activity_prizes (activity_id, rank_from, rank_to, title, description, image_url, kind, fulfillment,
        badge_id, sponsor_organizer_id, pickup_note, min_score, created_by)
      values (p_activity_id,
        (p_prize ->> 'rank_from')::smallint,
        coalesce(nullif(p_prize ->> 'rank_to', ''), p_prize ->> 'rank_from')::smallint,
        btrim(p_prize ->> 'title'),
        nullif(btrim(coalesce(p_prize ->> 'description', '')), ''),
        nullif(p_prize ->> 'image_url', ''),
        (p_prize ->> 'kind')::public.prize_kind,
        case when p_prize ->> 'kind' = 'badge' then 'digital' else p_prize ->> 'fulfillment' end::public.prize_fulfillment,
        nullif(p_prize ->> 'badge_id', '')::uuid,
        nullif(p_prize ->> 'sponsor_organizer_id', '')::uuid,
        nullif(btrim(coalesce(p_prize ->> 'pickup_note', '')), ''),
        coalesce(nullif(p_prize ->> 'min_score', '')::integer, 1),
        v_uid)
      returning id into v_id;
    elsif v_locked then
      update public.activity_prizes
      set description = case when p_prize ? 'description' then nullif(btrim(p_prize ->> 'description'), '') else description end,
          image_url = coalesce(nullif(p_prize ->> 'image_url', ''), image_url)
      where id = v_id and activity_id = p_activity_id;
      if not found then
        raise exception 'invalid_prize';
      end if;
    else
      update public.activity_prizes
      set rank_from = coalesce(nullif(p_prize ->> 'rank_from', '')::smallint, rank_from),
          rank_to = coalesce(nullif(p_prize ->> 'rank_to', '')::smallint, rank_to),
          title = coalesce(nullif(btrim(p_prize ->> 'title'), ''), title),
          description = case when p_prize ? 'description' then nullif(btrim(p_prize ->> 'description'), '') else description end,
          image_url = coalesce(nullif(p_prize ->> 'image_url', ''), image_url),
          kind = coalesce(nullif(p_prize ->> 'kind', '')::public.prize_kind, kind),
          fulfillment = case when coalesce(nullif(p_prize ->> 'kind', ''), kind::text) = 'badge' then 'digital'::public.prize_fulfillment
            else coalesce(nullif(p_prize ->> 'fulfillment', '')::public.prize_fulfillment, fulfillment) end,
          badge_id = case when p_prize ? 'badge_id' then nullif(p_prize ->> 'badge_id', '')::uuid else badge_id end,
          sponsor_organizer_id = case when p_prize ? 'sponsor_organizer_id' then nullif(p_prize ->> 'sponsor_organizer_id', '')::uuid else sponsor_organizer_id end,
          pickup_note = case when p_prize ? 'pickup_note' then nullif(btrim(p_prize ->> 'pickup_note'), '') else pickup_note end,
          min_score = coalesce(nullif(p_prize ->> 'min_score', '')::integer, min_score)
      where id = v_id and activity_id = p_activity_id;
      if not found then
        raise exception 'invalid_prize';
      end if;
    end if;
  exception
    when check_violation or not_null_violation or invalid_text_representation or numeric_value_out_of_range then
      raise exception 'invalid_prize';
  end;
  insert into public.admin_actions (admin_id, action, target_table, target_id)
  values (v_uid, 'upsert_activity_prize', 'activity_prizes', v_id);
  return v_id;
end;
$$;

create function public.remove_activity_prize(p_prize_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_activity uuid;
begin
  select activity_id into v_activity from public.activity_prizes where id = p_prize_id;
  if v_activity is null or not public.can_create_global_event((select host_organizer_id from public.activities where id = v_activity)) then
    raise exception 'not_allowed';
  end if;
  delete from public.activity_prizes where id = p_prize_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id)
  values (v_uid, 'remove_activity_prize', 'activity_prizes', p_prize_id);
end;
$$;

-- Badge eksklusif hadiah Event Global (tidak pernah diberikan award_badges otomatis).
create function public.create_prize_badge(p_name text, p_description text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_id uuid;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if char_length(btrim(coalesce(p_name, ''))) not between 3 and 60 or char_length(btrim(coalesce(p_description, ''))) not between 3 and 200 then
    raise exception 'invalid_badge';
  end if;
  insert into public.badges (code, name, description, rule, sort_order)
  values ('event_' || substr(translate(md5(random()::text || clock_timestamp()::text), '0123456789', 'ghijklmnop'), 1, 16),
    btrim(p_name), btrim(p_description), '{"type":"activity_prize"}', 100)
  returning id into v_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id)
  values (v_uid, 'create_prize_badge', 'badges', v_id);
  return v_id;
end;
$$;

-- Validasi tambahan saat Event Global diajukan (ALUR bagian 22b).
create function public.check_global_event_ready(p_activity_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.activities;
begin
  select * into v_a from public.activities where id = p_activity_id;
  if not public.can_create_global_event(v_a.host_organizer_id) then
    raise exception 'not_allowed';
  end if;
  if not exists (select 1 from public.activity_missions where activity_id = p_activity_id and is_active) then
    raise exception 'mission_required';
  end if;
  if v_a.location_mode = 'online' and exists (
    select 1 from public.activity_missions where activity_id = p_activity_id and is_active and verification = 'qr_scan'
  ) then
    raise exception 'online_no_qr_mission';
  end if;
  if not exists (select 1 from public.activity_prizes where activity_id = p_activity_id) then
    raise exception 'prize_required';
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Pemenang dan klaim hadiah
-- -----------------------------------------------------------------------------

create table public.activity_winners (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.activities (id),
  prize_id uuid not null references public.activity_prizes (id),
  user_id uuid not null references public.profiles (id),
  rank smallint not null,
  score integer not null,
  status public.winner_status not null default 'pending_claim',
  claim_deadline timestamptz not null,
  claimed_at timestamptz,
  ship_name text,
  ship_phone text,
  ship_address text,
  delivered_at timestamptz,
  delivered_by uuid references public.profiles (id),
  forfeited_reason text,
  note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint activity_winners_rank_once unique (activity_id, rank),
  constraint activity_winners_user_once unique (activity_id, user_id),
  constraint activity_winners_claimed check (status <> 'claimed' or claimed_at is not null),
  constraint activity_winners_delivered check (status <> 'delivered' or delivered_at is not null)
);

create index activity_winners_user_idx on public.activity_winners (user_id);
create index activity_winners_claim_idx on public.activity_winners (status, claim_deadline) where status = 'pending_claim';
create index activity_winners_shipping_idx on public.activity_winners (delivered_at) where ship_address is not null;

create trigger activity_winners_set_updated_at
  before update on public.activity_winners
  for each row execute function public.set_updated_at();

alter table public.activity_winners enable row level security;
revoke all on table public.activity_winners from anon, authenticated;
-- Alamat pengiriman (ship_*) tidak bisa dibaca langsung siapa pun; pemenang dan admin lewat get_winner_shipping.
grant select (id, activity_id, prize_id, user_id, rank, score, status, claim_deadline, claimed_at, delivered_at, delivered_by,
  forfeited_reason, note, created_at, updated_at) on public.activity_winners to authenticated;
create policy activity_winners_select on public.activity_winners
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (select public.is_admin())
    or exists (
      select 1 from public.activity_prizes p
      where p.id = prize_id and p.sponsor_organizer_id is not null and public.is_team_member(p.sponsor_organizer_id)
    )
  );

create function public.notify_admins(p_kind text, p_payload jsonb default '{}'::jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_admin uuid;
begin
  for v_admin in select id from public.profiles where is_admin and deleted_at is null loop
    perform public.notify(v_admin, p_kind, p_payload);
  end loop;
end;
$$;

-- Dipanggil settle_ended_activities. Idempoten: pemenang hanya ditetapkan sekali.
create function public.finalize_activity_winners(p_activity_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_a public.activities;
  v_row record;
  v_id uuid;
  v_n integer := 0;
  v_deadline timestamptz := now() + make_interval(days => public.setting_int('global_event.claim_days'));
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or v_a.reach <> 'global' or v_a.status <> 'settled' then
    return 0;
  end if;
  if exists (select 1 from public.activity_winners where activity_id = p_activity_id) then
    return 0;
  end if;
  for v_row in
    select b.user_id, b.rank, b.score, pz.id as prize_id, pz.kind, pz.badge_id, pz.title
    from public.v_activity_scoreboard b
    join public.activity_prizes pz on pz.activity_id = b.activity_id
      and b.rank between pz.rank_from and pz.rank_to and b.score >= pz.min_score
    where b.activity_id = p_activity_id
    order by b.rank
  loop
    insert into public.activity_winners (activity_id, prize_id, user_id, rank, score, status, claim_deadline, delivered_at)
    values (p_activity_id, v_row.prize_id, v_row.user_id, v_row.rank, v_row.score,
      case when v_row.kind = 'badge' then 'delivered'::public.winner_status else 'pending_claim'::public.winner_status end,
      v_deadline, case when v_row.kind = 'badge' then now() end)
    returning id into v_id;
    if v_row.kind = 'badge' then
      insert into public.user_badges (user_id, badge_id, activity_id) values (v_row.user_id, v_row.badge_id, p_activity_id)
      on conflict do nothing;
    end if;
    perform public.notify(v_row.user_id, 'prize_won', jsonb_build_object(
      'winner_id', v_id, 'activity_id', p_activity_id, 'activity_title', v_a.title, 'rank', v_row.rank,
      'prize_title', v_row.title, 'kind', v_row.kind, 'claim_deadline', v_deadline));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create function public.claim_prize(p_winner_id uuid, p_shipping jsonb default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_w public.activity_winners;
  v_pz public.activity_prizes;
  v_name text := nullif(btrim(coalesce(p_shipping ->> 'name', '')), '');
  v_phone text := regexp_replace(coalesce(p_shipping ->> 'phone', ''), '[^0-9]', '', 'g');
  v_address text := nullif(btrim(coalesce(p_shipping ->> 'address', '')), '');
begin
  select * into v_w from public.activity_winners where id = p_winner_id for update;
  if not found or v_w.user_id <> v_uid then
    raise exception 'invalid_winner';
  end if;
  if v_w.status <> 'pending_claim' then
    raise exception 'prize_not_claimable';
  end if;
  if v_w.claim_deadline < now() then
    raise exception 'claim_expired';
  end if;
  select * into v_pz from public.activity_prizes where id = v_w.prize_id;
  if v_pz.fulfillment = 'shipping' then
    if v_phone like '62%' then
      v_phone := '0' || substr(v_phone, 3);
    end if;
    if v_name is null or char_length(v_name) > 100 or v_phone !~ '^0[0-9]{8,14}$'
       or v_address is null or char_length(v_address) not between 10 and 500 then
      raise exception 'invalid_shipping';
    end if;
  else
    v_name := null; v_phone := null; v_address := null;
  end if;
  update public.activity_winners
  set status = 'claimed', claimed_at = now(), ship_name = v_name, ship_phone = nullif(v_phone, ''), ship_address = v_address
  where id = p_winner_id;
  perform public.notify_admins('prize_claimed', jsonb_build_object(
    'winner_id', p_winner_id, 'activity_id', v_w.activity_id, 'prize_title', v_pz.title, 'rank', v_w.rank));
end;
$$;

create function public.get_winner_shipping(p_winner_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_w public.activity_winners;
begin
  select * into v_w from public.activity_winners where id = p_winner_id;
  if not found or not (v_w.user_id = v_uid or public.is_admin()) then
    raise exception 'not_allowed';
  end if;
  return jsonb_build_object('name', v_w.ship_name, 'phone', v_w.ship_phone, 'address', v_w.ship_address);
end;
$$;

create function public.mark_prize_delivered(p_winner_id uuid, p_note text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_w public.activity_winners;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_w from public.activity_winners where id = p_winner_id for update;
  if not found or v_w.status <> 'claimed' then
    raise exception 'prize_not_claimed';
  end if;
  update public.activity_winners
  set status = 'delivered', delivered_at = now(), delivered_by = v_uid, note = nullif(btrim(p_note), '')
  where id = p_winner_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'mark_prize_delivered', 'activity_winners', p_winner_id, nullif(btrim(p_note), ''));
  perform public.notify(v_w.user_id, 'prize_delivered', jsonb_build_object(
    'winner_id', p_winner_id, 'activity_id', v_w.activity_id,
    'prize_title', (select title from public.activity_prizes where id = v_w.prize_id), 'note', nullif(btrim(p_note), '')));
end;
$$;

create function public.forfeit_prize(p_winner_id uuid, p_reason text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_w public.activity_winners;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  if nullif(btrim(p_reason), '') is null then
    raise exception 'note_required';
  end if;
  select * into v_w from public.activity_winners where id = p_winner_id for update;
  if not found or v_w.status not in ('pending_claim', 'claimed') then
    raise exception 'prize_not_forfeitable';
  end if;
  -- Hadiah tidak dialihkan ke peringkat berikutnya selama pilot.
  update public.activity_winners
  set status = 'forfeited', forfeited_reason = btrim(p_reason), ship_name = null, ship_phone = null, ship_address = null
  where id = p_winner_id;
  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'forfeit_prize', 'activity_winners', p_winner_id, btrim(p_reason));
  perform public.notify(v_w.user_id, 'prize_forfeited', jsonb_build_object(
    'winner_id', p_winner_id, 'activity_id', v_w.activity_id,
    'prize_title', (select title from public.activity_prizes where id = v_w.prize_id), 'reason', btrim(p_reason)));
end;
$$;

-- Cron harian: pengingat klaim, hadiah lewat batas klaim hangus, alamat dihapus setelah terkirim.
create function public.process_prizes()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row record;
  v_n integer := 0;
begin
  for v_row in
    select w.id, w.user_id, w.activity_id, w.claim_deadline, pz.title from public.activity_winners w
    join public.activity_prizes pz on pz.id = w.prize_id
    where w.status = 'pending_claim' and w.claim_deadline > now()
      and w.claim_deadline <= now() + make_interval(days => public.setting_int('global_event.claim_reminder_days'))
      and not exists (
        select 1 from public.notifications n
        where n.user_id = w.user_id and n.kind = 'prize_claim_reminder' and n.payload ->> 'winner_id' = w.id::text
      )
  loop
    perform public.notify(v_row.user_id, 'prize_claim_reminder', jsonb_build_object(
      'winner_id', v_row.id, 'activity_id', v_row.activity_id, 'prize_title', v_row.title, 'claim_deadline', v_row.claim_deadline));
    v_n := v_n + 1;
  end loop;

  for v_row in
    update public.activity_winners w
    set status = 'forfeited', forfeited_reason = 'Lewat batas klaim'
    where w.status = 'pending_claim' and w.claim_deadline < now()
    returning w.id, w.user_id, w.activity_id, w.prize_id
  loop
    perform public.notify(v_row.user_id, 'prize_forfeited', jsonb_build_object(
      'winner_id', v_row.id, 'activity_id', v_row.activity_id,
      'prize_title', (select title from public.activity_prizes where id = v_row.prize_id), 'reason', 'Lewat batas klaim'));
    v_n := v_n + 1;
  end loop;

  update public.activity_winners
  set ship_name = null, ship_phone = null, ship_address = null
  where status = 'delivered' and ship_address is not null
    and delivered_at < now() - make_interval(days => public.setting_int('global_event.shipping_retention_days'));
  return v_n;
end;
$$;

do $$
begin
  perform cron.schedule('process_prizes', '10 1 * * *', $cron$select public.process_prizes()$cron$); -- 08.10 WIB
exception when others then
  raise notice 'pg_cron tidak tersedia, jadwal process_prizes dilewati: %', sqlerrm;
end;
$$;

-- Leaderboard satu Event Global untuk semua pengguna masuk: 100 besar (nickname dan skor saja),
-- posisi pemanggil, dan status live/provisional/final.
create function public.get_activity_leaderboard(p_activity_id uuid, p_limit integer default 100)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.activities;
  v_limit integer := least(greatest(coalesce(p_limit, 100), 1), 100);
  v_rows jsonb;
  v_me jsonb;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_a from public.activities where id = p_activity_id;
  if not found or v_a.reach <> 'global'
     or not (public.activity_is_public(v_a.status) or public.is_admin() or public.is_activity_team(v_a.id)) then
    raise exception 'invalid_activity';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object(
      'rank', b.rank, 'nickname', b.nickname, 'score', b.score, 'is_me', b.user_id = v_uid, 'prize_title', w.prize_title
    ) order by b.rank), '[]'::jsonb)
  into v_rows
  from public.v_activity_scoreboard b
  left join lateral (
    select pz.title as prize_title from public.activity_winners aw
    join public.activity_prizes pz on pz.id = aw.prize_id
    where aw.activity_id = b.activity_id and aw.user_id = b.user_id and aw.status <> 'forfeited'
  ) w on v_a.status = 'settled'
  where b.activity_id = p_activity_id and b.rank <= v_limit;
  select jsonb_build_object('rank', rank, 'score', score) into v_me
  from public.v_activity_scoreboard where activity_id = p_activity_id and user_id = v_uid;
  return jsonb_build_object(
    'status', case v_a.status when 'settled' then 'final' when 'ended' then 'provisional' when 'running' then 'live' else 'upcoming' end,
    'rows', v_rows,
    'me', v_me,
    'participants', (select count(*) from public.v_activity_scoreboard where activity_id = p_activity_id)
  );
end;
$$;

-- Statistik Event Global untuk admin dan laporan ke pemkot.
create view public.v_global_event_stats as
select
  a.id as activity_id, a.title, a.status, a.location_mode, a.starts_at, a.ends_at,
  (select count(*) from public.participations p where p.activity_id = a.id and p.status not in ('cancelled', 'invited'))::integer as registrants,
  (select count(*) from public.v_activity_scoreboard b where b.activity_id = a.id)::integer as active_participants,
  (select count(*) from public.participations p join public.profiles pr on pr.id = p.user_id
    where p.activity_id = a.id and p.status not in ('cancelled', 'invited') and pr.home_village_id is not null)::integer as cimahi_participants,
  (select count(*) from public.participations p join public.profiles pr on pr.id = p.user_id
    where p.activity_id = a.id and p.status not in ('cancelled', 'invited') and pr.home_village_id is null)::integer as outside_participants,
  (select coalesce(jsonb_agg(jsonb_build_object('name', c.name, 'province', c.province_name, 'count', t.n) order by t.n desc, c.name), '[]'::jsonb)
    from (select pr.home_city_code, count(*) as n from public.participations p join public.profiles pr on pr.id = p.user_id
          where p.activity_id = a.id and p.status not in ('cancelled', 'invited') and pr.home_city_code is not null
          group by pr.home_city_code) t
    join public.cities c on c.code = t.home_city_code) as cities,
  (select coalesce(jsonb_agg(jsonb_build_object('name', r.name, 'count', t.n) order by t.n desc, r.name), '[]'::jsonb)
    from (select pr.home_village_id, count(*) as n from public.participations p join public.profiles pr on pr.id = p.user_id
          where p.activity_id = a.id and p.status not in ('cancelled', 'invited') and pr.home_village_id is not null
          group by pr.home_village_id) t
    join public.regions r on r.id = t.home_village_id) as villages,
  (select count(*) from public.mission_completions mc where mc.activity_id = a.id and mc.status = 'approved')::integer as missions_completed,
  (select round(avg(b.score)) from public.v_activity_scoreboard b where b.activity_id = a.id)::integer as avg_score,
  (select count(*) from public.activity_winners w where w.activity_id = a.id and w.status = 'pending_claim')::integer as prizes_pending_claim,
  (select count(*) from public.activity_winners w where w.activity_id = a.id and w.status = 'claimed')::integer as prizes_claimed,
  (select count(*) from public.activity_winners w where w.activity_id = a.id and w.status = 'delivered')::integer as prizes_delivered,
  (select count(*) from public.activity_winners w where w.activity_id = a.id and w.status = 'forfeited')::integer as prizes_forfeited
from public.activities a
where a.reach = 'global' and (select public.is_admin());

revoke all on public.v_global_event_stats from anon, authenticated;
grant select on public.v_global_event_stats to authenticated;

-- -----------------------------------------------------------------------------
-- Fungsi lama yang bercabang pada activities.reach
-- -----------------------------------------------------------------------------

create or replace function public.check_mission_row()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_a public.activities;
  v_cp public.activity_checkpoints;
  v_prev public.activity_missions;
  v_walk uuid;
  v_steps integer := 0;
  v_total integer;
begin
  select * into v_a from public.activities where id = new.activity_id;
  if v_a.reach = 'global' then
    -- Event Global: skor, bukan XP (ALUR bagian 22b)
    if new.xp_reward <> 0 then
      raise exception 'global_mission_no_xp';
    end if;
    if new.score_reward < public.setting_int('global_event.score_min') or new.score_reward > public.setting_int('global_event.score_max') then
      raise exception 'invalid_mission_score';
    end if;
    if new.verification = 'qr_scan' and v_a.location_mode = 'online' then
      raise exception 'online_no_qr_mission';
    end if;
  else
    if new.score_reward <> 0 then
      raise exception 'regional_mission_no_score';
    end if;
    if new.xp_reward < public.setting_int('mission.xp_min') or new.xp_reward > public.setting_int('mission.xp_max') then
      raise exception 'invalid_mission_xp';
    end if;
  end if;
  if not exists (select 1 from public.activity_partners ap where ap.activity_id = new.activity_id and ap.organizer_id = new.partner_organizer_id and ap.status = 'accepted') then
    raise exception 'mission_partner_not_accepted';
  end if;
  if new.verification = 'qr_scan' then
    if new.checkpoint_id is null then
      raise exception 'mission_checkpoint_required';
    end if;
    select * into v_cp from public.activity_checkpoints where id = new.checkpoint_id;
    if v_cp.activity_id <> new.activity_id or v_cp.partner_organizer_id <> new.partner_organizer_id then
      raise exception 'mission_checkpoint_not_owned';
    end if;
  else
    new.checkpoint_id := null;
  end if;
  if new.verification = 'secret_code' and new.code_hash is null then
    raise exception 'mission_code_required';
  end if;
  if new.verification <> 'secret_code' then
    new.code_hash := null;
  end if;
  if new.reveal_mode = 'scheduled' and new.reveal_at is null then
    raise exception 'mission_reveal_at_required';
  end if;
  if new.reveal_mode = 'after_mission' then
    if new.prerequisite_mission_id is null or new.prerequisite_mission_id = new.id then
      raise exception 'mission_prerequisite_required';
    end if;
    select * into v_prev from public.activity_missions where id = new.prerequisite_mission_id;
    if v_prev.activity_id <> new.activity_id then
      raise exception 'mission_prerequisite_other_activity';
    end if;
    if new.is_required and not v_prev.is_required then
      raise exception 'mission_prerequisite_must_be_required';
    end if;
    -- tidak boleh berputar
    v_walk := new.prerequisite_mission_id;
    while v_walk is not null loop
      if v_walk = new.id then
        raise exception 'mission_prerequisite_cycle';
      end if;
      select prerequisite_mission_id into v_walk from public.activity_missions where id = v_walk;
      v_steps := v_steps + 1;
      exit when v_steps > 50;
    end loop;
    new.revealed_at := null;
  else
    new.prerequisite_mission_id := null;
  end if;
  if new.available_from is not null and new.available_until is not null and new.available_from >= new.available_until then
    raise exception 'invalid_mission_window';
  end if;
  if new.reveal_mode = 'on_publish' and new.revealed_at is null and v_a.status in ('published', 'running', 'ended', 'settled') then
    new.revealed_at := now();
  end if;

  if tg_op = 'UPDATE' then
    if old.locked_at is not null and (new.verification <> old.verification or new.xp_reward <> old.xp_reward or new.score_reward <> old.score_reward
       or new.is_required <> old.is_required or new.checkpoint_id is distinct from old.checkpoint_id) then
      raise exception 'mission_locked';
    end if;
    if old.revealed_at is not null and new.revealed_at is null then
      raise exception 'mission_cannot_hide';
    end if;
    if new.activity_id <> old.activity_id then
      raise exception 'mission_activity_immutable';
    end if;
  end if;

  if v_a.reach = 'global' then
    select coalesce(sum(m.score_reward), 0) into v_total from public.activity_missions m
    where m.activity_id = new.activity_id and m.is_active and m.id <> new.id;
    if new.is_active and v_total + new.score_reward > public.setting_int('global_event.max_total_score') then
      raise exception 'mission_total_score_exceeded';
    end if;
  else
    select coalesce(sum(m.xp_reward), 0) into v_total from public.activity_missions m
    where m.activity_id = new.activity_id and m.is_active and m.id <> new.id;
    if new.is_active and v_total + new.xp_reward > public.setting_int('mission.max_total_xp') then
      raise exception 'mission_total_xp_exceeded';
    end if;
  end if;
  return new;
end;
$$;

create or replace function public.upsert_mission(p_activity_id uuid, p_mission jsonb)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_id uuid := nullif(p_mission ->> 'id', '')::uuid;
  v_partner uuid;
  v_old public.activity_missions;
  v_code text := nullif(btrim(coalesce(p_mission ->> 'code', '')), '');
  v_verification public.mission_verification := (p_mission ->> 'verification')::public.mission_verification;
  v_reveal public.mission_reveal := coalesce(nullif(p_mission ->> 'reveal_mode', ''), 'on_publish')::public.mission_reveal;
  v_template uuid := nullif(p_mission ->> 'template_id', '')::uuid;
begin
  select * into v_a from public.activities where id = p_activity_id;
  if not found then
    raise exception 'invalid_activity';
  end if;
  if v_a.status in ('ended', 'settled', 'cancelled') then
    raise exception 'activity_locked';
  end if;
  if v_id is not null then
    select * into v_old from public.activity_missions where id = v_id and activity_id = p_activity_id;
    if not found then
      raise exception 'invalid_mission';
    end if;
    v_partner := v_old.partner_organizer_id;
  else
    v_partner := coalesce(nullif(p_mission ->> 'partner_organizer_id', '')::uuid, v_a.host_organizer_id);
  end if;
  if not public.can_manage_missions(p_activity_id, v_partner) then
    raise exception 'not_allowed';
  end if;
  -- Partner (bukan host) hanya boleh misi qr_scan di checkpoint miliknya
  if v_partner <> v_a.host_organizer_id and not public.is_activity_host_team(p_activity_id) and v_verification <> 'qr_scan' then
    raise exception 'partner_qr_only';
  end if;
  if v_verification = 'secret_code' and v_code is not null and char_length(v_code) < 3 then
    raise exception 'invalid_code';
  end if;

  if v_id is null and v_template is not null
     and not exists (select 1 from public.mission_templates where id = v_template and is_active) then
    raise exception 'invalid_template';
  end if;

  if v_id is null then
    if v_verification = 'secret_code' and v_code is null then
      raise exception 'mission_code_required';
    end if;
    insert into public.activity_missions (activity_id, partner_organizer_id, title, description, icon, sort_order, verification, checkpoint_id, code_hash,
      xp_reward, score_reward, is_required, available_from, available_until, reveal_mode, reveal_at, prerequisite_mission_id, show_teaser, created_by, template_id)
    values (p_activity_id, v_partner, btrim(p_mission ->> 'title'), nullif(btrim(coalesce(p_mission ->> 'description', '')), ''), nullif(p_mission ->> 'icon', ''),
      coalesce((p_mission ->> 'sort_order')::smallint, (select coalesce(max(sort_order), 0) + 1 from public.activity_missions where activity_id = p_activity_id)),
      v_verification, nullif(p_mission ->> 'checkpoint_id', '')::uuid,
      case when v_verification = 'secret_code' then extensions.crypt(lower(v_code), extensions.gen_salt('bf')) end,
      case when v_a.reach = 'global' then 0 else (p_mission ->> 'xp_reward')::integer end,
      case when v_a.reach = 'global' then (p_mission ->> 'score_reward')::integer else 0 end,
      coalesce((p_mission ->> 'is_required')::boolean, true),
      nullif(p_mission ->> 'available_from', '')::timestamptz, nullif(p_mission ->> 'available_until', '')::timestamptz,
      v_reveal, nullif(p_mission ->> 'reveal_at', '')::timestamptz, nullif(p_mission ->> 'prerequisite_mission_id', '')::uuid,
      coalesce((p_mission ->> 'show_teaser')::boolean, true), v_uid, v_template)
    returning id into v_id;
  else
    update public.activity_missions set
      title = coalesce(btrim(p_mission ->> 'title'), title),
      description = case when p_mission ? 'description' then nullif(btrim(p_mission ->> 'description'), '') else description end,
      icon = case when p_mission ? 'icon' then nullif(p_mission ->> 'icon', '') else icon end,
      sort_order = coalesce((p_mission ->> 'sort_order')::smallint, sort_order),
      verification = coalesce(v_verification, verification),
      checkpoint_id = case when p_mission ? 'checkpoint_id' then nullif(p_mission ->> 'checkpoint_id', '')::uuid else checkpoint_id end,
      code_hash = case when v_code is not null then extensions.crypt(lower(v_code), extensions.gen_salt('bf')) else code_hash end,
      xp_reward = case when v_a.reach = 'global' then 0 else coalesce((p_mission ->> 'xp_reward')::integer, xp_reward) end,
      score_reward = case when v_a.reach = 'global' then coalesce((p_mission ->> 'score_reward')::integer, score_reward) else 0 end,
      is_required = coalesce((p_mission ->> 'is_required')::boolean, is_required),
      available_from = case when p_mission ? 'available_from' then nullif(p_mission ->> 'available_from', '')::timestamptz else available_from end,
      available_until = case when p_mission ? 'available_until' then nullif(p_mission ->> 'available_until', '')::timestamptz else available_until end,
      reveal_mode = case when p_mission ? 'reveal_mode' and revealed_at is null then v_reveal else reveal_mode end,
      reveal_at = case when p_mission ? 'reveal_at' then nullif(p_mission ->> 'reveal_at', '')::timestamptz else reveal_at end,
      prerequisite_mission_id = case when p_mission ? 'prerequisite_mission_id' then nullif(p_mission ->> 'prerequisite_mission_id', '')::uuid else prerequisite_mission_id end,
      show_teaser = coalesce((p_mission ->> 'show_teaser')::boolean, show_teaser)
    where id = v_id;
  end if;
  return v_id;
end;
$$;

create or replace function public.perform_checkin(p_checkpoint_id uuid, p_token text, p_lat numeric default null, p_lng numeric default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_cp public.activity_checkpoints;
  v_a public.activities;
  v_p public.participations;
  v_partner public.organizers;
  v_target public.challenge_targets;
  v_slot bigint := public.qr_slot();
  v_distance integer;
  v_flagged boolean := false;
  v_checkin_id uuid;
  v_base integer := 0;
  v_first integer := 0;
  v_collab integer := 0;
  v_group integer := 0;
  v_points integer := 0;
  v_partner_count integer;
  v_completed boolean := false;
  v_progress integer := 0;
  v_group_progress integer;
  v_target_count integer;
  v_total_xp integer;
  v_present integer;
  v_eval jsonb := '{}'::jsonb;
  v_row record;
  v_score integer := 0;
begin
  select * into v_cp from public.activity_checkpoints where id = p_checkpoint_id and is_active;
  if not found then
    raise exception 'invalid_checkpoint';
  end if;

  select * into v_a from public.activities where id = v_cp.activity_id for update;
  if v_a.status = 'published' and v_a.starts_at <= now() and v_a.ends_at > now() then
    update public.activities set status = 'running' where id = v_a.id;
    v_a.status := 'running';
  end if;
  if v_a.status <> 'running' then
    raise exception 'activity_not_running';
  end if;

  if p_token is null or p_token not in (
    public.qr_token(v_cp.qr_secret, v_cp.id, v_slot),
    public.qr_token(v_cp.qr_secret, v_cp.id, v_slot - 1)
  ) then
    raise exception 'invalid_token';
  end if;

  select * into v_p from public.participations
  where activity_id = v_a.id and user_id = v_uid for update;
  if not found or v_p.status not in ('registered', 'in_progress') then
    raise exception 'not_registered';
  end if;
  if v_p.payment_status not in ('not_required', 'paid') then
    raise exception 'payment_required';
  end if;

  if p_lat is not null and p_lng is not null then
    v_distance := public.distance_m(p_lat, p_lng, v_cp.lat, v_cp.lng);
    v_flagged := v_distance > v_cp.radius_m;
  else
    v_flagged := true;
  end if;

  begin
    insert into public.checkins (participation_id, activity_id, user_id, group_id, checkpoint_id, partner_organizer_id, lat, lng, distance_m, review_status)
    values (v_p.id, v_a.id, v_uid, v_p.group_id, v_cp.id, v_cp.partner_organizer_id, p_lat, p_lng, v_distance,
      case when v_flagged then 'flagged'::public.review_status else 'ok'::public.review_status end)
    returning id into v_checkin_id;
  exception when unique_violation then
    raise exception 'already_checked_in_today';
  end;

  if v_flagged then
    insert into public.fraud_flags (user_id, checkin_id, kind, detail)
    values (v_uid, v_checkin_id, 'out_of_radius',
      jsonb_build_object('distance_m', v_distance, 'radius_m', v_cp.radius_m, 'has_location', p_lat is not null));
  end if;

  -- Event Global: hanya skor event (ALUR bagian 22c), tanpa XP, bonus, dan poin.
  if v_a.reach = 'global' then
    v_score := public.award_activity_score(v_uid, v_a.id, public.setting_int('global_event.checkin_score'), 'checkin',
      v_checkin_id, null, now(), 'Check-in ' || v_a.title);
    v_eval := public.evaluate_completion(v_p.id, v_cp.partner_organizer_id, v_checkin_id);
    return jsonb_build_object(
      'checkin_id', v_checkin_id,
      'activity_id', v_a.id,
      'activity_title', v_a.title,
      'activity_type', v_a.type,
      'reach', v_a.reach,
      'target_scope', v_a.target_scope,
      'checkpoint_name', v_cp.name,
      'partner_name', (select name from public.organizers where id = v_cp.partner_organizer_id),
      'distance_m', v_distance,
      'flagged', v_flagged,
      'completed', coalesce((v_eval ->> 'completed')::boolean, false),
      'progress', coalesce((v_eval ->> 'progress')::integer, 0),
      'target_count', 1,
      'required_total', coalesce((v_eval ->> 'required_total')::integer, 0),
      'required_done', coalesce((v_eval ->> 'required_done')::integer, 0),
      'score', v_score,
      'event_score', public.activity_score(v_uid, v_a.id),
      'xp_total', 0,
      'points', 0
    );
  end if;

  if v_a.type = 'event' then
    v_base := public.award_xp(v_uid, v_a.xp_base, 'event_checkin', v_a.id, v_checkin_id, null, 'Check-in ' || v_a.title);
  end if;

  if not exists (
    select 1 from public.checkins
    where user_id = v_uid and partner_organizer_id = v_cp.partner_organizer_id and id <> v_checkin_id
  ) then
    select * into v_partner from public.organizers where id = v_cp.partner_organizer_id;
    v_first := public.award_xp(v_uid, public.setting_int('xp.first_visit_bonus'), 'first_visit_bonus', v_a.id, v_checkin_id, null,
      'Kunjungan pertama ke ' || v_partner.name);
  end if;

  if v_a.type = 'event' then
    select count(*) into v_partner_count from public.activity_partners where activity_id = v_a.id and status = 'accepted';
    if v_partner_count > 1 then
      v_collab := public.award_xp(v_uid, round(v_a.xp_base * public.setting_int('xp.collab_bonus_pct') / 100.0)::integer, 'collab_bonus', v_a.id, v_checkin_id, null,
        'Bonus kolaborasi ' || v_a.title);
    end if;
    -- Selesai jika semua misi wajib yang terbuka sudah disetujui (ALUR 9d)
    v_eval := public.evaluate_completion(v_p.id, v_cp.partner_organizer_id, v_checkin_id);
    v_completed := (v_eval ->> 'completed')::boolean;
    v_progress := (v_eval ->> 'progress')::integer;
    v_target_count := 1;
    v_points := (v_eval ->> 'points')::integer;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    v_target_count := coalesce(v_target.target_count, 1);
    v_progress := case when v_target.kind in ('total_checkins', 'distinct_checkpoints')
      then public.checkin_progress(v_a.id, v_target.kind, v_p.id, null) else v_p.progress end;

    if v_a.target_scope = 'individual' then
      if v_target.kind in ('total_checkins', 'distinct_checkpoints') and v_progress >= v_target_count then
        update public.participations set status = 'completed', progress = v_progress, completed_at = now() where id = v_p.id;
        v_base := public.award_challenge_completion(v_uid, v_a, v_checkin_id);
        v_points := public.grant_completion_points(v_uid, v_a, v_cp.partner_organizer_id);
        v_completed := true;
      else
        update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
      end if;
    else
      update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
      if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
        v_group_progress := public.checkin_progress(v_a.id, v_target.kind, null, v_p.group_id);
        if v_group_progress >= v_target_count then
          for v_row in
            select p.id, p.user_id from public.participations p
            where p.activity_id = v_a.id and p.group_id = v_p.group_id and p.status = 'in_progress'
              and exists (select 1 from public.checkins c where c.participation_id = p.id and c.review_status <> 'rejected')
          loop
            update public.participations set status = 'completed', completed_at = now() where id = v_row.id;
            if v_row.user_id = v_uid then
              v_base := public.award_challenge_completion(v_uid, v_a, v_checkin_id);
              v_points := public.grant_completion_points(v_uid, v_a, v_cp.partner_organizer_id);
              v_completed := true;
            else
              perform public.award_challenge_completion(v_row.user_id, v_a, null);
              perform public.grant_completion_points(v_row.user_id, v_a, v_cp.partner_organizer_id);
            end if;
          end loop;
        end if;
      else
        v_group_progress := public.mission_progress(v_a.id, v_target.kind, null, v_p.group_id);
      end if;
    end if;
  end if;

  if v_p.group_id is not null then
    select count(distinct user_id) into v_present from public.checkins
    where activity_id = v_a.id and group_id = v_p.group_id and local_date = public.local_today() and review_status <> 'rejected';
    if v_present >= public.setting_int('xp.group_bonus_min_members') then
      for v_row in
        select distinct c.user_id, c.id as checkin_id from public.checkins c
        where c.activity_id = v_a.id and c.group_id = v_p.group_id and c.local_date = public.local_today() and c.review_status <> 'rejected'
          and not exists (
            select 1 from public.xp_ledger x
            where x.user_id = c.user_id and x.activity_id = v_a.id and x.reason = 'group_bonus' and x.local_date = public.local_today()
          )
      loop
        if v_row.user_id = v_uid then
          v_group := public.award_xp(v_uid, round(v_a.xp_base * public.setting_int('xp.group_bonus_pct') / 100.0)::integer, 'group_bonus', v_a.id, v_checkin_id, null, 'Bonus grup ' || v_a.title);
        else
          perform public.award_xp(v_row.user_id, round(v_a.xp_base * public.setting_int('xp.group_bonus_pct') / 100.0)::integer, 'group_bonus', v_a.id, v_row.checkin_id, null, 'Bonus grup ' || v_a.title);
        end if;
      end loop;
    end if;
  end if;

  select coalesce(sum(amount), 0) into v_total_xp from public.xp_ledger where user_id = v_uid;

  return jsonb_build_object(
    'checkin_id', v_checkin_id,
    'activity_id', v_a.id,
    'activity_title', v_a.title,
    'activity_type', v_a.type,
    'target_scope', v_a.target_scope,
    'checkpoint_name', v_cp.name,
    'partner_name', (select name from public.organizers where id = v_cp.partner_organizer_id),
    'distance_m', v_distance,
    'flagged', v_flagged,
    'completed', v_completed,
    'progress', v_progress,
    'group_progress', v_group_progress,
    'target_count', v_target_count,
    'required_total', coalesce((v_eval ->> 'required_total')::integer, 0),
    'required_done', coalesce((v_eval ->> 'required_done')::integer, 0),
    'xp_base', v_base,
    'xp_first_visit', v_first,
    'xp_collab', v_collab,
    'xp_group', v_group,
    'xp_total', v_base + v_first + v_collab + v_group,
    'points', v_points,
    'points_balance', public.points_balance(v_uid),
    'total_xp', v_total_xp
  );
end;
$$;

create or replace function public.apply_mission_approval(p_completion_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.mission_completions;
  v_m public.activity_missions;
  v_a public.activities;
  v_xp integer := 0;
  v_score integer := 0;
  v_eval jsonb;
  v_row record;
begin
  select * into v_c from public.mission_completions where id = p_completion_id;
  select * into v_m from public.activity_missions where id = v_c.mission_id;
  select * into v_a from public.activities where id = v_c.activity_id;
  if v_a.reach = 'global' then
    -- Seri dihitung dari waktu warga mengirim bukti, bukan waktu disetujui.
    v_score := public.award_activity_score(v_c.user_id, v_a.id, v_m.score_reward, 'mission_complete', null, v_c.id, v_c.submitted_at, 'Misi: ' || v_m.title);
  else
    v_xp := public.award_xp(v_c.user_id, v_m.xp_reward, 'mission_complete', v_a.id, null, v_c.id, 'Misi: ' || v_m.title);
  end if;
  update public.mission_completions set local_date = public.local_today() where id = v_c.id;
  update public.activity_missions set locked_at = coalesce(locked_at, now()) where id = v_m.id;
  v_eval := public.evaluate_completion(v_c.participation_id, v_m.partner_organizer_id, null);
  -- Challenge grup bertarget misi: anggota lain ikut selesai saat target grup tercapai
  if (v_eval ->> 'completed')::boolean and v_a.target_scope = 'group' and v_c.group_id is not null then
    for v_row in
      select p.id from public.participations p
      where p.activity_id = v_a.id and p.group_id = v_c.group_id and p.status in ('registered', 'in_progress')
        and exists (select 1 from public.checkins c where c.participation_id = p.id and c.review_status <> 'rejected')
    loop
      perform public.evaluate_completion(v_row.id, v_m.partner_organizer_id, null);
    end loop;
  end if;
  return v_eval || jsonb_build_object('mission_xp', v_xp, 'mission_score', v_score, 'reach', v_a.reach, 'mission_title', v_m.title);
end;
$$;

create or replace function public.evaluate_completion(p_participation_id uuid, p_preferred_organizer_id uuid default null, p_checkin_id uuid default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_p public.participations;
  v_a public.activities;
  v_target public.challenge_targets;
  v_has_checkin boolean;
  v_req_total integer := 0;
  v_req_done integer := 0;
  v_progress integer := 0;
  v_target_count integer := 1;
  v_done boolean := false;
  v_xp integer := 0;
  v_points integer := 0;
  v_pref uuid;
begin
  select * into v_p from public.participations where id = p_participation_id for update;
  if not found then
    raise exception 'invalid_participation';
  end if;
  select * into v_a from public.activities where id = v_p.activity_id;
  if v_p.status = 'completed' then
    return jsonb_build_object('completed', true, 'newly_completed', false, 'xp', 0, 'points', 0, 'progress', v_p.progress, 'target_count', 1);
  end if;
  if v_p.status not in ('registered', 'in_progress') then
    return jsonb_build_object('completed', false, 'newly_completed', false, 'xp', 0, 'points', 0, 'progress', v_p.progress, 'target_count', 1);
  end if;

  v_has_checkin := exists (select 1 from public.checkins c where c.participation_id = v_p.id and c.review_status <> 'rejected');
  select count(*), count(*) filter (where exists (
      select 1 from public.mission_completions mc where mc.mission_id = m.id and mc.user_id = v_p.user_id and mc.status = 'approved'))
  into v_req_total, v_req_done
  from public.activity_missions m
  where m.activity_id = v_a.id and m.is_active and m.is_required and public.mission_open_for(m.id, v_p.user_id);

  if v_a.type = 'event' then
    v_done := v_has_checkin and v_req_done = v_req_total;
    v_progress := case when v_done then 1 else 0 end;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    v_target_count := coalesce(v_target.target_count, 1);
    if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
      v_progress := public.checkin_progress(v_a.id, v_target.kind, v_p.id, null);
      v_done := case when v_a.target_scope = 'group'
        then public.checkin_progress(v_a.id, v_target.kind, null, v_p.group_id) >= v_target_count
        else v_progress >= v_target_count end;
    elsif v_target.kind = 'required_missions' then
      v_progress := v_req_done;
      v_target_count := greatest(v_req_total, 1);
      v_done := v_req_total > 0 and v_req_done = v_req_total;
    else
      v_progress := public.mission_progress(v_a.id, v_target.kind, v_p.id, null);
      v_done := case when v_a.target_scope = 'group'
        then public.mission_progress(v_a.id, v_target.kind, null, v_p.group_id) >= v_target_count
        else v_progress >= v_target_count end;
    end if;
  end if;

  if v_a.reach = 'global' then
    -- Event Global tidak punya status selesai: peserta tetap bisa menambah skor lewat misi
    -- sampai acara berakhir (peringkat dari skor, bukan dari status selesai).
    v_done := false;
    v_progress := 0;
  end if;

  if v_done then
    update public.participations set status = 'completed', progress = v_progress, completed_at = now() where id = v_p.id;
    if v_a.type = 'challenge' then
      v_xp := public.award_challenge_completion(v_p.user_id, v_a, p_checkin_id);
    end if;
    -- Event Global tidak pernah memberi poin (points_per_completion selalu 0, dicek trigger).
    if v_a.reach = 'regional' then
      v_pref := coalesce(p_preferred_organizer_id, v_a.host_organizer_id);
      v_points := public.grant_completion_points(v_p.user_id, v_a, v_pref);
    end if;
  elsif v_has_checkin or v_progress > 0 then
    update public.participations set status = 'in_progress', progress = v_progress where id = v_p.id;
  end if;

  return jsonb_build_object('completed', v_done, 'newly_completed', v_done, 'xp', v_xp, 'points', v_points,
    'progress', v_progress, 'target_count', v_target_count, 'required_total', v_req_total, 'required_done', v_req_done);
end;
$$;

create or replace function public.review_mission_completion(p_completion_id uuid, p_approve boolean, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_c public.mission_completions;
  v_m public.activity_missions;
  v_a public.activities;
  v_eval jsonb := '{}'::jsonb;
begin
  select * into v_c from public.mission_completions where id = p_completion_id for update;
  if not found then
    raise exception 'invalid_completion';
  end if;
  select * into v_m from public.activity_missions where id = v_c.mission_id;
  if not (public.is_activity_host_team(v_c.activity_id) or public.is_team_member(v_m.partner_organizer_id)) then
    raise exception 'not_allowed';
  end if;
  if v_c.status <> 'pending_review' then
    raise exception 'completion_not_pending';
  end if;
  select * into v_a from public.activities where id = v_c.activity_id;
  if v_a.status = 'settled' or v_a.status = 'cancelled' then
    raise exception 'activity_locked';
  end if;
  if not p_approve and nullif(btrim(p_note), '') is null then
    raise exception 'note_required';
  end if;
  update public.mission_completions
  set status = case when p_approve then 'approved'::public.completion_status else 'rejected'::public.completion_status end,
      reviewed_by = v_uid, reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = p_completion_id;
  if p_approve then
    v_eval := public.apply_mission_approval(p_completion_id);
    perform public.check_reviewer_burst(v_uid, v_a.id,
      case when public.is_team_member(v_m.partner_organizer_id) then v_m.partner_organizer_id else v_a.host_organizer_id end);
    perform public.notify(v_c.user_id, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward, 'score', v_m.score_reward,
      'completed', (v_eval ->> 'completed')::boolean));
  else
    perform public.notify(v_c.user_id, 'mission_rejected', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'note', nullif(btrim(p_note), '')));
  end if;
  return v_eval || jsonb_build_object('approved', p_approve);
end;
$$;

create or replace function public.mark_missions_manual(p_mission_id uuid, p_user_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_m public.activity_missions;
  v_a public.activities;
  v_p public.participations;
  v_u uuid;
  v_id uuid;
  v_n integer := 0;
begin
  select * into v_m from public.activity_missions where id = p_mission_id;
  if not found or v_m.verification <> 'manual' or not v_m.is_active then
    raise exception 'invalid_mission';
  end if;
  if not (public.is_activity_host_team(v_m.activity_id) or public.is_team_member(v_m.partner_organizer_id)) then
    raise exception 'not_allowed';
  end if;
  select * into v_a from public.activities where id = v_m.activity_id;
  if v_a.status not in ('running', 'ended') then
    raise exception 'activity_not_running';
  end if;
  if v_m.revealed_at is null and v_m.reveal_mode <> 'after_mission' then
    raise exception 'mission_not_revealed';
  end if;
  foreach v_u in array p_user_ids loop
    select * into v_p from public.participations where activity_id = v_a.id and user_id = v_u;
    if not found or v_p.status not in ('registered', 'in_progress') or v_p.payment_status not in ('not_required', 'paid') then
      continue;
    end if;
    if not public.mission_open_for(v_m.id, v_u) then
      continue;
    end if;
    if exists (select 1 from public.mission_completions where mission_id = v_m.id and user_id = v_u and status in ('approved', 'pending_review')) then
      continue;
    end if;
    insert into public.mission_completions (mission_id, participation_id, activity_id, user_id, group_id, status, reviewed_by, reviewed_at)
    values (v_m.id, v_p.id, v_a.id, v_u, v_p.group_id, 'approved', v_uid, now())
    returning id into v_id;
    perform public.apply_mission_approval(v_id);
    perform public.notify(v_u, 'mission_approved', jsonb_build_object('activity_id', v_a.id, 'title', v_a.title, 'mission_title', v_m.title, 'xp', v_m.xp_reward, 'score', v_m.score_reward));
    v_n := v_n + 1;
  end loop;
  return v_n;
end;
$$;

create or replace function public.get_activity_missions(p_activity_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_a public.activities;
  v_p public.participations;
  v_m public.activity_missions;
  v_prev public.activity_missions;
  v_items jsonb := '[]'::jsonb;
  v_my record;
  v_req_total integer := 0;
  v_req_done integer := 0;
  v_can_work boolean;
  v_hint text;
begin
  if v_uid is null then
    raise exception 'not_authenticated';
  end if;
  select * into v_a from public.activities where id = p_activity_id;
  if not found then
    raise exception 'invalid_activity';
  end if;
  select * into v_p from public.participations where activity_id = p_activity_id and user_id = v_uid;
  v_can_work := v_a.status = 'running' and v_p.id is not null and v_p.status in ('registered', 'in_progress')
    and v_p.payment_status in ('not_required', 'paid');

  for v_m in select * from public.activity_missions where activity_id = p_activity_id and is_active order by sort_order, created_at loop
    if public.mission_open_for(v_m.id, v_uid) then
      select status, review_note, submitted_at into v_my from public.mission_completions
      where mission_id = v_m.id and user_id = v_uid order by submitted_at desc limit 1;
      if v_m.is_required then
        v_req_total := v_req_total + 1;
        if v_my.status = 'approved' then v_req_done := v_req_done + 1; end if;
      end if;
      v_items := v_items || jsonb_build_object(
        'id', v_m.id, 'open', true, 'title', v_m.title, 'description', v_m.description, 'icon', v_m.icon,
        'verification', v_m.verification, 'xp_reward', v_m.xp_reward, 'score_reward', v_m.score_reward, 'is_required', v_m.is_required,
        'available_from', v_m.available_from, 'available_until', v_m.available_until,
        'checkpoint_name', (select name from public.activity_checkpoints where id = v_m.checkpoint_id),
        'partner_name', (select name from public.organizers where id = v_m.partner_organizer_id),
        'my_status', v_my.status, 'my_note', v_my.review_note, 'my_submitted_at', v_my.submitted_at,
        'can_work', v_can_work and coalesce(v_my.status, 'rejected') = 'rejected' and v_m.verification <> 'manual'
          and (v_m.available_from is null or v_m.available_from <= now()) and (v_m.available_until is null or v_m.available_until > now()));
    elsif v_m.show_teaser then
      if v_m.reveal_mode = 'scheduled' then
        v_hint := 'Terbuka ' || to_char(v_m.reveal_at at time zone 'Asia/Jakarta', 'DD Mon HH24.MI');
      elsif v_m.reveal_mode = 'after_mission' then
        select * into v_prev from public.activity_missions where id = v_m.prerequisite_mission_id;
        v_hint := case when public.mission_open_for(v_prev.id, v_uid) then 'Selesaikan "' || v_prev.title || '" untuk membuka' else 'Terbuka setelah misi sebelumnya selesai' end;
      else
        v_hint := 'Dibuka panitia saat acara';
      end if;
      v_items := v_items || jsonb_build_object('id', v_m.id, 'open', false, 'xp_reward', v_m.xp_reward, 'score_reward', v_m.score_reward, 'is_required', v_m.is_required, 'hint', v_hint);
    end if;
  end loop;

  return jsonb_build_object('reach', v_a.reach, 'missions', v_items, 'required_total', v_req_total, 'required_done', v_req_done, 'can_work', v_can_work,
    'participation_status', v_p.status, 'payment_status', v_p.payment_status);
end;
$$;

create or replace function public.reverse_checkin(p_checkin_id uuid, p_note text default null)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_c public.checkins;
  v_a public.activities;
  v_p public.participations;
  v_xp integer := 0;
  v_points integer := 0;
  v_amount integer;
  v_row record;
  v_debit uuid;
  v_remaining integer;
  v_target public.challenge_targets;
  v_score integer := 0;
begin
  if not public.is_admin() then
    raise exception 'not_allowed';
  end if;
  select * into v_c from public.checkins where id = p_checkin_id for update;
  if not found then
    raise exception 'invalid_checkin';
  end if;
  if v_c.review_status = 'rejected' then
    raise exception 'already_rejected';
  end if;
  select * into v_a from public.activities where id = v_c.activity_id;
  select * into v_p from public.participations where id = v_c.participation_id for update;

  update public.checkins
  set review_status = 'rejected', reviewed_by = v_uid, reviewed_at = now(), review_note = nullif(btrim(p_note), '')
  where id = p_checkin_id;

  -- XP yang terikat ke check-in ini (dasar, kunjungan pertama, kolaborasi, bonus grup)
  select coalesce(sum(amount), 0) into v_amount from public.xp_ledger where checkin_id = p_checkin_id and reason <> 'reversal';
  if v_amount > 0 then
    insert into public.xp_ledger (user_id, amount, reason, activity_id, checkin_id, village_id, note)
    select v_c.user_id, -v_amount, 'reversal', v_c.activity_id, p_checkin_id, home_village_id, 'Check-in ditolak admin'
    from public.profiles where id = v_c.user_id;
    v_xp := v_amount;
  end if;

  -- Skor Event Global yang terikat ke check-in ini dibalik dengan baris negatif.
  select coalesce(sum(amount), 0) into v_score from public.activity_score_ledger where checkin_id = p_checkin_id;
  if v_score > 0 then
    insert into public.activity_score_ledger (activity_id, user_id, amount, reason, checkin_id, occurred_at, note)
    values (v_c.activity_id, v_c.user_id, -v_score, 'reversal', p_checkin_id, now(), 'Check-in ditolak admin');
  end if;

  -- Poin penyelesaian: hanya jika check-in ini yang menuntaskan (event selalu; challenge jika selesai)
  if v_p.status = 'completed' then
    for v_row in
      select c.id, c.amount, c.source_organizer_id,
        c.amount - coalesce((select sum(a.amount) from public.point_allocations a where a.credit_id = c.id), 0) as remaining
      from public.point_ledger c
      where c.user_id = v_c.user_id and c.activity_id = v_c.activity_id and c.reason = 'activity_reward' and c.amount > 0
    loop
      v_remaining := v_row.remaining;
      if v_remaining > 0 then
        insert into public.point_ledger (user_id, amount, reason, activity_id, source_organizer_id, note)
        values (v_c.user_id, -v_remaining, 'reversal', v_c.activity_id, v_row.source_organizer_id, 'Check-in ditolak admin')
        returning id into v_debit;
        insert into public.point_allocations (credit_id, debit_id, amount) values (v_row.id, v_debit, v_remaining);
        v_points := v_points + v_remaining;
      end if;
    end loop;
  end if;

  -- Status partisipasi dimundurkan sesuai check-in yang tersisa
  if v_a.type = 'event' then
    if not exists (select 1 from public.checkins where participation_id = v_p.id and review_status <> 'rejected') then
      update public.participations set status = 'registered', progress = 0, completed_at = null where id = v_p.id;
    end if;
  else
    select * into v_target from public.challenge_targets where activity_id = v_a.id;
    if v_target.kind in ('total_checkins', 'distinct_checkpoints') then
      v_amount := public.checkin_progress(v_a.id, v_target.kind, v_p.id, null);
      update public.participations
      set progress = v_amount,
          status = case when v_amount = 0 then 'registered'::public.participation_status else 'in_progress'::public.participation_status end,
          completed_at = null
      where id = v_p.id;
    end if;
  end if;

  update public.fraud_flags set status = 'actioned', reviewed_by = v_uid, reviewed_at = now()
  where checkin_id = p_checkin_id and status = 'open';

  insert into public.admin_actions (admin_id, action, target_table, target_id, note)
  values (v_uid, 'reverse_checkin', 'checkins', p_checkin_id, nullif(btrim(p_note), ''));

  perform public.notify(v_c.user_id, 'checkin_rejected',
    jsonb_build_object('activity_id', v_a.id, 'activity_title', v_a.title, 'xp', v_xp, 'points', v_points, 'score', v_score, 'note', nullif(btrim(p_note), '')));

  return jsonb_build_object('xp_reversed', v_xp, 'points_reversed', v_points, 'score_reversed', v_score);
end;
$$;

create or replace function public.submit_activity(p_activity_id uuid)
returns public.activity_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_a public.activities;
  v_host public.organizers;
  v_pending integer;
  v_budget integer;
begin
  select * into v_a from public.activities where id = p_activity_id for update;
  if not found or not public.is_activity_host_leader(p_activity_id) then
    raise exception 'not_allowed';
  end if;
  select * into v_host from public.organizers where id = v_a.host_organizer_id;
  if v_host.status <> 'approved' and v_host.type <> 'platform' then
    raise exception 'host_not_approved';
  end if;
  if v_a.status not in ('draft', 'awaiting_partners') then
    raise exception 'activity_locked';
  end if;
  if v_a.starts_at <= now() then
    raise exception 'starts_in_past';
  end if;
  -- onsite wajib checkpoint; online tidak boleh punya checkpoint; hybrid opsional.
  if v_a.location_mode = 'onsite' and not exists (select 1 from public.activity_checkpoints where activity_id = p_activity_id and is_active) then
    raise exception 'checkpoint_required';
  end if;
  if v_a.location_mode = 'online' and exists (select 1 from public.activity_checkpoints where activity_id = p_activity_id and is_active) then
    raise exception 'online_no_checkpoint';
  end if;
  if v_a.reach = 'global' then
    perform public.check_global_event_ready(p_activity_id);
  end if;
  if v_a.type = 'challenge' and not exists (select 1 from public.challenge_targets where activity_id = p_activity_id) then
    raise exception 'target_required';
  end if;
  if v_a.points_per_completion > 0 then
    select coalesce(sum(points_budget), 0) into v_budget
    from public.activity_partners where activity_id = p_activity_id and status = 'accepted';
    if v_budget < v_a.points_per_completion then
      raise exception 'points_budget_insufficient';
    end if;
  end if;
  if v_a.audience = 'members_only' and v_host.type <> 'community' then
    raise exception 'members_only_requires_community_host';
  end if;
  if v_a.residency_rule = 'residents_only' and v_a.scope_region_id is null then
    raise exception 'residency_requires_scope';
  end if;
  if v_a.is_paid and (v_a.price_idr is null or v_a.price_idr < public.setting_int('payment.min_price_idr') or v_a.payment_instructions is null) then
    raise exception 'invalid_payment';
  end if;

  update public.collab_posts set status = 'closed' where activity_id = p_activity_id and status = 'open';

  select count(*) into v_pending
  from public.activity_partners where activity_id = p_activity_id and status = 'invited';

  if v_host.type = 'platform' then
    update public.activities
    set status = 'published', submitted_at = now(), published_at = now(), reviewed_by = v_uid, review_note = null
    where id = p_activity_id;
    insert into public.admin_actions (admin_id, action, target_table, target_id)
    values (v_uid, 'publish_platform_activity', 'activities', p_activity_id);
    return 'published';
  end if;

  if v_pending > 0 then
    update public.activities set status = 'awaiting_partners', submitted_at = now() where id = p_activity_id;
    return 'awaiting_partners';
  end if;

  update public.activities set status = 'in_review', submitted_at = now(), review_note = null where id = p_activity_id;
  return 'in_review';
end;
$$;

create or replace function public.settle_ended_activities()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_row record;
begin
  create temp table if not exists settled_now (id uuid primary key) on commit drop;
  insert into settled_now
    select id from public.activities where status = 'ended' and ends_at <= now() - interval '48 hours';
  for v_row in
    select mc.id, mc.user_id, a.title, m.title as mission_title from public.mission_completions mc
    join settled_now s on s.id = mc.activity_id
    join public.activities a on a.id = mc.activity_id
    join public.activity_missions m on m.id = mc.mission_id
    where mc.status = 'pending_review'
  loop
    update public.mission_completions set status = 'rejected', reviewed_at = now(), review_note = 'Aktivitas ditutup sebelum ditinjau' where id = v_row.id;
    perform public.notify(v_row.user_id, 'mission_rejected', jsonb_build_object('title', v_row.title, 'mission_title', v_row.mission_title, 'note', 'Aktivitas ditutup sebelum bukti ditinjau'));
  end loop;
  update public.activities a set status = 'settled' from settled_now s where a.id = s.id;
  update public.participations p set status = 'not_completed'
  from settled_now s
  where p.activity_id = s.id and p.status in ('registered', 'in_progress');
  get diagnostics v_count = row_count;
  -- Event Global: tetapkan pemenang dari peringkat final (ALUR bagian 22d).
  for v_row in select s.id from settled_now s join public.activities a on a.id = s.id where a.reach = 'global' loop
    perform public.finalize_activity_winners(v_row.id);
  end loop;
  return v_count;
end;
$$;

create or replace function public.change_home_village(p_village_id uuid) -- null = Luar Cimahi
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_profile public.profiles;
begin
  select * into v_profile from public.profiles where id = v_uid for update;

  if p_village_id is not distinct from v_profile.home_village_id then
    raise exception 'same_village';
  end if;

  if v_profile.home_village_changed_at is not null
     and v_profile.home_village_changed_at > now() - make_interval(days => public.setting_int('profile.village_change_days')) then
    raise exception 'village_change_too_soon';
  end if;

  -- Kelurahan harus aktif dan kotanya juga sudah dibuka (sama seperti onboarding).
  if p_village_id is not null and not exists (
    select 1
    from public.regions v
    join public.regions d on d.id = v.parent_id
    join public.regions c on c.id = d.parent_id
    where v.id = p_village_id
      and v.level = 'village'
      and v.is_active and d.is_active and c.is_active
  ) then
    raise exception 'invalid_village';
  end if;

  update public.profiles
  set home_village_id = p_village_id,
      -- Warga Cimahi tidak memakai kota asal; warga yang pindah ke Luar Cimahi mengisinya lagi.
      home_city_code = case when p_village_id is null then home_city_code end,
      home_village_changed_at = now()
  where id = v_uid;
end;
$$;

create or replace function public.delete_my_account(p_confirm text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.active_uid();
  v_row record;
begin
  if upper(btrim(coalesce(p_confirm, ''))) <> 'HAPUS' then
    raise exception 'confirmation_required';
  end if;
  if (select is_admin from public.profiles where id = v_uid) then
    raise exception 'admin_account';
  end if;

  -- Satu-satunya pemilik/ketua harus menyerahkan peran dulu.
  if exists (
    select 1
    from public.organizer_members om
    where om.user_id = v_uid
      and om.role in ('owner', 'chair')
      and not exists (
        select 1 from public.organizer_members o2
        where o2.organizer_id = om.organizer_id
          and o2.user_id <> v_uid
          and o2.role in ('owner', 'chair')
      )
  ) then
    raise exception 'transfer_leadership_first';
  end if;

  -- Pembayaran lunas/menunggu di aktivitas yang belum selesai harus diurus dulu.
  if exists (
    select 1
    from public.participations p
    join public.activities a on a.id = p.activity_id
    where p.user_id = v_uid
      and p.payment_status in ('paid', 'awaiting_confirmation')
      and p.status in ('invited', 'registered', 'in_progress')
      and a.status not in ('ended', 'settled', 'cancelled')
  ) then
    raise exception 'active_paid_participation';
  end if;

  -- Batalkan pendaftaran yang belum berjalan.
  for v_row in
    select p.id from public.participations p
    where p.user_id = v_uid and p.status in ('invited', 'registered')
  loop
    perform public.cancel_participation(v_row.id);
  end loop;

  -- Keluar dari grup (peran ketua grup dipindah otomatis).
  for v_row in
    select gm.group_id from public.group_members gm
    where gm.user_id = v_uid and gm.status = 'active'
  loop
    perform public.leave_group(v_row.group_id);
  end loop;

  -- Keluar dari tim penyelenggara dan keanggotaan komunitas.
  delete from public.organizer_members where user_id = v_uid;
  update public.community_memberships
  set status = 'left', ended_at = now()
  where user_id = v_uid and status in ('active', 'pending');

  delete from public.notifications where user_id = v_uid;

  -- Kosongkan data pribadi. Nickname diganti penanda acak supaya tetap unik.
  update public.profiles
  set nickname = 'hapus-' || right(replace(v_uid::text, '-', ''), 14),
      full_name = null,
      avatar_url = null,
      home_village_id = null,
      home_city_code = null,
      deleted_at = now()
  where id = v_uid;
end;
$$;

-- -----------------------------------------------------------------------------
-- Hak eksekusi
-- -----------------------------------------------------------------------------

revoke execute on function
  public.award_activity_score(uuid, uuid, integer, public.score_reason, uuid, uuid, timestamptz, text),
  public.activity_score(uuid, uuid),
  public.check_global_event_ready(uuid),
  public.finalize_activity_winners(uuid),
  public.process_prizes(),
  public.notify_admins(text, jsonb)
from public, anon, authenticated;

revoke execute on function
  public.set_home_city(text),
  public.can_create_global_event(uuid),
  public.set_activity_reach(uuid, public.activity_reach, public.activity_location_mode),
  public.upsert_activity_prize(uuid, jsonb),
  public.remove_activity_prize(uuid),
  public.create_prize_badge(text, text),
  public.claim_prize(uuid, jsonb),
  public.get_winner_shipping(uuid),
  public.mark_prize_delivered(uuid, text),
  public.forfeit_prize(uuid, text),
  public.get_activity_leaderboard(uuid, integer)
from public, anon;

grant execute on function
  public.set_home_city(text),
  public.can_create_global_event(uuid),
  public.set_activity_reach(uuid, public.activity_reach, public.activity_location_mode),
  public.upsert_activity_prize(uuid, jsonb),
  public.remove_activity_prize(uuid),
  public.create_prize_badge(text, text),
  public.claim_prize(uuid, jsonb),
  public.get_winner_shipping(uuid),
  public.mark_prize_delivered(uuid, text),
  public.forfeit_prize(uuid, text),
  public.get_activity_leaderboard(uuid, integer)
to authenticated;
