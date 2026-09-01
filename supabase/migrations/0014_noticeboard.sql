-- New #44/#45: neighbourhood noticeboard (giveaways, lost & found, tool lending).

do $$ begin
  create type notice_kind as enum ('GIVEAWAY', 'LOST_FOUND', 'TOOL_LEND', 'GENERAL');
exception when duplicate_object then null; end $$;

create table if not exists noticeboard_posts (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references profiles(id) on delete cascade,
  kind notice_kind not null default 'GENERAL',
  title text not null,
  body text not null default '',
  place text not null default '',
  created_at timestamptz not null default now()
);

create index if not exists noticeboard_posts_created_idx on noticeboard_posts (created_at desc);

alter table noticeboard_posts enable row level security;

create policy noticeboard_read_all on noticeboard_posts
  for select to authenticated using (true);

create policy noticeboard_write_own on noticeboard_posts
  for all to authenticated
  using (author_id = auth.uid())
  with check (author_id = auth.uid());
