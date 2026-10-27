-- Uji Irisan 7 (Kolaborasi). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0007.
\o /dev/null
begin;
-- Trigger badge (irisan 9) tertunda sampai commit; di uji dipaksa langsung.
set constraints all immediate;

create function pg_temp.assert(p_ok boolean, p_msg text) returns void
language plpgsql as $$
begin
  if p_ok is not true then raise exception 'UJI GAGAL: %', p_msg; end if;
end;
$$;
create function pg_temp.assert_fails(p_sql text, p_expected text, p_msg text) returns void
language plpgsql as $$
begin
  begin
    execute p_sql;
  exception when others then
    if position(p_expected in sqlerrm) = 0 then
      raise exception 'UJI GAGAL: % (error tak terduga: %)', p_msg, sqlerrm;
    end if;
    return;
  end;
  raise exception 'UJI GAGAL: % (seharusnya ditolak)', p_msg;
end;
$$;
create function pg_temp.login(p_uid uuid) returns void
language plpgsql as $$
begin
  perform set_config('request.jwt.claims', json_build_object('sub', p_uid, 'role', 'authenticated')::text, true);
end;
$$;
grant execute on all functions in schema pg_temp to anon, authenticated;

-- Akun: O pemilik merchant M, P pemilik merchant M2, K ketua komunitas, A admin, W warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000f', 'p@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-00000000000d', 'w@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 1), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
grant all on table ids to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
insert into ids select 'm2', public.register_organizer('merchant', json_build_object('name', 'Seblak Teh Ai', 'whatsapp', '08120000002',
  'merchant_category', 'kuliner', 'outlets', json_build_array(json_build_object('name', 'Warung Melong', 'address', 'Jl. Melong 2',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.88, 'lng', 107.55)))::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'k', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);
select public.review_organizer((select v from ids where k = 'm2'), true, null);
select public.review_organizer((select v from ids where k = 'k'), true, null);

-- ---------------------------------------------------------------------------
-- 1. Undangan partner
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'k'), json_build_object(
  'title', 'Lari Bareng Kopi', 'starts_at', '2030-01-01T06:00+07', 'ends_at', '2030-01-01T09:00+07')::jsonb);
select public.add_checkpoint((select v from ids where k = 'ev'), '{"name":"Alun-alun","lat":-6.87,"lng":107.54}');
select pg_temp.assert_fails($$select public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'm'), 'host', 0, null)$$, 'invalid_role', 'peran host tidak bisa diundang');
select pg_temp.assert_fails($$select public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'k'), 'sponsor', 0, null)$$, 'partner_is_host', 'host tidak bisa mengundang dirinya');
select pg_temp.assert_fails($$select public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'k'), 'sponsor', 100, null)$$, 'partner_is_host', 'host tetap ditolak');
insert into ids select 'inv_m', public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'm'), 'sponsor', 100, 'Butuh 60 kopi untuk relawan');
insert into ids select 'inv_m2', public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'm2'), 'cohost', 0, null);
select pg_temp.assert_fails($$select public.invite_partner((select v from ids where k = 'ev'), (select v from ids where k = 'm'), 'sponsor', 0, null)$$, 'partner_exists', 'tidak bisa mengundang dua kali');
select pg_temp.assert(public.submit_activity((select v from ids where k = 'ev')) = 'awaiting_partners', 'ada undangan tertunda: awaiting_partners');

-- Partner yang diundang melihat aktivitas draft dan undangannya
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.notifications where kind = 'partner_invite') = 1, 'pemilik merchant dapat notifikasi undangan');
select pg_temp.assert((select count(*) from public.v_activity_partners where id = (select v from ids where k = 'inv_m')) = 1, 'partner yang diundang melihat undangan beserta aktivitasnya');
select pg_temp.assert_fails($$select public.respond_partner_invite((select v from ids where k = 'inv_m2'), true, null)$$, 'not_allowed', 'tidak bisa menjawab undangan organizer lain');
select public.respond_partner_invite((select v from ids where k = 'inv_m'), true, 300);
select pg_temp.assert((select status from public.activity_partners where id = (select v from ids where k = 'inv_m')) = 'accepted', 'undangan diterima');
select pg_temp.assert((select points_budget from public.activity_partners where id = (select v from ids where k = 'inv_m')) = 300, 'budget diisi saat menerima');
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'ev')) = 'awaiting_partners', 'masih menunggu partner lain');
-- Partner accepted bisa menambah checkpoint miliknya
insert into ids select 'cp_m', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('partner_organizer_id', (select v from ids where k = 'm'), 'outlet_id', (select v from ids where k = 'outlet'))::jsonb);

select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select public.respond_partner_invite((select v from ids where k = 'inv_m2'), false, null);
select pg_temp.assert((select status from public.activity_partners where id = (select v from ids where k = 'inv_m2')) = 'declined', 'undangan ditolak');
select pg_temp.assert_fails($$select public.respond_partner_invite((select v from ids where k = 'inv_m2'), true, null)$$, 'invite_unavailable', 'undangan yang sudah dijawab tidak bisa dijawab lagi');
reset role;
select pg_temp.assert((select status from public.activities where id = (select v from ids where k = 'ev')) = 'in_review', 'semua partner menjawab: in_review');
select pg_temp.assert((select count(*) from public.notifications where kind in ('partner_accepted', 'partner_declined')) = 2, 'host diberi tahu jawaban partner');
set local role authenticated;

