-- New #26: message reactions + one pinned message per conversation.

alter table messages
  add column if not exists reactions jsonb not null default '{}'::jsonb,
  add column if not exists pinned boolean not null default false;

-- Only one pinned message per conversation.
create unique index if not exists messages_one_pin_per_conversation
  on messages (conversation_id)
  where pinned;

-- toggle_message_reaction: flip the caller's reaction with a given emoji on a
-- message. reactions is { "<emoji>": ["<profile_id>", ...] }.
create or replace function toggle_message_reaction(
  p_message_id uuid,
  p_emoji text,
  p_profile_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_conversation uuid;
  v_members uuid[];
  v_current jsonb;
  v_people jsonb;
begin
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

grant execute on function toggle_message_reaction(uuid, text, uuid) to authenticated;
