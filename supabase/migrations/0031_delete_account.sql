-- Slett konto (design/screens/SlettKonto.dc.html).
-- Deleting the auth user would cascade and remove the person's messages from the
-- other party's chats. Instead: anonymise the profile ("Slettet bruker"), cancel
-- active agreements, remove listings and private data. The edge function
-- `delete-account` then soft-deletes the auth user so the login stops working.

-- Anonymous reasons ("Hvorfor vil du slette?") – no link to the person.
create table if not exists account_deletions (
  id uuid primary key default gen_random_uuid(),
  reason text,
  created_at timestamptz not null default now()
);
alter table account_deletions enable row level security;
-- no policies: only written by delete_my_account(), read by admins via the dashboard

create or replace function delete_my_account(p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_me uuid := auth.uid();
  p proposals;
begin
  if v_me is null then
    raise exception 'Ikke innlogget.';
  end if;

  insert into account_deletions (reason) values (nullif(btrim(coalesce(p_reason, '')), ''));

  -- Active agreements are cancelled, and the other party is told.
  for p in
    select * from proposals
    where status = 'ACCEPTED' and (from_profile_id = v_me or to_profile_id = v_me)
  loop
    perform cancel_agreement(p.id, 'Kontoen er slettet');
  end loop;

  -- Open offers I sent are withdrawn.
  update proposals set status = 'WITHDRAWN'
   where from_profile_id = v_me and status in ('SENT', 'REVISION_PENDING');

  -- My oppdrag disappear for everyone (soft delete keeps the others' chats).
  update listings set status = 'REMOVED' where owner_id = v_me;

  -- Private and personal data.
  delete from noticeboard_posts where author_id = v_me;
  delete from neighbourhood_members where profile_id = v_me;
  delete from saved_listings where profile_id = v_me;
  delete from saved_searches where profile_id = v_me;
  delete from follows where follower_id = v_me or followed_id = v_me;
  delete from skill_endorsements where endorser_id = v_me or target_id = v_me;
  delete from trusted_contacts where owner_id = v_me;
  delete from safe_trips where owner_id = v_me;
  delete from profile_settings where profile_id = v_me;
  delete from push_tokens where profile_id = v_me;
  delete from blocks where by_profile_id = v_me;
  delete from verifications where profile_id = v_me;

  -- What others still see in old chats and reviews.
  update profiles set
    display_name = 'Slettet bruker',
    initials = '?',
    avatar_path = null,
    presentation = null,
    place = null,
    home_notes = null,
    portfolio = '{}',
    phone = null,
    paused = true,
    deleted_at = now(),
    updated_at = now()
  where id = v_me;
end;
$$;

revoke all on function delete_my_account(text) from public;
grant execute on function delete_my_account(text) to authenticated;
