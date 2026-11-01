-- 0081_invites.sql
-- «Inviter en nabo»: who brought whom to MinNabo, for the «Verver» merke.
--
-- The invite link carries the inviter's profile id (minnabo://velkommen?ref=<id>).
-- The app keeps it while the new neighbour logs in with Vipps and sets up the
-- profile, then calls record_invite once. Rules, so the badge can't be farmed:
--   * only a profile created in the last 14 days can say who invited it
--   * one inviter per person, for good (the first answer counts)
--   * not yourself, and not a deleted or suspended inviter
-- Only the count is public (invite_count); who invited whom stays private.

create table if not exists invites (
  invitee_id uuid primary key references profiles(id) on delete cascade,
  inviter_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists invites_inviter_idx on invites (inviter_id);
alter table invites enable row level security;
drop policy if exists p_invites_read on invites;
create policy p_invites_read on invites for select to authenticated
  using (inviter_id = auth.uid() or invitee_id = auth.uid());

create or replace function record_invite(p_inviter uuid) returns boolean
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid();
begin
  if v_me is null or p_inviter is null or p_inviter = v_me then return false; end if;
  if not exists (select 1 from profiles where id = v_me and created_at > now() - interval '14 days') then return false; end if;
  if not exists (select 1 from profiles where id = p_inviter and deleted_at is null and suspended_at is null) then return false; end if;
  insert into invites (invitee_id, inviter_id) values (v_me, p_inviter) on conflict (invitee_id) do nothing;
  return found;
end $$;
revoke all on function record_invite(uuid) from public, anon;
grant execute on function record_invite(uuid) to authenticated;

create or replace function invite_count(p_profile uuid) returns int
language sql stable security definer set search_path = public as $$
  select count(*)::int from invites i join profiles p on p.id = i.invitee_id and p.deleted_at is null
   where i.inviter_id = p_profile;
$$;
revoke all on function invite_count(uuid) from public, anon;
grant execute on function invite_count(uuid) to authenticated;
