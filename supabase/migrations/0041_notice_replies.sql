-- 0041_notice_replies.sql
-- Oppslagstavle (design/screens/Oppslagstavle.dc.html):
--  * "Svar" opens a chat with the person who wrote the oppslag → a conversation
--    can now belong to an oppslag instead of an oppdrag
--  * "Lagre" → saved_notices
--  * "N svar" → how many neighbours have written to the poster (a number only)

alter table conversations alter column listing_id drop not null;
alter table conversations add column if not exists notice_id uuid references noticeboard_posts(id) on delete set null;
-- kept on the conversation so the chat keeps its heading if the oppslag is removed
alter table conversations add column if not exists notice_title text;
alter table conversations add column if not exists notice_place text;
create index if not exists conversations_notice_idx on conversations (notice_id);

create table if not exists saved_notices (
  profile_id uuid not null references profiles(id) on delete cascade,
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, notice_id)
);
alter table saved_notices enable row level security;
drop policy if exists p_saved_notices_own on saved_notices;
create policy p_saved_notices_own on saved_notices for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

create or replace function start_conversation_for_notice(p_notice_id uuid)
returns conversations language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_me uuid := auth.uid(); v_conv conversations;
begin
  if v_me is null then raise exception 'Ikke innlogget.'; end if;
  if is_youth(v_me) then
    raise exception 'Dette er ikke tilgjengelig for ungdomskontoer.' using errcode = '42501';
  end if;
  select * into n from noticeboard_posts where id = p_notice_id and hidden_at is null;
  if not found then raise exception 'Fant ikke oppslaget.'; end if;
  if n.author_id = v_me then raise exception 'Du kan ikke svare på ditt eget oppslag.'; end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = v_me and b.blocked_profile_id = n.author_id)
                 or (b.by_profile_id = n.author_id and b.blocked_profile_id = v_me)) then
    raise exception 'Du kan ikke kontakte denne personen.' using errcode = '42501';
  end if;

  select c.* into v_conv from conversations c
    join conversation_participants a on a.conversation_id = c.id and a.profile_id = v_me
    join conversation_participants b on b.conversation_id = c.id and b.profile_id = n.author_id
   where c.notice_id = p_notice_id limit 1;
  if found then return v_conv; end if;

  insert into conversations (notice_id, notice_title, notice_place)
    values (n.id, n.title, n.place) returning * into v_conv;
  insert into conversation_participants (conversation_id, profile_id)
    values (v_conv.id, v_me), (v_conv.id, n.author_id);
  return v_conv;
end $$;
grant execute on function start_conversation_for_notice(uuid) to authenticated;

-- "N svar": conversations on the oppslag where the other person actually wrote something.
create or replace function noticeboard_reply_counts()
returns table (notice_id uuid, replies int)
language sql stable security definer set search_path = public as $$
  select c.notice_id, count(*)::int
    from conversations c
    join noticeboard_posts n on n.id = c.notice_id and n.hidden_at is null
   where exists (select 1 from messages m
                  where m.conversation_id = c.id and m.author_id <> n.author_id and m.kind::text <> 'SYSTEM')
   group by c.notice_id;
$$;
grant execute on function noticeboard_reply_counts() to authenticated;
