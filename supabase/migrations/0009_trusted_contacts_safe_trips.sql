-- New #29/#30/#31: trusted contacts + trygg-tur (safe trip) escort.
-- The client keeps these on-device for v1; these tables let it move server-side
-- so a trip can actually alert a contact when the app is closed.

create table if not exists trusted_contacts (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  name text not null,
  phone text not null,
  created_at timestamptz not null default now()
);

alter table trusted_contacts enable row level security;

create policy trusted_contacts_own on trusted_contacts
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

create table if not exists safe_trips (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  proposal_id uuid references proposals(id) on delete set null,
  started_at timestamptz not null default now(),
  due_at timestamptz not null,
  checked_in_at timestamptz,
  alerted_at timestamptz,
  created_at timestamptz not null default now()
);

alter table safe_trips enable row level security;

create policy safe_trips_own on safe_trips
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());

-- One open trip per person at a time.
create unique index if not exists safe_trips_one_open_per_owner
  on safe_trips (owner_id)
  where checked_in_at is null;
