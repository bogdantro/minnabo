# MinNabo — Design Brief

A brief describing the MinNabo app's design as it is **now**: what the app is, how it is
structured, every screen and its content, the design system ("Nabolys"), and the rules any
further design work (new screens, the website, marketing) must keep.

The app is built (React Native / Expo, ~50 screens, working) and has been re-skinned 1:1 to the
designs in `design/screens/*.dc.html`. Those files are the source of truth; this brief summarises them.
For a fuller reference (every token, component, screen and copy string) see
[docs/MINNABO_APP_FOR_WEBSITE.md](docs/MINNABO_APP_FOR_WEBSITE.md).

---

## 1. What MinNabo is

MinNabo ("My Neighbour") is a mobile app for **småjobber** (small local jobs) in the **Innlandet**
region of Norway (launch: Lillehammer, Hamar, Gjøvik og omegn). People post an **oppdrag** (a job they
need help with), neighbours send a **tilbud** (offer), they agree the details in chat, and get it done.
MinNabo never handles payment — money is arranged directly between the two people.

**Taglines (welcome screen):**
- *Småjobber nær deg.* — "Få hjelp med plenen, flyttelasset eller datamaskinen — av folk som bor i nærheten."
- *Ta en småjobb i nabolaget.* — "Finn oppdrag i din egen kommune, gi et tilbud og avtal resten i chatten."
- *Enkelt, trygt og lokalt.* — "Verifiserte profiler, ærlige vurderinger og avtaler i chatten. Pris og betaling avtaler dere direkte."

**Personality:** local, trustworthy, warm, calm, inclusive, simple, modern. A friendly community tool,
not a gig-economy marketplace or a classifieds board.

**Language:** the entire app is in **norsk bokmål** — every label, button, error, notification.
No language switcher. Copy is exactly as in the design files.

---

## 2. Who uses it

| Role | What they do |
| --- | --- |
| **Oppdragsgiver** (job poster) | Posts an oppdrag, receives tilbud, compares, accepts, chats, confirms completion, leaves a review |
| **Oppdragstaker / hjelper** (helper) | Browses oppdrag, sends tilbud, does the job, confirms, leaves a review |
| Both | One account does both. Agreements show "Du hjelper" / "Du får hjelp" |
| **Ungdomskonto** (under 18) | Limited account: browse oppdrag, give/withdraw tilbud, chat only in conversations their tilbud created (§9) |
| **Bedrift** | Verified local business, borettslag, lag or forening; org.nr checked against Enhetsregisteret |
| **Partner / sponsor** | Local businesses shown in Fellesskap on three levels: Hovedpartner (max 4, own page), Lokal helt, Lokal støttespiller |
| **Admin / moderator** | Works on the website's admin, not in the app: reports, verification, users, oppdrag, partners, categories, platform switches |

Most users are private individuals. The design centres the private-person experience.

---

## 3. The core concept — one listing type: oppdrag

There is **only one kind of listing: the oppdrag** ("Trenger hjelp" — "I need help with X").
There are **no service offers**: no "Tilbyr hjelp" listings, no "Folk som tilbyr hjelp", no provider
directory. Helpers respond to oppdrag with a tilbud; they do not advertise services.

- Badge: **"Trenger hjelp"** on cards, **"Åpent oppdrag"** on the detail page (lime tint pill with a dot).
- Others tap: **"Gi tilbud"** (primary) · **"Send melding"** (secondary).
- Budget shown as "Budsjett 400 kr", or **"Ønsker tilbud"** when the poster wants price suggestions.

### The transaction flow

1. Helper sends a **tilbud**: price in kr, message, day and time, optional **forbehold** (caveats).
   Price is informational only.
2. A **conversation** opens, tied to that oppdrag.
3. Poster sees **Mottatte tilbud**, can **Sammenlign** offers side by side, **Godta** (accept),
   **Avslå** (decline, with reasons + Angre) or **Be om endring**. Helper can **Trekk tilbudet** before acceptance.
