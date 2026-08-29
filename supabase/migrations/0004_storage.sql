-- 0004_storage.sql — Storage buckets + object policies (spec §7)
-- All three buckets are public-read; privacy of a file's *reference* is enforced
-- by RLS on the row (listing_images / messages) that holds the path.

insert into storage.buckets (id, name, public) values
  ('avatars','avatars', true),
  ('listing-images','listing-images', true),
  ('chat-attachments','chat-attachments', true)
on conflict (id) do nothing;

create policy "storage read" on storage.objects for select to authenticated
  using (bucket_id in ('avatars','listing-images','chat-attachments'));

create policy "storage write own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars','listing-images','chat-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage update own folder" on storage.objects for update to authenticated
  using (
    bucket_id in ('avatars','listing-images','chat-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "storage delete own folder" on storage.objects for delete to authenticated
  using (
    bucket_id in ('avatars','listing-images','chat-attachments')
    and (storage.foldername(name))[1] = auth.uid()::text
  );
