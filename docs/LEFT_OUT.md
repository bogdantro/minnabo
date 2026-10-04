# Left out – what's missing, why, and what you need to do

Living list for the MinNabo redesign. Updated with every screen commit.
Last updated: 2026-10-03 (after Trygge kontakter).

Legend: 🔴 blocks real use · 🟠 design element hidden until data exists · 🟡 nice to have / decision needed · ✅ resolved

---

## 1. What you need to do (action list)

| # | Prio | Action | Why |
|---|------|--------|-----|
| A1 | ✅ | ~~Restore the Supabase project~~ – **done by you (2026-10-03)**: `profiles` exists, the app saves with a real Supabase session. Still to do: verify the **`avatars` bucket** upload with the storage policies you prepared (folder = Supabase user id). | Onboarding photo and Rediger profil photo/portfolio upload depend on it. |
| A2 | 🔴 | **Apply ALL migrations (0001–0028) – the database is empty.** Checked 2026-10-03: only a hand-made `profiles` table exists; `listings`, `categories`, `partners`, `noticeboard_posts` … are missing, which is why most screens show "Noe gikk galt". Steps: (1) in the Supabase SQL editor run `drop table if exists public.profiles cascade;` (it only holds your test rows – 0001 creates the real one, and would fail if it exists); (2) put `SUPABASE_DB_PASSWORD` in `.env`; (3) `set -a; source .env; set +a` → `npx supabase login` → `npx supabase link --project-ref hvxuzvhzsaocsnwznsai --password "$SUPABASE_DB_PASSWORD"` → `npm run db:push`. Your storage policies can stay (0004 adds its own with other names; the `avatars` bucket is reused). | Every data screen depends on these tables. |
| A3 | 🔴 | **Real Vipps login (OIDC)**. Today the Vipps sheet is a mock (`src/auth/mockVipps.ts`) with sample identities. Needs a Vipps Login merchant agreement, client id/secret, and a Supabase auth hook / edge function. | Rule 3: Vipps is the only login. Name, birth year and phone on Samtykke / Oppsett also come from Vipps. |
| A4 | 🔴 | **Youth roles on the backend** (under-18). Add a role/claim from the Vipps birth date and RLS rules: youth can only browse oppdrag, give/withdraw tilbud, chat in their own offer conversations, view profile, safety/privacy. | Rule 5 says enforce on the backend. The youth app (`/ung`) works, but its offers/chats are local only until this exists. |
| A5 | 🟠 | **Commit your own changes** that I keep out of my commits: `app.json` (EAS/owner/infoPlist), `package.json` version bumps + `package-lock.json`, `app/(tabs)/_layout.tsx` (SKIP_LOGIN), partner-logo edits (`mappers.ts`, `supabaseClient.ts`, `types.ts`, `FellesskapScreen.tsx`, `seedCommunity.ts`), migration 0025, the **SetupScreen anonymous-auth fix** (`src/screens/Onboarding/SetupScreen.tsx` – remove the two `console.log` lines and the `console.error` before release), and delete the temp file `app.json.BLV1_…`. | `package-lock.json` now also contains the `expo-calendar` install, so it must be committed together with your version bumps. |
| A6 | 🟠 | **Make a new app build** (EAS) once A5 is in. | `expo-calendar` adds a native module + the calendar permission text; Expo Go/old builds can't use "Legg i kalender". |
| A7 | 🟠 | **Decide the backend fields** in section 3 (skills, availability, offer count, response time, …). Tell me which to add and I'll write the migrations. | Each one un-hides a part of the design. |
| A8 | 🟡 | **Partner logos**: get logo files from the partners and set `logo_path`. | Fellesskap shows dashed placeholders until then. |
| A9 | ✅ | ~~Mock switch~~ – **back (2026-10-03)**: `EXPO_PUBLIC_USE_MOCKS=true` in `.env` runs the app on the demo data as Marius B.; `false` uses the real Supabase. Restart Expo with `-c` after changing it. Dev builds only. | – |
| A10 | 🟡 | `design/compare/knapper-app.png` does not exist (asked about in the Komponenter task). Add it if you want that comparison redone. | Komponenter was compared against `design/screenshots/Komponenter.png` instead. |
| A11 | 🟠 | **Anonymous Supabase auth is a dev stand-in** (added by you in Oppsett). Enable "Anonymous sign-ins" only for development, and replace it with the Vipps OIDC session (A3) before launch – the profile id model (auth.uid() = profiles.id) stays the same. Anonymous users are never cleaned up automatically. | Otherwise anyone can create accounts without Vipps (rule 3). |
| A12 | 🟡 | **Test the price fields on a phone** after the fix (Legg ut step 6, Gi tilbud, youth tilbud). I could only reproduce on web, so I fixed the native causes I could find: big-number clipping on Android, keyboard covering the field (iOS screens + all sheets), and the first tap on a quick-amount chip only closing the keyboard. If something is still off, send a screenshot. | The bug was reported on device. |
| A13 | 🟡 | **Decide: replies and saving on Oppslagstavle.** The design has "Svar" (opens a chat with the poster), "Lagre" and "N svar" on every oppslag. Chats are tied to an oppdrag in the database (`conversations.listing_id` is required), so this needs either chats on oppslag (`conversations.notice_id`) or a simple reply thread, plus a `saved_notices` table. Say which and I'll build it. | Hidden for now – the board works without them. |

