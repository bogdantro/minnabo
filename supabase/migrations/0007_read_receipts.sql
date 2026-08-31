-- New #23: read receipts. Track how far each participant has read in a
-- conversation; the client derives a message's delivery state from the other
-- participant's last_read_at (sent → delivered → read).

alter table conversation_participants
  add column if not exists last_read_at timestamptz not null default 'epoch';

create or replace function mark_conversation_read(p_conversation_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation_id
     and profile_id = auth.uid();
end;
$$;

grant execute on function mark_conversation_read(uuid) to authenticated;
