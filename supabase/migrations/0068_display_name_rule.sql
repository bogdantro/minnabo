-- 0068_display_name_rule.sql
--  Visningsnavn: someone with a Vipps name can only show that name or one of its
--  short forms, so nobody can pose as someone else:
--      'Mari Haugen' → 'Mari Haugen', 'Mari H.', 'Mari'
--  The same rule as src/domain/displayName.ts and the vipps-login function's default.
--  Only a *change* is checked: names saved before this rule stay until the person
--  changes them. Accounts without a Vipps name (old test logins), admins and the
--  server itself (sign-up, website admin) are not limited.

create or replace function display_name_options(p_full_name text)
returns text[] language sql immutable as $$
  select case
    when n is null or n < 1 then '{}'::text[]
    when n = 1 then array[parts[1]]
    else array[array_to_string(parts, ' '), parts[1] || ' ' || left(parts[n], 1) || '.', parts[1]]
  end
  from (select parts, array_length(parts, 1) as n
          from (select case when btrim(coalesce(p_full_name, '')) = '' then '{}'::text[]
                            else regexp_split_to_array(btrim(p_full_name), '\s+') end as parts) s) t;
$$;

-- Not security definer: current_user must stay 'authenticated' for app requests, like
-- guard_moderation_columns. The person can read their own profile_private row (0038).
create or replace function guard_display_name() returns trigger
language plpgsql set search_path = public as $$
declare v_full text;
begin
  if current_user <> 'authenticated' or is_admin() then return new; end if;
  if new.display_name is not distinct from old.display_name then return new; end if;
  select full_name into v_full from profile_private where profile_id = new.id;
  if v_full is null then return new; end if;
  if not (new.display_name = any (display_name_options(v_full))) then
    raise exception 'Visningsnavnet må være navnet ditt fra Vipps eller en kortform av det.' using errcode = '42501';
  end if;
  return new;
end $$;

-- update only: an upsert from Oppsett also runs insert triggers before it turns into
-- an update, and profiles are created by the sign-up trigger, never by the app
drop trigger if exists t_display_name_rule on profiles;
create trigger t_display_name_rule before update of display_name on profiles
  for each row execute function guard_display_name();