4. On acceptance price, date, description and caveats are frozen as an **avtale** ("Låst avtale",
   "Avtalt 30. sep kl. 19:42"). Chat shows **"Tilbud godtatt"** / "Avtalegrunnlaget er låst".
   Changes must be agreed again in chat. The avtale can be cancelled ("Avlys avtalen").
5. On the job day: **Jobbdag** — shared live timer, checklist, materials, before/during/after photos,
   safety tools (Trygg tur, call/SMS).
6. **Both parties confirm completion** (Fullføring). Then each can leave **one review**
   (1–5 stars + tags "Punktlig", "Ryddig", "Vennlig", "Grundig", "God kommunikasjon", "Anbefales").

> Always visible near every price and offer: *"Pris og betaling avtales direkte mellom dere.
> MinNabo håndterer ikke betaling."*

---

## 4. Navigation & app chrome

### Bottom navigation (main screens only)

A floating white bar (radius 30, slight blur, large soft shadow), five slots:

1. **Oppdrag** — clipboard icon — *the home screen and default route. There is no separate "Home" tab.*
2. **Fellesskap** — people icon
3. **Legg ut** — a 62px **flat lime circle with a navy +**, 5px white ring, raised 30px above the bar.
   Opens the post-oppdrag wizard **directly** (no type choice)
4. **Innboks** — speech-bubble icon — unread-count badge
5. **Meny** — hamburger icon — opens a bottom sheet listing every other page

Active tab = lime-tint bubble behind the icon, icon + label in deep lime. Hidden on detail screens, chat and wizards.

### Top bar

- **Main screens:** MinNabo logo + wordmark top-left; **notification bell** (red dot when unread) and the
  **circular profile avatar** top-right (accessibility label "Åpne profil").
- **Sub screens:** back button (44px circle) left; centred title; optional right action.

### Menu sheet (from "Meny")

- Header card: avatar, name, rating, jobs, place, "Se profilen din", toggle **"Tilgjengelig for småjobber"**
- **Utforsk** (tiles): Oppdrag · Fellesskap · Innboks · Legg ut ("Nytt oppdrag")
- **Mitt:** Min profil · Mine avtaler · Mine oppdrag · Mottatte tilbud · Lagrede oppføringer og søk · Varsler
- **Tillit og trygghet:** Vurderinger og verifisering · Sikkerhet, rapportering og blokkering
- **Innstillinger:** Innstillinger · Personvern · Vilkår · Varslinger · For bedrifter
- Logg ut (confirm dialog) · "MinNabo · versjon 1.0 · Innlandet"

---

## 5. Screen inventory

Every screen, grouped. Each has the universal states (§5 end). Design file in brackets.

### Onboarding & auth
| Screen | Content |
| --- | --- |
| **Velkommen** (`Main`) | Centred logo, 3 auto-advancing slides (4.2 s, tappable dots) with an animated phone mock, "Kom i gang" |
| **Logg inn** (`LoggInn`) | **Vipps only.** "Logg inn eller opprett konto", orange **"Fortsett med Vipps"** → sheet: Åpner Vipps → Bekreft i Vipps-appen → Identitet bekreftet (name, birth year, phone). "Vipps brukes kun til innlogging – aldri til betaling." Link "Under 18 år? Se ungdomskonto" |
| **Samtykker** (`Samtykke`) | Verified identity card, required checkboxes (vilkår, personvern, alder) + optional tips, "Godta alle", expandable explanations, timestamped consent log |
| **Oppsett** (`Oppsett`) | 3 steps: navn (from Vipps, optional photo) → formål ("Jeg trenger hjelp" / "Jeg ønsker småjobber" / "Begge deler") → kommune (GPS with radar animation, or list, optional område) → confetti celebration |
| **Ungdomskonto** (`Ungdomskonto`) | "Dette kan du gjøre" / "Låst til du fyller 18" lists, required checkboxes |

