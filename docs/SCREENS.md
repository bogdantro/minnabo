# MinNabo – screen-by-screen checklist

## Design file → existing route map

Routes are expo-router files in `app/`; most are one-line wrappers around a component in `src/screens/`.
Status: **exists** = a screen for this purpose is already there (still needs the re-skin) ·
**partial** = only part of the design exists, or it lives inside another screen ·
**missing** = nothing to build on.

| Design file | Route (`app/…`) | Screen component | Status | Notes |
|---|---|---|---|---|
| `Admin.dc.html` | `/admin` (`admin.tsx`) | `src/screens/AdminScreen.tsx` | ✅ done | Admin role only – every action is an admin-only RPC (`0032_admin.sql`). KPIs, report queue (Avvis / Fjern innhold / Advar bruker + Angre), business approval with a live Enhetsregisteret check, user search + suspend, flagged oppdrag hide/show, partner slots (max 2) + carousel, weekly stats |
| `Avtale.dc.html` | `/avtale/[id]` | `src/screens/AvtaleSammendragScreen.tsx` | ✅ done | Avlys = new `cancel_agreement` RPC (migration 0026, ACCEPTED → CANCELLED, reopens the oppdrag). Legg i kalender = expo-calendar, shown on iOS/Android when the agreed time contains a date. Job-day tools moved to `/jobbdag/[id]`. |
| `Bedrift.dc.html` | `/bedrift` | `src/screens/BedriftRegistreringScreen.tsx` | ✅ done | Org.nr format + mod-11 check + **live Enhetsregisteret lookup** (data.brreg.no: name, address, form), contact fields with validation, categories, consent → PENDING. Opens on the status (Sendt / Til verifisering / Verifisert, or rejected → send again) when already registered. |
| `Chat.dc.html` | `/chat/[id]` | `src/screens/ChatScreen.tsx` + `src/components/chat/*` | ✅ done | Tap bubble → reactions (stored as emoji 👍❤️😊✅), long-press → fest/løsne. Time proposals are text messages with a "📅 Tidsforslag:" marker rendered as cards; answers "✓ Tidspunktet passer" / "↻ Nytt tidspunkt ønskes". "Del sted" tile only after an agreement (existing feature, not in the design). Send tilbud opens the Gi tilbud sheet (helper only). Mute is on-device. Decline held for Angre. |
| `Fellesskap.dc.html` | `/(tabs)/fellesskap` | `src/screens/FellesskapScreen.tsx` | ✅ done | Partner logos are placeholders until partners deliver them; no member-avatar stack (no member data) |
| `ForMeg.dc.html` | `/oppdrag-for-meg` | `src/screens/ForMegScreen.tsx` | ✅ done | Matching uses the profile's categories (`categorySlugs`) – **API gap:** the Supabase profile has no skills column, so live users get distance/newest ranking only. "N nye forslag i dag" = posted in the last 24 h (hidden when 0). Hidden suggestions are stored on the device. |
| `Forhandsvisning.dc.html` | `/legg-ut/forhandsvisning` | `src/screens/LeggUt/PreviewScreen.tsx` | ✅ done | "Publiser" always saves to the backend |
| `Fullforing.dc.html` | `/fullfor/[id]` | `src/screens/CompletionScreen.tsx` | ✅ done | Two-party state from real confirmations (none / other / mine / both). Stats from the job workspace (timer, checklist, photos). "Gi vurdering" hidden once I've reviewed. |
| `Innboks.dc.html` | `/(tabs)/innboks` | `src/screens/InnboksScreen.tsx` | ✅ done | Tab. Live client-side search on name/oppdrag/message. "Merk alle som lest" uses the existing `mark_conversation_read` RPC per conversation, held for Angre. Unread bubble shows a dot (no per-conversation count in the API). |
| `Innstillinger.dc.html` | `/innstillinger` | `src/screens/SettingsScreen.tsx` | ✅ done | Profile card, Konto (phone + e-mail from `profile_settings`), Sted → location sheet, push/e-post channel switches, feriemodus with hidden count, text-size preview, Personvern/Vilkår/Bedrift, logout dialog, Slett konto. The design's Utvikler panel (feature-flag switches) was removed for release on request (2026-10-09); flags are fixed per build in `src/config/featureFlags.ts`. |
| `Jobbdag.dc.html` | `/jobbdag/[id]` | `src/screens/JobbdagScreen.tsx` | ✅ done | Timer on the workspace (start / pause / stop are saved, with first start and total pause). Tasks show who does them, materials who sorts them out, photos have captions and an Underveis phase (0040). Before/after slider pairs Før[i] with Etter[i]. Kept the existing job-day tools (på vei/framme, ring/SMS, trygg tur, no-show) in a "Trygghet og kontakt" section below the tabs. |
| `Komponenter.dc.html` | – (reference) | `src/components/ui/*` | n/a | Visual reference for COMPONENTS.md |
| `Lagrede.dc.html` | `/lagrede` | `src/screens/SavedScreen.tsx` | ✅ done | Oppføringer (unsave collapses + Angre) / Søk (filter chips, "nye treff" since saved, Kjør søk, delete + Angre). Alert bell per search with real notifications (0042). Extra "Hjelpere" segment only when you follow someone. |
| `LeggUt.dc.html` | `/legg-ut` | `src/screens/LeggUt/LeggUtWizard.tsx` | ✅ done | Opens directly (rule 2); draft saved locally ("Lagre utkast"). **API gap:** "Hvem kan gi tilbud", "Maks avstand" and the private estimate have no columns for oppdrag – shown in the summary, not saved |
| `LoggInn.dc.html` | `/logg-inn` | `src/screens/Onboarding/LoginScreen.tsx` | ✅ done | Real Vipps OIDC (`src/auth/vipps.ts` → `vipps-login` edge function → `/vipps`). Vipps only – the temporary test login was removed 2026-10-09 |
| `Main.dc.html` | `/velkommen` | `src/screens/Onboarding/WelcomeScreen.tsx` | ✅ done | Anon users are redirected here from `(tabs)/_layout.tsx` |
| `Meny.dc.html` | – (sheet) | `src/components/MenySheet.tsx` | ✅ done | Opened from `BottomNav`. "Tilgjengelig for småjobber" saves `profiles.available_for_jobs` (0036). "Legg ut" tile says "Nytt oppdrag" (rule 1). Bedrift row behind feature flag, Admin row for admins only |
| `MineAvtaler.dc.html` | `/avtaler` | `src/screens/MineAvtalerScreen.tsx` | ✅ done | Role (Du hjelper / Du får hjelp), cancelled and my rating added to the agenda item. Agreements whose time has no date go under "Uten dato". Cancelled ones show under Fullført as "Avlyst". |
| `MineOppforinger.dc.html` | `/mine` | `src/screens/MyListingsScreen.tsx` | ✅ done | Oppdrag only (no Alle/Oppdrag/Tjenester tabs, no "Tilbyr hjelp"). New `setListingStatus` API: Pause = PAUSED, Arkiver = ARCHIVED, Aktiver = PUBLISHED/RECEIVING_OFFERS, Slett = soft delete (REMOVED – chats and offers stay). Public lists hide PAUSED/ARCHIVED. |
| `MottatteTilbud.dc.html` | `/tilbud` | `src/screens/MottatteTilbudScreen.tsx` | ✅ done | "Ny" = SENT; Besvart = every other status. Row date is always "Sendt …" (the API has no accepted/declined timestamp). Offers on removed or non-oppdrag listings are hidden. |
| `Nabolag.dc.html` | `/nabolag` | `src/screens/NeighbourhoodScreen.tsx` | ✅ done | One group per area ("<sted> nabolag") in your kommune. Real membership via `0027_neighbourhood_groups.sql` RPCs (count, avatars, join/leave). Fellesskap's Nabolag card shows the same count. |
| `Oppdrag.dc.html` | `/(tabs)/index` (home) | `src/screens/OppdragScreen.tsx` | ✅ done | Default route. Kommune list in the sheet has no "184 aktive" counts (no API data). "Hele Innlandet" = all kommuner (`expandKommuner` reach 2). "N nye" = open oppdrag in reach from the last 48 h |
| `OppdragUng.dc.html` | `/ung` | `src/screens/youth/YouthAppScreen.tsx` | ✅ done | Real oppdrag, real tilbud (send / withdraw) and real chats; limits enforced by the database (0038). Youth users are redirected here from the tabs |
| `Oppdragsdetaljer.dc.html` | `/oppdrag/[id]` | `src/screens/TaskDetailScreen.tsx` + `src/components/GiTilbudSheet.tsx` | ✅ done | Oppdrag only (ServiceOfferDetailScreen, `/tilbud/ny`, `/tilbud/be-om` removed). **API gaps:** no public offer count on a listing ("N naboer har gitt tilbud" + avatar stack hidden) and no response-time stat ("Svarer vanligvis innen …" hidden); no image captions. Map is a stylised approximate area, never a pin. |
| `Oppsett.dc.html` | `/oppsett` | `src/screens/Onboarding/SetupScreen.tsx` | ✅ done | Signed-in users without `onboardedAt` are redirected here. "Fullt navn · Fra Vipps" field + name chips need Vipps data. Area chips: Lillehammer only (`KOMMUNE_AREAS`) |
| `Oppslagstavle.dc.html` | `/oppslagstavle` | `src/screens/NoticeboardScreen.tsx` | ✅ done | Kind chips with counts, cards, compose sheet (type/title/text validation, optional photo via `0028_noticeboard_images.sql`), fresh post highlight. "Svar" opens the public comments under the oppslag (0048), "Lagre" saves, the owner can edit and mark it "Avsluttet". |
| `Personvern.dc.html` | `/personvern` | `src/screens/PersonvernScreen.tsx` | ✅ done | Consent log from `consent_records`; tips toggle inserts a new row; export gathers data (progress) and opens the share sheet; retention accordion; Vilkår / Slett konto links. |
| `Profil.dc.html` | `/profil`, `/profil/[id]` | `src/screens/ProfileScreen.tsx` | ✅ done | Own vs public via `profileId` param. Own: "Slik ser andre deg" preview. Someone else's: Ta kontakt (only when you already share a conversation) + Følg, flag icon → Rapporter. Endorse = "Anbefal" on the Anbefalt av naboer rows. |
| `Publisert.dc.html` | `/legg-ut/publisert` | `src/screens/LeggUt/PublishedScreen.tsx` | ✅ done | Share sheet: copy link, SMS, e-post, system share |
| `Rapporter.dc.html` | `/rapporter` | `src/screens/RapporterScreen.tsx` | ✅ done | `?profil=` / `?listing=` / `?melding=` set the context card and type chips; without them it is a general report (details required). Block toggle (auto-on for svindel/trakassering) blocks after sending. Old SafetyScreen removed. |
| `RedigerProfil.dc.html` | `/profil/rediger` | `src/screens/EditProfileScreen.tsx` | ✅ done | Name from Vipps (locked) + editable visningsnavn; kommune sheet + area chips save `municipality`/`place`; photo/portfolio upload right away but are only applied on "Lagre endringer". |
| `Sammenlign.dc.html` | `/tilbud/sammenlign/[listingId]` | `src/screens/SammenlignTilbudScreen.tsx` | ✅ done | Open + accepted offers only. **API gaps:** no per-offer duration and no reply-time stat → "Varighet" and "Svartid" cells left out. "Dato" sort parses the free-text time ("Lør 10. okt"); unparseable times go last. |
| `Samtykke.dc.html` | `/samtykker` | `src/screens/Onboarding/ConsentScreen.tsx` | ✅ done | Vipps identity card + "Bekreftet via Vipps" hidden until Vipps login. Optional tips consent needs migration `0024_consent_tips.sql` pushed |
| `SeAlle.dc.html` | `/oppdrag-liste` (`?category=`) | `src/screens/SeeAllScreen.tsx` | ✅ done | Oppdrag only; `/tilbydere` + ListingListScreen removed (rule 1). Price sort uses the listing budget; "Ønsker tilbud" sorts last. |
| `Sikkerhet.dc.html` | `/sikkerhet` | `src/screens/SikkerhetScreen.tsx` | ✅ done | New screen (SafetyScreen stays for `/rapporter` until Rapporter). Trygg tur = shared `TryggTurCard` (also on Jobbdag) – SMS via the phone's SMS app. Blocked list inline with confirm. `/blokkerte` still exists for Innstillinger. |
| `SlettKonto.dc.html` | `/slett-konto` | `src/screens/DeleteAccountScreen.tsx` | ✅ done | 3 steps (what is deleted with real listings/reviews → active agreements, skipped when none → type SLETT) → goodbye. `delete_my_account` RPC (0031) anonymises + cleans up, edge function `delete-account` soft-deletes the login (deployed). |
| `Sok.dc.html` | `/sok` | `src/screens/SearchScreen.tsx` | ✅ done | Oppdrag only (offer type filter removed). Multi-category, verified, distance and sort filter client-side on the scoped result |
| `StartSamtale.dc.html` | `/chat/start?listing=` | `src/screens/StartChatScreen.tsx` | ✅ done | Conversation is created on the first message (opening the screen saves nothing); an existing conversation for the oppdrag redirects to `/chat/[id]`. The prototype's scripted typing/reply is not faked. Hidden for lack of data: "Svarer vanligvis innen …". |
| `TilbudDetaljer.dc.html` | `/tilbud/[id]` | `src/screens/TilbudDetaljScreen.tsx` + `src/components/TilbudSheets.tsx` | ✅ done | Recipient and sender views come from the real roles (no demo toggle). DECLINED is final in the state machine, so a decline is held for the toast's Angre window before it is sent; chosen reasons go to the chat. "Be om endring" topics go in the revision message. No "seen" timestamp or offer expiry in the API → those timeline rows are left out. |
| `Tilstander.dc.html` | – (reference) | `src/components/ui/ScreenState.tsx`, `FallbackScreen.tsx`, `OfflineBanner.tsx` | ✅ done | `ScreenState` maps every status to the designed states (`States.tsx`); offline banner with "Tilkoblet igjen", last-updated time and Prøv igjen |
| `TryggeKontakter.dc.html` | `/trygge-kontakter` | `src/screens/TrustedContactsScreen.tsx` | ✅ done | Hero, list with relation, add sheet (+47, 8-digit validation, relation chips), remove confirm. Stored on the phone (max 5). |
| `Ungdomskonto.dc.html` | `/ungdomskonto` | `src/screens/Onboarding/YouthAccountScreen.tsx` | ✅ done | Reached from the Vipps sheet ("Under 18 år?") |
| `Varsler.dc.html` | `/varsler` | `src/screens/NotificationsScreen.tsx` | ✅ done | Category per notification kind (Tilbud/Melding/Avtale/Annet). Rows deep-link via the notification `route`. |
| `Varslinger.dc.html` | `/varslinger` | `src/screens/NotificationPrefsScreen.tsx` | ✅ done | Master pause, push/e-post matrix per type, quiet hours with timeline + time picker – all saved to `profile_settings.notification_prefs` (0030). "Send et testvarsel" shows a real local notification (expo-notifications). |
| `Verifisering.dc.html` | `/verifisering` | `src/screens/VerifiseringssenterScreen.tsx` | ✅ done | Vipps-ID always counts (rule 3); phone/e-mail/bedrift from `verifications` incl. `verified_at` dates. BankID row removed. "Bygg tillit" is computed from the real profile + trygge kontakter (tap opens the place to fix it). |
| `Vilkar.dc.html` | `/vilkar` | `src/screens/VilkarScreen.tsx` | ✅ done | Text + values in `src/content/terms.ts`; reading progress, current section, TOC jump, Til toppen, share (download icon), accepted date from the consent log. Jurist markers only in dev builds. |
| `Vurdering.dc.html` | `/vurder/[id]` | `src/screens/ReviewScreen.tsx` | ✅ done | Question adapts to role ("få hjelp av" / "hjelpe"). "Anbefale? Ja" is saved as the "Anbefales" tag (no recommend field). Send disabled if already reviewed. |

