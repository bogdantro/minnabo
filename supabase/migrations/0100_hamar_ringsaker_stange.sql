-- 0100_hamar_ringsaker_stange.sql
--  Asked 2026-11-10: Hamar, Ringsaker and Stange count as one area, like Lillehammer, Øyer and Gausdal (0085).
--  Someone in any of the three sees oppdrag and «Tilbyr hjelp» from all three, even on «Bare min kommune»,
--  and gets the «nytt i kommunen» push for them. The app does the same: KOMMUNE_GROUPS in src/data/kommuner.ts.

create or replace function kommune_group(p_kommune text) returns text[]
language sql immutable as $$
  select case
    when p_kommune in ('Lillehammer', 'Øyer', 'Gausdal') then array['Lillehammer', 'Øyer', 'Gausdal']
    when p_kommune in ('Hamar', 'Ringsaker', 'Stange') then array['Hamar', 'Ringsaker', 'Stange']
    else array[p_kommune]
  end;
$$;
