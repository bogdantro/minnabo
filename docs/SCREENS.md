# MinNabo – screen-by-screen checklist

## Design file → existing route map

Routes are expo-router files in `app/`; most are one-line wrappers around a component in `src/screens/`.
Status: **exists** = a screen for this purpose is already there (still needs the re-skin) ·
**partial** = only part of the design exists, or it lives inside another screen ·
**missing** = nothing to build on.

| Design file | Route (`app/…`) | Screen component | Status | Notes |
|---|---|---|---|---|
| `Admin.dc.html` | `/admin` (`admin.tsx`) | `src/screens/AdminScreen.tsx` | exists | Behind `featureFlags.adminPanel` (off). DB role is `user` \| `admin` |
| `Avtale.dc.html` | `/avtale/[id]` | `src/screens/AvtaleSammendragScreen.tsx` | exists | Also hosts the job-day workspace today (see Jobbdag) |
| `Bedrift.dc.html` | `/bedrift` | `src/screens/BedriftRegistreringScreen.tsx` | exists | Behind `featureFlags.businessRegistration` (off) |
| `Chat.dc.html` | `/chat/[id]` | `src/screens/ChatScreen.tsx` | exists | |
| `Fellesskap.dc.html` | `/(tabs)/fellesskap` | `src/screens/FellesskapScreen.tsx` | exists | Tab |
| `ForMeg.dc.html` | `/oppdrag-for-meg` | `src/screens/LeadBoardScreen.tsx` | exists | |
| `Forhandsvisning.dc.html` | `/legg-ut/forhandsvisning` | `src/screens/LeggUt/PreviewScreen.tsx` | exists | |
| `Fullforing.dc.html` | `/fullfor/[id]` | `src/screens/CompletionScreen.tsx` | exists | |
| `Innboks.dc.html` | `/(tabs)/innboks` | `src/screens/InnboksScreen.tsx` | exists | Tab |
| `Innstillinger.dc.html` | `/innstillinger` | `src/screens/SettingsScreen.tsx` | exists | |
| `Jobbdag.dc.html` | – | `src/components/JobWorkspaceSection.tsx` (inside Avtale) | partial | No own route; data via `useJobWorkspace` / `useUpdateJobWorkspace` |
| `Komponenter.dc.html` | – (reference) | `src/components/ui/*` | n/a | Visual reference for COMPONENTS.md |
| `Lagrede.dc.html` | `/lagrede` | `src/screens/SavedScreen.tsx` | exists | |
| `LeggUt.dc.html` | `/legg-ut/trenger-jobb` | `src/screens/LeggUt/TaskRequestForm.tsx` | partial | `/legg-ut` is `LeggUt/IntroScreen.tsx`, an intro step before the form – the FAB must go straight into the wizard (rule 2). Form is not the 9-step wizard yet |
| `LoggInn.dc.html` | `/logg-inn` | `src/screens/Onboarding/LoginScreen.tsx` | partial | Today: Supabase **e-mail OTP**. Must become Vipps-only (rule 3) – needs backend (Vipps OIDC) |
| `Main.dc.html` | `/velkommen` | `src/screens/Onboarding/WelcomeScreen.tsx` | exists | Anon users are redirected here from `(tabs)/_layout.tsx` |
| `Meny.dc.html` | – (sheet) | `src/components/MenySheet.tsx` + `src/config/appMenu.ts` | exists | Opened from `BottomNav` inside `TabBar` |
| `MineAvtaler.dc.html` | `/avtaler` | `src/screens/AgendaScreen.tsx` | exists | |
| `MineOppforinger.dc.html` | `/mine` | `src/screens/MyListingsScreen.tsx` | exists | Menu label still says "Mine oppdrag og tjenester" |
| `MottatteTilbud.dc.html` | `/tilbud` | `src/screens/MottatteTilbudScreen.tsx` | exists | |
| `Nabolag.dc.html` | `/nabolag` | `src/screens/NeighbourhoodScreen.tsx` | exists | |
| `Oppdrag.dc.html` | `/(tabs)/index` (home) | `src/screens/OppdragScreen.tsx` | exists | Default route |
| `OppdragUng.dc.html` | – | – | **missing** | Youth shell (4 tabs, no Legg ut). No youth role in backend yet (`profiles.role` is `user` \| `admin`) |
| `Oppdragsdetaljer.dc.html` | `/oppdrag/[id]` | `src/screens/TaskDetailScreen.tsx` | exists | Route also renders `ServiceOfferDetailScreen` for `SERVICE_OFFER` (remove, rule 1). Gi tilbud is a sheet in the design; today it is `/tilbud/ny` → `SendProposalScreen` |
| `Oppsett.dc.html` | `/oppsett` | `src/screens/Onboarding/SetupScreen.tsx` | exists | Signed-in users without `onboardedAt` are redirected here |
| `Oppslagstavle.dc.html` | `/oppslagstavle` | `src/screens/NoticeboardScreen.tsx` | exists | |
| `Personvern.dc.html` | `/personvern` | `src/screens/InfoPageScreen.tsx` (static text) | partial | Design needs consent toggle + log, data export (`src/lib/dataExport.ts` exists), retention accordion |
| `Profil.dc.html` | `/profil`, `/profil/[id]` | `src/screens/ProfileScreen.tsx` | exists | Own vs public via `profileId` param |
| `Publisert.dc.html` | `/legg-ut/publisert` | `src/screens/LeggUt/PublishedScreen.tsx` | exists | |
| `Rapporter.dc.html` | `/rapporter` | `src/screens/SafetyScreen.tsx` (with `targetType`) | partial | Shares a component with Sikkerhet; design is a separate 3-step flow |
| `RedigerProfil.dc.html` | `/profil/rediger` | `src/screens/EditProfileScreen.tsx` | exists | |
| `Sammenlign.dc.html` | `/tilbud/sammenlign/[listingId]` | `src/screens/SammenlignTilbudScreen.tsx` | exists | |
| `Samtykke.dc.html` | `/samtykker` | `src/screens/Onboarding/ConsentScreen.tsx` | exists | |
| `SeAlle.dc.html` | `/oppdrag-liste` | `src/screens/ListingListScreen.tsx` (`type="TASK_REQUEST"`) | exists | |
| `Sikkerhet.dc.html` | `/sikkerhet` | `src/screens/SafetyScreen.tsx` | exists | Blocked list is a separate route today (`/blokkerte` → `BlockedListScreen`); design has it inline |
| `SlettKonto.dc.html` | `/slett-konto` | `src/screens/DeleteAccountScreen.tsx` | exists | Backend: `supabase/functions/delete-account` |
| `Sok.dc.html` | `/sok` | `src/screens/SearchScreen.tsx` | exists | Has a Trenger/Tilbyr type filter (`SERVICE_OFFER`) – remove (rule 1) |
| `StartSamtale.dc.html` | `/chat/start?listing=` | `app/chat/start.tsx` (inline, no screen) | partial | Today only a spinner that creates the conversation and redirects to `/chat/[id]` |
| `TilbudDetaljer.dc.html` | `/tilbud/[id]` | `src/screens/TilbudDetaljScreen.tsx` | exists | |
| `Tilstander.dc.html` | – (reference) | `src/components/ui/ScreenState.tsx`, `FallbackScreen.tsx`, `OfflineBanner.tsx` | partial | No NoAccess / Success states yet |
| `TryggeKontakter.dc.html` | `/trygge-kontakter` | `src/screens/TrustedContactsScreen.tsx` | exists | |
| `Ungdomskonto.dc.html` | – | – | **missing** | Needs age from Vipps + youth role/permissions on backend |
| `Varsler.dc.html` | `/varsler` | `src/screens/NotificationsScreen.tsx` | exists | |
| `Varslinger.dc.html` | `/varslinger` | `src/screens/NotificationPrefsScreen.tsx` | exists | |
| `Verifisering.dc.html` | `/verifisering` | `src/screens/VerifiseringssenterScreen.tsx` | exists | |
| `Vilkar.dc.html` | `/vilkar` | `src/screens/InfoPageScreen.tsx` (static text) | partial | Design needs TOC chips, progress bar, "Kort fortalt" boxes |
| `Vurdering.dc.html` | `/vurder/[id]` | `src/screens/ReviewScreen.tsx` | exists | |