Existing routes with **no** design file:

| Route | Component | What to do |
|---|---|---|
| ~~`/tilbydere`~~ | removed | Service offers – removed (rule 1) |
| `/oppdrag/[id]` for offers | `src/screens/ServiceOfferDetailScreen.tsx` | Service offers – remove (rule 1) |
| ~~`/tilbud/ny`~~ | removed | Replaced by the Gi tilbud sheet in Oppdragsdetaljer |
| ~~`/tilbud/be-om`~~ | removed | Service-offer flow (rule 1) |
| `/blokkerte` | `src/screens/BlockedListScreen.tsx` | Folded into Sikkerhet in the design |

---

For each screen: the design file is the truth for layout, copy and behaviour. The prototype's
`renderVals()` / `state` in each file shows exactly which interactions exist. Mock data and
`setTimeout` "fake network" in the prototypes become real API calls.

Done screens are marked ✅ (in both tables). Tick a screen off only when: layout matches the design side by side, every interaction listed
works, loading / empty / error states exist, and all copy is identical (norsk bokmål).

Legend: → = navigates to. [S] = bottom sheet. [D] = dialog. [T] = toast.

---

## 0 · Global (build first)

- [x] `theme.ts` in place, fonts loaded (Bricolage Grotesque + Figtree), splash waits for fonts
- [x] All components in COMPONENTS.md (reference: `Komponenter.dc.html`)
- [x] Tab bar: Oppdrag · Fellesskap · (Legg ut FAB) · Innboks (badge) · Meny. Hidden on detail, chat, wizards
- [x] Main header: logo left, bell (dot) → Varsler, avatar → Profil on every main screen
- [x] No gradients anywhere. No payment UI anywhere. Payment note near every price (audited 2026-10-05)
- [x] Never show exact address or exact map pin in public views (audited 2026-10-05: no map component, areas only)
- [x] Account role from backend: `adult` | `youth` (under 18). Youth rules enforced server-side (`0038_vipps_youth.sql`, see §1b)

