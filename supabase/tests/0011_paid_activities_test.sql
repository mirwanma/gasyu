-- Uji Irisan 11 (Aktivitas berbayar). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0011.
\o /dev/null
begin;
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

-- Akun: O pemilik merchant (host), T staf merchant, A admin, W1 W2 W3 warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 't@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test'),
  ('00000000-0000-0000-0000-0000000000d3', 'w3@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Uji', terms_accepted_at = now(), onboarded_at = now(),
  home_district_id = (select id from public.regions where name = 'Cimahi Tengah');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
create temp table tok (k text primary key, v text);
create temp table res (k text primary key, v jsonb);
grant all on table ids, tok, res to anon, authenticated;
set local role authenticated;

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'district_id', (select id from public.regions where name = 'Cimahi Tengah'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
insert into ids select 'outlet', id from public.merchant_outlets where organizer_id = (select v from ids where k = 'm');
insert into tok select 'inv', public.create_organizer_invite((select v from ids where k = 'm'), 'staff');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_organizer_invite((select v from tok where k = 'inv'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);

-- ---------------------------------------------------------------------------
-- 1. Harga: validasi, hanya owner, terkunci setelah terbit
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails($$select public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Night Run Staf', 'starts_at', '2030-01-01T19:00+07', 'ends_at', '2030-01-01T21:00+07',
  'is_paid', true, 'price_idr', '75000', 'payment_instructions', 'Transfer BCA 123')::jsonb)$$,
  'pricing_leader_only', 'staf tidak bisa membuat aktivitas berbayar');
insert into ids select 'free', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Ngopi Gratis', 'starts_at', '2030-01-01T10:00+07', 'ends_at', '2030-01-01T14:00+07', 'is_paid', false)::jsonb);
select pg_temp.assert((select not is_paid and price_idr is null from public.activities where id = (select v from ids where k = 'free')), 'staf bisa membuat aktivitas gratis');

select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Night Run Murah', 'starts_at', '2030-01-01T19:00+07', 'ends_at', '2030-01-01T21:00+07',
  'is_paid', true, 'price_idr', '500', 'payment_instructions', 'Transfer BCA 123')::jsonb)$$,
  'invalid_payment', 'harga di bawah minimum ditolak');
select pg_temp.assert_fails($$select public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Night Run Tanpa Instruksi', 'starts_at', '2030-01-01T19:00+07', 'ends_at', '2030-01-01T21:00+07',
  'is_paid', true, 'price_idr', '75000')::jsonb)$$,
  'invalid_payment', 'berbayar tanpa instruksi ditolak');
insert into ids select 'ev', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Cimahi Night Run 5K', 'starts_at', '2030-01-01T19:00+07', 'ends_at', '2030-01-01T21:00+07',
  'is_paid', true, 'price_idr', 'Rp 75.000', 'payment_instructions', 'Transfer BCA 1234567 a.n. Kopi Lereng', 'payment_window_hours', '12')::jsonb);
select pg_temp.assert((select is_paid and price_idr = 75000 and payment_window_hours = 12 from public.activities where id = (select v from ids where k = 'ev')), 'harga tersimpan (angka dibersihkan dari format)');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails($$select public.update_activity((select v from ids where k = 'ev'), json_build_object('is_paid', true, 'price_idr', '80000', 'payment_instructions', 'Transfer BCA 1234567 a.n. Kopi Lereng')::jsonb)$$,
  'pricing_leader_only', 'staf tidak bisa mengubah harga');
