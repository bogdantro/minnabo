# Changes in the MOBILE APP for the website (final, real table names)

> **See also `APP_CHANGES_UPDATE_1.md`** (2026-10-10) for what changed in website phases 6–8.

> Give this file to Claude in the **app repo**. It replaces `docs/APP_CHANGES.md` (written before the real schema was known).
> The website and the app share one Supabase database. Migration `0054_website.sql` adds what the website needs.
> **Nothing in the app breaks when 0054 is applied:** every section below is either "already works" or an
> improvement the app can ship later. Keep all existing app behaviour.

## 0. First
1. Apply `supabase/migrations/0054_website.sql` (after 0047–0053). See the steps in the website repo's hand-off message.
2. Regenerate the Supabase TypeScript types and the reference dump (`app-schema.sql`).
3. Type changes to expect: `donation_records.transferred_at` is now nullable (the app only ever receives rows where it is set);
   new nullable/defaulted columns on `partners`, `categories`, `listings`, `reports`, `business_profiles`.

## 1. Partners in Fellesskap
**Works without changes.** The app keeps reading `partners` + `partner_placements` exactly as today:
- Hovedpartner = `partner_placements` row with `surface = 'fellesskap'` and `active`. Max is now a setting (`partners.max_hovedpartnere`, 4).
- Lokal helt = `partners.local_hero`.
- Lokal støttespiller = any other partner row the app can read.

What changed underneath:
- **Visibility is decided in the database.** The RLS policy `p_partners_read` now uses `partner_is_visible(id)`.
  Partners that are not approved, unpaid past the 7-day grace period, paused or hidden by an admin are simply not returned.
  The app needs no payment logic. Webiser and Håndverker Innlandet are free partners and stay visible.
- Paying partners' level (`local_hero`, the `fellesskap` placement) is set by the website from their package. Billing data lives in
  `partner_accounts`, which the app cannot read (by design).

Recommended app changes:
1. **Live updates.** Subscribe to Realtime `postgres_changes` on `public.app_settings` (row `key = 'partners.version'`; it changes
   on every partner change) and on `public.partners` + `public.partner_placements`. On any event, refetch partners.
   Also refetch when the Fellesskap tab gains focus. (A partner that becomes hidden sends no row event to the app because of RLS,
   so the `partners.version` row is the reliable signal.)
2. **Optional: read `partners_public`** (view, readable by `authenticated`) instead of joining yourself. Columns:
   `id, name, blurb, url, logo_path, cover_path, municipality, region, category_slug, package ('hoved'|'helt'|'stottespiller'),
   about, offer, address, phone, email, opening_hours, gallery, partner_since, sort_order`.
3. **Category under the name** in the Lokale støttespillere carousel: `partners.category_slug` → `categories.label` (nullable).
4. **Statistics for partners.** When a partner card is ≥ 50 % visible for 1 s, call
   `supabase.rpc('log_partner_event', { p_partner: id, p_kind: 'impression', p_kommune })` (once per partner per app session).
   On "Besøk nettsiden": `p_kind: 'click'` before opening the link. The function ignores hidden partners.
5. **Logos:** `partners.logo_path` holds a full https URL (as it does today). No change.
6. **App Adminpanel › Partnere:** keeps working (`admin_partners`, `admin_set_main_partner`, `admin_set_partner_hero`,
   `admin_set_partner_active`). `admin_set_main_partner` now uses the shared count and the setting. Partners are managed on the
   website from now on: a change made in the app to a partner that has a website account is overwritten the next time the website
   changes its package or status. Consider hiding these toggles in the app, or labelling them "Administreres på nettsiden".

## 2. Categories from the database
Table `categories` (existing: `slug, label, icon`) now also has `active, sort_order, tile_bg, icon_color, web_icon, updated_at`.
1. Replace the static list in `src/domain/categories.ts` with
   `from('categories').select('slug,label,icon,tile_bg,icon_color,active,sort_order').eq('active', true).order('sort_order')`.
   Keep the static list as the offline fallback. `icon` keeps the app's own icon names; `tile_bg` / `icon_color` are the art colours.
2. Subscribe to Realtime on `public.categories` → refetch. Inactive categories disappear from chips, the Legg ut grid and filters.
   Existing oppdrag in an inactive category still show their label (`listings.category_slug` keeps its FK; categories are never deleted).