## 1 · Onboarding

| Design file | Screen | Must work |
|---|---|---|
| `Main.dc.html` | ✅ Velkommen | Centred logo at top (no "Logg inn" button). 3 slides auto-advance every 4.2 s, dots tappable, text animates in per slide. "Kom i gang" → LoggInn |
| `LoggInn.dc.html` | ✅ Logg inn (mock Vipps) | **Vipps only** – no phone, e-mail or BankID. "Fortsett med Vipps" → sheet: Åpner Vipps (spinner) → Bekreft i Vipps-appen (pulse) → Identitet bekreftet (drawn check, name / fødselsår / telefon) → Samtykke. Under 18 → Ungdomskonto. Note: "Vipps brukes kun til innlogging – aldri til betaling." |
| `Samtykke.dc.html` | ✅ Samtykker | Verified identity card. Required checkboxes (vilkår, personvern, alder bekreftet) + optional tips. "Godta alle". Continue disabled until required done. Expandable explanations. Consents stored with timestamp |
| `Oppsett.dc.html` | ✅ Oppsett | 3-step wizard with progress: navn (prefilled from Vipps, photo optional) → formål (3 option cards) → kommune (GPS detect with radar animation, or searchable list, optional område). Celebration with confetti → Oppdrag |

## 1b · Ungdomskonto (under 18)

