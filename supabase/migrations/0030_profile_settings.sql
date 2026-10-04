-- Innstillinger / Varslinger: private per-user settings.
-- Kept out of `profiles` because profiles are readable by every signed-in user.

create table if not exists profile_settings (
  profile_id uuid primary key references profiles(id) on delete cascade,
  email text,
  -- { master, channels:{push,email}, push:{key:bool}, email:{key:bool}, quiet:{on,from,to} }
  notification_prefs jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);

alter table profile_settings enable row level security;

drop policy if exists p_settings_own on profile_settings;
create policy p_settings_own on profile_settings for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

-- Expo push tokens, one row per device.
create table if not exists push_tokens (
  token text primary key,
  profile_id uuid not null references profiles(id) on delete cascade,
  platform text not null check (platform in ('ios', 'android', 'web')),
  updated_at timestamptz not null default now()
);
create index if not exists push_tokens_profile_idx on push_tokens (profile_id);

alter table push_tokens enable row level security;

drop policy if exists p_push_tokens_own on push_tokens;
create policy p_push_tokens_own on push_tokens for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
