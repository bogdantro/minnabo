-- New #40 ("om hjemmet mitt") + #37 (skill endorsements).

alter table profiles
  add column if not exists home_notes text;

create table if not exists skill_endorsements (
  target_id uuid not null references profiles(id) on delete cascade,
  endorser_id uuid not null references profiles(id) on delete cascade,
  skill text not null,
  created_at timestamptz not null default now(),
  primary key (target_id, endorser_id, skill),
  check (target_id <> endorser_id)
);

alter table skill_endorsements enable row level security;

create policy skill_endorsements_read on skill_endorsements
  for select to authenticated using (true);

create policy skill_endorsements_write_own on skill_endorsements
  for all to authenticated
  using (endorser_id = auth.uid())
  with check (endorser_id = auth.uid());

create or replace function toggle_endorsement(p_target_id uuid, p_skill text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from skill_endorsements
    where target_id = p_target_id and endorser_id = auth.uid() and skill = p_skill
  ) then
    delete from skill_endorsements
    where target_id = p_target_id and endorser_id = auth.uid() and skill = p_skill;
  else
    insert into skill_endorsements (target_id, endorser_id, skill)
    values (p_target_id, auth.uid(), p_skill);
  end if;
end;
$$;

grant execute on function toggle_endorsement(uuid, text) to authenticated;