---

## 2. Removed on purpose (product rules)

| What | Rule | Status |
|------|------|--------|
| "Folk som tilbyr hjelp", service-offer listings, `/tilbydere`, `ListingListScreen`, `ServiceOfferDetailScreen`, `/tilbud/ny`, `/tilbud/be-om`, `SendProposalScreen`, lead board matching on service offers | Rule 1 – oppdrag only | ✅ removed. Old SERVICE_OFFER rows in the database are simply not shown (Mottatte tilbud, detail route treat them as "not found"). Consider deleting them / the `service_offer_details` table later. |
| Type-choice screen before Legg ut, IntroScreen, old TaskRequestForm | Rule 2 – Legg ut opens the wizard | ✅ removed |
| Phone / e-mail / OTP / BankID login | Rule 3 – Vipps only | ✅ removed from the UI (see A3 for real Vipps) |
| Scripted "typing…" + automatic reply in StartSamtale, "Vis som avsender (demo)" toggle in Tilbudsdetaljer | Prototype-only behaviour | Not built – real replies arrive in the chat; sender view follows your real role |
| Mine oppføringer: tabs Alle / Oppdrag / Tjenester, the "Tilbyr hjelp" pill, and "…og det du tilbyr naboene" in the subtitle (now "Det du trenger hjelp med.") | Rule 1 – oppdrag only | ✅ not built |
| Exact address / map pin | Rule 6 – approximate location | Oppdragsdetaljer shows a stylised area circle only |

---

## 3. Backend / API gaps (design parts hidden until data exists)