select public.update_activity((select v from ids where k = 'ev'), json_build_object('description', 'Lari malam santai')::jsonb);
select pg_temp.assert((select price_idr = 75000 and description = 'Lari malam santai' from public.activities where id = (select v from ids where k = 'ev')), 'staf mengubah deskripsi tanpa menyentuh harga');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.update_activity((select v from ids where k = 'ev'), json_build_object('is_paid', true, 'price_idr', '50000', 'payment_instructions', 'QRIS di kasir atau transfer BCA 1234567')::jsonb);
select pg_temp.assert((select price_idr = 50000 from public.activities where id = (select v from ids where k = 'ev')), 'owner mengubah harga draft');
insert into ids select 'cp', public.add_checkpoint((select v from ids where k = 'ev'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.submit_activity((select v from ids where k = 'ev'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev'), true, null);
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.update_activity((select v from ids where k = 'ev'), json_build_object('is_paid', true, 'price_idr', '60000', 'payment_instructions', 'x')::jsonb)$$,
  'price_locked_after_publish', 'harga terkunci setelah terbit');
select public.update_activity((select v from ids where k = 'ev'), json_build_object('payment_instructions', 'QRIS di kasir, transfer BCA 1234567, atau tunai di lokasi')::jsonb);
select pg_temp.assert((select price_idr = 50000 and payment_instructions like 'QRIS di kasir, transfer%' from public.activities where id = (select v from ids where k = 'ev')), 'instruksi bayar masih bisa diperbarui setelah terbit');

-- ---------------------------------------------------------------------------
-- 2. Warga join → unpaid; check-in ditolak; bukti bayar; konfirmasi
-- ---------------------------------------------------------------------------
reset role;
update public.activities set starts_at = now() - interval '1 hour', ends_at = now() + interval '3 hours' where id = (select v from ids where k = 'ev');
insert into tok select 'cp', public.qr_token(qr_secret, id, public.qr_slot()) from public.activity_checkpoints where id = (select v from ids where k = 'cp');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.join_activity((select v from ids where k = 'ev'));
insert into ids select 'p1', id from public.participations where activity_id = (select v from ids where k = 'ev') and user_id = '00000000-0000-0000-0000-0000000000d1';
select pg_temp.assert((select payment_status = 'unpaid' and payment_due_at is not null and payment_due_at <= now() + interval '12 hours' from public.participations where id = (select v from ids where k = 'p1')), 'join berbayar: unpaid + batas bayar sesuai jendela');
select pg_temp.assert_fails($$select public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.89, 107.54)$$, 'payment_required', 'check-in ditolak sebelum lunas');
select pg_temp.assert_fails($$select public.submit_payment_proof((select v from ids where k = 'p1'), 'salah/path.jpg')$$, 'proof_required', 'path bukti harus activity/user');
select pg_temp.assert_fails($$select public.confirm_payment((select v from ids where k = 'p1'), true, null)$$, 'not_allowed', 'warga tidak bisa mengonfirmasi sendiri');
select public.submit_payment_proof((select v from ids where k = 'p1'), (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d1/bukti.jpg');
select pg_temp.assert((select payment_status = 'awaiting_confirmation' and payment_proof_path like '%/bukti.jpg' from public.participations where id = (select v from ids where k = 'p1')), 'bukti terkirim: awaiting_confirmation');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_proof_submitted' and user_id in ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000c')) = 2, 'tim host (owner + staf) diberi tahu bukti masuk');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$select public.confirm_payment((select v from ids where k = 'p1'), true, null)$$, 'not_allowed', 'warga lain tidak bisa mengonfirmasi');
select pg_temp.assert((select count(*) from public.v_activity_participants) = 0, 'warga tidak melihat peserta lain');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails($$select public.confirm_payment((select v from ids where k = 'p1'), false, null)$$, 'note_required', 'menolak bukti wajib beralasan');
select public.confirm_payment((select v from ids where k = 'p1'), false, 'Nominal tidak sesuai');
select pg_temp.assert((select payment_status = 'unpaid' and payment_note = 'Nominal tidak sesuai' and payment_due_at > now() + interval '1 hour' from public.participations where id = (select v from ids where k = 'p1')), 'bukti ditolak: kembali unpaid dengan catatan dan batas baru');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_rejected' and user_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'warga diberi tahu bukti ditolak');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.submit_payment_proof((select v from ids where k = 'p1'), (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d1/bukti2.jpg');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.confirm_payment((select v from ids where k = 'p1'), true, null);
select pg_temp.assert((select payment_status = 'paid' and payment_confirmed_by = '00000000-0000-0000-0000-00000000000c' and payment_confirmed_at is not null from public.participations where id = (select v from ids where k = 'p1')), 'staf mengonfirmasi lunas');
select pg_temp.assert_fails($$select public.confirm_payment((select v from ids where k = 'p1'), true, null)$$, 'payment_already_paid', 'tidak bisa dikonfirmasi dua kali');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_confirmed' and user_id = '00000000-0000-0000-0000-0000000000d1') = 1, 'warga diberi tahu lunas');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into res select 'ci', public.perform_checkin((select v from ids where k = 'cp'), (select v from tok where k = 'cp'), -6.89, 107.54);
select pg_temp.assert(((select v from res where k = 'ci') ->> 'xp_base')::int = 100, 'check-in jalan setelah lunas, membayar tidak memberi XP tambahan');
select pg_temp.assert_fails($$select public.submit_payment_proof((select v from ids where k = 'p1'), (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d1/bukti3.jpg')$$, 'invalid_participation', 'yang sudah selesai tidak kirim bukti lagi');

-- ---------------------------------------------------------------------------
-- 3. Kedaluwarsa, bayar di lokasi, statistik
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev'));
insert into ids select 'p2', id from public.participations where activity_id = (select v from ids where k = 'ev') and user_id = '00000000-0000-0000-0000-0000000000d2';
select pg_temp.login('00000000-0000-0000-0000-0000000000d3');
select public.join_activity((select v from ids where k = 'ev'));
insert into ids select 'p3', id from public.participations where activity_id = (select v from ids where k = 'ev') and user_id = '00000000-0000-0000-0000-0000000000d3';
select public.submit_payment_proof((select v from ids where k = 'p3'), (select v from ids where k = 'ev') || '/00000000-0000-0000-0000-0000000000d3/bukti.jpg');
reset role;
select pg_temp.assert(public.expire_unpaid_participations() = 0, 'belum ada yang lewat batas');
update public.participations set payment_due_at = now() - interval '1 minute' where id in ((select v from ids where k = 'p2'), (select v from ids where k = 'p3'));
select pg_temp.assert(public.expire_unpaid_participations() = 1, 'hanya unpaid yang kedaluwarsa, awaiting_confirmation tetap ditinjau');
select pg_temp.assert((select status = 'cancelled' and payment_status = 'unpaid' from public.participations where id = (select v from ids where k = 'p2')), 'W2 dibatalkan karena lewat batas bayar');
select pg_temp.assert((select status = 'registered' and payment_status = 'awaiting_confirmation' from public.participations where id = (select v from ids where k = 'p3')), 'W3 masih menunggu konfirmasi');
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_expired' and user_id = '00000000-0000-0000-0000-0000000000d2') = 1, 'W2 diberi tahu kedaluwarsa');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_activity((select v from ids where k = 'ev'));
select pg_temp.assert((select status = 'registered' and payment_status = 'unpaid' and payment_note is null from public.participations where id = (select v from ids where k = 'p2')), 'W2 daftar ulang: unpaid lagi, catatan dibersihkan');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.confirm_payment((select v from ids where k = 'p2'), true, 'Bayar tunai di lokasi');
select public.confirm_payment((select v from ids where k = 'p3'), true, null);
select pg_temp.assert((select payment_status = 'paid' and payment_note = 'Bayar tunai di lokasi' from public.participations where id = (select v from ids where k = 'p2')), 'tandai lunas langsung dari unpaid (bayar di lokasi)');
select pg_temp.assert((select unpaid = 0 and awaiting_confirmation = 0 and paid = 3 and refunded = 0 and refund_due = 0 and expected_idr = 150000
  from public.v_activity_payment_stats where activity_id = (select v from ids where k = 'ev')), 'statistik bayar: 3 lunas, perkiraan Rp150.000');
select pg_temp.assert((select count(*) from public.v_activity_payment_stats where activity_id = (select v from ids where k = 'free')) = 0, 'aktivitas gratis tidak masuk statistik bayar');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) from public.v_activity_payment_stats) = 0, 'warga tidak melihat statistik bayar');

