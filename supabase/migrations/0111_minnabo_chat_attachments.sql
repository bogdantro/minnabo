-- 0111_minnabo_chat_attachments.sql
--  Asked 2026-11-16: a message from MinNabo (Admin › Chats on the website) can carry up to three attachments:
--    - a button to a place in the app («Velg kommune», «Bli med i et nabolag», «Se Fellesskap», a tab, …),
--    - a business (a partner card that opens the partner's page),
--    - one nabolag or one lag (a card that opens it).
--  The website writes them; the app reads them in minnabo_thread() with the names filled in, so a renamed
--  partner or nabolag shows its new name, and a hidden one (unpaid partner, inactive nabolag/lag) is simply left out.
--  Route keys are checked for shape only: the app maps each key to a screen and ignores keys it doesn't know,
--  so a newer website never breaks an older app.

-- ---------------------------------------------------------------------------
-- 1. Columns
-- ---------------------------------------------------------------------------
alter table minnabo_messages add column if not exists actions jsonb not null default '[]'::jsonb;
alter table minnabo_broadcasts add column if not exists actions jsonb not null default '[]'::jsonb;

-- ---------------------------------------------------------------------------
-- 2. Checking what the website sends
-- ---------------------------------------------------------------------------
-- [{"type": "route", "key": "fellesskap", "label": "Se Fellesskap"}, {"type": "partner", "id": "<uuid>"}, …]
-- label is optional (the app has a default per key); at most 3; the same thing twice is refused.
create or replace function minnabo_clean_actions(p_actions jsonb) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare e jsonb; out jsonb := '[]'::jsonb; v_type text; v_label text; v_id uuid; v_key text;
begin
  if p_actions is null or p_actions = 'null'::jsonb then return out; end if;
  if jsonb_typeof(p_actions) <> 'array' then raise exception 'Vedleggene har feil format.'; end if;
  if jsonb_array_length(p_actions) > 3 then raise exception 'En melding kan ha høyst 3 vedlegg.'; end if;
  for e in select * from jsonb_array_elements(p_actions) loop
    v_type := e->>'type';
    v_label := nullif(btrim(coalesce(e->>'label', '')), '');
    if v_label is not null and char_length(v_label) > 40 then raise exception 'Teksten på en knapp kan ha høyst 40 tegn.'; end if;
    if v_type = 'route' then
      v_key := e->>'key';
      if v_key is null or v_key !~ '^[a-z_]{2,30}$' then raise exception 'Ukjent sted i appen.'; end if;
      e := jsonb_build_object('type', 'route', 'key', v_key);
    elsif v_type in ('partner', 'nabolag', 'lag') then
      begin
        v_id := (e->>'id')::uuid;
      exception when others then
        raise exception 'Vedlegget mangler en gyldig id.';
      end;
      if v_type = 'partner' and not exists (select 1 from partners where id = v_id) then raise exception 'Fant ikke bedriften.'; end if;
      if v_type = 'nabolag' and not exists (select 1 from neighbourhoods where id = v_id) then raise exception 'Fant ikke nabolaget.'; end if;
      if v_type = 'lag' and not exists (select 1 from organisations where id = v_id) then raise exception 'Fant ikke laget.'; end if;
      e := jsonb_build_object('type', v_type, 'id', v_id);
    else
      raise exception 'Ukjent type vedlegg.';
    end if;
    if v_label is not null then e := e || jsonb_build_object('label', v_label); end if;
    if exists (select 1 from jsonb_array_elements(out) o where o - 'label' = e - 'label') then
      raise exception 'Det samme vedlegget er med to ganger.';
    end if;
    out := out || jsonb_build_array(e);
  end loop;
  return out;
end $$;
revoke all on function minnabo_clean_actions(jsonb) from public, anon, authenticated;

-- What the app gets: names, places and logos filled in; anything hidden since is left out.
create or replace function minnabo_resolve_actions(p_actions jsonb) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(r.v order by r.i), '[]'::jsonb) from (
    select a.i, case a.e->>'type'
      when 'route' then a.e
      when 'partner' then (select a.e || jsonb_build_object('name', p.name, 'sub', p.blurb, 'logo', p.logo_path)
                             from partners_public p where p.id = (a.e->>'id')::uuid)
      when 'nabolag' then (select a.e || jsonb_build_object('name', n.name, 'place', coalesce(n.place, n.name), 'sub', n.municipality)
                             from neighbourhoods n where n.id = (a.e->>'id')::uuid and n.active)
      when 'lag' then (select a.e || jsonb_build_object('name', o.name, 'sub', o.municipality, 'logo', o.logo_path)
                         from organisations o where o.id = (a.e->>'id')::uuid and o.active)
    end as v
      from jsonb_array_elements(coalesce(p_actions, '[]'::jsonb)) with ordinality as a(e, i)
  ) r where r.v is not null;
