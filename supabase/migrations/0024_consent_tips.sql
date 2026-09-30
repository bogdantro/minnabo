-- Optional "Send meg tips om nye oppdrag i nærheten" consent (Samtykke screen).
-- Additive: existing rows default to false.
alter table consent_records add column if not exists tips boolean not null default false;