-- ---------------------------------------------------------------------------
-- 4. Refund: peserta batal, aktivitas dibatalkan, antrean admin
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert_fails($$select public.mark_refunded((select v from ids where k = 'p2'), null)$$, 'not_refundable', 'peserta aktif yang lunas tidak bisa di-refund');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.cancel_participation((select v from ids where k = 'p2'));
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_refund_due' and user_id = '00000000-0000-0000-0000-00000000000a') = 1, 'tim diberi tahu refund saat peserta lunas membatalkan');
select pg_temp.assert((select refund_due from public.v_activity_payment_stats where activity_id = (select v from ids where k = 'ev')) is null, 'view host tidak terbaca tanpa sesi');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select refunds_pending from public.v_admin_overview) = 1, 'ringkasan admin: 1 refund belum ditandai');
select pg_temp.assert((select refund_due from public.v_admin_refund_queue where activity_id = (select v from ids where k = 'ev')) = 1, 'antrean refund admin memuat aktivitas ini');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.mark_refunded((select v from ids where k = 'p2'), 'Dikembalikan tunai');
select pg_temp.assert((select payment_status = 'refunded' and refunded_at is not null from public.participations where id = (select v from ids where k = 'p2')), 'refund ditandai');
select pg_temp.assert_fails($$select public.mark_refunded((select v from ids where k = 'p2'), null)$$, 'not_refundable', 'refund tidak bisa ditandai dua kali');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_refunded' and user_id = '00000000-0000-0000-0000-0000000000d2') = 1, 'warga diberi tahu refund');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select count(*) from public.v_admin_refund_queue) = 0, 'antrean refund kosong setelah ditandai');
select public.cancel_activity((select v from ids where k = 'ev'), 'Hujan badai');
reset role;
select pg_temp.assert((select count(*) from public.notifications where kind = 'payment_refund_due' and user_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d3')) = 2, 'peserta lunas diberi tahu refund saat aktivitas dibatalkan');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select refunds_pending from public.v_admin_overview) = 2, 'ringkasan admin: 2 refund setelah aktivitas dibatalkan');
select pg_temp.assert((select refund_due = 2 and refunded = 1 and host_whatsapp = '08120000000' from public.v_admin_refund_queue where activity_id = (select v from ids where k = 'ev')), 'antrean refund: 2 belum, 1 sudah, kontak host');
select pg_temp.assert((select refund_due from public.v_activity_payment_stats where activity_id = (select v from ids where k = 'ev')) = 2, 'statistik bayar admin: refund_due 2');
select pg_temp.assert_fails($$select public.mark_refunded((select v from ids where k = 'p1'), null)$$, 'not_allowed', 'admin hanya melihat, tim host yang menandai refund');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.mark_refunded((select v from ids where k = 'p1'), null);
select public.mark_refunded((select v from ids where k = 'p3'), null);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select refunds_pending from public.v_admin_overview) = 0, 'semua refund ditandai oleh tim host');

