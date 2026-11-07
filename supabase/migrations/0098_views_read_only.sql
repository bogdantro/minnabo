-- 0098_views_read_only.sql
--  Security fix (found 2026-11-07 in a database review): a logged-in user could change and delete everyone's
--  reviews through the view visible_reviews.
--
--  Why: a view runs with its owner's rights, so the reviews table's own rules (RLS) don't apply through it, and a
--  simple view like this one accepts UPDATE and DELETE. Supabase gives the logged-in role ALL on every new object
--  by default, and the earlier migrations only took the rights away from anon.
--
--  Fix: every view in public is read-only for the app's roles. The app and the
--  website only ever read views; writes go to the tables, under their RLS.

do $$
declare v record;
begin
  for v in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('v', 'm') loop
    execute format('revoke insert, update, delete, truncate on public.%I from public, anon, authenticated', v.relname);
  end loop;
end $$;

-- New views get the same default rights again, so supabase/tests/new_features_checks.sql fails on any view a
-- logged-in user can write to. (Changing the default rights here would also take write rights from new tables.)
