-- New #13/#18/#19: per-agreement working state — checklist, materials log,
-- time tracker. Both participants share one row.

create table if not exists job_workspaces (
  proposal_id uuid primary key references proposals(id) on delete cascade,
  checklist jsonb not null default '[]'::jsonb,
  materials jsonb not null default '[]'::jsonb,
  timer_started_at timestamptz,
  timer_accum_ms bigint not null default 0,
  updated_at timestamptz not null default now()
);

alter table job_workspaces enable row level security;

create policy job_workspaces_participants on job_workspaces
  for all to authenticated
  using (
    exists (
      select 1 from proposals p
      where p.id = job_workspaces.proposal_id
        and (p.from_profile_id = auth.uid() or p.to_profile_id = auth.uid())
    )
  )
  with check (
    exists (
      select 1 from proposals p
      where p.id = job_workspaces.proposal_id
        and (p.from_profile_id = auth.uid() or p.to_profile_id = auth.uid())
    )
  );

-- update_job_workspace(proposal_id, action jsonb) applies one mutation and
-- returns nothing; the client re-reads the row. Action shapes mirror the
-- ApiClient union: { kind: 'addChecklist', text } etc.
create or replace function update_job_workspace(p_proposal_id uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := p_action ->> 'kind';
  v_ws job_workspaces;
begin
  insert into job_workspaces (proposal_id) values (p_proposal_id)
  on conflict (proposal_id) do nothing;
  select * into v_ws from job_workspaces where proposal_id = p_proposal_id for update;

  if v_kind = 'addChecklist' then
    update job_workspaces set checklist = checklist || jsonb_build_object(
      'id', gen_random_uuid(), 'text', p_action ->> 'text', 'done', false)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'toggleChecklist' then
    update job_workspaces set checklist = (
      select jsonb_agg(case when c ->> 'id' = p_action ->> 'itemId'
        then jsonb_set(c, '{done}', to_jsonb(not (c ->> 'done')::boolean)) else c end)
      from jsonb_array_elements(checklist) c)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removeChecklist' then
    update job_workspaces set checklist = (
      select coalesce(jsonb_agg(c), '[]'::jsonb) from jsonb_array_elements(checklist) c
      where c ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'addMaterial' then
    update job_workspaces set materials = materials || jsonb_build_object(
      'id', gen_random_uuid(), 'label', p_action ->> 'label',
      'amountKr', (p_action ->> 'amountKr')::numeric)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removeMaterial' then
    update job_workspaces set materials = (
      select coalesce(jsonb_agg(m), '[]'::jsonb) from jsonb_array_elements(materials) m
      where m ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'toggleTimer' then
    if v_ws.timer_started_at is null then
      update job_workspaces set timer_started_at = now() where proposal_id = p_proposal_id;
    else
      update job_workspaces set
        timer_accum_ms = timer_accum_ms + (extract(epoch from (now() - v_ws.timer_started_at)) * 1000)::bigint,
        timer_started_at = null
        where proposal_id = p_proposal_id;
    end if;
  end if;

  update job_workspaces set updated_at = now() where proposal_id = p_proposal_id;
end;
$$;

grant execute on function update_job_workspace(uuid, jsonb) to authenticated;