| Design file | Screen | Must work |
|---|---|---|
| `Ungdomskonto.dc.html` | ✅ Opprett ungdomskonto | Shown when Vipps age < 18. "Dette kan du" / "Låst til du fyller 18" lists, info that posters see it's a youth account, 3 required checkboxes → OppdragUng |
| `OppdragUng.dc.html` | ✅ Youth app shell (offers mocked) | 4 tabs only: Oppdrag · Mine tilbud (badge = pending) · Innboks · Profil. **No Legg ut button.** Task card → [S] detail → Gi tilbud form (amount, day, message, validation) → sending → success. Card shows "Tilbud sendt" afterwards. Mine tilbud: statuses (Sendt / Venter / Godtatt / Trukket), withdraw pending. Innboks: only conversations created by an offer. Profil: locked rows → [S] "… er ikke tilgjengelig" |

Youth permission rules (backend must enforce, UI only reflects):
- ALLOWED: browse oppdrag, give tilbud, withdraw own tilbud, chat inside a conversation created by their tilbud, receive reviews, view profile, safety/report/block, privacy, log out
- BLOCKED: create/edit oppdrag, start a conversation without a tilbud, Fellesskap/Nabolag/Oppslagstavle, giving reviews, saved searches, business account, admin
- Posters see a "Ungdomskonto · 16 år" marker on offers from youth accounts
- Account becomes `adult` automatically at 18th birthday
- Open legal questions (minimum age, guardian consent) – marked `[minstealder]` in design