Existing routes with **no** design file:

| Route | Component | What to do |
|---|---|---|
| `/tilbydere` | `ListingListScreen` (`type="SERVICE_OFFER"`) | Service offers – remove (rule 1) |
| `/oppdrag/[id]` for offers | `src/screens/ServiceOfferDetailScreen.tsx` | Service offers – remove (rule 1) |
| `/legg-ut` | `src/screens/LeggUt/IntroScreen.tsx` | Intro step before the form – remove / point FAB at the wizard (rule 2) |
| `/tilbud/ny` | `SendProposalScreen` (`mode="give"`) | Becomes the Gi tilbud sheet in Oppdragsdetaljer |
| `/tilbud/be-om` | `SendProposalScreen` (`mode="request"`) | Only linked from `ServiceOfferDetailScreen` – goes with the service-offer flow (rule 1) |
| `/blokkerte` | `src/screens/BlockedListScreen.tsx` | Folded into Sikkerhet in the design |

---

For each screen: the design file is the truth for layout, copy and behaviour. The prototype's
`renderVals()` / `state` in each file shows exactly which interactions exist. Mock data and
`setTimeout` "fake network" in the prototypes become real API calls.

Tick a screen off only when: layout matches the design side by side, every interaction listed
works, loading / empty / error states exist, and all copy is identical (norsk bokmål).

