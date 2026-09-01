-- New #35 (pause profile) + #32/#33 (no-show reporting → reliability score).

alter table profiles
  add column if not exists paused boolean not null default false;

-- Paused profiles' listings drop out of the public feed. Assumes the public
-- listing view/policy filters on the owner; adjust the listings view here.
create or replace view public_listings as
  select l.*
  from listings l
  join profiles p on p.id = l.owner_id
  where p.paused = false;

-- No-show reports: one row per (agreement, reporter). The reported party's
-- reliability is derived from completed agreements vs. no-show count.
create table if not exists no_show_reports (
  id uuid primary key default gen_random_uuid(),
  agreement_proposal_id uuid not null references proposals(id) on delete cascade,
  reporter_id uuid not null references profiles(id) on delete cascade,
  reported_id uuid not null references profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (agreement_proposal_id, reporter_id)
);

alter table no_show_reports enable row level security;

create policy no_show_insert_own on no_show_reports
  for insert to authenticated
  with check (reporter_id = auth.uid());

create policy no_show_read_involved on no_show_reports
  for select to authenticated
  using (reporter_id = auth.uid() or reported_id = auth.uid());

create or replace function report_no_show(
  p_agreement_proposal_id uuid,
  p_profile_id uuid
) returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into no_show_reports (agreement_proposal_id, reporter_id, reported_id)
  values (p_agreement_proposal_id, auth.uid(), p_profile_id)
  on conflict (agreement_proposal_id, reporter_id) do nothing;
end;
$$;

grant execute on function report_no_show(uuid, uuid) to authenticated;

-- Reliability counters, surfaced on the profile row the client reads.
-- reliability_completed: fully-confirmed agreements the profile took part in.
-- reliability_no_shows: rows in no_show_reports naming this profile.
alter table profiles
  add column if not exists reliability_completed integer not null default 0,
  add column if not exists reliability_no_shows integer not null default 0;

create or replace function bump_no_show_counter()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  update profiles
     set reliability_no_shows = reliability_no_shows + 1
   where id = new.reported_id;
  return new;
end;
$$;

create trigger t_no_show_counter after insert on no_show_reports
  for each row execute function bump_no_show_counter();
