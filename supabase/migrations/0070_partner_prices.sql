-- 0070_partner_prices.sql
--  A hovedpartner's price list, shown as «Priser» on their page in the app
--  (PartnerScreen, with the note that MinNabo has nothing to do with payment).
--  Edited by the partner in the website's partner portal and approved by the admin,
--  like the rest of the profile – see docs/WEBSITE_PARTNER_PROFILE.md.
--
--    prices = [{"name": "Herreklipp", "price": "fra 450 kr"}, …]   (at most 20 rows)
--
--  The price is free text on purpose ("fra 450 kr", "350 kr/time", "Gratis") – it is
--  information for the neighbours, never something paid through MinNabo.

alter table public.partners
  add column if not exists prices jsonb not null default '[]'::jsonb;

alter table public.partners drop constraint if exists partners_prices_shape;
alter table public.partners add constraint partners_prices_shape
  check (jsonb_typeof(prices) = 'array' and jsonb_array_length(prices) <= 20);

-- The website reads partners through this view (0054). Same columns in the same order,
-- with `prices` added at the end – the only change `create or replace view` allows.
create or replace view public.partners_public as
select p.id, p.name, p.blurb, p.url, p.logo_path, p.cover_path, p.municipality, k.region, p.category_slug,
       case when a.partner_id is not null then a.package
            when exists (select 1 from partner_placements pp
                          where pp.partner_id = p.id and pp.surface = 'fellesskap' and pp.active) then 'hoved'
            when p.local_hero then 'helt'
            else 'stottespiller' end as package,
       p.about, p.offer, p.address, p.phone, p.email, p.opening_hours, p.gallery,
       p.partner_since, p.sort_order,
       p.prices
  from public.partners p
  left join public.partner_accounts a on a.partner_id = p.id
  left join public.kommuner k on k.name = p.municipality
 where public.partner_is_visible(p.id);
revoke all on public.partners_public from public, anon, authenticated;
grant select on public.partners_public to anon, authenticated;
