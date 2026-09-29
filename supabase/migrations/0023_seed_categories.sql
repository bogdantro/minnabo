-- 0023_seed_categories.sql — the category catalogue the app depends on.
-- Mirrors src/domain/categories.ts. Idempotent; edit both together.

insert into categories (slug, label, icon) values
  ('hage','Hage','feather'),
  ('renhold','Rengjøring','droplet'),
  ('flytting','Flytting/bæring','package'),
  ('transport','Transport/levering','truck'),
  ('montering','Montering','tool'),
  ('snomaking','Snømåking','cloud-snow'),
  ('maling','Maling/vedlikehold','edit-3'),
  ('dyrepass','Dyrepass','heart'),
  ('datahjelp','Datahjelp','monitor'),
  ('arrangement','Arrangementshjelp','calendar'),
  ('annet','Annet','more-horizontal')
on conflict (slug) do update set label = excluded.label, icon = excluded.icon;