### Home — Oppdrag
| Screen | Content |
| --- | --- |
| **Oppdrag** (`Oppdrag`) | "Hei, {navn}" + **"Finn hjelp eller en småjobb nær deg"**; kommune + reach row ("Lillehammer kommune · Bare min kommune" → sheet "Hvor vil du se oppdrag?": GPS, kommune list, reach Min kommune / Nabokommuner / Innlandet with animated rings); search bar; category chips; **"Folk som trenger hjelp"** (6 listing cards, save heart + Angre); "Se alle oppdrag"; dark **"Oppdrag for meg"** card; payment note footer |
| **Søk** (`Sok`) | Live search, filter sheet (multiple categories, kun verifiserte, distance, sort Relevans / Avstand / Nyeste / Pris), removable filter chips, recent + popular searches, "Lagre søk" |
| **Se alle** (`SeAlle`) | Full oppdrag list, sort (Nærmest / Nyeste / Pris), category chips, count |
| **Oppdrag for meg** (`ForMeg`) | Swipeable card stack matched to the helper: "Ikke aktuelt" (Angre), save, "Se og gi tilbud", counter, stack/list toggle, finished state |

### Oppdrag detail & contact
| Screen | Content |
| --- | --- |
| **Oppdragsdetaljer** (`Oppdragsdetaljer`) | Photo gallery (counter, dots), save, share, **"Åpent oppdrag"**, budget card, info grid, **stylised approximate-area map (circle, never a pin)**, description, practical info, owner card → profile, report link. Sticky footer: payment note + **"Send melding"** + **"Gi tilbud"**. Never shows an exact address |
| **Gi tilbud** (sheet) | Amount with quick chips, message + templates + counter, day & time chips, forbehold, validation, preview, send → success → chat. Footer then reads "Tilbud sendt" |
| **Ny samtale** (`StartSamtale`) | Pinned oppdrag card, opener chips; conversation created on first message |

### Posting — Legg ut
| Screen | Content |
| --- | --- |
| **Veiviser** (`LeggUt`) | 9 steps with progress bar ("Steg 3 av 9"): Kategori → Tittel (suggestions) → Beskrivelse + category questions + photos → Sted (GPS, "Vi viser bare et omtrentlig område til andre.") → Når → Pris (budsjett / "Ønsker tilbud", private estimate) → Utstyr og praktisk → Hvem kan gi tilbud (max distance) → Bekreft ("Endre" per section). "Lagre utkast", per-step validation with shake, slide transitions |
| **Forhåndsvisning** (`Forhandsvisning`) | Kortet / Detaljsiden toggle, readiness checklist, Rediger, Publiser |
| **Publisert** (`Publisert`) | Drawn check + confetti, live card, Del sheet (copy link, SMS, e-post, share), "Se oppføringen", "Til forsiden" |

### Tilbud & avtaler
| Screen | Content |
| --- | --- |
| **Mottatte tilbud** (`MottatteTilbud`) | Alle / Nye / Besvart, grouped by own oppdrag, status pills, "Sammenlign" |
| **Tilbudsdetaljer** (`TilbudDetaljer`) | Godta (summary + required checkbox → confetti), Avslå (reasons + Angre), Be om endring; sender: Trekk tilbudet. Youth offers marked "Ungdomskonto · 16 år" |
| **Sammenlign** (`Sammenlign`) | Columns, animated price bars, "Lavest pris" / "Best vurdert", sort, "Gå videre med …" |
| **Avtalesammendrag** (`Avtale`) | Frozen agreement with AVTALT / AVLYST stamp, countdown, parties, price, date, duration, place ("adressen er delt i chatten"), description, forbehold, timeline, Åpne chat, Legg i kalender, Åpne jobbdag, Avlys |
| **Mine avtaler** (`MineAvtaler`) | Kommende / Fullført, week strip, role pills "Du hjelper" / "Du får hjelp" |

