-- 0049_four_main_partners.sql
-- Up to 4 hovedpartnere on Fellesskap (was 2).

create or replace function admin_set_main_partner(p_partner_id uuid, p_main boolean)
returns void language plpgsql security definer set search_path = public as $$
declare v_n int;
begin
  perform admin_guard();
  if p_main then
    select count(distinct partner_id) into v_n from partner_placements
     where surface = 'fellesskap' and active and partner_id <> p_partner_id;
    if v_n >= 4 then raise exception 'Maks 4 hovedpartnere.'; end if;
    update partner_placements set active = true where partner_id = p_partner_id and surface = 'fellesskap';
    if not found then
      insert into partner_placements (partner_id, surface, headline, active)
        values (p_partner_id, 'fellesskap', 'Hovedpartner', true);
    end if;
    -- a hovedpartner is not also a lokal helt
    update partners set active = true, local_hero = false where id = p_partner_id;
  else
    update partner_placements set active = false where partner_id = p_partner_id and surface = 'fellesskap';
  end if;
end $$;
