-- New #6: "min faste hjelper" — follow a helper.

create table if not exists follows (
  follower_id uuid not null references profiles(id) on delete cascade,
  followed_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  check (follower_id <> followed_id)
);

alter table follows enable row level security;

create policy follows_read_own on follows
  for select to authenticated using (follower_id = auth.uid());

create policy follows_write_own on follows
  for all to authenticated
  using (follower_id = auth.uid())
  with check (follower_id = auth.uid());

create or replace function toggle_follow(p_followed_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (select 1 from follows where follower_id = auth.uid() and followed_id = p_followed_id) then
    delete from follows where follower_id = auth.uid() and followed_id = p_followed_id;
  else
    insert into follows (follower_id, followed_id) values (auth.uid(), p_followed_id);
  end if;
end;
$$;

grant execute on function toggle_follow(uuid) to authenticated;