Legend: → = navigates to. [S] = bottom sheet. [D] = dialog. [T] = toast.

---

## 0 · Global (build first)

- [ ] `theme.ts` in place, fonts loaded (Bricolage Grotesque + Figtree), splash waits for fonts
- [ ] All components in COMPONENTS.md
- [ ] Tab bar: Oppdrag · Fellesskap · (Legg ut FAB) · Innboks (badge) · Meny. Hidden on detail, chat, wizards
- [ ] Main header: logo left, bell (dot) → Varsler, avatar → Profil on every main screen
- [ ] No gradients anywhere. No payment UI anywhere. Payment note near every price
- [ ] Never show exact address or exact map pin in public views
- [ ] Account role from backend: `adult` | `youth` (under 18). Youth rules enforced server-side (see §1b)

## 1 · Onboarding

| Design file | Screen | Must work |
|---|---|---|
| `Main.dc.html` | Velkommen | Centred logo at top (no "Logg inn" button). 3 slides auto-advance every 4.2 s, dots tappable, text animates in per slide. "Kom i gang" → LoggInn |
| `LoggInn.dc.html` | Logg inn | **Vipps only** – no phone, e-mail or BankID. "Fortsett med Vipps" → sheet: Åpner Vipps (spinner) → Bekreft i Vipps-appen (pulse) → Identitet bekreftet (drawn check, name / fødselsår / telefon) → Samtykke. Under 18 → Ungdomskonto. Note: "Vipps brukes kun til innlogging – aldri til betaling." |
| `Samtykke.dc.html` | Samtykker | Verified identity card. Required checkboxes (vilkår, personvern, alder bekreftet) + optional tips. "Godta alle". Continue disabled until required done. Expandable explanations. Consents stored with timestamp |
| `Oppsett.dc.html` | Oppsett | 3-step wizard with progress: navn (prefilled from Vipps, photo optional) → formål (3 option cards) → kommune (GPS detect with radar animation, or searchable list, optional område). Celebration with confetti → Oppdrag |

## 1b · Ungdomskonto (under 18)

| Design file | Screen | Must work |
|---|---|---|
| `Ungdomskonto.dc.html` | Opprett ungdomskonto | Shown when Vipps age < 18. "Dette kan du" / "Låst til du fyller 18" lists, info that posters see it's a youth account, 3 required checkboxes → OppdragUng |
| `OppdragUng.dc.html` | Youth app shell | 4 tabs only: Oppdrag · Mine tilbud (badge = pending) · Innboks · Profil. **No Legg ut button.** Task card → [S] detail → Gi tilbud form (amount, day, message, validation) → sending → success. Card shows "Tilbud sendt" afterwards. Mine tilbud: statuses (Sendt / Venter / Godtatt / Trukket), withdraw pending. Innboks: only conversations created by an offer. Profil: locked rows → [S] "… er ikke tilgjengelig" |

Youth permission rules (backend must enforce, UI only reflects):
- ALLOWED: browse oppdrag, give tilbud, withdraw own tilbud, chat inside a conversation created by their tilbud, receive reviews, view profile, safety/report/block, privacy, log out
- BLOCKED: create/edit oppdrag, start a conversation without a tilbud, Fellesskap/Nabolag/Oppslagstavle, giving reviews, saved searches, business account, admin
- Posters see a "Ungdomskonto · 16 år" marker on offers from youth accounts
- Account becomes `adult` automatically at 18th birthday
- Open legal questions (minimum age, guardian consent) – marked `[minstealder]` in design

## 2 · Oppdrag (home)

