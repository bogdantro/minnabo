-- 0083_offer_moderation_wording.sql
-- The website's Admin › Oppdrag can now hide «Tilbyr hjelp» posts too (SERVICE_OFFER, 0076). The notification
-- the owner gets must then say «Innlegget ditt er skjult», not «Oppdraget …». Same function as 0054 otherwise.

create or replace function public.moderation_set_listing_hidden(p_listing_id uuid, p_hidden boolean,
  p_reason text default null, p_by text default null) returns void
language plpgsql security definer set search_path = public as $$
declare v_owner uuid; v_title text; v_type text;
begin
  update listings set admin_hidden = p_hidden,
         hidden_reason = case when p_hidden then p_reason end,
         hidden_at     = case when p_hidden then now() end,
         hidden_by     = case when p_hidden then p_by end
   where id = p_listing_id returning owner_id, title, type::text into v_owner, v_title, v_type;
  if p_hidden then
    perform notify_moderation(v_owner,
      case when v_type = 'SERVICE_OFFER' then 'Innlegget ditt er skjult' else 'Oppdraget ditt er skjult' end,
      '«' || v_title || '» bryter med reglene for MinNabo og vises ikke for andre.', '/mine');
  end if;
end $$;
revoke all on function public.moderation_set_listing_hidden(uuid, boolean, text, text) from public, anon, authenticated;
