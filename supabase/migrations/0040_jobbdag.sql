-- 0040_jobbdag.sql
-- Jobbdag gets the rest of design/screens/Jobbdag.dc.html:
--  * checklist items say who does them        (who: CLIENT | HELPER, none = "Felles")
--  * materials say who sorts them out         (payer: CLIENT | HELPER | HELPER_OUTLAY)
--  * photos carry a caption, the time taken and a third phase (DURING = "Underveis")
--  * the timer remembers the first start, the total pause time and "Stopp"
-- The function also checks that the caller is part of the agreement (it did not before).

alter table job_workspaces add column if not exists first_started_at timestamptz;
alter table job_workspaces add column if not exists paused_at timestamptz;
alter table job_workspaces add column if not exists paused_ms bigint not null default 0;
alter table job_workspaces add column if not exists timer_stopped_at timestamptz;

create or replace function update_job_workspace(p_proposal_id uuid, p_action jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_kind text := p_action ->> 'kind';
  v_ws job_workspaces;
  v_who text := nullif(p_action ->> 'who', '');
  v_payer text := coalesce(nullif(p_action ->> 'payer', ''), 'CLIENT');
  v_phase text := coalesce(nullif(p_action ->> 'phase', ''), 'DURING');
begin
  if not exists (select 1 from proposals p
                  where p.id = p_proposal_id
                    and (p.from_profile_id = auth.uid() or p.to_profile_id = auth.uid())) then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if v_who is not null and v_who not in ('CLIENT','HELPER') then v_who := null; end if;
  if v_payer not in ('CLIENT','HELPER','HELPER_OUTLAY') then v_payer := 'CLIENT'; end if;
  if v_phase not in ('BEFORE','AFTER','DURING') then v_phase := 'DURING'; end if;

  insert into job_workspaces (proposal_id) values (p_proposal_id)
  on conflict (proposal_id) do nothing;
  select * into v_ws from job_workspaces where proposal_id = p_proposal_id for update;

  if v_kind = 'addChecklist' then
    update job_workspaces set checklist = checklist || jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid(), 'text', p_action ->> 'text', 'done', false, 'who', v_who))
      where proposal_id = p_proposal_id;
  elsif v_kind = 'setChecklistWho' then
    update job_workspaces set checklist = (
      select coalesce(jsonb_agg(case when c ->> 'id' = p_action ->> 'itemId'
        then jsonb_strip_nulls((c - 'who') || jsonb_build_object('who', v_who)) else c end), '[]'::jsonb)
      from jsonb_array_elements(checklist) c)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'toggleChecklist' then
    update job_workspaces set checklist = (
      select coalesce(jsonb_agg(case when c ->> 'id' = p_action ->> 'itemId'
        then jsonb_set(c, '{done}', to_jsonb(not (c ->> 'done')::boolean)) else c end), '[]'::jsonb)
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
      'amountKr', coalesce((p_action ->> 'amountKr')::numeric, 0), 'payer', v_payer)
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removeMaterial' then
    update job_workspaces set materials = (
      select coalesce(jsonb_agg(m), '[]'::jsonb) from jsonb_array_elements(materials) m
      where m ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'addPhoto' then
    update job_workspaces set photos = photos || jsonb_strip_nulls(jsonb_build_object(
      'id', gen_random_uuid(), 'url', p_action ->> 'url', 'phase', v_phase,
      'caption', nullif(trim(p_action ->> 'caption'), ''), 'at', now()))
      where proposal_id = p_proposal_id;
  elsif v_kind = 'removePhoto' then
    update job_workspaces set photos = (
      select coalesce(jsonb_agg(p), '[]'::jsonb) from jsonb_array_elements(photos) p
      where p ->> 'id' <> p_action ->> 'itemId')
      where proposal_id = p_proposal_id;
  elsif v_kind = 'toggleTimer' then
    if v_ws.timer_started_at is null then
      -- start / continue: a running pause ends here
      update job_workspaces set
        timer_started_at = now(),
        first_started_at = coalesce(first_started_at, now()),
        paused_ms = paused_ms + case when paused_at is null then 0
                                     else (extract(epoch from (now() - paused_at)) * 1000)::bigint end,
        paused_at = null,
        timer_stopped_at = null
        where proposal_id = p_proposal_id;
    else
      -- pause
      update job_workspaces set
        timer_accum_ms = timer_accum_ms + (extract(epoch from (now() - v_ws.timer_started_at)) * 1000)::bigint,
        timer_started_at = null,
        paused_at = now()
        where proposal_id = p_proposal_id;
    end if;
  elsif v_kind = 'stopTimer' then
    update job_workspaces set
      timer_accum_ms = timer_accum_ms + case when timer_started_at is null then 0
                         else (extract(epoch from (now() - timer_started_at)) * 1000)::bigint end,
      timer_started_at = null,
      paused_ms = paused_ms + case when paused_at is null then 0
                                   else (extract(epoch from (now() - paused_at)) * 1000)::bigint end,
      paused_at = null,
      timer_stopped_at = now()
      where proposal_id = p_proposal_id;
  end if;

  update job_workspaces set updated_at = now() where proposal_id = p_proposal_id;
end;
$$;

grant execute on function update_job_workspace(uuid, jsonb) to authenticated;
