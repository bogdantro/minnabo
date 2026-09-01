-- New #36: helper portfolio — before/after photos on the profile.
alter table profiles
  add column if not exists portfolio text[] not null default '{}';
