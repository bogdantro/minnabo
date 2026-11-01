-- 0078_arrival_place.sql
-- «Jeg er framme» with an optional, approximate place.
--
-- When the helper taps «Jeg er framme» they can choose to show the owner roughly
-- where they are: the street and town from their phone's position, never a house
-- number or coordinates ("Storgata, Lillehammer"). The owner knows their own
-- address, so it is a calm way to see that the helper really is there.
--
-- Privacy: only the two people on the avtale can read agreement_snapshots; the app
-- shows the place only on the job day, and it is wiped 12 hours after it was sent.
-- It is never written into the chat or a notification, which are kept for good.

alter table agreement_snapshots
  add column if not exists helper_status_place text
    check (helper_status_place is null or char_length(helper_status_place) <= 80);

-- The old two-argument version is replaced (not overloaded): with both present a
-- call with two arguments would be ambiguous. Apps call it with named arguments,
-- so current builds keep working unchanged.
drop function if exists set_helper_status(uuid, text);
create or replace function set_helper_status(p_proposal_id uuid, p_status text, p_place text default null) returns void
language plpgsql security definer set search_path = public as $$
declare p proposals := helper_agreement(p_proposal_id); v_text text;
begin
  if p_status not in ('ON_THE_WAY', 'ARRIVED') then raise exception 'Ugyldig status.'; end if;
  update agreement_snapshots
     set helper_status = p_status,
         helper_status_at = now(),
         helper_confirmed_at = coalesce(helper_confirmed_at, now()),
         -- only «framme» carries a place; «på vei» clears an old one
         helper_status_place = case when p_status = 'ARRIVED' then nullif(left(btrim(coalesce(p_place, '')), 80), '') end
   where proposal_id = p.id;
  v_text := first_name(p.from_profile_id) || case p_status when 'ON_THE_WAY' then ' er på vei' else ' er framme' end;
  insert into messages (conversation_id, author_id, kind, text) values (p.conversation_id, p.from_profile_id, 'SYSTEM', v_text);
  perform notify(p.to_profile_id, 'JOB_DAY', v_text, 'kl. ' || oslo_hhmm(now()), '/avtale/' || p.id);
end $$;
revoke all on function set_helper_status(uuid, text, text) from public, anon;
grant execute on function set_helper_status(uuid, text, text) to authenticated;

-- Wipe the place 12 hours after it was shared
create or replace function clear_arrival_places() returns int
language sql security definer set search_path = public as $$
  with cleared as (
    update agreement_snapshots set helper_status_place = null
     where helper_status_place is not null and helper_status_at < now() - interval '12 hours'
    returning 1
  )
  select count(*)::int from cleared;
$$;
revoke all on function clear_arrival_places() from public, anon, authenticated;

do $$ begin
  begin
    perform cron.unschedule('minnabo-clear-arrival-place');
  exception when others then null;
  end;
  perform cron.schedule('minnabo-clear-arrival-place', '17 * * * *', 'select public.clear_arrival_places()');
exception when others then
  raise notice 'Arrival places are not cleared on a schedule (%). Enable pg_cron and run this block again.', sqlerrm;
end $$;
