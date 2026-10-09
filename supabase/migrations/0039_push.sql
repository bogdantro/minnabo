-- 0039_push.sql
-- Push notifications were stored (push_tokens) and configured (notification_prefs)
-- but never sent. Now every new notification row and every new chat message
-- calls the `send-push` edge function through pg_net; the function applies the
-- person's settings (master switch, per-type switches, quiet hours, muted chat)
-- and hands the message to Expo's push service.
--
-- One-time setup after `db push` (SQL editor, values from the Supabase dashboard):
--   insert into app_secrets (key, value) values
--     ('functions_url', 'https://<project-ref>.supabase.co/functions/v1'),
--     ('push_secret',   '<same random string as the PUSH_SECRET function secret>')
--   on conflict (key) do update set value = excluded.value;
-- Until both rows exist nothing is called (the app works as before, without push).

create extension if not exists pg_net with schema extensions;

create table if not exists app_secrets (
  key text primary key,
  value text not null
);
alter table app_secrets enable row level security;
-- no policies: only the service role and security-definer functions can read it

-- "Slå av varsler" in a chat, per person.
alter table conversation_participants add column if not exists muted boolean not null default false;

create or replace function set_conversation_muted(p_conversation_id uuid, p_muted boolean)
returns void language sql security definer set search_path = public as $$
  update conversation_participants set muted = p_muted
   where conversation_id = p_conversation_id and profile_id = auth.uid();
$$;
grant execute on function set_conversation_muted(uuid, boolean) to authenticated;

create or replace function call_send_push(p_body jsonb)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare v_url text; v_secret text;
begin
  select value into v_url from app_secrets where key = 'functions_url';
  select value into v_secret from app_secrets where key = 'push_secret';
  if v_url is null or v_secret is null then return; end if;
  perform net.http_post(
    url := rtrim(v_url, '/') || '/send-push',
    body := p_body,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret));
exception when others then
  -- a push that can't be queued must never block the write that caused it
  null;
end $$;
revoke all on function call_send_push(jsonb) from public, anon, authenticated;

create or replace function push_on_notification() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform call_send_push(jsonb_build_object('type', 'notification', 'id', new.id));
  return new;
end $$;
drop trigger if exists t_notifications_push on notifications;
create trigger t_notifications_push after insert on notifications
  for each row execute function push_on_notification();

create or replace function push_on_message() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  -- tilbud and system lines already produce a notification row of their own
  if new.kind::text in ('TEXT', 'IMAGE') then
    perform call_send_push(jsonb_build_object('type', 'message', 'id', new.id));
  end if;
  return new;
end $$;
drop trigger if exists t_messages_push on messages;
create trigger t_messages_push after insert on messages
  for each row execute function push_on_message();
