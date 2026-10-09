-- 0050_notifications_and_receipts.sql
-- A pass over everything that should tell the other person something.
--
--  * Push tokens: a phone's token could not move to a new account (the row belonged
--    to whoever registered it first), so a second user on the same phone got no
--    push and the first one kept getting theirs there. Tokens are now claimed by
--    whoever is signed in, and released on sign-out.
--  * Two events told nobody:
--      - a new vurdering (the notification was lost when 0010 rewrote submit_review)
--      - the helper sending updated terms after "Be om endring"
--  * Chat "Lest": the app reads the other person's read time from
--    conversation_participants; changes to it are now sent live.

-- ---------------------------------------------------------------------------
-- push tokens
-- ---------------------------------------------------------------------------
create or replace function register_push_token(p_token text, p_platform text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'Ikke innlogget.'; end if;
  if coalesce(p_token, '') = '' then return; end if;
  insert into push_tokens (token, profile_id, platform, updated_at)
    values (p_token, auth.uid(), case when p_platform in ('ios','android','web') then p_platform else 'ios' end, now())
  on conflict (token) do update
    set profile_id = excluded.profile_id, platform = excluded.platform, updated_at = now();
end $$;
grant execute on function register_push_token(text, text) to authenticated;

create or replace function unregister_push_token(p_token text)
returns void language sql security definer set search_path = public as $$
  delete from push_tokens where token = p_token and profile_id = auth.uid();
$$;
grant execute on function unregister_push_token(text) to authenticated;

-- ---------------------------------------------------------------------------
-- missing notifications
-- ---------------------------------------------------------------------------
create or replace function review_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into notifications (profile_id, kind, title, body, route)
    values (new.to_profile_id, 'REVIEW_RECEIVED', 'Ny vurdering',
            'Du har fått en vurdering. Den vises når dere begge har vurdert, eller når fristen går ut.',
            '/profil');
  return new;
end $$;
drop trigger if exists t_review_notify on reviews;
create trigger t_review_notify after insert on reviews
  for each row execute function review_notify();

-- "Be om endring" → the helper answers with updated terms (status goes back to SENT).
-- edit_proposal (0034) notifies by itself and stamps edited_at, so it is left out here.
create or replace function proposal_revision_notify() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if old.status::text = 'REVISION_PENDING' and new.status::text = 'SENT'
     and new.edited_at is not distinct from old.edited_at then
    insert into notifications (profile_id, kind, title, body, route)
      values (new.to_profile_id, 'OFFER_CHANGED', 'Tilbudet er oppdatert',
              'Du har fått et oppdatert tilbud etter endringen du ba om.', '/tilbud/' || new.id);
  end if;
  return new;
end $$;
drop trigger if exists t_proposal_revision_notify on proposals;
create trigger t_proposal_revision_notify after update of status on proposals
  for each row execute function proposal_revision_notify();

-- ---------------------------------------------------------------------------
-- read receipts live
-- ---------------------------------------------------------------------------
do $$
begin
  alter publication supabase_realtime add table conversation_participants;
exception when duplicate_object then null;
end $$;
