-- 0080_neighbourhood_highlights.sql
-- «Mest hjelpsomme denne måneden» on Nabolag: up to three neighbours in a kommune
-- who finished the most jobs as the helper this calendar month.
--
-- Opt-in only: nobody is shown unless they turned on «Vis meg blant de mest
-- hjelpsomme» under Personvern (highlight_opt_in, off by default). Youth accounts
-- are never ranked, and neither is anyone the viewer has blocked (or who blocked
-- the viewer). Only the profile id and the number of jobs leave the database; the
-- app shows the name and photo from the public profile like everywhere else.

alter table profiles add column if not exists highlight_opt_in boolean not null default false;

create or replace function neighbourhood_highlights(p_municipality text) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('profileId', x.id, 'jobs', x.n) order by x.n desc, x.last_at desc), '[]'::jsonb)
    from (
      select p.id, count(*)::int as n, max(c.done_at) as last_at
        from profiles p
        -- the helper is always the one who sent the accepted tilbud (oppdrag and «Tilbyr hjelp» alike)
        join proposals pr on pr.from_profile_id = p.id and pr.status::text = 'ACCEPTED'
        join lateral (
          select max(cc.confirmed_at) as done_at, count(*) as k
            from completion_confirmations cc
           where cc.agreement_proposal_id = pr.id
        ) c on c.k >= 2
       where p.highlight_opt_in
         and p.municipality = p_municipality
         and p.deleted_at is null
         and p.suspended_at is null
         and p.youth_age is null
         and c.done_at >= (date_trunc('month', now() at time zone 'Europe/Oslo') at time zone 'Europe/Oslo')
         and not exists (select 1 from blocks b
                          where (b.by_profile_id = auth.uid() and b.blocked_profile_id = p.id)
                             or (b.by_profile_id = p.id and b.blocked_profile_id = auth.uid()))
       group by p.id
       order by n desc, last_at desc
       limit 3
    ) x;
$$;
revoke all on function neighbourhood_highlights(text) from public, anon;
grant execute on function neighbourhood_highlights(text) to authenticated;
