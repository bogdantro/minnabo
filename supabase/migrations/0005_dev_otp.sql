-- 0005_dev_otp.sql — DEV / TEST ONLY.
--
-- Lets the login screen display the email one-time code so you can test the
-- signup / login flow without receiving an actual email. The code is written
-- here by the `auth-email` Send Email Hook (supabase/functions/auth-email).
--
-- SECURITY: this only ever holds data on a project where that hook is
-- registered. DO NOT register the auth-email hook on a production project.
-- The table stays empty in prod and `get_dev_otp` returns null.

create table if not exists dev_otp_codes (
  email text primary key,
  code text not null,
  created_at timestamptz not null default now()
);

alter table dev_otp_codes enable row level security;

drop policy if exists dev_otp_read on dev_otp_codes;
create policy dev_otp_read on dev_otp_codes
  for select to anon, authenticated using (true);

create or replace function get_dev_otp(p_email text)
returns text
language sql
security definer
set search_path = public
as $$
  delete from dev_otp_codes where created_at < now() - interval '15 minutes';
  select code from dev_otp_codes
   where email = lower(p_email)
     and created_at > now() - interval '15 minutes'
   limit 1;
$$;

-- callable without a session (during signup the user isn't authenticated yet)
grant execute on function get_dev_otp(text) to anon, authenticated;

create or replace function set_dev_otp(p_email text, p_code text)
returns void
language sql
security definer
set search_path = public
as $$
  insert into dev_otp_codes (email, code, created_at)
  values (lower(p_email), p_code, now())
  on conflict (email) do update set code = excluded.code, created_at = now();
$$;

revoke execute on function set_dev_otp(text, text) from anon, authenticated;
