-- 0104_lend_reply_and_busy_days.sql
--  Utlån redesign (asked 2026-11-13):
--   * The owner can add a short reply when answering a request («Hentes i garasjen etter kl. 17»). There is no
--     chat for utlån (chats belong to an oppdrag), so this is how pickup is agreed. Shown to the borrower, and in the push.
--   * The days a thing is already lent out, so a borrower picks free days. Dates only – never who borrowed it.

alter table lend_requests add column if not exists reply text check (reply is null or char_length(reply) <= 300);

drop function if exists respond_lend(uuid, text);
create or replace function respond_lend(p_id uuid, p_status text, p_reply text default null) returns lend_requests
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); r lend_requests; i lend_items; v_reply text := nullif(left(btrim(coalesce(p_reply, '')), 300), '');
begin
  select * into r from lend_requests where id = p_id for update;
  if not found then raise exception 'Fant ikke forespørselen.'; end if;
  select * into i from lend_items where id = r.item_id;
  if p_status = 'CANCELLED' then
    if r.borrower_id <> v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
    if r.status not in ('PENDING', 'ACCEPTED') then raise exception 'Forespørselen er allerede avsluttet.'; end if;
    v_reply := null;
  elsif p_status in ('ACCEPTED','DECLINED') then
    if i.owner_id <> v_me then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
    if r.status <> 'PENDING' then raise exception 'Forespørselen er allerede besvart.'; end if;
    if p_status = 'ACCEPTED' and exists (select 1 from lend_requests x where x.item_id = r.item_id and x.id <> r.id and x.status = 'ACCEPTED'
        and daterange(x.from_date, x.to_date, '[]') && daterange(r.from_date, r.to_date, '[]')) then
      raise exception 'Den er allerede lånt ut noen av de dagene.';
    end if;
  else
    raise exception 'Ugyldig svar.';
  end if;
  update lend_requests set status = p_status, reply = coalesce(v_reply, reply) where id = p_id returning * into r;
  if p_status in ('ACCEPTED','DECLINED') then
    insert into notifications (profile_id, kind, title, body, route)
      values (r.borrower_id, 'NOTICE_REPLY'::text::notification_kind,
              case when p_status = 'ACCEPTED' then 'Du kan låne ' || i.title else coalesce(first_name(v_me), 'Naboen') || ' kan ikke låne ut ' || i.title || ' da' end,
              to_char(r.from_date, 'DD.MM') || '–' || to_char(r.to_date, 'DD.MM') || coalesce(' · «' || v_reply || '»', ''),
              '/utlan?fane=foresporsler');
  end if;
  return r;
end $$;
revoke all on function respond_lend(uuid, text, text) from public, anon;
grant execute on function respond_lend(uuid, text, text) to authenticated;

-- the days an active thing is lent out from today on: only the dates, never who borrowed it
create or replace function lend_busy_days(p_item uuid) returns table (from_date date, to_date date)
language sql stable security definer set search_path = public as $$
  select r.from_date, r.to_date
    from lend_requests r join lend_items i on i.id = r.item_id
   where r.item_id = p_item and r.status = 'ACCEPTED' and r.to_date >= current_date
     and auth.uid() is not null and (i.active or i.owner_id = auth.uid())
   order by r.from_date;
$$;
revoke all on function lend_busy_days(uuid) from public, anon;
grant execute on function lend_busy_days(uuid) to authenticated;
