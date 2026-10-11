-- 0058_private_chat_photos.sql
-- Chat photos were in a public bucket: anyone with the link could open them without
-- logging in. The bucket is now private; the app shows photos through signed links.
--  * a chat photo can be read by the person who uploaded it and by the people in a
--    conversation that has a message with that photo
--  * messages.attachment_path holds the storage path ("<user id>/<file>.jpg").
--    Earlier messages stored the full public link – those are converted, and links
--    sent by older app builds are converted when the message is saved.

update storage.buckets set public = false where id = 'chat-attachments';

-- full public link → path inside the bucket
create or replace function chat_attachment_path(p text) returns text
language sql immutable as $$
  select case
    when p is null then null
    when position('/storage/v1/object/public/chat-attachments/' in p) > 0
      then substring(p from position('/storage/v1/object/public/chat-attachments/' in p)
                            + length('/storage/v1/object/public/chat-attachments/'))
    else p
  end;
$$;

update messages set attachment_path = chat_attachment_path(attachment_path)
 where attachment_path like '%/storage/v1/object/public/chat-attachments/%';

create or replace function normalize_chat_attachment() returns trigger
language plpgsql as $$
begin
  new.attachment_path := chat_attachment_path(new.attachment_path);
  return new;
end $$;
drop trigger if exists t_normalize_chat_attachment on messages;
create trigger t_normalize_chat_attachment before insert or update of attachment_path on messages
  for each row execute function normalize_chat_attachment();

-- who may read a chat photo (security definer: storage policies run as the caller)
create or replace function can_read_chat_attachment(p_name text) returns boolean
language sql stable security definer set search_path = public as $$
  select auth.uid() is not null and (
    split_part(p_name, '/', 1) = auth.uid()::text
    or exists (select 1 from messages m
                where m.attachment_path = p_name
                  and is_participant(m.conversation_id))
  );
$$;
revoke all on function can_read_chat_attachment(text) from public, anon;
grant execute on function can_read_chat_attachment(text) to authenticated;

-- reading: avatars and oppdrag photos stay readable for signed-in users; chat photos
-- only for the conversation
drop policy if exists "storage read" on storage.objects;
create policy "storage read public buckets" on storage.objects for select to authenticated
  using (bucket_id in ('avatars', 'listing-images'));
create policy "chat attachments read" on storage.objects for select to authenticated
  using (bucket_id = 'chat-attachments' and public.can_read_chat_attachment(name));