## 2 · Oppdrag (home)

| Design file | Screen | Must work |
|---|---|---|
| `Oppdrag.dc.html` | ✅ Oppdrag (home, default route) | "Hei, Mari" + h1. Location row → [S] GPS "Bruk posisjonen min" (spinner → found), kommune radio list, reach segmented (Min kommune / Nabokommuner / Innlandet) with animated rings → "Vis oppdrag" [T]. Search bar → Sok. Category chips filter the list. "Folk som trenger hjelp" 6 cards, save heart [T] + Angre, empty state "Ingen oppdrag i {kommune} akkurat nå. Prøv å utvide rekkevidden." "Se alle oppdrag" → SeAlle. "Oppdrag for meg" card → ForMeg. Payment note footer. **No "Folk som tilbyr hjelp" section.** |
| `Meny.dc.html` | ✅ Meny sheet | Opens from tab bar over dimmed home. User header → Profil. Utforsk tiles, sections Mitt / Tillit og trygghet / Innstillinger (rows with badges), Logg ut [D] |
| `Sok.dc.html` | ✅ Søk | Live search, clear. Filtre [S]: categories (multi), kun verifiserte, distance slider, sort. Active filter chips removable. Recent + popular searches when empty. "Lagre søk" [T]. Empty state |
| `SeAlle.dc.html` | ✅ Se alle | Sort menu (Nærmest / Nyeste / Pris), category chips, count, skeleton on reload |
| `ForMeg.dc.html` | ✅ Oppdrag for meg | Card stack: "Ikke aktuelt" flies card left, save, "Se og gi tilbud" → Oppdragsdetaljer, Angre, counter, stack/list toggle, finished state |
| `Varsler.dc.html` | ✅ Varsler | Filter chips with counts, grouped I dag / I går / Tidligere, unread tint + dot, every row deep-links, "Merk alle som lest" [T], empty state |

