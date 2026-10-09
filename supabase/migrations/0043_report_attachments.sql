-- 0043_report_attachments.sql
-- Rapporter → "Skjermbilde" (design/screens/Rapporter.dc.html).
-- The file goes in a PRIVATE bucket: only the person who uploaded it and
-- administrators can read it (the other buckets are public-read).

insert into storage.buckets (id, name, public) values
  ('report-attachments', 'report-attachments', false)
on conflict (id) do nothing;

drop policy if exists "report attachments write own" on storage.objects;
create policy "report attachments write own" on storage.objects for insert to authenticated
  with check (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "report attachments read own or admin" on storage.objects;
create policy "report attachments read own or admin" on storage.objects for select to authenticated
  using (bucket_id = 'report-attachments'
         and ((storage.foldername(name))[1] = auth.uid()::text or is_admin()));

drop policy if exists "report attachments delete own" on storage.objects;
create policy "report attachments delete own" on storage.objects for delete to authenticated
  using (bucket_id = 'report-attachments' and (storage.foldername(name))[1] = auth.uid()::text);

alter table reports add column if not exists attachment_path text;

-- The reporter attaches the uploaded file to the report they just sent.
create or replace function set_report_attachment(p_report_id uuid, p_path text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if p_path is null or split_part(p_path, '/', 1) <> auth.uid()::text then
    raise exception 'Ugyldig vedlegg.' using errcode = '42501';
  end if;
  update reports set attachment_path = p_path
   where id = p_report_id and by_profile_id = auth.uid();
  if not found then raise exception 'Fant ikke rapporten.'; end if;
end $$;
grant execute on function set_report_attachment(uuid, text) to authenticated;

-- Adminpanel: which reports have a screenshot.
create or replace function admin_report_attachments()
returns table (report_id uuid, path text)
language plpgsql stable security definer set search_path = public as $$
begin
  perform admin_guard();
  return query select r.id, r.attachment_path from reports r where r.attachment_path is not null;
end $$;
grant execute on function admin_report_attachments() to authenticated;
