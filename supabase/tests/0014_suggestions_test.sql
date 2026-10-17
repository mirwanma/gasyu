-- Uji fitur saran warga (0014). Semua perubahan dibatalkan di akhir (rollback).
-- Jalankan setelah 0001–0014.
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

-- Akun: O pemilik merchant, T staf merchant, K ketua komunitas, A admin, W1 W2 warga
insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-00000000000a', 'o@uji.test'),
  ('00000000-0000-0000-0000-00000000000c', 't@uji.test'),
  ('00000000-0000-0000-0000-00000000000b', 'k@uji.test'),
  ('00000000-0000-0000-0000-00000000000e', 'a@uji.test'),
  ('00000000-0000-0000-0000-0000000000d1', 'w1@uji.test'),
  ('00000000-0000-0000-0000-0000000000d2', 'w2@uji.test');
update public.profiles set nickname = 'uji' || right(id::text, 2), full_name = 'Nama Lengkap Rahasia', terms_accepted_at = now(), onboarded_at = now(),
  home_village_id = (select id from public.regions where name = 'Baros');
update public.profiles set is_admin = true where id = '00000000-0000-0000-0000-00000000000e';

create temp table ids (k text primary key, v uuid);
grant all on table ids to anon, authenticated;
set local role authenticated;

-- Merchant (approved) dengan staf, komunitas (masih pending)
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
insert into ids select 'm', public.register_organizer('merchant', json_build_object('name', 'Kopi Lereng', 'whatsapp', '08120000000',
  'merchant_category', 'kopi', 'outlets', json_build_array(json_build_object('name', 'Cabang Baros', 'address', 'Jl. Baros 10',
  'village_id', (select id from public.regions where name = 'Baros'), 'lat', -6.89, 'lng', 107.54)))::jsonb);
create temp table tok (k text primary key, v text);
grant all on table tok to authenticated;
insert into tok select 'inv', public.create_organizer_invite((select v from ids where k = 'm'), 'staff');
select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select public.accept_organizer_invite((select v from tok where k = 'inv'));
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
insert into ids select 'c', public.register_organizer('community', json_build_object('name', 'Cimahi Runners', 'whatsapp', '08120000001',
  'interest_category', 'olahraga', 'join_policy', 'open')::jsonb);
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select public.review_organizer((select v from ids where k = 'm'), true, null);

-- ---------------------------------------------------------------------------
-- 1. Kirim saran: validasi tujuan, isi, tim sendiri, batas harian
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.submit_suggestion((select v from ids where k = 'c'), 'activity', 'Bikin lari pagi tiap Minggu dong')$$,
  'invalid_organizer', 'komunitas yang belum terverifikasi tidak bisa menerima saran');
select pg_temp.assert_fails($$select public.submit_suggestion(public.platform_organizer_id(), 'other', 'Saran untuk organizer platform')$$,
  'invalid_organizer', 'organizer platform tidak menerima saran');
select pg_temp.assert_fails($$select public.submit_suggestion((select v from ids where k = 'm'), 'product', 'Enak')$$,
  'invalid_suggestion', 'saran terlalu pendek ditolak');
insert into ids select 's1', public.submit_suggestion((select v from ids where k = 'm'), 'product', '  Tolong tambah menu kopi tanpa gula ya  ');
insert into ids select 's2', public.submit_suggestion((select v from ids where k = 'm'), 'service', 'Wifi di cabang Baros sering putus sore hari.', true);
select pg_temp.assert((select body = 'Tolong tambah menu kopi tanpa gula ya' and status = 'new' from public.suggestions where id = (select v from ids where k = 's1')),
  'saran tersimpan, spasi dirapikan, status baru');
select public.submit_suggestion((select v from ids where k = 'm'), 'place', 'Tambah colokan di meja dekat jendela.');
select pg_temp.assert_fails($$select public.submit_suggestion((select v from ids where k = 'm'), 'other', 'Saran keempat di hari yang sama')$$,
  'suggestion_limit', 'batas 3 saran per penyelenggara per hari');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails($$select public.submit_suggestion((select v from ids where k = 'm'), 'other', 'Saran dari staf sendiri')$$,
  'own_organizer', 'tim tidak bisa memberi saran ke penyelenggaranya sendiri');

-- Tulis langsung ke tabel ditolak (tidak ada policy insert/update)
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert_fails($$insert into public.suggestions (organizer_id, user_id, body) values ((select v from ids where k = 'm'), auth.uid(), 'Insert langsung ke tabel')$$,
  'row-level security', 'insert langsung ke tabel ditolak');
update public.suggestions set status = 'done' where id = (select v from ids where k = 's1');
reset role;
select pg_temp.assert((select status = 'new' from public.suggestions where id = (select v from ids where k = 's1')), 'update langsung tidak berpengaruh');
set local role authenticated;

-- Notifikasi ke tim (pemilik dan staf)
reset role;
select pg_temp.assert((select count(*) = 2 from public.notifications where kind = 'suggestion_received' and payload ->> 'suggestion_id' = (select v from ids where k = 's1')::text),
  'pemilik dan staf mendapat notifikasi saran baru');
set local role authenticated;