## 3 · Oppdrag detail & contact

| Design file | Screen | Must work |
|---|---|---|
| `Oppdragsdetaljer.dc.html` | ✅ Oppdragsdetaljer | Gallery (prev/next, counter, dots), save, share. "Åpent oppdrag" pill, budget, info grid, **approximate area** map (circle, no pin), description, practical info, owner card → Profil, report link. Sticky: payment note + "Send melding" → StartSamtale + "Gi tilbud". Gi tilbud [S]: amount (quick chips), message + templates + counter, day & time chips, forbehold → validation → preview → send → success → Chat. Footer becomes "Tilbud sendt" |
| `StartSamtale.dc.html` | ✅ Ny samtale | Pinned task card (Kari, Klippe plen). Opener chips fill composer. Send → ticks → typing → reply → "Fortsett i samtalen" → Chat |

## 4 · Tilbud og avtaler (poster side)

| Design file | Screen | Must work |
|---|---|---|
| `MottatteTilbud.dc.html` | ✅ Mottatte tilbud | Segmented Alle / Nye / Besvart, grouped by own oppdrag, status pills, "Sammenlign" → Sammenlign, rows → TilbudDetaljer |
| `TilbudDetaljer.dc.html` | ✅ Tilbudsdetaljer | Godta → [S] agreement summary + required checkbox → success (confetti) → Avtale / Chat. Avslå → [S] reasons → status + [T] Angre. Be om endring → [S]. "Vis som avsender" demo → Trekk tilbudet. *(Add youth-account marker when offer is from a youth.)* |
| `Sammenlign.dc.html` | ✅ Sammenlign | Columns, animated price bars, "Lavest pris" / "Best vurdert", sort, select column → "Gå videre med …" |
| `Avtale.dc.html` | ✅ Avtalesammendrag | Frozen agreement, stamp + timestamp, countdown, parties, timeline, Legg i kalender [T], Chat, Jobbdag, Avlys [D] |
| `MineAvtaler.dc.html` | ✅ Mine avtaler | Kommende / Fullført, week strip with dots, role pills ("Du hjelper" / "Du får hjelp"), empty day |