| Screen | Hidden / changed | Why | What's needed |
|--------|------------------|-----|---------------|
| Meny | "Tilgjengelig for småjobber" toggle | No field for it (`paused`/feriemodus means something else) | `profiles.available_for_jobs boolean` |
| Meny | "Legg ut" tile says "Nytt oppdrag" | Rule 1 (design text implied offers) | Confirm wording |
| Oppsett | Name chips + "Fullt navn · Fra Vipps"; area chips only for Lillehammer | Needs real Vipps data; `KOMMUNE_AREAS` only has Lillehammer | A3 + area lists for other kommuner |
| Samtykke | Vipps identity card + "Bekreftet via Vipps" | Mock login has no verified identity | A3 |
| Samtykke | Optional tips consent | Column added in `0024_consent_tips.sql` | A2 |
| Oppdrag (home) | "184 aktive" counts per kommune in the location sheet | No count endpoint | Count view / RPC per kommune |
| Legg ut wizard | "Hvem kan gi tilbud", "Maks avstand", private price estimate – shown in the summary but **not saved** | No columns on oppdrag | `listings.offer_audience`, `max_distance_km`, `private_estimate` |
| Legg ut / Forhåndsvisning | "Publiser" under the mock login runs the flow but saves nothing | No real session (A3) | A3 |
| Fellesskap | Partner logos; member avatar stack | No logo files; no member data | A8; member count/avatars endpoint |
| Oppdrag for meg | Skill matching (the chips "Datahjelp, Hage …" and "Passer …") | Supabase profile has no skills column – live users get distance/newest ranking only | `profiles.category_slugs text[]` (+ edit in Rediger profil) |
| Oppdrag for meg | "Ikke aktuelt" hides are stored on the device only | No table | Optional `dismissed_listings` table to sync across devices |
| Oppdragsdetaljer | "N naboer har gitt tilbud" + avatar stack | Non-owners can't read other people's proposals (RLS) | Public `offer_count` on listings (count only, no identities) |
| Oppdragsdetaljer, StartSamtale, Sammenlign | "Svarer vanligvis innen 1 t" / "Svartid" | No response-time statistic | Computed `profiles.median_reply_minutes` |
| Oppdragsdetaljer | Image captions ("Plenen, ca. 300 m²") | Images have no caption field | `listing_images.caption` |
| Mottatte tilbud | Row date always "Sendt …" (design: "Godtatt 15. sep", "Avslått 15. sep") | No accepted/declined timestamp on proposals | `proposals.responded_at` |
| Tilbudsdetaljer | Timeline rows "Sett av deg" and "Tilbudet gjelder til …" | No seen timestamp, no offer expiry | `proposals.seen_at`, `expires_at` |
| Tilbudsdetaljer | Decline is held ~4 s for "Angre" before it is sent | DECLINED is final in the state machine | OK as is; or add an UNDO_DECLINE transition |
| Sammenlign | "Varighet" cell | Offers have no duration field | `proposals.duration_text` (+ field in Gi tilbud) |
| Sammenlign, Avtale | Date sort / countdown / calendar read the date from free text | Proposal time is free text ("Lør 10. okt kl. 10:00") | `proposals.scheduled_at timestamptz` – then "Fredag ettermiddag"-style offers also get a countdown |
| Avtalesammendrag | "Om 11 dager" countdown + "Legg i kalender" hidden when the time has no date | Same as above | Same as above |
| Jobbdag | "Pauser" total and the day's first "Startet kl." – shows "Denne økten" and the current session start instead | The timer only stores accumulated time + current start | `job_workspaces.first_started_at`, `paused_ms` |
| Jobbdag | "Stopp" is not saved (after reopening, a stopped timer shows as Pause) | No stopped state on the workspace | `job_workspaces.timer_stopped_at` |
| Jobbdag | Who does a task ("Mari" / "Jonas" on each row) | Checklist items have no owner | `checklist_items.assignee_id` |
| Jobbdag | "Hvem ordner det?" (Mari kjøper / Jonas tar med / legger ut) and the per-person split under the sum | Materials only have label + amount | `materials.payer` (`CLIENT`/`HELPER`/`HELPER_OUTLAY`) |
| Jobbdag | Photo pair titles ("Langsiden mot veien") and Før/Etter times; "Underveis" as its own phase | Photos only have BEFORE/AFTER; pairs are made by order | `job_photos.caption`, `pair_id`, phase `DURING` |
| Jobbdag | Estimate bar only shows when the oppdrag has a duration with hours/day in it | Estimate is parsed from free text | `listings.estimated_minutes` |
| Vurdering | "Vil du anbefale …?" Ja/Nei has no field – "Ja" is saved as the "Anbefales" tag, "Nei" is not stored | No `recommends` column on reviews | `reviews.recommends boolean` |
| Vurdering | "Jonas har nå 33 vurderinger" count in the success row | Would need a refetch of the profile's review count | Shown without the count; OK as is |
| Fullføring | "Tid brukt", "Oppgaver", "Bilder" show "–" / 0 when nobody used the job-day tools | They come from the Jobbdag workspace | OK as is – fills in once Jobbdag is used |
| Chat | "Slå av varsler" (mute) is stored on the device only – push notifications still arrive | No mute field on the backend | `conversation_participants.muted boolean` + respect it in the push sender |
| Chat | Time proposals are text messages with a "📅 Tidsforslag:" marker; the "Passer" answer is also a text message | No structured message type for time proposals | Add message kind `TIME` (+ answer state) so the card and the agreed time are data, not text |
| Chat | Duration fact ("ca. 5 t") on the inline offer card | Offers have no duration | `proposals.duration_text` (see Sammenlign) |
| Chat | Image captions ("Sett fra plenen") and file-name chip on photos | Image messages have no caption/file name | `messages.caption` |
| Chat | "Svarer vanligvis …" / response time | See Oppdragsdetaljer | `profiles.median_reply_minutes` |
| Chat | Block/unblock uses the existing block list; the blocked person isn't hidden from oppdrag lists yet | Lists don't filter blocked profiles | Filter blocked owners in `listListings` (RLS or query) |
| Innboks | Unread count per conversation ("2" in the bubble) – shows a dot instead; subline counts conversations, not messages | The API only knows read/unread per conversation | Return `unread_count` (messages after `last_read_at`) from the conversations query |
| Innboks | Status tag "Endring forespurt" | `statusTag` only has NEW_OFFER / OFFER_ACCEPTED | Add REVISION_PENDING to the conversation status tag |
| Innboks | "Du: …" prefix on my own last message | Preview has no author | Return the last message's author with the preview |
| Mine avtaler | Agreements without a real date ("Lørdag kl. 10:00") get no dot in the week strip, no time and sit under "Uten dato"; "Legg alle i kalenderen" skips them | Free-text time (see `scheduled_at` above) | `proposals.scheduled_at timestamptz` |
| Mine avtaler | Duration in the time column comes from the oppdrag, not the offer | Offers have no duration | `proposals.duration_text` (see Sammenlign) |
| Mine avtaler | "Legg alle i kalenderen" button | Only on iOS/Android (no device calendar on web) | OK as is |
| Avtalesammendrag | "Legg i kalender" only on iOS/Android | Web has no device calendar | OK as is (or offer an .ics download on web) |
| Youth app | Offers/chats from `/ung` stay on the device | Needs youth roles | A4 |
| Profil | "Svarer vanligvis innen" stat tile (3rd tile) | No response-time data | `profiles.median_reply_minutes` (same as Chat) |
| Profil | Presentation pills: languages, "Har bil", availability ("Kvelder etter kl. 17") | Profile has no such fields | `profiles.languages text[]`, `has_car boolean`, `availability_text` |
| Profil | "Medlem siden mars 2024" shows only the year ("Medlem siden 2026") and place shows the kommune/sted only | `memberSince` is a year string | Return `created_at` (month + year) |
| Profil | Pålitelighet: only "Møter opp" is shown; "Presis" and "Fullfører" bars are hidden. Footer says "Basert på N fullførte avtaler." (not "siste 12 måneder") | Reliability only has completed + no-shows + score | `reliability.on_time_pct`, `completion_pct`, and a 12-month window |
| Profil | Anbefalt av naboer: the avatar stack of who recommended is hidden. The note "Bare naboer som har hatt en fullført avtale med … kan anbefale" is shown, but the backend lets anyone endorse | Endorsements return only skill + count | Return endorser ids (first 3) and **enforce in `toggle_endorsement` that the caller has a completed agreement with the person** |
| Profil | Verification sheet: Telefon/E-post/Bedrift show the backend's `explanation` text as the single "Dette ble sjekket" line (the date is now shown from `verified_at`) | Verifications have no list of checks | Optional: check lines per verification |
| Profil | Vipps-ID chip and "Verifisert med Vipps" are shown for every profile | Login is Vipps only (rule 3) – correct once A3 is live | A3 |
| Profil | Private card: "E-post" row hidden | Profile has no e-mail field | Return the masked e-mail for the own profile |
| Profil | Review cards: "Svar fra …" (owner reply) hidden | Reviews can't be replied to | `reviews.reply text`, `replied_at` + an API to reply |
| Profil | Portfolio tiles are single photos: no Før/Etter pairs, no titles/place under the tiles, no Før/Etter switch in the viewer | `portfolio` is a list of image URLs | `portfolio_items (before_url, after_url, title, place, caption, done_at)` |
| Rediger profil | "Fullt navn" shows the Vipps name only when the Vipps identity is available (mock login today); otherwise it falls back to the display name | There is no separate full-name field on the profile | A3 (real Vipps) + `profiles.full_name` filled from Vipps |
| Rediger profil | Portfolio tiles have no caption ("Terrasse", "Hagebed") | Portfolio is a list of image URLs | Same as the Profil portfolio item (`portfolio_items.title`) |
| Rediger profil | Photos picked for the avatar/portfolio are uploaded immediately; if you press "Forkast" the uploaded file stays in Storage | Storage upload happens before save | Optional: a cleanup job for unreferenced files in `avatars/` and `listing-images/` |
| Mine oppføringer | **"Rediger" in the ⋯ sheet is missing** – there is no way to edit a published oppdrag | No `updateListing` API and the Legg ut wizard has no edit mode | `updateListing(id, patch)` (+ task_details) and a wizard "edit" mode prefilled from the listing. Tell me if you want this built. |
| Mine oppføringer | "visninger denne uka" mini stat, "48 visninger" and "2 lagret" per card | No view or save counters | `listing_views` (or a `view_count`) and a saved count per listing |
| Mine oppføringer | Archived card subline "Fullført 2. sep med Erik Moen" and "Du ga 5 stjerner"; "Se avtalen" opens Mine avtaler, not the exact avtale | The owner list doesn't include the agreement / review | Return the accepted proposal id, counterpart and my rating with `listMyListings` |
| Mine oppføringer | "Slett" is a soft delete (status REMOVED): offers and chats stay in the database, the oppdrag disappears for everyone | Hard delete would cascade-delete the chats, which the design says are kept | OK as is |
| Lagrede | Alert bell per saved search, "Slå på varsel …" note, "· varsel på" and "sist kjørt …" | Saved searches have no alert flag, no last-run time and nothing sends alerts | `saved_searches.alert boolean`, `last_run_at`, and a job that pushes new hits |
| Lagrede | "Nye treff" counts oppdrag posted since the search was **saved**, not since you last opened it | No last-seen time per saved search | `saved_searches.last_seen_at` (set when "Kjør søk" is pressed) |
| Lagrede | "Kjør søk" only carries the text and category into Søk (not kommune / verified / sort) | `/sok` only reads `q` and `category` | Let `/sok` accept the full saved filter |
| Lagrede | Extra "Hjelpere (n)" segment (only when you follow someone) – not in the design | Following ("Følg") still exists on Profil and this is the only list of them | Decide: keep, or drop following |
| Nabolag | The group is your **own area** ("<sted> nabolag" in your kommune), not a group you pick or name. Borettslag-style named groups are gone | The design shows one area group; the old free-text group was stored on the phone only | Decide if you also want named groups (borettslag) later |
| Nabolag | The fake member number (a hash of the place name) is gone – the count is now real and starts at 0 until people join | Needs 0027 (A2) | – |
| Nabolag | Cover art avatars and the member stack show the latest members; there is no "who is online" | – | OK as is |
| Oppslagstavle | Image tile only when a photo was added (the design shows coloured category tiles as stand-ins for photos) | Prototype stand-ins | OK as is |
| Oppslagstavle | "Svar", "Lagre" and "N svar" | See A13 | A13 |
| Verifisering | E-post row shows "Fra Vipps-profilen din" instead of the masked address | Profile has no e-mail field | Return the masked e-mail for the own profile (same as Profil) |
| Verifisering | "Du kan svare offentlig på en vurdering du har fått." is left out of "Slik fungerer vurderinger" | There is no reply-to-review feature | `reviews.reply` (see Profil) – then add the line back |
| Verifisering | Phone row says "Hentet fra Vipps da du logget inn" – true once real Vipps login exists; with the mock login the phone is not from Vipps | A3 | A3 |
| Verifisering | BankID row (old "Kommer snart") removed | Rule 3 – Vipps only | ✅ |
| Sikkerhet / Jobbdag | **Trygg tur sends nothing by itself**: Start / Forleng / Stopp open the phone's SMS app with the message pre-filled to your trygge kontakter; you press send. The trip and contacts are stored on the phone only | No SMS service on the backend | An SMS provider (e.g. Twilio / Link Mobility) + an edge function, and `safe_trips` + `trusted_contacts` tables |
| Sikkerhet / Jobbdag | "Stopper du ikke innen fristen, får kontaktene dine en påminnelse" – the reminder to contacts is not sent (only the overdue state shows in the app) | Needs a server-side timer | Scheduled job on `safe_trips.due_at` that texts the contacts |
| Sikkerhet | Blocked rows say "Blokkert" without date or "via rapport" | Blocks have no timestamp/source in the API | Return `blocks.created_at` and whether it came from a report |
| Rapporter | "Skjermbilde" attachment | Reports have no attachment field | `reports.attachment_path` (+ upload to a private bucket only admins can read) |
| Rapporter | "Du får varsel i appen når saken er avgjort" / "Du får beskjed om utfallet" – changed to "Vi går gjennom rapporten så snart vi kan" / "Saken lukkes når den er behandlet" | No notification is sent when an admin resolves a report | Notification kind `REPORT_RESOLVED` from `resolve_report` – then restore the design copy |
| Rapporter | Tilbud and Vurdering cannot be reported from where they are shown yet (only users, oppdrag and messages have a "Rapporter" entry) | Tilbudsdetaljer / review cards link to the user instead | Add `?tilbud=` / `?vurdering=` entries (API already supports PROPOSAL / REVIEW) |
| Rapporter | Case number is made from the report id (e.g. "MN-863468"), not a running number | No case-number column | Optional `reports.case_no serial` |
| Personvern | Retention answers have no numbers (design: "[x] dager", "[x] måneder") and "Vilkår v2.1" has no version | Legal decisions; no terms-version field | Decide retention periods + a terms version (`consent_records.terms_version`) |
| Personvern | Export opens the share sheet with the data as JSON ("Eksporten er klar") instead of "sendt til e-post" | No e-mail sending | An edge function that mails a download link |
| Innstillinger | "Stor" text size only enlarges the preview; app-wide large text follows the phone's text-size setting (button opens phone settings) | React Native can't scale every Text from one place without rewriting all screens | OK as is (accessibility is covered by the OS setting) |
| Innstillinger | "Vilkår for bruk · Versjon [x.x]" shows "Les vilkårene for MinNabo" | No terms version | Same as Personvern (`terms_version`) |
| Vilkår | **Final legal text** – the design's working copy is used. Values to confirm in `src/content/terms.ts`: version (1.0), valid-from date, minimum age (15), notice days (30), contact e-mail (empty → sentence hidden). The "[Endelig juridisk tekst …]" markers show only in dev builds | Needs a lawyer | Send the text to a lawyer, then update `terms.ts` |
| Vilkår | Download icon shares the terms as text instead of a PDF | No PDF library | Optional: host a PDF and link to it |
| Profil | "Be om tilbud" is only in the preview of your own profile; on others' profiles "Ta kontakt" shows only when you already have a conversation together | There is no direct request/message without an oppdrag (rule 1) | Decide: keep as is, or allow a direct conversation without a listing |

---

## 4. Screens not finished yet

| Screen | State | Notes |
|--------|-------|-------|
| Slett konto, Bedrift, Admin | to do | |
| Tilstander (NoAccess / Success states, offline banner redesign) | partial | |

---

## 5. Resolved

| Was | Fixed in |
|-----|----------|
| "Avlys avtalen" had no backend | `0026_cancel_agreement.sql` + `cancelAgreement` API (`d1497de`) – still needs A2 |
| "Legg i kalender" had no library | `expo-calendar` installed (approved 2026-10-03) – needs A5/A6 |
| Trygg tur card had old styling (Jobbdag) | New `TryggTurCard` in the Sikkerhet design, used on Sikkerhet and Jobbdag |
| Price input UI on device (reported 2026-10-03) | Android font padding removed from the big amount, "kr" centred, inputs inside sheets use the sheet's keyboard-aware input, iOS screens adjust for the keyboard, taps on chips work while the keyboard is open – please confirm on a phone (A12) |
| Lists stuck on skeletons under the mock login | `locationScope` keeps the kommune locally without a backend user (`b7f045f`) |