-- Host membatalkan undangan yang belum dijawab
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'ev2', public.create_activity((select v from ids where k = 'k'), json_build_object(
  'title', 'Jalan Santai', 'starts_at', '2030-02-01T06:00+07', 'ends_at', '2030-02-01T09:00+07')::jsonb);
insert into ids select 'inv_c', public.invite_partner((select v from ids where k = 'ev2'), (select v from ids where k = 'm2'), 'cohost', 0, null);
select public.cancel_partner_invite((select v from ids where k = 'inv_c'));
select pg_temp.assert((select status from public.activity_partners where id = (select v from ids where k = 'inv_c')) = 'removed', 'undangan dibatalkan host');
select pg_temp.assert(length(public.invite_partner((select v from ids where k = 'ev2'), (select v from ids where k = 'm2'), 'cohost', 0, null)::text) = 36, 'bisa diundang lagi setelah dibatalkan');

-- ---------------------------------------------------------------------------
-- 2. Open call
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert_fails($$select public.create_collab_post((select v from ids where k = 'k'), '{"kind":"sponsor","title":"x","needs":"y","benefits":"z"}')$$, 'not_allowed', 'warga tidak bisa membuat open call');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.create_collab_post((select v from ids where k = 'k'), '{"kind":"sponsor","title":"x","needs":"y","benefits":"z"}')$$, 'invalid_post', 'judul minimal 3 karakter');
insert into ids select 'post', public.create_collab_post((select v from ids where k = 'k'), json_build_object(
  'kind', 'sponsor', 'activity_id', (select v from ids where k = 'ev2'), 'title', 'Jalan Santai butuh sponsor',
  'needs', 'hadiah voucher dan budget poin', 'benefits', 'logo di halaman aktivitas, checkpoint di outlet',
  'region_id', (select id from public.regions where name = 'Cimahi Tengah'))::jsonb);
select pg_temp.assert_fails(
  $$select public.apply_open_call((select v from ids where k = 'post'), (select v from ids where k = 'k'), 'sponsor', 0, null, null)$$,
  'own_post', 'tidak bisa mengajukan ke open call sendiri');
select pg_temp.login('00000000-0000-0000-0000-00000000000d');
select pg_temp.assert((select count(*) from public.collab_posts) = 0, 'warga tidak melihat papan kolaborasi');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.collab_posts where status = 'open') = 1, 'tim merchant melihat open call');
insert into ids select 'app', public.apply_open_call((select v from ids where k = 'post'), (select v from ids where k = 'm'), 'sponsor', 200, 'Voucher kopi untuk 50 peserta', 'Kedai kami di Baros, bisa jadi checkpoint.');
select pg_temp.assert_fails(
  $$select public.apply_open_call((select v from ids where k = 'post'), (select v from ids where k = 'm'), 'sponsor', 0, null, null)$$,
  'already_applied', 'satu pengajuan per open call');
select pg_temp.login('00000000-0000-0000-0000-00000000000f');
select pg_temp.assert((select count(*) from public.collab_applications) = 0, 'merchant lain tidak melihat pengajuan orang lain');
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) from public.notifications where kind = 'application_received') = 1, 'pemilik post diberi tahu pengajuan');
select pg_temp.assert((select count(*) from public.collab_applications where post_id = (select v from ids where k = 'post')) = 1, 'pemilik post melihat pengajuan');
select public.decide_application((select v from ids where k = 'app'), true);
select pg_temp.assert((select status from public.activity_partners where activity_id = (select v from ids where k = 'ev2') and organizer_id = (select v from ids where k = 'm')) = 'accepted', 'diterima: jadi partner accepted');
select pg_temp.assert((select source from public.activity_partners where activity_id = (select v from ids where k = 'ev2') and organizer_id = (select v from ids where k = 'm')) = 'open_call', 'sumber open_call');
select pg_temp.assert((select points_budget from public.activity_partners where activity_id = (select v from ids where k = 'ev2') and organizer_id = (select v from ids where k = 'm')) = 200, 'budget dari pengajuan');
select pg_temp.assert_fails($$select public.decide_application((select v from ids where k = 'app'), false)$$, 'application_unavailable', 'pengajuan sudah diputuskan');
-- submit menutup open call
select public.add_checkpoint((select v from ids where k = 'ev2'), '{"name":"Taman Kota","lat":-6.87,"lng":107.54}');
select public.submit_activity((select v from ids where k = 'ev2'));
select pg_temp.assert((select status from public.collab_posts where id = (select v from ids where k = 'post')) = 'closed', 'open call ditutup saat diajukan');

