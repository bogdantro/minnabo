-- New #43 (dugnad mode) + #3 (recurring tasks).

do $$ begin
  create type task_recurrence as enum ('WEEKLY', 'BIWEEKLY', 'MONTHLY');
exception when duplicate_object then null; end $$;

alter table task_details
  add column if not exists is_dugnad boolean not null default false,
  add column if not exists recurrence task_recurrence;
