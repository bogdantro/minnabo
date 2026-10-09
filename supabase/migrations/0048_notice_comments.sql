-- 0048_notice_comments.sql
-- Oppslagstavle, changed on request:
--  * "Svar" is a public comment under the oppslag – not a private chat (0041 opened a chat).
--  * The person who wrote an oppslag can edit it and mark it as done ("Avsluttet").
--  * "N svar" counts the comments.

alter table noticeboard_posts add column if not exists done_at timestamptz;
alter table noticeboard_posts add column if not exists edited_at timestamptz;

create table if not exists notice_comments (
  id uuid primary key default gen_random_uuid(),
  notice_id uuid not null references noticeboard_posts(id) on delete cascade,
  author_id uuid not null references profiles(id) on delete cascade,
  body text not null check (length(trim(body)) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists notice_comments_notice_idx on notice_comments (notice_id, created_at);

alter table notice_comments enable row level security;
drop policy if exists p_notice_comments_read on notice_comments;
create policy p_notice_comments_read on notice_comments for select to authenticated
  using (exists (select 1 from noticeboard_posts n
                  where n.id = notice_id and (n.hidden_at is null or n.author_id = auth.uid() or is_admin())));
drop policy if exists p_notice_comments_insert on notice_comments;
create policy p_notice_comments_insert on notice_comments for insert to authenticated
  with check (author_id = auth.uid());
-- your own comment, or any comment under your own oppslag
drop policy if exists p_notice_comments_delete on notice_comments;
create policy p_notice_comments_delete on notice_comments for delete to authenticated
  using (author_id = auth.uid()
         or is_admin()
         or exists (select 1 from noticeboard_posts n where n.id = notice_id and n.author_id = auth.uid()));

-- same limits as writing an oppslag: not for suspended or youth accounts
drop trigger if exists notice_comments_block_suspended on notice_comments;
create trigger notice_comments_block_suspended before insert on notice_comments
  for each row execute function block_suspended_writes();
drop trigger if exists notice_comments_block_youth on notice_comments;
create trigger notice_comments_block_youth before insert on notice_comments
  for each row execute function block_youth_writes();

alter type notification_kind add value if not exists 'NOTICE_REPLY';

create or replace function notice_comment_added() returns trigger
language plpgsql security definer set search_path = public as $$
declare n noticeboard_posts; v_name text; v_recent int;
begin
  select * into n from noticeboard_posts where id = new.notice_id;
  if not found or n.hidden_at is not null then raise exception 'Fant ikke oppslaget.'; end if;
  if n.done_at is not null then raise exception 'Oppslaget er avsluttet.'; end if;
  if exists (select 1 from blocks b
              where (b.by_profile_id = n.author_id and b.blocked_profile_id = new.author_id)
                 or (b.by_profile_id = new.author_id and b.blocked_profile_id = n.author_id)) then
    raise exception 'Du kan ikke svare på dette oppslaget.' using errcode = '42501';
  end if;
  select count(*) into v_recent from notice_comments
   where author_id = new.author_id and created_at > now() - interval '1 minute';
  if v_recent >= 6 then raise exception 'For mange svar. Vent litt og prøv igjen.'; end if;

  if n.author_id <> new.author_id then
    select display_name into v_name from profiles where id = new.author_id;
    insert into notifications (profile_id, kind, title, body, route)
      values (n.author_id, 'NOTICE_REPLY'::text::notification_kind,
              coalesce(v_name, 'En nabo') || ' svarte på oppslaget ditt',
              '«' || n.title || '»: ' || left(new.body, 100), '/oppslagstavle');
  end if;
  return new;
end $$;
drop trigger if exists t_notice_comment_added on notice_comments;
create trigger t_notice_comment_added before insert on notice_comments
  for each row execute function notice_comment_added();

-- "N svar" = comments (was: private chats on the oppslag)
create or replace function noticeboard_reply_counts()
returns table (notice_id uuid, replies int)
language sql stable security definer set search_path = public as $$
  select c.notice_id, count(*)::int
    from notice_comments c
    join noticeboard_posts n on n.id = c.notice_id and n.hidden_at is null
   group by c.notice_id;
$$;
grant execute on function noticeboard_reply_counts() to authenticated;

-- an edit is stamped, so "redigert" can be shown
create or replace function notice_touch_edit() returns trigger
language plpgsql as $$
begin
  if new.title is distinct from old.title or new.body is distinct from old.body or new.kind is distinct from old.kind then
    new.edited_at := now();
  end if;
  return new;
end $$;
drop trigger if exists t_notice_touch_edit on noticeboard_posts;
create trigger t_notice_touch_edit before update on noticeboard_posts
  for each row execute function notice_touch_edit();