$$;
revoke all on function minnabo_resolve_actions(jsonb) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- 3. Sending (the old signatures go: the new last argument has a default, so the website's
--    named-argument calls keep working until it is deployed)
-- ---------------------------------------------------------------------------
drop function if exists minnabo_send_message(uuid, text, text);
create or replace function minnabo_send_message(p_profile uuid, p_body text, p_staff text default null, p_actions jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_body text := btrim(coalesce(p_body, ''));
begin
  if not exists (select 1 from profiles where id = p_profile and deleted_at is null) then
    raise exception 'Fant ikke brukeren.';
  end if;
  insert into minnabo_messages (profile_id, from_admin, staff, body, actions)
    values (p_profile, true, p_staff, v_body, minnabo_clean_actions(p_actions)) returning id into v_id;
  perform notify_moderation(p_profile, 'Melding fra MinNabo', left(v_body, 140), '/minnabo');
  return v_id;
end $$;
revoke all on function minnabo_send_message(uuid, text, text, jsonb) from public, anon, authenticated;

drop function if exists minnabo_send_broadcast(text, text, text, text[], jsonb, text, timestamptz);
create or replace function minnabo_send_broadcast(
  p_kind text, p_title text, p_body text, p_options text[] default null,
  p_audience jsonb default '{}'::jsonb, p_staff text default null, p_closes_at timestamptz default null,
  p_actions jsonb default null)
returns uuid language plpgsql security definer set search_path = public as $$
declare v_id uuid; v_n int; v_body text := btrim(coalesce(p_body, '')); v_title text := nullif(btrim(coalesce(p_title, '')), '');
        v_actions jsonb := minnabo_clean_actions(p_actions);
begin
  if p_kind = 'NEWS' and v_title is null then raise exception 'En nyhet må ha en tittel.'; end if;
  insert into minnabo_broadcasts (kind, title, body, poll_options, poll_closes_at, audience, created_by, actions)
    values (p_kind, v_title, v_body, case when p_kind = 'POLL' then p_options end,
            case when p_kind = 'POLL' then p_closes_at end, coalesce(p_audience, '{}'::jsonb), p_staff, v_actions)
    returning id into v_id;

  insert into minnabo_messages (profile_id, from_admin, staff, body, broadcast_id, actions)
    select a, true, p_staff, v_body, v_id, v_actions from minnabo_audience(p_audience) a;
  get diagnostics v_n = row_count;
  update minnabo_broadcasts set recipients = v_n where id = v_id;

  insert into notifications (profile_id, kind, title, body, route)
    select m.profile_id, 'MODERATION',
           case p_kind when 'POLL' then 'Spørsmål fra MinNabo' when 'NEWS' then coalesce(v_title, 'Nytt fra MinNabo') else 'Melding fra MinNabo' end,
           left(v_body, 140), '/minnabo'
      from minnabo_messages m where m.broadcast_id = v_id;
  return v_id;
end $$;
revoke all on function minnabo_send_broadcast(text, text, text, text[], jsonb, text, timestamptz, jsonb) from public, anon, authenticated;

-- The admin's list of utsendelser shows what was attached (new column last, so the view can be replaced).
create or replace view minnabo_broadcast_stats as
select b.id, b.kind, b.title, b.body, b.poll_options, b.poll_closes_at, b.audience, b.created_by, b.created_at,
       b.recipients,
       (select count(*)::int from minnabo_messages m where m.broadcast_id = b.id and m.read_at is not null) as read_count,
       (select count(*)::int from minnabo_messages m where m.reply_to_broadcast_id = b.id) as reply_count,
       (select count(*)::int from minnabo_poll_votes v where v.broadcast_id = b.id) as vote_count,
       case when b.kind = 'POLL' then
         (select array_agg((select count(*)::int from minnabo_poll_votes v where v.broadcast_id = b.id and v.option = o.i) order by o.i)
            from generate_series(1, array_length(b.poll_options, 1)) as o(i))
       end as votes,
       b.actions
  from minnabo_broadcasts b;
revoke all on minnabo_broadcast_stats from anon, authenticated, public;

-- ---------------------------------------------------------------------------
-- 4. The app's thread, now with "attachments"
-- ---------------------------------------------------------------------------
create or replace function minnabo_thread()
returns json language sql stable security definer set search_path = public as $$
  select coalesce(json_agg(t order by t."createdAt"), '[]'::json) from (
    select m.id, m.from_admin as "fromAdmin", m.body, m.created_at as "createdAt", m.read_at as "readAt",
           b.id as "broadcastId", coalesce(b.kind, 'MESSAGE') as kind, b.title,
           b.poll_options as "pollOptions",
           (b.poll_closes_at is not null and b.poll_closes_at <= now()) as "pollClosed",
           v.option as "myVote",
           case when b.kind = 'POLL' and (v.option is not null or (b.poll_closes_at is not null and b.poll_closes_at <= now())) then
             (select array_agg((select count(*)::int from minnabo_poll_votes x where x.broadcast_id = b.id and x.option = o.i) order by o.i)
                from generate_series(1, array_length(b.poll_options, 1)) as o(i))
           end as "pollCounts",
           minnabo_resolve_actions(m.actions) as attachments
      from minnabo_messages m
      left join minnabo_broadcasts b on b.id = m.broadcast_id
      left join minnabo_poll_votes v on v.broadcast_id = b.id and v.profile_id = m.profile_id
     where m.profile_id = auth.uid()
  ) t;
$$;
