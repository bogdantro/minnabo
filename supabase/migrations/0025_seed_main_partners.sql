-- 0025_seed_main_partners.sql — the two hovedpartnere shown on Fellesskap.
-- A partner is "main" when it has an active placement on surface 'fellesskap'
-- (see toPartner in src/api/mappers.ts). Idempotent: fixed ids + upsert.

insert into partners (id, name, blurb, logo_path, url) values
  ('6b1f3c2e-0000-4000-8000-000000000001', 'Webiser', 'Nettsider og digitale løsninger',
   'https://webiser.no/static/images/logo/webiser.png', 'https://webiser.no'),
  ('6b1f3c2e-0000-4000-8000-000000000002', 'Håndverker Innlandet', 'Håndverkere i hele Innlandet',
   'https://handverkerinnlandet.no/static/images/logo/logo-black.png', 'https://handverkerinnlandet.no')
on conflict (id) do update set
  name = excluded.name, blurb = excluded.blurb, logo_path = excluded.logo_path, url = excluded.url;

insert into partner_placements (id, partner_id, surface, headline, active) values
  ('6b1f3c2e-0000-4000-8000-000000000101', '6b1f3c2e-0000-4000-8000-000000000001', 'fellesskap', 'Hovedpartner', true),
  ('6b1f3c2e-0000-4000-8000-000000000102', '6b1f3c2e-0000-4000-8000-000000000002', 'fellesskap', 'Hovedpartner', true)
on conflict (id) do update set surface = excluded.surface, active = excluded.active;