### Inbox, chat & job day
| Screen | Content |
| --- | --- |
| **Innboks** (`Innboks`) | Live search, Alle / Uleste, status tags, unread markers, read ticks, "Merk alle som lest" |
| **Chat** (`Chat`) | Header menu (profil, oppføring, demp, rapporter, blokker); pinned oppdrag card + pinned message; ink outgoing / white incoming bubbles with Sendt → Levert → Lest; reactions; quick replies; attach sheet (Bilde, Kamera, Foreslå tid, Send tilbud for helper); inline **offer card** with "Avslå" / "Godta tilbud" → "Avtale inngått" banner |
| **Jobbdag** (`Jobbdag`) | Dark timer hero (start / pause / stop), tabs Sjekkliste / Materialer / Bilder (before/after slider), Trygghet og kontakt, "Marker jobben som ferdig" |
| **Fullføring** (`Fullforing`) | Two-party confirm, drawn check + confetti, "Noe er ikke i orden?" |
| **Vurdering** (`Vurdering`) | 5 stars with labels (Dårlig → Fantastisk!), tags, comment, recommend Ja/Nei, success + preview |

### Profile & personal
| Screen | Content |
| --- | --- |
| **Profil** (`Profil`) | Own / public view, "Verifisert med Vipps", stats, tabs Om / Vurderinger / Portefølje, verification sheets, reliability bars, "Anbefalt av naboer", feriemodus banner; others: Ta kontakt, Følg, Rapporter |
| **Rediger profil** (`RedigerProfil`) | Photo, name locked "Fra Vipps", visningsnavn, kommune/område, presentation, private home notes, portfolio |
| **Mine oppdrag** (`MineOppforinger`) | Aktive / Pauset / Arkivert; Rediger, Pause/Aktiver, Arkiver, Slett (Angre) |
| **Lagrede** (`Lagrede`) | Saved oppdrag + saved searches (new hits badge, alert bell, Kjør søk) |
| **Varsler** (`Varsler`) | Filters Alle / Tilbud / Meldinger / Avtaler / Annet, grouped I dag / I går / Tidligere, deep links |

### Trust & safety
| Screen | Content |
| --- | --- |
| **Vurderinger og verifisering** (`Verifisering`) | "Fullt verifisert med Vipps" (Vipps-ID, Telefon, E-post), "Hva ble sjekket?", review rules, "Bygg tillit" checklist |
| **Sikkerhet** (`Sikkerhet`) | Trygg tur (SMS to trusted contacts, stop/extend), Rapporter, Trygge kontakter, blocked users, tips, "Er du i akutt fare? Ring 112." |
| **Rapporter** (`Rapporter`) | What → reason (Svindel eller krav om forhåndsbetaling, Trakassering, Upassende innhold, Falsk profil, Farlig oppdrag, Annet) → details + screenshot + block → status timeline |
| **Trygge kontakter** (`TryggeKontakter`) | List (max 5), add sheet with phone validation + relation chips, remove |
| **Personvern** (`Personvern`) | Consent log, tips toggle, data export, retention accordion, Vilkår, Slett konto |

### Community — Fellesskap
| Screen | Content |
| --- | --- |
| **Fellesskap** (`Fellesskap`) | Hero *"Sammen gjør vi en forskjell"*; Nabolag + Oppslagstavle cards; partner note ("De betaler for synlighet her – aldri for plass i søket."); then three partner levels: **Hovedpartnere** (max 4, large cover cards → own page), **Lokale helter** (cards → info sheet, scoped to your kommune), **Lokale støttespillere** (logo + name in a quiet carousel, no autoplay, scoped to your kommune); **Donasjoner** with "Overført"; Røde Kors "Kommer". *Changed from the design file on request (2026-10-06): the design had max 2 main partners and no Lokal helt level* |
| **Hovedpartner** (`/partner/<id>`, no design file) | Cover photo, logo tile, "Hovedpartner" badge, name, tagline, "Om oss", "Til naboene", "Kontakt" (nettside, telefon, e-post, adresse, åpningstider, område), gallery, "Besøk nettsiden", "Takk for støtten". Empty fields are hidden |
| **Nabolag** (`Nabolag`) | Join/leave a named area group, member count, tabs Oppdrag / Oppslag |
| **Oppslagstavle** (`Oppslagstavle`) | Kinds Gis bort / Mistet og funnet / Utlån av verktøy / Generelt; cards, compose sheet, comments, "Avsluttet" |