-- ---------------------------------------------------------------------------
-- 3. Event Gasyu (host platform) oleh admin
-- ---------------------------------------------------------------------------
select pg_temp.assert(public.platform_organizer_id() is not null, 'organizer Gasyu ada');
select pg_temp.assert_fails(
  $$select public.create_activity(public.platform_organizer_id(), '{"title":"Festival","starts_at":"2030-03-01T10:00+07","ends_at":"2030-03-02T18:00+07"}')$$,
  'not_allowed', 'bukan admin tidak bisa membuat event Gasyu');
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
insert into ids select 'fest', public.create_activity(public.platform_organizer_id(), json_build_object(
  'title', 'Festival Cimahi Kreatif', 'audience', 'members_only', 'starts_at', '2030-03-01T10:00+07', 'ends_at', '2030-03-02T18:00+07', 'quota', 2000)::jsonb);
select pg_temp.assert((select audience from public.activities where id = (select v from ids where k = 'fest')) = 'public', 'event Gasyu selalu publik');
select pg_temp.assert_fails($$select public.admin_add_partner((select v from ids where k = 'ev'), (select v from ids where k = 'm2'), 'cohost', null)$$, 'platform_host_required', 'admin_add_partner hanya untuk host Gasyu');
insert into ids select 'fp_m', public.admin_add_partner((select v from ids where k = 'fest'), (select v from ids where k = 'm'), 'sponsor', 'Booth kopi di panggung utama');
insert into ids select 'fp_k', public.admin_add_partner((select v from ids where k = 'fest'), (select v from ids where k = 'k'), 'cohost', null);
select pg_temp.assert((select status from public.activity_partners where id = (select v from ids where k = 'fp_m')) = 'accepted', 'partner langsung accepted');
select pg_temp.assert((select source from public.activity_partners where id = (select v from ids where k = 'fp_m')) = 'admin', 'sumber admin');
select pg_temp.assert((select count(*) from public.admin_actions where action = 'add_partner') = 2, 'tindakan admin tercatat');
-- checkpoint atas nama Gasyu dan atas nama partner
insert into ids select 'fcp_r', public.add_checkpoint((select v from ids where k = 'fest'), '{"name":"Panggung utama","lat":-6.87,"lng":107.54}');
insert into ids select 'fcp_m', public.add_checkpoint((select v from ids where k = 'fest'), json_build_object('partner_organizer_id', (select v from ids where k = 'm'), 'outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select pg_temp.assert((select partner_organizer_id from public.activity_checkpoints where id = (select v from ids where k = 'fcp_r')) = public.platform_organizer_id(), 'checkpoint atas nama Gasyu');
select pg_temp.assert_fails(
  $$select public.set_partner_budget((select v from ids where k = 'fp_m'), 500)$$,
  'not_allowed', 'admin tidak bisa mengisi budget atas nama merchant');
select pg_temp.assert(public.submit_activity((select v from ids where k = 'fest')) = 'published', 'event Gasyu langsung terbit');
select pg_temp.assert(length((public.get_checkpoint_qr((select v from ids where k = 'fcp_r')) ->> 'token')) = 16, 'admin menampilkan QR checkpoint Gasyu');
select pg_temp.assert_fails($$select public.get_checkpoint_qr((select v from ids where k = 'fcp_m'))$$, 'not_allowed', 'admin tidak menampilkan QR checkpoint partner');

-- Partner mendapat notifikasi dan bisa mengisi budget sendiri, lalu keluar
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select count(*) from public.notifications where kind = 'partner_added_by_admin') = 1, 'partner diberi tahu ditambahkan admin');
select public.set_partner_budget((select v from ids where k = 'fp_m'), 500);
select pg_temp.assert((select count(*) from public.v_activity_cards where id = (select v from ids where k = 'fest') and host_type = 'platform') = 1, 'kartu event Gasyu terlihat dengan host platform');
select public.leave_activity((select v from ids where k = 'fp_m'));
select pg_temp.assert((select status from public.activity_partners where id = (select v from ids where k = 'fp_m')) = 'removed', 'partner keluar');
reset role;
select pg_temp.assert((select is_active from public.activity_checkpoints where id = (select v from ids where k = 'fcp_m')) = false, 'checkpoint partner dinonaktifkan');
select pg_temp.assert((select count(*) from public.notifications where kind = 'partner_left' and user_id = '00000000-0000-0000-0000-00000000000e') = 1, 'admin diberi tahu partner keluar');
update public.activities set status = 'running', starts_at = now() - interval '1 hour' where id = (select v from ids where k = 'fest');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.leave_activity((select v from ids where k = 'fp_k'))$$, 'activity_locked', 'tidak bisa keluar saat berjalan');

-- ---------------------------------------------------------------------------
-- 4. Reputasi dan cron
-- ---------------------------------------------------------------------------
select pg_temp.assert((select count(*) from public.v_organizer_reputation) = 3, 'reputasi untuk 3 penyelenggara (tanpa Gasyu)');
reset role;
update public.collab_posts set status = 'open', deadline = now() - interval '1 hour' where id = (select v from ids where k = 'post');
select pg_temp.assert(public.close_expired_collab_posts() = 1, 'cron menutup open call lewat tenggat');

rollback;
\o
select 'SEMUA UJI IRISAN 7 LOLOS' as hasil;
