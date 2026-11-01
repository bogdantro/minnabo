-- 0075_no_show_moderation.sql
--  The website's admin decides explained no-shows (Admin › Uteblitt in minnaboweb).
--  0074's decide_no_show checked is_admin(), which needs an app login (auth.uid()) – the
--  website talks to Postgres directly and has none. Same split as the other moderation
--  functions (0054):
--    * moderation_decide_no_show – the work, no login check, callable by the website only
--    * decide_no_show            – the same for an app admin, behind admin_guard()
--  The helper is told with a MODERATION notification, so the website's «Angre» (which
--  deletes the notifications an action created) also takes the message back.
--
--  Also: helper functions from 0074 that app users never need to call get their default
--  grant taken away (Supabase gives new functions to anon/authenticated).

create or replace function public.moderation_decide_no_show(p_id uuid, p_counts boolean)
returns void language plpgsql security definer set search_path = public as $$
declare n no_show_reports;
begin
  update no_show_reports set status = case when p_counts then 'COUNTED' else 'DISMISSED' end, decided_at = now()
   where id = p_id returning * into n;
  if not found then raise exception 'Fant ikke saken.'; end if;
  perform notify_moderation(n.reported_id, 'MinNabo har sett på saken',
    case when p_counts then 'Meldingen om at du uteble står ved lag.' else 'Meldingen om at du uteble er fjernet.' end,
    '/uteblitt/' || n.id);
end $$;
revoke all on function public.moderation_decide_no_show(uuid, boolean) from public, anon, authenticated;

create or replace function public.decide_no_show(p_id uuid, p_counts boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform admin_guard();
  perform moderation_decide_no_show(p_id, p_counts);
end $$;
revoke all on function public.decide_no_show(uuid, boolean) from public, anon;
grant execute on function public.decide_no_show(uuid, boolean) to authenticated;

-- 0074 helpers that only other functions call
revoke all on function public.first_name(uuid) from public, anon, authenticated;
revoke all on function public.refresh_no_show_count(uuid) from public, anon, authenticated;
revoke all on function public.tilbud_pause_until(uuid) from public, anon, authenticated;
revoke all on function public.end_of_oslo_day() from public, anon, authenticated;
