-- supabase/migrations/0021_location_scoping.sql
-- Location scoping: kommune is the filter unit (spec 2026-09-05). No RLS change.

alter table partners          add column if not exists municipality text;
alter table neighbourhoods    add column if not exists municipality text;
alter table noticeboard_posts add column if not exists municipality text not null default '';

create index if not exists listings_municipality_idx on listings (municipality);

-- Backfill notices where poststed already equals the kommune name.
update noticeboard_posts set municipality = place where municipality = '' and place <> '';
