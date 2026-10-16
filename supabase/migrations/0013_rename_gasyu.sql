-- 0013: nama aplikasi berganti dari Ramein menjadi Gasyu.
-- Hanya mengubah teks data; struktur, fungsi, dan aturan tidak berubah.
-- Organizer platform dicari lewat type = 'platform' (platform_organizer_id), bukan slug,
-- jadi mengganti slug tidak memutus apa pun.

update public.organizers
set name = 'Gasyu',
    slug = 'gasyu',
    description = 'Event dan challenge kota yang diselenggarakan tim Gasyu.'
where type = 'platform'
  and slug = 'ramein';

update public.badges
set description = 'Check-in pertama kamu di Gasyu.'
where code = 'first_step'
  and description = 'Check-in pertama kamu di Ramein.';
