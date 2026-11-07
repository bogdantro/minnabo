-- 0089_chat_replies_archive.sql
--  Asked 2026-11-06, all additive – an older app reads the same rows:
--    * Svar på en melding: messages.reply_to_id (must be in the same conversation).
--    * Slett en melding: your own, for 10 minutes. The text and file go; the bubble says
--      «Meldingen ble slettet» so the conversation still makes sense.
--    * Arkiver en samtale: per person. A new message brings it back to Innboks.
--    * Tekst av talemeldinger: messages.transcript, written by the `transcribe` edge function.
--      Off until platform.transcripts_enabled is true (needs a speech service and a data agreement).

alter table messages add column if not exists reply_to_id uuid references messages(id) on delete set null;
alter table messages add column if not exists deleted_at timestamptz;
alter table messages add column if not exists transcript text;
alter table conversation_participants add column if not exists archived_at timestamptz;

-- The quoted message must be in the same conversation: otherwise an id could leak another chat's text.
create or replace function messages_check_reply() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.reply_to_id is not null and not exists (
    select 1 from messages m where m.id = new.reply_to_id and m.conversation_id = new.conversation_id
  ) then
    raise exception 'Fant ikke meldingen du svarer på.' using errcode = '42501';
  end if;
  return new;
end $$;
drop trigger if exists t_messages_check_reply on messages;
create trigger t_messages_check_reply before insert on messages
  for each row when (new.reply_to_id is not null) execute function messages_check_reply();

create or replace function delete_my_message(p_message_id uuid) returns void
language plpgsql security definer set search_path = public as $$
declare m messages; v_last uuid;
begin
  select * into m from messages where id = p_message_id for update;
  if not found or m.author_id is distinct from auth.uid() then
    raise exception 'Ikke tilgang.' using errcode = '42501';
  end if;
  if m.deleted_at is not null then return; end if;
  if m.kind::text not in ('TEXT', 'IMAGE', 'AUDIO') then
    raise exception 'Denne meldingen kan ikke slettes.';
  end if;
  if m.created_at < now() - interval '10 minutes' then
    raise exception 'Du kan bare slette en melding de første 10 minuttene.';
  end if;

  perform queue_file_purge('chat-attachments', m.attachment_path);
  update messages
     set text = '', attachment_path = null, transcript = null, audio_ms = null,
         reactions = '{}'::jsonb, pinned = false, deleted_at = now()
   where id = m.id;

  -- Innboks must not keep showing a message that is gone
  select id into v_last from messages where conversation_id = m.conversation_id
   order by created_at desc limit 1;
  if v_last = m.id then
    update conversations set last_message_preview = 'Meldingen ble slettet' where id = m.conversation_id;
  end if;
end $$;
revoke all on function delete_my_message(uuid) from public, anon;
grant execute on function delete_my_message(uuid) to authenticated;

create or replace function set_conversation_archived(p_conversation_id uuid, p_archived boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants
     set archived_at = case when p_archived then now() else null end
   where conversation_id = p_conversation_id and profile_id = auth.uid();
  if not found then raise exception 'Ikke tilgang.' using errcode = '42501'; end if;
end $$;
revoke all on function set_conversation_archived(uuid, boolean) from public, anon;
grant execute on function set_conversation_archived(uuid, boolean) to authenticated;

-- A new message is something to read: the conversation comes back for both.
create or replace function messages_unarchive() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  update conversation_participants set archived_at = null
   where conversation_id = new.conversation_id and archived_at is not null;
  return new;
end $$;
drop trigger if exists t_messages_unarchive on messages;
create trigger t_messages_unarchive after insert on messages
  for each row execute function messages_unarchive();

insert into app_settings (key, value) values ('platform.transcripts_enabled', 'false'::jsonb)
on conflict (key) do nothing;
