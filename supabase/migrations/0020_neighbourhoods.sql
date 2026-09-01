-- New #42: neighbourhood / borettslag groups. The client keeps the chosen
-- group on-device for v1; this table lets it become a real shared space with
-- membership and a group-scoped feed.

create table if not exists neighbourhoods (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  place text,
  created_by uuid references profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

create table if not exists neighbourhood_members (
  neighbourhood_id uuid not null references neighbourhoods(id) on delete cascade,
  profile_id uuid not null references profiles(id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (neighbourhood_id, profile_id)
);

alter table neighbourhoods enable row level security;
alter table neighbourhood_members enable row level security;

create policy neighbourhoods_read_all on neighbourhoods for select to authenticated using (true);
create policy neighbourhoods_create on neighbourhoods for insert to authenticated with check (created_by = auth.uid());

create policy neighbourhood_members_own on neighbourhood_members
  for all to authenticated
  using (profile_id = auth.uid())
  with check (profile_id = auth.uid());