| Design file | Screen | Must work |
|---|---|---|
| `Oppdrag.dc.html` | Oppdrag (home, default route) | "Hei, Mari" + h1. Location row → [S] GPS "Bruk posisjonen min" (spinner → found), kommune radio list, reach segmented (Min kommune / Nabokommuner / Innlandet) with animated rings → "Vis oppdrag" [T]. Search bar → Sok. Category chips filter the list. "Folk som trenger hjelp" 6 cards, save heart [T] + Angre, empty state "Ingen oppdrag i {kommune} akkurat nå. Prøv å utvide rekkevidden." "Se alle oppdrag" → SeAlle. "Oppdrag for meg" card → ForMeg. Payment note footer. **No "Folk som tilbyr hjelp" section.** |
| `Meny.dc.html` | Meny sheet | Opens from tab bar over dimmed home. User header → Profil. Utforsk tiles, sections Mitt / Tillit og trygghet / Innstillinger (rows with badges), Logg ut [D] |
| `Sok.dc.html` | Søk | Live search, clear. Filtre [S]: categories (multi), kun verifiserte, distance slider, sort. Active filter chips removable. Recent + popular searches when empty. "Lagre søk" [T]. Empty state |
| `SeAlle.dc.html` | Se alle | Sort menu (Nærmest / Nyeste / Pris), category chips, count, skeleton on reload |
| `ForMeg.dc.html` | Oppdrag for meg | Card stack: "Ikke aktuelt" flies card left, save, "Se og gi tilbud" → Oppdragsdetaljer, Angre, counter, stack/list toggle, finished state |
| `Varsler.dc.html` | Varsler | Filter chips with counts, grouped I dag / I går / Tidligere, unread tint + dot, every row deep-links, "Merk alle som lest" [T], empty state |

## 3 · Oppdrag detail & contact

| Design file | Screen | Must work |
|---|---|---|
| `Oppdragsdetaljer.dc.html` | Oppdragsdetaljer | Gallery (prev/next, counter, dots), save, share. "Åpent oppdrag" pill, budget, info grid, **approximate area** map (circle, no pin), description, practical info, owner card → Profil, report link. Sticky: payment note + "Send melding" → StartSamtale + "Gi tilbud". Gi tilbud [S]: amount (quick chips), message + templates + counter, day & time chips, forbehold → validation → preview → send → success → Chat. Footer becomes "Tilbud sendt" |
| `StartSamtale.dc.html` | Ny samtale | Pinned task card (Kari, Klippe plen). Opener chips fill composer. Send → ticks → typing → reply → "Fortsett i samtalen" → Chat |

## 4 · Tilbud og avtaler (poster side)

| Design file | Screen | Must work |
|---|---|---|
| `MottatteTilbud.dc.html` | Mottatte tilbud | Segmented Alle / Nye / Besvart, grouped by own oppdrag, status pills, "Sammenlign" → Sammenlign, rows → TilbudDetaljer |
| `TilbudDetaljer.dc.html` | Tilbudsdetaljer | Godta → [S] agreement summary + required checkbox → success (confetti) → Avtale / Chat. Avslå → [S] reasons → status + [T] Angre. Be om endring → [S]. "Vis som avsender" demo → Trekk tilbudet. *(Add youth-account marker when offer is from a youth.)* |
| `Sammenlign.dc.html` | Sammenlign | Columns, animated price bars, "Lavest pris" / "Best vurdert", sort, select column → "Gå videre med …" |
| `Avtale.dc.html` | Avtalesammendrag | Frozen agreement, stamp + timestamp, countdown, parties, timeline, Legg i kalender [T], Chat, Jobbdag, Avlys [D] |
| `MineAvtaler.dc.html` | Mine avtaler | Kommende / Fullført, week strip with dots, role pills ("Du hjelper" / "Du får hjelp"), empty day |

## 5 · Innboks, chat, job day

| Design file | Screen | Must work |
|---|---|---|
| `Innboks.dc.html` | Innboks (tab) | Search filters live, Alle / Uleste, status tags, unread counts, "Merk alle som lest", empty state |
| `Chat.dc.html` | Chat | Header menu [S] (profil, oppføring, mute, rapporter, blokker [D]). Pinned listing (collapsible) + pinned message. Inline OfferCard: Godta [D] → accepted state + system message + banner → Avtale / Jobbdag; Avslå + Angre. Tap bubble → reactions. Quick replies. Attach [S] (Bilde, Kamera, Foreslå tid; Send tilbud only for the helper). Foreslå tid [S] → time card with Passer / Foreslå annen. Send → Sendt → Levert → Lest, typing, reply |
| `Jobbdag.dc.html` | Jobbdag | Live timer start/pause/stop. Tabs Sjekkliste (toggle, progress ring, add) / Materialer (kr, who pays, sum, add [S]) / Bilder (before/after with drag slider). "Marker som ferdig" → Fullforing |
| `Fullforing.dc.html` | Fullføring | Two-party confirm, animation + confetti, → Vurdering; "Noe er ikke i orden?" [S] |
| `Vurdering.dc.html` | Vurdering | 5 stars with labels, tags multi-select, comment counter, recommend Ja/Nei, submit disabled until stars, success + preview |

## 6 · Legg ut (opened by the FAB — straight into the wizard, no type choice)

