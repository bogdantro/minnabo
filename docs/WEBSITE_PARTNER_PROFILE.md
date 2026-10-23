# Partner portal and admin: the hovedpartner profile (2026-10-23)

For the website project (`minnaboweb`). A hovedpartner should be able to fill in a full profile –
banner image, opening hours, more photos, prices and a longer «Om oss» – and the app should show it.

**The app already shows all of it** on the partner's page (`/partner/<id>`), and the banner also on the
hovedpartner card on Fellesskap. The database has every column; `prices` is new in the app repo's
migration `0070_partner_prices.sql`. What's missing is on the website: the partner can't edit these
fields, and the admin can't approve them.

The next free migration number is **0071**. The website connects as `postgres`.

## 1. The fields (table `public.partners`, also in the view `partners_public`)

| Column | Shown in the app as | Rules for the form |
|---|---|---|
| `cover_path` | The wide banner at the top of the page and of the Fellesskap card | One image, landscape, at least 1200 px wide (shown about 3:1, cropped to fill). Full public URL. |
| `logo_path` | The logo over the banner | As today. Full public URL. |
| `blurb` | The short line under the name | Max ~120 characters. Required. |
| `about` | «Om oss» | Longer text, up to 1500 characters. Line breaks are kept. |
| `offer` | «Til naboene» – what they offer MinNabo's neighbours | Up to 500 characters. |
| `opening_hours` | «Åpningstider» in Kontakt | Free text, several lines, e.g. `Man–fre 09–17` / `Lør 10–15` / `Søn stengt`. Up to 300 characters. |
| `gallery` | The photos on the page, full width, one under the other | Up to 8 images (`text[]`), full public URLs, in the order the partner sets. |
| `prices` | «Priser» – a list, with the note «Prisene er satt av … MinNabo håndterer ikke betaling.» | Up to 20 rows: `[{"name": "Herreklipp", "price": "fra 450 kr"}]`. Both texts required per row; name ≤ 60, price ≤ 30 characters. Free text on purpose («350 kr/time», «Gratis»). The database refuses more than 20 rows or anything that isn't a list. |
| `address`, `phone`, `email`, `url` | Kontakt (phone, e-mail and website are tappable) | As today. |

Images go in the existing `public-web` bucket (public, max 2 MB, png/jpeg/webp) and the column stores the
**full** public URL, like `logo_path` today.

Only hovedpartnere (package `hoved`) have a page in the app. A lokal helt or lokal støttespiller only
needs name, blurb, logo and link – hide the other fields for them, or show them greyed with
«Tilgjengelig for hovedpartnere».

## 2. Partner portal: «Min profil»

- One form with the fields above, grouped: **Bilder** (banner, logo, galleri – drag to reorder, remove),
  **Om dere** (blurb, Om oss, Til naboene), **Priser** (add row, remove row, reorder), **Kontakt**
  (adresse, telefon, e-post, nettside, åpningstider).
- A **preview** of how it looks in the app (banner, logo, sections in the app's order: Om oss → Til
  naboene → Priser → Bilder → Kontakt).
- **Save sends it for approval** – as today: one row in `partner_profile_changes` with `status =
  'pending'` and the changed fields in `changes` (only one pending row per partner is allowed). The new
  keys are `cover_path`, `about`, `offer`, `opening_hours`, `gallery`, `prices`, `address`, `phone`,
  `email` – next to the existing `name`, `blurb`, `logo_path`, `url`, `category_slug`.
- While a change is pending, show it as «Venter på godkjenning» and let the partner edit or withdraw it.
- After a rejection, show the admin's `reason`.

## 3. Admin: approving profile changes

- Show the pending change **side by side** with the current profile (old → new per field; images as
  thumbnails; the price list as a table).
- **Approve** writes every key in `changes` to `partners` and sets `status = 'approved'`,
  `reviewed_at`, `reviewed_by`. Check the same rules as the form before writing (lengths, at most 8
  photos, at most 20 prices) – the database only checks the shape of `prices`.
- **Reject** asks for a reason (shown to the partner).
- Changing `partners` bumps `app_settings 'partners.version'` (existing trigger), so the app refetches
  and shows the new profile straight away.

## 4. Check in the app afterwards

Fill in a test hovedpartner completely, approve it, then in the app: Fellesskap → the hovedpartner
card shows the banner → open it → Om oss, Til naboene, Priser (with the payment note), the photos and
Kontakt with åpningstider are all there.
