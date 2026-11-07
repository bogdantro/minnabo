# Website work for app 1.2

Give this file to Claude in the website repo (minnaboweb). The app and the website share one database. Migrations 0086–0093 add what is described here. Nothing on the website breaks when they are pushed: every item is new work, not a repair.

## 1. Admin › Innstillinger: two new switches

Both rows exist in `app_settings` after migration 0089 / 0091.

| Key | Value | Effect in the app |
|---|---|---|
| `platform.min_app_version` | text, e.g. `"1.2.0"`. `"0.0.0"` stops nobody | Older builds show «Oppdater appen» and nothing else. Raise it only after the new version is live in both stores |
| `platform.transcripts_enabled` | `true` / `false`, default `false` | Shows «Vis som tekst» on talemeldinger. Needs the `transcribe` function and `TRANSCRIBE_API_KEY` |

## 2. Admin › Politiattest (only when the lawyer has said yes)

The app feature is behind the flag `policeCertificate` and is off.

- Table `police_certificates`: `profile_id, status (PENDING/APPROVED/REJECTED), file_path, submitted_at, decided_at, rejection_reason`.
- The file is in the private bucket `police-certificates`. Show it from a short signed link, like reported chat photos.
- Decide with `moderation_decide_police_certificate(p_profile, p_approved, p_reason)` using the service role. It queues the file for deletion and notifies the person. Only «sett» and the date stay.

## 3. Admin › Oppdrag: new information

- `listings.helpers_needed`: show «2 hjelpere» when above 1.
- `listings.first_to_followed_until`: an oppdrag in its two-hour head start. Only the helpers the owner follows can see it.
- `listings.price_mode` has a new value `HOURLY`: the amount is kr per hour. Show «300 kr / t», not «Budsjett».
- `listing_questions`: public questions and answers on a post. Show them in the drawer. A report about a question arrives as a report on the oppdrag.

## 4. Moderation of the new public text

Public text that users write now also lives in `listing_questions.body`, `listing_questions.answer`, `thank_cards.message` and `tool_bookings.note`. The word filter already runs on the first three. If the admin has a text search across user content, include them.

## 5. Website pages

- A landing page for `/?nabo=<profil-id>`: the QR code on the posters goes there. Today it lands on the front page with the store links, which works. A page saying «Marius hjelper naboer i Lillehammer» would convert better.
- Hjelp: the app's new questions are in `src/i18n/nb.ts` under `help`. Keep the two the same.
- Vilkår and Personvern are already updated for app 1.2 (2026-11-06). Transcripts and politiattest need their own lines before they are switched on.
- «Slik fungerer det»: flere hjelpere, spørsmål, timepris, dugnad.