## 3. Kommuner and platform settings
1. New table `kommuner(id, name, region, active, sort_order)`, readable by `anon` + `authenticated`. `name` is the exact text the app
   already stores in `profiles.municipality`, `listings.municipality`, `partners.municipality` etc.
   Kommune pickers (Oppsett, location sheet, Legg ut step 4, profile) list `kommuner where active order by sort_order`.
   Kommuner that are not active keep using the existing waiting list (`kommune_waitlist`). Realtime on `kommuner` → refetch.
2. New table `app_settings(key, value jsonb)`. The app may read (anon + authenticated):
   | key | value | app behaviour |
   |---|---|---|
   | `platform.maintenance_mode` | `true/false` | full-screen "Vi oppdaterer MinNabo" (existing error/offline style) with "Prøv igjen" |
   | `platform.registration_open` | `true/false` | new Vipps sign-ups see "MinNabo tar ikke imot nye brukere akkurat nå." (existing users can log in) |
   | `platform.default_radius_km` | number | default reach for new users |
   | `partners.version` | string | refetch partners when it changes (section 1) |
   | `partners.max_hovedpartnere` | number | copy like "Maks 4 hovedpartnere" |
   Realtime on `app_settings` is enabled.
3. **Word filter: nothing to do.** It stays in the existing `banned_words` table and triggers; the website now edits that table.

## 4. Moderation done on the website
Reports are made **only in the app** (unchanged). The website admin reads `reports` and acts through the same logic the app's
`admin_*` functions use (moved into `moderation_*` functions in 0054).
1. **Hidden oppdrag** – already works (`listings.admin_hidden` + RLS). New columns `listings.hidden_reason`, `hidden_at`:
   in Mine oppdrag / the owner's detail screen, show a banner "Oppdraget er skjult av MinNabo" + `hidden_reason` + "Kontakt oss".
   No realtime needed: hidden oppdrag drop out on the next refresh.
2. **Closed by admin** – the website's «Lukk» sets `listings.status = 'REMOVED'` (same as a removed oppdrag). Make sure Mine oppdrag
   shows it as closed, not as an error.
3. **Suspended users** – unchanged: `profiles.suspended_at` + the auth ban (trigger `profiles_suspension_ban`) + `my_account_status()`.
   New: timed suspensions end automatically (cron job `minnabo-lift-suspensions`), and `profile_moderation(profile_id,
   suspended_until, suspension_reason, warning_count, last_warned_at)` holds the details (each user can read only their own row).
4. **Warnings and admin messages** – inserted as `notifications` with `kind = 'MODERATION'` (existing kind; push fires from the
   existing trigger). Nothing to do.
5. **Reports, "Mine rapporter"** – new column `reports.claimed_at`. Show the status as
   Mottatt (`OPEN`, `claimed_at is null`) → Under behandling (`OPEN`, `claimed_at` set) → Avgjort (`RESOLVED`).
   The enum `report_status` is unchanged.
6. **Bedrift verification** – new column `business_profiles.rejection_reason`: show it with the "Avvist" state and "Send inn på nytt".
   The status values are unchanged (`PENDING` → `APPROVED` / `REJECTED`).
7. **Deleted users** – the website runs the app's own `delete_my_account()` for that user. Nothing to do.

## 5. Donations
**Works without changes.** `donation_records` gets `club_id, status ('planned'|'transferred'), note, reference, created_at`.
The RLS policy now returns only `status = 'transferred'`, so the app still shows only real transfers ("Overført").
`recipient` is still filled with the club name. Realtime on `donation_records` is enabled → refetch on change.

## 6. News in the app (optional)
If the app gets a news list: read the view `news_public` (only articles the admin marked "Vis i appen"), render `body_html` with a
safe HTML renderer, and open `https://<domain>/nyheter/<slug>/` for the full article.

## 7. Later (backlog)
- Pre-login lookup so a suspended user sees "Kontoen er midlertidig stengt til {dato}" with the reason (needs a small public
  function; the user can't sign in while banned).

## 8. Tests for the app
- Partners in each state (paid, failed day 2, failed day 8, admin hidden, pending, free): only paid, day 2 and free show.
- "Skjul i appen" on the website removes the card within seconds on an open Fellesskap screen (via `partners.version`).
- Deactivating a category on the website removes it from the Legg ut grid after refetch; old oppdrag in it still render.
- A report claimed on the website shows "Under behandling" in Mine rapporter.
- Maintenance mode on → maintenance screen; off → back to normal.