-- ---------------------------------------------------------------------------
-- 2. Privasi: siapa membaca apa
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-0000000000d2');
select pg_temp.assert((select count(*) = 0 from public.suggestions), 'warga lain tidak membaca saran orang lain');
select pg_temp.assert((select count(*) = 0 from public.v_organizer_suggestions), 'warga bukan tim tidak membaca view tim');

select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select count(*) = 3 from public.suggestions), 'pengirim membaca saran miliknya');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert((select count(*) = 0 from public.suggestions), 'staf tidak membaca tabel mentah');
select pg_temp.assert((select count(*) = 3 from public.v_organizer_suggestions where organizer_id = (select v from ids where k = 'm')), 'staf membaca saran lewat view');
select pg_temp.assert((select nickname = 'ujid1' and user_id is not null from public.v_organizer_suggestions where id = (select v from ids where k = 's1')), 'tim melihat nickname pengirim');
select pg_temp.assert((select nickname is null and user_id is null and village_name is null from public.v_organizer_suggestions where id = (select v from ids where k = 's2')), 'saran anonim tanpa identitas');

select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert((select count(*) = 0 from public.v_organizer_suggestions where organizer_id = (select v from ids where k = 'm')), 'tim penyelenggara lain tidak membaca');

-- ---------------------------------------------------------------------------
-- 3. Menanggapi
-- ---------------------------------------------------------------------------
select pg_temp.login('00000000-0000-0000-0000-00000000000b');
select pg_temp.assert_fails($$select public.respond_suggestion((select v from ids where k = 's1'), 'done', 'Bukan urusan saya')$$,
  'not_allowed', 'tim lain tidak bisa menanggapi');
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert_fails($$select public.respond_suggestion((select v from ids where k = 's1'), 'done', null)$$,
  'not_allowed', 'pengirim tidak bisa mengubah status sendiri');

select pg_temp.login('00000000-0000-0000-0000-00000000000c');
select pg_temp.assert_fails($$select public.respond_suggestion((select v from ids where k = 's1'), 'new', null)$$,
  'invalid_status', 'tidak bisa kembali ke status baru');
select public.respond_suggestion((select v from ids where k = 's1'), 'in_progress', 'Siap, kami uji resepnya minggu ini.');
select pg_temp.assert((select status = 'in_progress' and reply = 'Siap, kami uji resepnya minggu ini.' and replied_at is not null
  from public.v_organizer_suggestions where id = (select v from ids where k = 's1')), 'balasan tersimpan');
select pg_temp.assert((select replied_by_nickname = 'uji0c' from public.v_organizer_suggestions where id = (select v from ids where k = 's1')), 'nama penanggap tercatat');
select public.respond_suggestion((select v from ids where k = 's2'), 'archived', null);

reset role;
select pg_temp.assert((select count(*) = 1 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'suggestion_answered'
  and payload ->> 'suggestion_id' = (select v from ids where k = 's1')::text and (payload ->> 'has_reply')::boolean), 'pengirim diberi tahu ada balasan');
select pg_temp.assert((select count(*) = 0 from public.notifications where kind = 'suggestion_answered'
  and payload ->> 'suggestion_id' = (select v from ids where k = 's2')::text), 'arsip tanpa balasan tidak mengirim notifikasi');
set local role authenticated;

-- Tanggapan yang sama tidak mengirim notifikasi ulang
select pg_temp.login('00000000-0000-0000-0000-00000000000a');
select public.respond_suggestion((select v from ids where k = 's1'), 'in_progress', 'Siap, kami uji resepnya minggu ini.');
select public.respond_suggestion((select v from ids where k = 's1'), 'done', null);
reset role;
select pg_temp.assert((select count(*) = 2 from public.notifications where user_id = '00000000-0000-0000-0000-0000000000d1' and kind = 'suggestion_answered'
  and payload ->> 'suggestion_id' = (select v from ids where k = 's1')::text), 'tanpa perubahan tidak ada notifikasi; selesai mengirim satu lagi');
select pg_temp.assert((select status = 'done' and reply is not null from public.suggestions where id = (select v from ids where k = 's1')), 'reply null tidak menghapus balasan');
set local role authenticated;

-- Pengirim membaca status dan balasan di tabel miliknya
select pg_temp.login('00000000-0000-0000-0000-0000000000d1');
select pg_temp.assert((select status = 'done' and reply = 'Siap, kami uji resepnya minggu ini.' from public.suggestions where id = (select v from ids where k = 's1')),
  'pengirim melihat status dan balasan');

-- Admin membaca semua, termasuk pengirim saran anonim (untuk menindak penyalahgunaan)
select pg_temp.login('00000000-0000-0000-0000-00000000000e');
select pg_temp.assert((select user_id = '00000000-0000-0000-0000-0000000000d1' from public.suggestions where id = (select v from ids where k = 's2')), 'admin bisa menelusuri saran anonim');

-- anon tidak bisa memanggil fungsi
reset role;
set local role anon;
select pg_temp.assert_fails($$select public.submit_suggestion((select v from ids where k = 'm'), 'other', 'Saran dari anon tanpa login')$$,
  'permission denied', 'anon tidak bisa mengirim saran');

rollback;
\o
\echo UJI 0014 LULUS
