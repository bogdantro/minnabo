-- 0046_partner_tiers.sql
-- Fellesskap gets three levels of partners:
--   Hovedpartner       – max 2, a large card and a page of their own (/partner/<id>)
--   Lokal helt         – new: a card that opens the short information sheet
--   Lokal støttespiller – logo and name only
-- A hovedpartner's page needs room for more than a tagline, so partners get the
-- fields below. They are filled in by MinNabo (SQL / Supabase table editor).

alter table partners add column if not exists local_hero boolean not null default false;
alter table partners add column if not exists about text;          -- "Om oss"
alter table partners add column if not exists offer text;          -- what they offer the neighbours
alter table partners add column if not exists address text;
alter table partners add column if not exists phone text;
alter table partners add column if not exists email text;
alter table partners add column if not exists opening_hours text;
alter table partners add column if not exists cover_path text;     -- wide photo at the top of the page
alter table partners add column if not exists gallery text[] not null default '{}';

-- The return type changes (new column), so the function is dropped first.
drop function if exists admin_partners();
create function admin_partners()
returns table (id uuid, name text, blurb text, municipality text, main boolean, active boolean, hero boolean)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query
    select p.id, p.name, p.blurb, p.municipality,
           exists (select 1 from partner_placements pp
                    where pp.partner_id = p.id and pp.surface = 'fellesskap' and pp.active),
           p.active,
           p.local_hero
      from partners p order by p.name;
end $$;
revoke all on function admin_partners() from public, anon;
grant execute on function admin_partners() to authenticated;

create or replace function admin_set_partner_hero(p_partner_id uuid, p_hero boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  update partners set local_hero = p_hero, active = active or p_hero where id = p_partner_id;
end $$;
revoke all on function admin_set_partner_hero(uuid, boolean) from public, anon;
grant execute on function admin_set_partner_hero(uuid, boolean) to authenticated;
