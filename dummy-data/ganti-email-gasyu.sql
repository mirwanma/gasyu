-- Sekali jalan: ganti email dan kata sandi akun dummy lama ke nama Gasyu.
--   email      ...@dummy.ramein.id  ->  ...@dummy.gasyu.id
--   kata sandi RameinDummy2026!     ->  GasyuDummy2026!
-- Hanya menyentuh akun dummy (id berawalan dd000000-0000-4000-8000-).
-- Jalankan di Supabase -> SQL Editor. Aman dijalankan ulang (kedua kali tidak mengubah apa-apa).

with u as (
  update auth.users set
    email = replace(email, '@dummy.ramein.id', '@dummy.gasyu.id'),
    encrypted_password = extensions.crypt('GasyuDummy2026!', extensions.gen_salt('bf')),
    raw_user_meta_data = case when raw_user_meta_data ? 'email'
      then jsonb_set(raw_user_meta_data, '{email}', to_jsonb(replace(raw_user_meta_data->>'email', '@dummy.ramein.id', '@dummy.gasyu.id')))
      else raw_user_meta_data end,
    updated_at = now()
  where email like '%@dummy.ramein.id' and id::text like 'dd000000-0000-4000-8000-%'
  returning id
), i as (
  update auth.identities set
    identity_data = jsonb_set(identity_data, '{email}', to_jsonb(replace(identity_data->>'email', '@dummy.ramein.id', '@dummy.gasyu.id'))),
    updated_at = now()
  where user_id in (select id from u) and identity_data ? 'email'
  returning id
)
select (select count(*) from u) as akun_diganti, (select count(*) from i) as identitas_diganti;