-- ---------------------------------------------------------------------------
-- 5. Grup: anggota yang mengonfirmasi mendapat batas bayar baru
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'ev2', public.create_activity((select v from ids where k = 'm'), json_build_object(
  'title', 'Fun Walk Berbayar', 'starts_at', '2030-02-01T07:00+07', 'ends_at', '2030-02-01T10:00+07', 'join_mode', 'both',
  'is_paid', true, 'price_idr', '20000', 'payment_instructions', 'Transfer BCA 1234567')::jsonb);
insert into ids select 'cp2', public.add_checkpoint((select v from ids where k = 'ev2'), json_build_object('outlet_id', (select v from ids where k = 'outlet'))::jsonb);
select public.submit_activity((select v from ids where k = 'ev2'));
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_activity((select v from ids where k = 'ev2'), true, null);
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
insert into ids select 'g', public.create_group('Tim Baros');
insert into tok select 'g', invite_code from public.groups where id = (select v from ids where k = 'g');
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.join_group((select v from tok where k = 'g'));
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select public.register_group((select v from ids where k = 'ev2'), (select v from ids where k = 'g'), array['00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2']::uuid[]);
reset role;
insert into ids select 'gp2', id from public.participations where activity_id = (select v from ids where k = 'ev2') and user_id = '00000000-0000-0000-0000-0000000000d2';
update public.participations set payment_due_at = now() - interval '1 hour' where id = (select v from ids where k = 'gp2');
select pg_temp.assert(public.expire_unpaid_participations() = 0, 'undangan grup yang belum dikonfirmasi tidak dibatalkan cron bayar');
set local role authenticated;
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select public.confirm_group_registration((select v from ids where k = 'gp2'), true);
select pg_temp.assert((select status = 'registered' and payment_status = 'unpaid' and payment_due_at > now() + interval '12 hours' from public.participations where id = (select v from ids where k = 'gp2')), 'anggota grup mengonfirmasi: batas bayar dihitung ulang');
select pg_temp.assert((select unpaid = 2 from public.v_activity_payment_stats where activity_id = (select v from ids where k = 'ev2')) is not true, 'warga tidak membaca statistik');
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select pg_temp.assert((select unpaid = 2 and paid = 0 from public.v_activity_payment_stats where activity_id = (select v from ids where k = 'ev2')), 'statistik grup: 2 belum bayar');

rollback;
\o
\echo UJI 0011 LULUS
