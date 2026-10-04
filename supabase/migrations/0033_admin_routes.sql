-- 0033_admin_routes.sql — the "Oppdraget ditt er skjult" notification links to
-- Mine oppdrag, which lives at /mine (0032 pointed at a route that doesn't exist).
create or replace function admin_set_listing_hidden(p_listing_id uuid, p_hidden boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text;
begin
  perform admin_guard();
  update listings set admin_hidden = p_hidden where id = p_listing_id returning owner_id, title into v_owner, v_title;
  if p_hidden then
    perform notify_moderation(v_owner, 'Oppdraget ditt er skjult',
      '«' || v_title || '» bryter med reglene for MinNabo og vises ikke for andre.', '/mine');
  end if;
end $$;