### Youth app
| Screen | Content |
| --- | --- |
| **OppdragUng** (`OppdragUng`) | 4 tabs only: Oppdrag · Mine tilbud · Innboks · Profil. **No Legg ut button.** Locked features show a "… er ikke tilgjengelig" sheet |

### Settings, business & admin
| Screen | Content |
| --- | --- |
| **Innstillinger** (`Innstillinger`) | Account (from Vipps), location, push / e-post, feriemodus, text size, Logg ut, Slett konto |
| **Varslinger** (`Varslinger`) | Master pause, Push / E-post per type, quiet hours, test notification |
| **Vilkår** (`Vilkar`) | TOC chips, reading progress, "Kort fortalt" boxes, "Til toppen" |
| **Slett konto** (`SlettKonto`) | What is deleted → active-agreement warning → type SLETT → goodbye |
| **Bedrift** (`Bedrift`) | Org.nr with live Enhetsregisteret lookup, contact fields, categories → Sendt / Til verifisering / Verifisert |
| **Adminpanel** | Removed from the app (2026-10-11) – done on the website's admin, which shares the database |

### Universal states (`Tilstander`)
Every important screen has: **loading** (pulsing skeleton), **empty**, **error** (Prøv igjen),
**offline / frakoblet** (banner, greyed cache, "Tilkoblet igjen"), **success**, **no-access**.
Reversible actions show a toast with **"Angre"**.

---

## 6. Key components

Full spec: [docs/COMPONENTS.md](docs/COMPONENTS.md); live reference: `design/screens/Komponenter.dc.html`.

| Component | Notes |
| --- | --- |
| **Listing card** | White, radius 24, padding 12, soft shadow. 96px category-art thumbnail (or photo), "Trenger hjelp" pill (+ optional "Dugnad" / "Gjentakende"), bold one-line title, owner + ★ rating, pin row (place · distance), clock row (schedule), "Budsjett" + price in display font. Round heart save top-right (pops when saved) |
| **Buttons** | Pill-shaped, 52px. Primary = **flat lime** `#B8EE3C` with navy text; cyan `#0A74B4` white text; ink; ghost (white + border); soft; danger; Vipps orange (login only); text link `#065C8F` |
| **Pills** | 26px, Figtree 700 12. Tones: need (lime tint), neutral, dark, warn, ok, danger |
| **Chips** | White pill + border, optional coloured category icon circle; selected = ink fill, white text |
| **Avatar** | Circle, cyan ring (2px white + 2px cyan), initials on tinted fallback, online dot |
| **Fields** | 56px inputs, radius 17; focus = cyan border + soft ring; errors red with shake; big amount input with "kr"; toggles, checkboxes, radios, option cards, segmented control, tabs, range slider, day chips, photo picker, wheel picker |
| **Bottom sheets** | Radius 32 top, grabber, scrim. Location, menu, filters, Gi tilbud, attach, share, time proposal |
| **Dialog** | Centred, radius 28, spring scale-in, two buttons |
| **Toast** | Ink bg, lime icon circle, optional lime "Angre", 2.6 s |
| **Section header** | Optional 34px icon tile + display title + subtitle + "Se alle" |
| **Wizard** | 6px lime progress bar, per-step validation, sticky footer button |
| **Chat** | Bubbles, system pills, typing dots, inline offer card, payment note |
| **Celebrations** | SVG check drawn in a lime circle, confetti (lime, cyan, ink, star) |
| **Category art** | Flat category colour tile + centred Lucide icon (used where there is no photo) |

