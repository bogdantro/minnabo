-- 0055_jobs_and_reviews.sql
-- 1. "Fullførte jobber" on profiles, Meny, Gi tilbud and Sammenlign reads
--    profiles.reliability_completed, but nothing ever counted it (0008 only built
--    the no-show counter), so every profile showed 0.
--     * count an agreement for both parties when the second completion is confirmed
--     * backfill the agreements that are already completed
--     * users can no longer write the reliability counters on their own row
-- 2. submit_review: the version with tags (0010, the one the app calls) lost the
--    checks of the original – anyone could review anyone, before the job was done.
--    The checks are back; the old 3-argument version is dropped. The notification
--    comes from the review_notify trigger only.
-- 3. confirm_completion: a youth account can't give reviews (0038), so it is not
--    asked to – it gets a plain "Oppdrag fullført" that opens the youth app.
--    Confirming a second time no longer sends the notifications again.

create or replace function bump_completed_counter()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_from uuid; v_to uuid;
begin
  -- exactly when the second party confirms (both have confirmed now)
  if (select count(*) from completion_confirmations
       where agreement_proposal_id = new.agreement_proposal_id) <> 2 then
    return new;
  end if;
  select from_profile_id, to_profile_id into v_from, v_to
    from proposals where id = new.agreement_proposal_id;
  update profiles set reliability_completed = reliability_completed + 1
   where id in (v_from, v_to);
  return new;
end $$;
revoke all on function bump_completed_counter() from public, anon, authenticated;

drop trigger if exists t_completed_counter on completion_confirmations;
create trigger t_completed_counter after insert on completion_confirmations
  for each row execute function bump_completed_counter();

-- backfill: every agreement both parties have confirmed, for both parties
update profiles pr
   set reliability_completed = coalesce(c.n, 0)
  from (
    select pid, count(*)::int as n
      from (
        select p.from_profile_id as pid, p.id
          from proposals p
         where (select count(*) from completion_confirmations cc where cc.agreement_proposal_id = p.id) >= 2
        union all
        select p.to_profile_id, p.id
          from proposals p
         where (select count(*) from completion_confirmations cc where cc.agreement_proposal_id = p.id) >= 2
      ) x
     group by pid
  ) c
 where c.pid = pr.id;

-- the counters are written by triggers only (same guard as the moderation columns)
create or replace function guard_moderation_columns() returns trigger
language plpgsql as $$
begin
  if not is_admin() and current_user = 'authenticated' then
    new.suspended_at := old.suspended_at;
    new.role := old.role;
    new.is_business := old.is_business;
    new.youth_age := old.youth_age;
    new.reliability_completed := old.reliability_completed;
    new.reliability_no_shows := old.reliability_no_shows;
  end if;
  return new;
end $$;


-- ---------------------------------------------------------------------------
-- 2. submit_review with its checks back
-- ---------------------------------------------------------------------------
drop function if exists submit_review(uuid, integer, text);

create or replace function submit_review(p_agreement_proposal_id uuid, p_rating integer, p_comment text,
                                         p_tags text[] default '{}')
returns reviews language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_to uuid; v_done int; v_row reviews;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me is null or v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;
  if p_rating is null or p_rating not between 1 and 5 then raise exception 'Velg mellom 1 og 5 stjerner.'; end if;

  select count(*) into v_done from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_done < 2 then raise exception 'Oppdraget er ikke fullført ennå.'; end if;

  if exists (select 1 from reviews
              where agreement_proposal_id = p_agreement_proposal_id and from_profile_id = v_me) then
    raise exception 'Du har allerede vurdert denne avtalen.';
  end if;

  v_to := case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end;
  insert into reviews (agreement_proposal_id, listing_id, from_profile_id, to_profile_id, rating, comment, tags)
  values (p_agreement_proposal_id, p.listing_id, v_me, v_to, p_rating, nullif(p_comment, ''), coalesce(p_tags, '{}'))
  returning * into v_row;

  update listings set status = 'REVIEWED' where id = p.listing_id and status = 'COMPLETED';
  return v_row;
end $$;
revoke all on function submit_review(uuid, integer, text, text[]) from public, anon;
grant execute on function submit_review(uuid, integer, text, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. confirm_completion: no review prompt for youth accounts
-- ---------------------------------------------------------------------------
create or replace function confirm_completion(p_agreement_proposal_id uuid)
returns setof completion_confirmations language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); p proposals; v_both int; v_party uuid; v_new int;
begin
  select * into p from proposals where id = p_agreement_proposal_id;
  if not found then raise exception 'Fant ikke avtalen.'; end if;
  if v_me not in (p.from_profile_id, p.to_profile_id) then raise exception 'Ikke tilgang.'; end if;

  insert into completion_confirmations (agreement_proposal_id, by_profile_id)
    values (p_agreement_proposal_id, v_me)
  on conflict do nothing;
  get diagnostics v_new = row_count;

  -- confirming twice changes nothing and sends nothing again
  if v_new = 0 then
    return query select * from completion_confirmations
      where agreement_proposal_id = p_agreement_proposal_id;
    return;
  end if;

  select count(*) into v_both from completion_confirmations
   where agreement_proposal_id = p_agreement_proposal_id;
  if v_both >= 2 then
    update listings set status = 'COMPLETED' where id = p.listing_id;
    foreach v_party in array array[p.from_profile_id, p.to_profile_id] loop
      if is_youth(v_party) then
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført',
          'Oppdraget er markert som fullført. Bra jobbet!','/ung');
      else
        perform notify(v_party,'REVIEW_RECEIVED','Oppdrag fullført',
          'Oppdraget er markert som fullført. Legg gjerne igjen en vurdering.','/vurder/'||p.id);
      end if;
    end loop;
  else
    perform notify(case when v_me = p.from_profile_id then p.to_profile_id else p.from_profile_id end,
      'COMPLETION_REQUESTED','Bekreft fullføring',
      'Den andre parten markerte oppdraget som fullført.','/fullfor/'||p.id);
  end if;

  return query select * from completion_confirmations
    where agreement_proposal_id = p_agreement_proposal_id;
end $$;
