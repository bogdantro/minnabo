-- 0085_kommune_groups_and_new_oppdrag_push.sql
--  Asked 2026-11-04:
--    * Lillehammer, Øyer and Gausdal lie so close together that they count as one area: someone in
--      any of them sees oppdrag from all three, even on «Bare min kommune». The app does the same
--      (KOMMUNE_GROUPS in src/data/kommuner.ts) – change both.
--    * Everyone gets a push right away each time something new is posted in their kommune (or its
--      group): an oppdrag («Trenger hjelp») or a «Tilbyr hjelp».
--      Before, only helpers matching the category were meant to hear – and the app never called
--      notify_matching_helpers (0036), so nobody did. This is a trigger now, so it also fires when
--      the website's Verifisering approves an oppdrag that was held back.
--
--  Who hears about it:
--    * a profile in the oppdrag's kommune group, not the owner, not deleted / suspended / on holiday
--    * neither side has blocked the other
--    * not an invitation oppdrag (invited_profile_id: only the invited nabo sees it)
--    * a youth only for oppdrag in the youth categories (the only posts the youth app lists, 0084) –
--      never for a «Tilbyr hjelp», which a youth can't answer
--    * at most once per post: a saved-search alert (0061) for the same oppdrag counts
--  The «Nye oppdrag» switch under Varslinger (NEW_MATCH) and quiet hours still apply (send-push).

create or replace function kommune_group(p_kommune text) returns text[]
language sql immutable as $$
  select case when p_kommune in ('Lillehammer', 'Øyer', 'Gausdal')
              then array['Lillehammer', 'Øyer', 'Gausdal']
              else array[p_kommune] end;
$$;

-- A post the public can see (the feed's own rules: published, not held for review, not hidden, not private).
-- Oppdrag and «Tilbyr hjelp» alike; an offer stays PUBLISHED through its avtaler (0076).
create or replace function listing_publicly_visible(l listings) returns boolean
language sql immutable as $$
  select l.type::text in ('TASK_REQUEST', 'SERVICE_OFFER')
     and l.status::text in ('PUBLISHED', 'RECEIVING_OFFERS')
     and not coalesce(l.pending_review, false)
     and not coalesce(l.admin_hidden, false)
     and l.invited_profile_id is null;
$$;

create or replace function notify_kommune_new_oppdrag() returns trigger
language plpgsql security definer set search_path = public as $$
declare v_route text := '/oppdrag/' || new.id; v_offer boolean := new.type::text = 'SERVICE_OFFER';
begin
  if not listing_publicly_visible(new) then return new; end if;
  -- only the moment it becomes visible, never on an edit of an oppdrag that already was
  if tg_op = 'UPDATE' and listing_publicly_visible(old) then return new; end if;

  insert into notifications (profile_id, kind, title, body, route)
  select p.id, 'NEW_MATCH'::text::notification_kind,
         case when v_offer then 'En nabo tilbyr hjelp i ' else 'Nytt oppdrag i ' end || new.municipality,
         '«' || new.title || '» · ' || new.place,
         v_route
    from profiles p
   where p.municipality = any(kommune_group(new.municipality))
     and p.id <> new.owner_id
     and p.deleted_at is null
     and p.suspended_at is null
     and not coalesce(p.paused, false)
     and (not is_youth(p.id) or (not v_offer and youth_offer_category(new.category_slug)))
     and not exists (select 1 from blocks b
                      where (b.by_profile_id = p.id and b.blocked_profile_id = new.owner_id)
                         or (b.by_profile_id = new.owner_id and b.blocked_profile_id = p.id))
     and not exists (select 1 from notifications n
                      where n.profile_id = p.id and n.kind::text = 'NEW_MATCH' and n.route = v_route);
  return new;
end $$;
drop trigger if exists t_listings_notify_kommune on listings;
create trigger t_listings_notify_kommune after insert or update on listings
  for each row execute function notify_kommune_new_oppdrag();

-- The Sunday summary (0079) counts the whole group too: «3 nye oppdrag i Lillehammer, Øyer og Gausdal».
-- Anyone who got a «Nytt oppdrag» this week is skipped by its NEW_MATCH rule, as before.
create or replace function weekly_digest() returns int
language plpgsql security definer set search_path = public as $$
declare r record; v_sent int := 0;
begin
  for r in
    select p.id, p.municipality, count(l.id)::int as n
      from profiles p
      join listings l
        on l.municipality = any(kommune_group(p.municipality))
       and l.type::text = 'TASK_REQUEST'
       and listing_publicly_visible(l)
       and l.created_at > now() - interval '7 days'
       and l.owner_id <> p.id
       and not exists (select 1 from blocks b
                        where (b.by_profile_id = p.id and b.blocked_profile_id = l.owner_id)
                           or (b.by_profile_id = l.owner_id and b.blocked_profile_id = p.id))
     where p.municipality is not null
       and p.deleted_at is null
       and p.suspended_at is null
       and not exists (select 1 from notifications n
                        where n.profile_id = p.id and n.kind::text = 'NEW_MATCH'
                          and n.created_at > now() - interval '6 days')
     group by p.id, p.municipality
    having count(l.id) >= 2
  loop
    insert into notifications (profile_id, kind, title, body, route)
      values (r.id, 'NEW_MATCH'::text::notification_kind,
              r.n || ' nye oppdrag i ' ||
                case when array_length(kommune_group(r.municipality), 1) > 1
                     then 'Lillehammer, Øyer og Gausdal' else r.municipality end || ' denne uka',
              'Se hva naboene trenger hjelp til.',
              '/');
    v_sent := v_sent + 1;
  end loop;
  return v_sent;
end $$;
revoke all on function weekly_digest() from public, anon, authenticated;
