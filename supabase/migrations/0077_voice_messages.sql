-- 0077_voice_messages.sql
-- Talemeldinger in the chat: some neighbours (often the older ones) find it far
-- easier to say something than to type it.
--
-- A voice message is a message of kind AUDIO whose sound file lives in the same
-- private chat-attachments bucket as chat photos (0058), so the existing
-- "who may read this file" rule covers it: only the people in the conversation.
-- audio_ms is the length, so the bubble can show «0:12» before anything is loaded.

alter type message_kind add value if not exists 'AUDIO';

-- Longest recording the app allows is 2 minutes; a little slack for rounding.
alter table messages add column if not exists audio_ms int
  check (audio_ms is null or audio_ms between 0 and 180000);

-- Sending straight from the app: text, photo or voice. A voice message must carry
-- its file and its length. (kind::text, because the new enum value can't be used
-- as a literal in the same transaction that adds it.)
drop policy if exists p_msg_ins on messages;
create policy p_msg_ins on messages for insert to authenticated
  with check (is_participant(conversation_id)
              and author_id = auth.uid()
              and kind::text in ('TEXT', 'IMAGE', 'AUDIO')
              and (kind::text <> 'AUDIO' or (attachment_path is not null and audio_ms is not null)));

-- Innboks preview
create or replace function bump_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = case new.kind::text
      when 'TEXT' then left(new.text, 120)
      when 'IMAGE' then '📷 Bilde'
      when 'AUDIO' then '🎤 Talemelding'
      when 'PROPOSAL' then 'Sendte et tilbud'
      else left(coalesce(new.text, ''), 120) end
  where id = new.conversation_id
    -- an older message arriving late (offline outbox) must not replace a newer preview
    and last_message_at <= new.created_at;
  return new;
end $$;

-- A voice message gets a push like any other message
create or replace function push_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- tilbud and system lines already produce a notification row of their own
  if new.kind::text in ('TEXT', 'IMAGE', 'AUDIO') then
    perform call_send_push(jsonb_build_object('type', 'message', 'id', new.id));
  end if;
  return new;
end $$;

-- ... and counts towards the 10-messages-in-10-seconds flood limit
create or replace function message_rate_guard() returns trigger
language plpgsql as $$
declare v_recent int;
begin
  if new.kind::text in ('TEXT', 'IMAGE', 'AUDIO') then
    select count(*) into v_recent from messages
     where author_id = new.author_id and created_at > now() - interval '10 seconds';
    perform rate_check(v_recent, 10, 'meldinger');
  end if;
  return new;
end $$;