---

## 7. Design system — "Nabolys" (current)

Source: `design/screens/mn.css` → `src/theme/theme.ts`. Never hard-code values in screens.
**No gradients anywhere** — flat colours only.

### Colour
| Token | Hex | Use |
| --- | --- | --- |
| ink | `#0A1740` | Primary text, dark buttons, selected chips, outgoing bubbles |
| ink2 | `#34405F` | Secondary text |
| mute | `#5F6983` | Meta text (4.5:1 on white) |
| faint | `#8A93A8` | Meta icons, chevrons (not text) |
| line / line2 | `#E4E8EE` / `#EEF1F4` | Borders / inner dividers |
| bg | `#F3F5F1` | Screen background |
| surface / surface2 | `#FFFFFF` / `#F7F8FA` | Cards, sheets / quiet info boxes |
| lime | `#B8EE3C` | Primary action, FAB, progress |
| limeDeep | `#3B7300` | Lime text/icons on light bg, active tab |
| limeTint | `#EDF8D6` | "Trenger hjelp" pill, active tab bubble |
| cyan | `#19B8EE` | Avatar ring, accent dots |
| cyan2 | `#0A74B4` | Cyan button, focus border |
| cyanDeep | `#065C8F` | Links |
| cyanTint | `#DFF2FB` | Info backgrounds |
| star | `#F0A500` | Ratings |
| danger / tint | `#C23029` / `#FDEBE9` | Errors, destructive |
| warn / tint | `#9A5B00` / `#FFF2D9` | Warnings, pending |
| ok / okText / tint | `#2B8F4E` / `#1D6E3A` / `#E3F5E8` | Success, accepted |
| notifDot | `#F2542D` | Unread badges |
| online | `#2FBF62` | Online dot |
| vipps | `#FF5B24` | **Only** the Vipps login button |

Plus 23 category colour pairs (tile bg + icon colour) and 7 avatar colour pairs — see `theme.ts`.

### Type
- **Bricolage Grotesque** (display/headings; 500, 700, 800) — tight negative tracking.
- **Figtree** (body/UI; 400–800).
- Scale: display 42 · h1 31 · h2 24 · section 21 · h3 20 · h4 16.5 · card title 16 · body 15 · label 14 · meta 13 · note 12.5 · eyebrow 12 uppercase · tab 11. Prices in display font (19, large 34–38).

### Shape & depth
- Radius: 10 · 16 · cards 22 · listing card 24 · tiles 18 · inputs 17 · dialog 28 · sheet 32 · nav 30 · pills/buttons 999.
- Shadows soft and navy-tinted: card `0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)`;
  medium and large variants; coloured soft shadows under lime/cyan/ink buttons.
- Floating nav and sticky footers use white at 93–94 % with blur.

### Spacing & sizes
- 4 / 8 / 12 / 16 / 20 / 28 / 40. Screen padding 20 horizontal.
- Button 52 (40 / 58), input 56, chip 42, pill 26, icon button 44, min touch 44.

### Motion
- Ease `cubic-bezier(.2,.8,.2,1)`, spring overshoot `cubic-bezier(.3,1.45,.5,1)`.
- Lists fade up 16px over 550 ms, staggered 50 ms. Press scale .97 / .985.
- Sheets 450 ms, dialogs 350 ms spring, toasts visible 2.6 s, skeleton pulse 1.3 s, drawn check 600 ms, confetti 2.4 s.

### Icons
**Lucide**, stroke 2, 20px default. Line icons only (except the filled saved heart).

---

## 8. Constraints — what any design must NOT break

These are **product rules**, not visual preferences.

1. **Only one listing type: oppdrag.** No service offers / "Tilbyr hjelp" / "Folk som tilbyr hjelp" anywhere.
2. **"Legg ut" opens the post-oppdrag wizard directly** — no type-choice screen.
3. **Login is Vipps only.** No phone / e-mail / OTP / BankID login. Vipps is never used for payment.
4. **No payment UI, ever.** No "Betal nå", card fields, wallet, balance, checkout or fees.
   Show the payment note near every price and offer.