## 5 · Innboks, chat, job day

| Design file | Screen | Must work |
|---|---|---|
| `Innboks.dc.html` | ✅ Innboks (tab) | Search filters live, Alle / Uleste, status tags, unread counts, "Merk alle som lest", empty state. Addition (not in the design, asked for): a tick before my own last message – one = sendt, two = levert, two in cyan = lest |
| `Chat.dc.html` | ✅ Chat | Header menu [S] (profil, oppføring, mute, rapporter, blokker [D]). Pinned listing (collapsible) + pinned message. Inline OfferCard: Godta [D] → accepted state + system message + banner → Avtale / Jobbdag; Avslå + Angre. Tap bubble → reactions. Quick replies. Attach [S] (Bilde, Kamera, Foreslå tid; Send tilbud only for the helper). Foreslå tid [S] → time card with Passer / Foreslå annen. Send → Sendt → Levert → Lest, typing, reply |
| `Jobbdag.dc.html` | ✅ Jobbdag | Live timer start/pause/stop. Tabs Sjekkliste (toggle, progress ring, add) / Materialer (kr, who pays, sum, add [S]) / Bilder (before/after with drag slider). "Marker som ferdig" → Fullforing |
| `Fullforing.dc.html` | ✅ Fullføring | Two-party confirm, animation + confetti, → Vurdering; "Noe er ikke i orden?" [S] |
| `Vurdering.dc.html` | ✅ Vurdering | 5 stars with labels, tags multi-select, comment counter, recommend Ja/Nei, submit disabled until stars, success + preview |

## 6 · Legg ut (opened by the FAB — straight into the wizard, no type choice)

| Design file | Screen | Must work |
|---|---|---|
| `LeggUt.dc.html` | ✅ Veiviser, 9 steps | Kategori → Tittel (suggestions) → Beskrivelse + category questions + photos → Sted (GPS, privacy note) → Når → Pris (budget / Ønsker tilbud) → Utstyr og praktisk → Hvem kan gi tilbud → Bekreft (Endre per section). Progress bar, back, "Lagre utkast" [T], per-step validation with shake, slide transitions |
| `Forhandsvisning.dc.html` | ✅ Forhåndsvisning | Kortet / Detaljsiden toggle, readiness checklist, Rediger, Publiser (spinner) → Publisert |
| `Publisert.dc.html` | ✅ Publisert | Drawn check + confetti, live card, Del [S] (copy link [T]), Se oppføringen, Til forsiden |

## 7 · Profil