| Design file | Screen | Must work |
|---|---|---|
| `LeggUt.dc.html` | Veiviser, 9 steps | Kategori → Tittel (suggestions) → Beskrivelse + category questions + photos → Sted (GPS, privacy note) → Når → Pris (budget / Ønsker tilbud) → Utstyr og praktisk → Hvem kan gi tilbud → Bekreft (Endre per section). Progress bar, back, "Lagre utkast" [T], per-step validation with shake, slide transitions |
| `Forhandsvisning.dc.html` | Forhåndsvisning | Kortet / Detaljsiden toggle, readiness checklist, Rediger, Publiser (spinner) → Publisert |
| `Publisert.dc.html` | Publisert | Drawn check + confetti, live card, Del [S] (copy link [T]), Se oppføringen, Til forsiden |

## 7 · Profil

| Design file | Screen | Must work |
|---|---|---|
| `Profil.dc.html` | Min profil | Own / public view toggle, feriemodus toggle + banner, tabs Om / Vurderinger / Portefølje, verification sheets, reliability bars, endorsements |
| `RedigerProfil.dc.html` | Rediger profil | Photo [S], name locked "Fra Vipps", fields, private home notes, portfolio manager, save enabled only when dirty → [T] |
| `MineOppforinger.dc.html` | Mine oppdrag | Status chips Aktive / Pauset / Arkivert, more [S] (Rediger, Pause/Aktiver, Arkiver, Slett [D]) with animated moves + Angre |
| `Lagrede.dc.html` | Lagrede | Oppføringer (unsave collapses + Angre) / Søk (filters summary, new hits badge, alert toggle, Kjør søk, delete) |

## 8 · Tillit og trygghet

| Design file | Screen | Must work |
|---|---|---|
| `Verifisering.dc.html` | Verifisering | "Fullt verifisert med Vipps", 3-step bar (Vipps-ID, Telefon, E-post – all from Vipps), expandable "Hva ble sjekket?", bedrift link, review rules, profile checklist |
| `Sikkerhet.dc.html` | Sikkerhet | Rapporter → Rapporter, blocked users (Opphev [D]), trygge kontakter → TryggeKontakter, Trygg tur start/stop with pulse, tips accordion |
| `Rapporter.dc.html` | Rapporter | 3 steps: what → reason → details (+ screenshot, block toggle) → success with status timeline |
| `TryggeKontakter.dc.html` | Trygge kontakter | List, remove [D], add [S] with phone validation and relation chips → [T] |
| `Personvern.dc.html` | Personvern | Tips toggle writes a new timestamped consent-log row, data export progress → done, retention accordion, Vilkår, Slett konto |

## 9 · Fellesskap

| Design file | Screen | Must work |
|---|---|---|
| `Fellesskap.dc.html` | Fellesskap (tab) | Hero, Nabolag + Oppslagstavle cards, partner note, max 2 main partners, quiet supporter carousel (no autoplay), donations with "Overført", Røde Kors "Kommer" (feature flag) |
| `Nabolag.dc.html` | Nabolag | Bli med / Forlat with count ±1 [T], tabs Oppdrag / Oppslag scoped to kommune |
| `Oppslagstavle.dc.html` | Oppslagstavle | Kind filter chips, post cards, compose [S] with validation → post animates in |

## 10 · Innstillinger, bedrift, admin

| Design file | Screen | Must work |
|---|---|---|
| `Innstillinger.dc.html` | Innstillinger | Account (Vipps), location, notification toggles, feriemodus, text size, dev mode + flags, Logg ut [D], Slett konto |
| `Varslinger.dc.html` | Varslinger | Master toggle, per-category Push / E-post, quiet hours |
| `Vilkar.dc.html` | Vilkår | TOC chips jump to sections, reading progress bar, "Kort fortalt" boxes, "Til toppen" |
| `SlettKonto.dc.html` | Slett konto | What's deleted → active-agreement warning → type SLETT (disabled until exact) → goodbye |
| `Bedrift.dc.html` | Bedrift | Org.nr format + validation + lookup spinner, fields, categories, pending timeline |
| `Admin.dc.html` | Adminpanel | KPIs, tabs: reports queue actions, verifications, users (suspend), listings (hide), partners (max 2 enforced), weekly stats bars. Admin role only |

## 11 · System

| Design file | What |
|---|---|
| `Komponenter.dc.html` | Full component sheet – visual reference for COMPONENTS.md |
| `Tilstander.dc.html` | Loading (skeleton), Tom, Feil (retry), Frakoblet (banner + greyed cache + reconnect), Suksess, Ingen tilgang |