5. **Under 18 = youth account** with limited rights, enforced on the backend; the UI only reflects it.
6. **Approximate location only** in public views — never an exact address or a precise map pin.
7. **No gradients anywhere.** Flat colours only.
8. **Norsk bokmål only**, copy exactly as in the design files. Real Norwegian strings run ~15–30 % longer than English.
9. **"Oppdrag" is the home screen.** No "Home" tab. **The profile avatar is top-right on every main screen.**
10. **Calm community section** — three partner levels only (max 4 hovedpartnere, lokale helter, lokale støttespillere
    in a quiet carousel), no logo wall, no flashing, no autoplay, no auto-audio. Partners pay for visibility on
    Fellesskap, never for search placement. Sponsor deals are made outside the app.
11. **Accessibility:** 44px touch targets, labels on icon-only buttons, contrast as designed, large text, safe-area aware.
12. **Cross-platform** (React Native): flex layouts, no CSS grid; shadows via `boxShadow`, blur via `expo-blur`.

---

## 9. Youth account (under 18)

**Can:** browse oppdrag, give and withdraw tilbud, chat inside conversations their tilbud created,
receive reviews, view profile, safety / report / block, privacy, log out.

**Locked until 18:** posting oppdrag, messaging without a tilbud, Fellesskap / Nabolag / Oppslagstavle,
giving reviews, saved searches, business account, admin.

Posters see "Ungdomskonto · 16 år" on youth offers. The account becomes a normal account automatically
at 18. Minimum age is an open legal question (`[minstealder]` in the design).

---

## 10. Open design questions / still to come

- **Dark mode** — the app is light-only today.
- **Partner logos and texts** — placeholders until partners deliver them.
- **Minimum age** for youth accounts — pending legal decision.
- Data the designs show but the API doesn't have yet (offer counts on a listing, reply-time stats,
  per-offer duration) — see [docs/SCREENS.md](docs/SCREENS.md) and [docs/LEFT_OUT.md](docs/LEFT_OUT.md).

---

## 11. Sample copy (real strings)

- Home heading: **"Finn hjelp eller en småjobb nær deg"**
- Location row: **"Lillehammer kommune · Bare min kommune"**
- Section title: **"Folk som trenger hjelp"** — "Småjobber du kan ta i nærheten"
- Badges: **"Trenger hjelp"**, **"Åpent oppdrag"**, **"Dugnad"**, **"Gjentakende"**, **"Tilbud sendt"**, **"Tilbud godtatt"**
- Buttons: **"Gi tilbud"**, **"Send melding"**, **"Legg ut oppdrag"**, **"Godta tilbud"**, **"Avslå"**, **"Se alle oppdrag"**, **"Bruk posisjonen min"**, **"Fortsett med Vipps"**, **"Kom i gang"**
- Payment note: **"Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling."**
- Vipps note: **"Vipps brukes kun til innlogging – aldri til betaling."**
- Location note: **"Vi viser bare et omtrentlig område til andre."**
- Community hero: **"Sammen gjør vi en forskjell"**
- Empty state: **"Ingen oppdrag i Lillehammer akkurat nå. Prøv å utvide rekkevidden."**
- Toasts: **"Lagret i Lagrede"** + **"Angre"**
- Categories (23): Hage · Rengjøring · Flytting/bæring · Transport/levering · Montering · Snømåking ·
  Maling/vedlikehold · Dyrepass · Datahjelp · Arrangementshjelp · Snekring/småreparasjoner · Vinduspuss ·
  Bilpleie · Handling og ærender · Leksehjelp · Hus- og plantevakt · Ved og fyring · Bortkjøring og rydding ·
  Sykkelreparasjon · Matlaging og baking · Selskap og følge · Barnevakt · Annet
