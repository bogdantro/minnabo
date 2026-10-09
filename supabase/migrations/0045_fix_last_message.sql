-- 0045_fix_last_message.sql
-- Innboks showed the wrong last message.
--
-- Cause: bump_conversation() – the trigger that copies a new message into
-- conversations.last_message_at / last_message_preview – ran with the rights of
-- the person sending. Nobody has an UPDATE policy on conversations, so for an
-- ordinary chat message (inserted straight from the app) the update matched no
-- rows and was silently skipped. Only tilbud and system lines, which are written
-- by SECURITY DEFINER functions, ever moved the preview. The same skipped update
-- is what tells the other person's Innboks to refresh, so that never fired either.
--
-- Fix: the trigger runs as its owner, and every conversation is brought back in
-- step with its real last message.

create or replace function bump_conversation() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversations set
    last_message_at = new.created_at,
    last_message_preview = case new.kind::text
      when 'TEXT' then left(new.text, 120)
      when 'IMAGE' then '📷 Bilde'
      when 'PROPOSAL' then 'Sendte et tilbud'
      else left(coalesce(new.text, ''), 120) end
  where id = new.conversation_id
    -- an older message arriving late (offline outbox) must not replace a newer preview
    and last_message_at <= new.created_at;
  return new;
end $$;

update conversations c set
  last_message_at = m.created_at,
  last_message_preview = case m.kind::text
    when 'TEXT' then left(m.text, 120)
    when 'IMAGE' then '📷 Bilde'
    when 'PROPOSAL' then 'Sendte et tilbud'
    else left(coalesce(m.text, ''), 120) end
from (
  select distinct on (conversation_id) conversation_id, created_at, kind, text
    from messages
   order by conversation_id, created_at desc
) m
where m.conversation_id = c.id
  and c.last_message_at < m.created_at;