| Design file | Screen | Must work |
|---|---|---|
| `Profil.dc.html` | ✅ Min profil | Own / public view toggle, feriemodus toggle + banner, tabs Om / Vurderinger / Portefølje, verification sheets, reliability bars, endorsements |
| `RedigerProfil.dc.html` | ✅ Rediger profil | Photo [S], name locked "Fra Vipps", fields, private home notes, portfolio manager, save enabled only when dirty → [T] |
| `MineOppforinger.dc.html` | ✅ Mine oppdrag | Status chips Aktive / Pauset / Arkivert, more [S] (Rediger, Pause/Aktiver, Arkiver, Slett [D]) with animated moves + Angre |
| `Lagrede.dc.html` | ✅ Lagrede | Oppføringer (unsave collapses + Angre) / Søk (filters summary, new hits badge, alert toggle, Kjør søk, delete) |

## 8 · Tillit og trygghet

| Design file | Screen | Must work |
|---|---|---|
| `Verifisering.dc.html` | ✅ Verifisering | "Fullt verifisert med Vipps", 3-step bar (Vipps-ID, Telefon, E-post – all from Vipps), expandable "Hva ble sjekket?", bedrift link, review rules, profile checklist |
| `Sikkerhet.dc.html` | ✅ Sikkerhet | Rapporter → Rapporter, blocked users (Opphev [D]), trygge kontakter → TryggeKontakter, Trygg tur start/stop with pulse, tips accordion |
| `Rapporter.dc.html` | ✅ Rapporter | 3 steps: what → reason → details (+ screenshot, block toggle) → success with status timeline |
| `TryggeKontakter.dc.html` | ✅ Trygge kontakter | List, remove [D], add [S] with phone validation and relation chips → [T] |
| `Personvern.dc.html` | ✅ Personvern | Tips toggle writes a new timestamped consent-log row, data export progress → done, retention accordion, Vilkår, Slett konto |

## 9 · Fellesskap

| Design file | Screen | Must work |
|---|---|---|
| `Fellesskap.dc.html` | ✅ Fellesskap (tab) | Hero, Nabolag + Oppslagstavle cards, partner note, max 2 main partners, quiet supporter carousel (no autoplay), donations with "Overført", Røde Kors "Kommer" (feature flag) |
| `Nabolag.dc.html` | ✅ Nabolag | Bli med / Forlat with count ±1 [T], tabs Oppdrag / Oppslag scoped to kommune |
| `Oppslagstavle.dc.html` | ✅ Oppslagstavle | Kind filter chips, post cards, compose [S] with validation → post animates in |

## 10 · Innstillinger, bedrift, admin

| Design file | Screen | Must work |
|---|---|---|
| `Innstillinger.dc.html` | ✅ Innstillinger | Account (Vipps), location, notification toggles, feriemodus, text size, dev mode + flags, Logg ut [D], Slett konto |
| `Varslinger.dc.html` | ✅ Varslinger | Master toggle, per-category Push / E-post, quiet hours |
| `Vilkar.dc.html` | ✅ Vilkår | TOC chips jump to sections, reading progress bar, "Kort fortalt" boxes, "Til toppen" |
| `SlettKonto.dc.html` | ✅ Slett konto | What's deleted → active-agreement warning → type SLETT (disabled until exact) → goodbye |
| `Bedrift.dc.html` | ✅ Bedrift | Org.nr format + validation + lookup spinner, fields, categories, pending timeline |
| `Admin.dc.html` | ✅ Adminpanel | KPIs, tabs: reports queue actions, verifications, users (suspend), listings (hide), partners (max 2 enforced), weekly stats bars. Admin role only |

## 11 · System

| Design file | What |
|---|---|
| `Komponenter.dc.html` | Full component sheet – visual reference for COMPONENTS.md |
| `Tilstander.dc.html` | Loading (skeleton), Tom, Feil (retry), Frakoblet (banner + greyed cache + reconnect), Suksess, Ingen tilgang |
