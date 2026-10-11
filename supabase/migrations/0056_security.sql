-- 0056_security.sql
-- Postgres lets PUBLIC (so also anon and authenticated over the API) execute a new
-- function unless it is revoked. Three SECURITY DEFINER functions were open:
--  * notify(...)            anyone, even signed out, could send any user a notification
--                           (and a push) with any title, text and link
--  * report_target_text/owner  showed the start of any message, tilbud or review to
--                           anyone who had its id – only the admin functions need them
--  * toggle_message_reaction  took the reacting person's id as an argument without
--                           checking it was the caller, so one could react as someone else
-- The callers inside the database are SECURITY DEFINER functions owned by postgres and
-- keep working after the revokes.

revoke all on function notify(uuid, notification_kind, text, text, text) from public, anon, authenticated;
revoke all on function report_target_text(report_target, text) from public, anon, authenticated;
revoke all on function report_target_owner(report_target, text) from public, anon, authenticated;

create or replace function toggle_message_reaction(p_message_id uuid, p_emoji text, p_profile_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_conversation uuid;
  v_members uuid[];
  v_current jsonb;
  v_people jsonb;
begin
  -- you can only react as yourself
  if auth.uid() is null or p_profile_id is distinct from auth.uid() then
    raise exception 'Ikke tilgang.';
  end if;

  select conversation_id into v_conversation from messages where id = p_message_id;
  if v_conversation is null then
    raise exception 'Fant ikke meldingen.';
  end if;

  select array_agg(profile_id) into v_members
  from conversation_participants where conversation_id = v_conversation;

  if not (p_profile_id = any (v_members)) then
    raise exception 'Ikke tilgang.';
  end if;

  select reactions into v_current from messages where id = p_message_id for update;
  v_people := coalesce(v_current -> p_emoji, '[]'::jsonb);

  if v_people @> to_jsonb(p_profile_id::text) then
    v_people := (select coalesce(jsonb_agg(x), '[]'::jsonb)
                 from jsonb_array_elements(v_people) x
                 where x <> to_jsonb(p_profile_id::text));
  else
    v_people := v_people || to_jsonb(p_profile_id::text);
  end if;

  if jsonb_array_length(v_people) = 0 then
    v_current := v_current - p_emoji;
  else
    v_current := jsonb_set(v_current, array[p_emoji], v_people, true);
  end if;

  update messages set reactions = v_current where id = p_message_id;
  return v_current;
end;
$$;
revoke all on function toggle_message_reaction(uuid, text, uuid) from public, anon;
grant execute on function toggle_message_reaction(uuid, text, uuid) to authenticated;
