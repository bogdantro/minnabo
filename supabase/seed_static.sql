-- seed_static.sql — idempotent catalog + read-only content.
-- Run with: psql "$SUPABASE_DB_URL" -f supabase/seed_static.sql

-- categories (mirrors src/data/seed.ts `categories`)
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

-- partners (mirrors src/data/seedCommunity.ts `partners`)
insert into partners (id, name, blurb, url) values
  ('a1000000-0000-0000-0000-000000000001','Innlandet Sparebank','Støtter lokalt initiativ','https://example.no'),
  ('a1000000-0000-0000-0000-000000000002','Fjellbygg AS','Bygg og vedlikehold i hele Innlandet','https://example.no'),
  ('a1000000-0000-0000-0000-000000000003','Mjøsa Elektro','Autorisert elektriker','https://example.no'),
  ('a1000000-0000-0000-0000-000000000004','Gudbrandsdal Hage','Planteskole og hagehjelp','https://example.no'),
  ('a1000000-0000-0000-0000-000000000005','Toten Transport','Frakt og flytting','https://example.no'),
  ('a1000000-0000-0000-0000-000000000006','Hedmark Rør','Rørlegger med lang erfaring','https://example.no')
on conflict (id) do update set name = excluded.name, blurb = excluded.blurb;

insert into partner_placements (id, partner_id, surface, headline, active) values
  ('a2000000-0000-0000-0000-000000000001','a1000000-0000-0000-0000-000000000001','fellesskap','Innlandet Sparebank – hovedpartner', true),
  ('a2000000-0000-0000-0000-000000000002','a1000000-0000-0000-0000-000000000002','fellesskap','Fjellbygg AS – hovedpartner', true)
on conflict (id) do update set headline = excluded.headline, active = excluded.active;

-- documented donations (mirrors src/data/seedCommunity.ts `documentedDonations`)
insert into donation_records (id, recipient, amount_kr, period, transferred_at) values
  ('a3000000-0000-0000-0000-000000000001','Norges Røde Kors',18500,'2026 Q1', now()),
  ('a3000000-0000-0000-0000-000000000002','Norges Røde Kors',14200,'2025 Q4', now())
on conflict (id) do update set amount_kr = excluded.amount_kr, period = excluded.period;
