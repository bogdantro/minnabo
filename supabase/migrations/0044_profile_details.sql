-- 0044_profile_details.sql
-- Profil (design/screens/Profil.dc.html):
--  * presentation pills: languages, "Har bil", when you are available
--  * Pålitelighet: "Møter opp", "Presis", "Fullfører" over the last 12 months
--  * "Svar fra …" – the person reviewed can answer a review once, publicly
--  * Portefølje as before/after pairs with title, place and caption

alter table profiles add column if not exists languages text[] not null default '{}';
alter table profiles add column if not exists has_car boolean not null default false;
alter table profiles add column if not exists availability_text text;

-- ---------------------------------------------------------------------------
-- reliability
-- ---------------------------------------------------------------------------
alter table agreement_snapshots add column if not exists cancelled_by uuid references profiles(id) on delete set null;

create or replace function agreement_cancelled_by() returns trigger
language plpgsql as $$
begin
  if new.cancelled_at is not null and old.cancelled_at is null then
    new.cancelled_by := auth.uid();
  end if;
  return new;
end $$;
drop trigger if exists t_agreement_cancelled_by on agreement_snapshots;
create trigger t_agreement_cancelled_by before update of cancelled_at on agreement_snapshots
  for each row execute function agreement_cancelled_by();

-- Percentages are null until there are at least 3 agreements to judge from.
--   showsUp   : agreements without a no-show report against the person
--   onTime    : as helper, the Jobbdag timer was started no later than 15 min after the agreed time
--   completes : agreements both parties confirmed, of those confirmed or called off by the person
create or replace function profile_reliability(p_profile_id uuid)
returns json language sql stable security definer set search_path = public as $$
  with mine as (
    select a.proposal_id, a.cancelled_at, a.cancelled_by, a.scheduled_at,
           p.from_profile_id = p_profile_id as is_helper,
           (select count(*) from completion_confirmations c where c.agreement_proposal_id = a.proposal_id) >= 2 as done,
           exists (select 1 from no_show_reports n
                    where n.agreement_proposal_id = a.proposal_id and n.reported_id = p_profile_id) as no_show,
           (select w.first_started_at from job_workspaces w where w.proposal_id = a.proposal_id) as started_at
      from agreement_snapshots a
      join proposals p on p.id = a.proposal_id
     where (p.from_profile_id = p_profile_id or p.to_profile_id = p_profile_id)
       and a.agreed_at > now() - interval '12 months'
  ), s as (
    select count(*) filter (where done) as completed,
           count(*) filter (where done or no_show) as judged,
           count(*) filter (where no_show) as no_shows,
           count(*) filter (where is_helper and scheduled_at is not null and started_at is not null) as timed,
           count(*) filter (where is_helper and scheduled_at is not null and started_at is not null
                              and started_at <= scheduled_at + interval '15 minutes') as on_time,
           count(*) filter (where done or cancelled_by = p_profile_id) as ended,
           count(*) filter (where cancelled_by = p_profile_id) as called_off
      from mine
  )
  select json_build_object(
    'completed', completed,
    'showsUp',   case when judged >= 3 then round(100.0 * (judged - no_shows) / judged)::int end,
    'onTime',    case when timed  >= 3 then round(100.0 * on_time / timed)::int end,
    'completes', case when ended  >= 3 then round(100.0 * (ended - called_off) / ended)::int end)
    from s;
$$;
grant execute on function profile_reliability(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- reply to a review
-- ---------------------------------------------------------------------------
alter table reviews add column if not exists reply text;
alter table reviews add column if not exists replied_at timestamptz;

create or replace function reply_to_review(p_review_id uuid, p_text text)
returns reviews language plpgsql security definer set search_path = public as $$
declare r reviews; v_text text := trim(coalesce(p_text, ''));
begin
  select * into r from reviews where id = p_review_id for update;
  if not found or r.to_profile_id <> auth.uid() then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
  if exists (select 1 from profiles where id = auth.uid() and suspended_at is not null) then
    raise exception 'Kontoen din er suspendert. Kontakt MinNabo.' using errcode = '42501';
  end if;
  if length(v_text) < 2 then raise exception 'Skriv et svar.'; end if;
  if length(v_text) > 400 then raise exception 'Svaret kan ha høyst 400 tegn.'; end if;
  update reviews set reply = v_text, replied_at = now() where id = r.id returning * into r;
  return r;
end $$;
grant execute on function reply_to_review(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- portfolio: before / after pairs
-- ---------------------------------------------------------------------------
create table if not exists portfolio_items (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  before_path text,
  after_path text not null,
  title text not null,
  place text,
  caption text,
  category_slug text,
  done_at date,
  created_at timestamptz not null default now()
);
create index if not exists portfolio_items_profile_idx on portfolio_items (profile_id, created_at desc);
alter table portfolio_items enable row level security;
drop policy if exists p_portfolio_read on portfolio_items;
create policy p_portfolio_read on portfolio_items for select to authenticated using (true);
drop policy if exists p_portfolio_own on portfolio_items;
create policy p_portfolio_own on portfolio_items for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- photos already on a profile become "after only" items so nothing disappears
insert into portfolio_items (profile_id, after_path, title)
  select p.id, x.path, 'Tidligere jobb'
    from profiles p, unnest(p.portfolio) as x(path)
   where coalesce(array_length(p.portfolio, 1), 0) > 0
     and not exists (select 1 from portfolio_items i where i.profile_id = p.id);
