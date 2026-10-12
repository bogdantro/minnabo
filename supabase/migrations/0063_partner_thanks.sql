-- 0063_partner_thanks.sql
-- "Takk for støtten" on a partner is now remembered, so Fellesskap can show
-- "47 naboer har takket". One thank per person per partner; it cannot be undone or
-- repeated, and only partners that are visible in the app can be thanked.
--  * partner_thanks: who thanked whom. A person can read only their own rows.
--  * partner_thanks_summary(): per visible partner, how many have thanked and whether
--    the caller has – the app reads the numbers from here, never the rows.
-- Additive: nothing existing is changed. The website can read the table (it connects
-- as postgres) if it wants the number in the partner portal.

create table if not exists partner_thanks (
  partner_id uuid not null references partners(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (partner_id, profile_id)
);
create index if not exists partner_thanks_partner_idx on partner_thanks(partner_id);
alter table partner_thanks enable row level security;

drop policy if exists p_partner_thanks_own on partner_thanks;
create policy p_partner_thanks_own on partner_thanks for select to authenticated
  using (profile_id = auth.uid());
-- no insert / update / delete policy: thanks go through thank_partner()

revoke all on partner_thanks from anon, public;
grant select on partner_thanks to authenticated;

create or replace function thank_partner(p_partner uuid)
returns integer language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_n integer;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if not partner_is_visible(p_partner) then raise exception 'Fant ikke partneren.'; end if;
  insert into partner_thanks (partner_id, profile_id) values (p_partner, v_me)
  on conflict do nothing;
  select count(*) into v_n from partner_thanks where partner_id = p_partner;
  return v_n;
end $$;
revoke all on function thank_partner(uuid) from public, anon;
grant execute on function thank_partner(uuid) to authenticated;

create or replace function partner_thanks_summary()
returns table (partner_id uuid, thanks integer, mine boolean)
language sql stable security definer set search_path = public as $$
  select t.partner_id,
         count(*)::integer,
         bool_or(t.profile_id = auth.uid())
    from partner_thanks t
   where auth.uid() is not null and partner_is_visible(t.partner_id)
   group by t.partner_id;
$$;
revoke all on function partner_thanks_summary() from public, anon;
grant execute on function partner_thanks_summary() to authenticated;
