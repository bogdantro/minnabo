# MinNabo — Design Brief

A brief for redesigning the MinNabo app's visual design. It describes what the
app is, how it is structured, every screen and its content, the current design
system, and which things a new design must keep vs. is free to change.

The app is built (React Native / Expo, ~50 screens, working). This is a
**re-skin / visual redesign** — the screens, flows and content below are fixed;
the look is what's being redesigned.

---

## 1. What MinNabo is

MinNabo ("My Neighbour") is a mobile app for **småjobber** (small local jobs) in
the Innlandet region of Norway. People post a job they need help with, or offer a
service they can do, and neighbours connect, agree a price in chat, and get it
done. MinNabo never handles payment — money is arranged directly between the two
people.

**Tagline:** *Småjobber nær deg. Enkelt, trygt og lokalt.*
("Small jobs near you. Simple, safe and local.")

**Personality:** local, trustworthy, energetic, inclusive, simple, modern. It
should feel like a friendly community tool, not a gig-economy marketplace or a
classifieds board. Warm and calm, not loud.

**Language:** the entire app is in **norsk bokmål** — every label, button, error,
notification. No language switcher. (Sample copy is given throughout this doc so
the designer can typeset real strings.)

---

## 2. Who uses it

| Role | What they do |
| --- | --- |
| **Oppdragsgiver** (job poster) | Posts a task, receives offers, picks one, chats, confirms completion, leaves a review |
| **Oppdragstaker** (helper) | Browses tasks or posts a service offer, sends offers, does the job |
| Both | One account does both — a person is often both poster and helper |
| **Bedrift** (business) | A verified local trade business; same app, org number + verification |
| **Partner / sponsor** | Local businesses shown in the Fellesskap (community) section |
| **Admin / moderator** | Handles reports, verifications, users, listings, partners, stats |

Most users are private individuals. The design should center the private-person
experience.

---

## 3. The core concept — two listing types

This is the single most important thing to get right. There are **two kinds of
listing** and they must never be confused:

| | **A · Oppdrag** (task request) | **B · Tjenestetilbud** (service offer) |
| --- | --- | --- |
| Meaning | "I need help with X" | "I can do X for you" |
| Owner | The person who needs help | The person offering to help |
| Badge | **Trenger hjelp** / **Åpent oppdrag** (lime green) | **Tilbyr hjelp** (cyan) |
| Others tap | **Gi tilbud** (give an offer) · **Send melding** | **Ta kontakt** (get in touch) · **Be om tilbud** (request an offer) |
| Example | "Klippe plen" (Mow lawn) | "Jeg kan klippe plenen din" (I can mow your lawn) |

Both types use the **same card layout** (so a search for "lawn" shows both in one
list) but with **different badge colour, different terminology, different primary
button**. A searcher must be able to tell at a glance which is which.

### The transaction flow

1. Helper sends a **tilbud** (offer): proposed price in NOK, short message,
   date/time, caveats. Price is informational only.
2. A **conversation** opens, tied to that listing.
3. Poster can compare offers, ask for changes, **godta** (accept) or **avslå**
   (decline). Helper can withdraw before acceptance.
4. On acceptance: price, date, description, caveats are frozen as an
   **avtalegrunnlag** (agreement). Chat shows **"Tilbud godtatt"**.
5. On the job day: an optional shared **job workspace** (checklist, materials,
   before/after photos, a time tracker).
6. Both parties **confirm completion**. Then each can leave **one review**
   (1–5 stars + quick tags like "Punktlig", "Ryddig").

> Always visible near the offer: *"Pris og betaling avtales direkte mellom dere.
> MinNabo håndterer ikke betaling."*

---

## 4. Navigation & app chrome

### Bottom navigation (main screens only)

Five slots, fixed:

1. **Oppdrag** — clipboard icon — *this is the home screen, the default route.
   There is no separate "Home" tab.*
2. **Fellesskap** — people/group icon
3. **Legg ut** — large raised **lime-green gradient + button** (a FAB that sits
   above the bar), opens the post-a-listing choice
4. **Innboks** — speech-bubble icon — shows an unread-count badge
5. **Meny** — hamburger icon — opens a bottom sheet listing every other page

Active tab = lime green icon + label. The bottom nav hides on detail screens and
chat.

### Top bar

- **Main screens:** MinNabo **logo + wordmark** top-left; **notification bell**
  (with unread dot) and **circular profile avatar** top-right. The avatar is a
  permanent shortcut — tapping it opens the profile. Accessibility label "Åpne
  profil".
- **Sub screens:** back arrow + MinNabo logo icon left; optional centered title;
  optional right-side node.
- **Detail screens** (listing / offer detail): back + logo + title + bell +
  avatar.

### Menu sheet (from "Meny")

A bottom sheet, sectioned:

- **Utforsk:** Oppdrag · Fellesskap · Innboks · Legg ut
- **Mitt:** Min profil · Mine avtaler · Mine oppdrag og tjenester · Mottatte
  tilbud · Lagrede oppføringer og søk · Varsler
- **Tillit og trygghet:** Vurderinger og verifisering · Sikkerhet, rapportering
  og blokkering
- **Innstillinger:** Innstillinger · Personvern · Vilkår · Varslinger · For
  bedrifter · Adminpanel

---

## 5. Screen inventory

Every screen the design needs to cover, grouped. Each has states (see §7).

### Onboarding & auth
| Screen | Content |
| --- | --- |
| **Velkommen / intro** | Brand, tagline, value proposition, "Kom i gang" |
| **Logg inn / opprett konto** | Phone or email + one-time code (OTP). Architecture supports BankID later |
| **Verifisering og samtykker** | Consent checkboxes: terms, privacy, age. GDPR consent log |
| **Oppsett** (role + place) | Name, purpose choice ("Jeg trenger hjelp" / "Jeg ønsker småjobber" / "Begge deler"), **kommune** (municipality) picker + free-text place, a "Bruk posisjonen min" button that detects the kommune from GPS |

### Home — Oppdrag (front page)
| Screen | Content |
| --- | --- |
| **Oppdrag** | Heading *"Finn hjelp eller en småjobb nær deg"*; a **kommune + reach** row ("Lillehammer kommune · Bare min kommune", opens a sheet with GPS detect / kommune picker / a 3-step reach control); a search bar; a horizontal **category chip** row; then two sections — **"Folk som tilbyr hjelp"** (service offers, with a horizontal row of active provider avatars) and **"Folk som trenger hjelp"** (task requests), each showing ~4 listing cards + a "Se alle" button; a link to the personal lead board; a footer note |
| **Søk** | Full search: query field, type filter (Alle / Oppdrag / Tilbud), category, verified-only, sort (Relevans / Avstand / Nyeste / Pris); results as listing cards; recent searches; "Lagre søk" |
| **Oppdrag-liste / Tilbydere** ("Se alle") | A filtered full list of one type — sort dropdown, category chips, cards |
| **Oppdrag for meg** (lead board) | For helpers: a swipeable stack / list of task requests matched to them, each dismissable ("Ikke aktuelt") |

### Listing content
| Screen | Content |
| --- | --- |
| **Oppdragsdetaljer** (task request detail) | Image gallery + counter, save (heart) button, title, category, **"Åpent oppdrag"** badge, price/budget, approximate place + distance, date, expected duration, description, practical info, equipment, an **owner card** (avatar, name, rating, verifications, member-since). Sticky actions: primary **"Gi tilbud"**, secondary **"Send melding"**, text *"Pris og betaling avtales mellom dere."* Never shows exact address |
| **Tilbyderdetaljer** (service offer detail) | One large image, **"Tilbyr hjelp"** badge, title, category, from-price or "Pris avtales", ratings, **explained verifications**, service area + max travel distance, availability, equipment, "Om tilbudet", experience, list of services, provider card. Sticky actions: primary **"Ta kontakt"**, secondary **"Be om tilbud"** |

### Posting a listing
| Screen | Content |
| --- | --- |
| **Legg ut** (choice) | Always first: two big choices — **"Jeg trenger en jobb utført"** and **"Jeg ønsker å utføre en jobb"** |
| **Trenger jobb** form | Multi-step wizard: category → title → description + category-specific intake questions → place + kommune → date/time + duration → budget or "Ønsker tilbud" → equipment / materials / practical info → who can offer → confirm |
| **Tilby jobb** form | Multi-step wizard: category → title → services → presentation → area + max distance → availability (weekdays, time of day) → transport / equipment → experience → price ("Fra" / "Pris avtales") → who can contact → confirm |
| **Forhåndsvisning** | Full preview of the card + detail as others will see it, before publishing |
| **Publisert** | Success screen — confirmation, "Del", "Se oppføringen", tip about notifying matching helpers |

### Offers & agreements
| Screen | Content |
| --- | --- |
| **Mottatte tilbud** | List of offers received across your listings, grouped by listing, with status |
| **Send / be om tilbud** | Form: amount (NOK), message, proposed date/time, caveats |
| **Tilbudsdetaljer** | One offer: amount, schedule, message, caveats, status; actions to accept / decline / request revision / withdraw |
| **Sammenlign tilbud** | Side-by-side comparison of multiple offers on one listing — price, schedule, rating, "Lavest pris" marker |
| **Avtalesammendrag** (agreement summary) | The frozen agreement: price, date, description, caveats, both parties, "avtalt" timestamp |

### Inbox & chat
| Screen | Content |
| --- | --- |
| **Innboks** | Title "Innboks", search field "Søk i meldinger", filters **Alle / Uleste**, conversation rows: avatar, name, the listing it's about, last message, time, unread dot, status tags **"Nytt tilbud"** / **"Tilbud godtatt"** |
| **Chat** | Back + counterpart avatar/name + optional online status + report menu; a compact listing card pinned at top; chat bubbles (outgoing = filled, incoming = light grey/blue) with timestamps and sent/delivered/read ticks; image attachments; message reactions; a pinned message; composer with attach + **"Send tilbud"** (when the role allows); **offer cards** inline showing price/date/description/caveats with **"Godta tilbud" / "Avslå"** for the right recipient; quick replies; a time-proposal sheet |
| **Start samtale** | Entry when messaging about a listing with no existing thread |

### Job execution
| Screen | Content |
| --- | --- |
| **Job workspace** (in chat, day of job) | Shared checklist, materials list with kr amounts, before/after photo pairs, a start/stop time tracker |
| **Fullføring** | Both parties confirm completion; shows who has confirmed |
| **Vurdering** (review) | 1–5 stars, optional comment, quick tags ("Punktlig", "Ryddig", "Vennlig" …). One review per agreement |

### Profile & personal
| Screen | Content |
| --- | --- |
| **Min profil / Offentlig profil** | Avatar, name, area, "medlem siden", presentation, services & categories, verification badges (each explains what was checked), completed-jobs count, star rating + review list, reliability stats (shows-up / on-time / completes), skill endorsements from neighbours, portfolio (before/after photos), holiday-mode toggle |
| **Rediger profil** | Edit name, photo, presentation, place, home notes, portfolio |
| **Mine oppdrag og tjenester** | Your own listings, by type and status, with edit/pause/archive |
| **Mine avtaler** (agenda) | Accepted agreements you're part of — upcoming and done |
| **Lagrede** | Saved listings + saved searches (each saved search shows its filter summary and re-runs) |
| **Varsler** | Notification list: new message, new/changed/withdrawn offer, offer accepted/declined, agreed time, completion requested, review received, moderation. Each deep-links |

### Trust & safety
| Screen | Content |
| --- | --- |
| **Vurderinger og verifisering** | Your verifications (phone / email / business) with explanations; how to verify |
| **Sikkerhet, rapportering og blokkering** | Report a user/listing/offer/message/review; blocked-users list; trusted contacts; "safe trip" sharing |
| **Trygge kontakter** | Add contacts who can be notified when you go to a job |
| **Personvern / samtykker** | Consent log, data export, account deletion, retention info |

### Community — Fellesskap
| Screen | Content |
| --- | --- |
| **Fellesskap** | Hero *"Sammen gjør vi en forskjell"*; links to Nabolag and Oppslagstavle; a partner note; **up to 2 main partners** with premium placement (cards); **local supporters** in a calm horizontal carousel; a list of **documented donations** actually transferred (amount + recipient + period + "Overført"); a pending note about Røde Kors (behind a feature flag). No cluttered logo wall, no flashing banners, no auto audio |
| **Nabolag** (neighbourhood group) | Join/leave a named neighbourhood group; member count; local tasks and local noticeboard posts scoped to your kommune |
| **Oppslagstavle** (noticeboard) | Community posts: giveaways, lost & found, tool lending, general — kind filter chips, a compose form, post rows scoped to your kommune |

### Settings & business
| Screen | Content |
| --- | --- |
| **Innstillinger** | Account, location, notifications toggles, holiday mode, dev switch |
| **Vilkår / Personvern (docs)** | Long-form legal text screens |
| **Varslinger** | Fine-grained push/email notification preferences |
| **Slett konto** | Account deletion flow with confirmation |
| **Bedriftsregistrering** | Org number, company name, contact person, email, phone, categories → verification pending |
| **Adminpanel** | Moderation queues, reports, verification approvals, partner management, stats. Admin-only |

### Universal states
Every important screen also needs: **loading**, **empty**, **error**,
**offline / frakoblet**, **success**, **no-access**.

---

## 6. Key components (anatomy to redesign)

| Component | Notes |
| --- | --- |
| **Listing card** (row) | 96px thumbnail (with a small online dot), title (1 line), a badge row (type badge + optional "Dugnad" / "Gjentakende"), owner name + ★ rating, a place + distance meta row (pin icon), an availability/schedule meta row (clock icon), a large price line, a heart/save button top-right. One layout for both listing types |
| **Buttons** | Primary = lime-green (a subtle lime gradient is allowed, used on primary CTAs and "Legg ut"); secondary = white with a coloured border; ghost = text only. Large tap targets |
| **Status pills** | Calm, textual, rounded. Tones: lime (positive / needs-help), cyan (offer / links), neutral grey. A "soft" variant with tint background |
| **Category chips** | Icon + label, horizontally scrolling, active state filled |
| **Avatar** | Circular, with a **cyan ring**; falls back to initials on a tinted background |
| **Fields** | Rounded text fields with a label above; select fields, date/time fields, amount field (NOK), image-picker field, tag input, chip-select, toggle rows, a wheel picker, a distance slider |
| **Bottom sheets** | Used for the location picker, menu, attach, share, send-offer, time-proposal, message actions |
| **Section headers** | Icon + title + optional "Se alle" link. A "rich" variant with a subtitle |
| **Wizard** | Step progress indicator + per-step validation + a sticky footer button |
| **Screen states** | Shared loading skeletons, empty/error/offline illustrations + retry |
| **Toast** | Transient confirmation messages |
| **Verification badge** | Small, tappable, explains what was checked |

---

## 7. Current design system (what's being replaced — open to change)

The current tokens, for reference. **The new design is free to change all of
this** — palette, type, spacing, the lot — as long as it respects the product
rules in §8.

### Colour (current)
| Token | Hex | Use |
| --- | --- | --- |
| navy | `#0B2E4E` | primary text, icons, headings |
| navyMuted | `#7A8794` | secondary text |
| lime | `#8CC63F` | primary action, active state, positive status |
| limeGradientEnd | `#A5D638` | end stop of the primary-button / FAB gradient |
| limeTint | `#F4F9EC` | lime backgrounds |
| cyan | `#22A9E0` | secondary accent, links, avatar ring |
| cyanTint | `#EAF7FD` | cyan backgrounds |
| bg | `#FDFBFA` | warm-white page background |
| surface | `#FFFFFF` | cards, action bars |
| line | `#ECEFF2` | dividers |
| bubbleIn | `#EDEFF2` | incoming chat bubble |
| bubbleOut | `#DBF1FB` | outgoing chat bubble |
| star | `#F5B301` | rating stars |
| shieldGreen | `#3AAE5C` | verification shield |
| dangerText | `#C0392B` | errors |

### Type (current)
- **Mulish** — Regular 400, Medium 500, Bold 700, ExtraBold 800.
- Scale: h1 26 · screen-title 24 · section 19 · card-title 17 · body 15 · meta 13.
- Headings are bold navy.

### Shape & depth (current)
- Radius: 8 / 12 / 16 (tiles) / 18 (cards) / 999 (pills).
- Cards: white, 1px `line` border, a very soft shadow.
- The "Legg ut" FAB: 62px circle, lime gradient, white 4px ring, raised above the
  bar.

### Spacing (current)
- 4 / 8 / 12 / 16 / 20 / 28 / 40. Screen padding is 20 horizontal.

---

## 8. Constraints — what a new design must NOT break

These are **product rules**, not visual preferences. Keep them.

1. **"Oppdrag" is the home screen.** No "Home" tab. Five bottom-nav slots as
   listed (§4), with "Legg ut" as the raised centre button.
2. **The profile avatar is a permanent top-right shortcut** on every logged-in
   main screen, opening the profile.
3. **The two listing types must be visually unmistakable** — distinct badge,
   terminology, and primary button (§3).
4. **No payment UI, ever.** No "Betal nå", no Vipps, no card fields, no wallet /
   balance / checkout. Always show the "payment happens between you two" line
   near offers.
5. **Norsk bokmål only.** No language switcher. Design with real Norwegian string
   lengths (they run ~15–30% longer than English).
6. **"Legg ut" always opens the two-way choice screen first.**
7. **Approximate location only** in public views — never an exact address or a
   precise map pin.
8. **Calm community section** — max 2 premium partners, local supporters in a
   quiet carousel, no logo wall, no flashing, no auto-audio.
9. **Accessibility is mandatory:** WCAG contrast, large text support, every
   interactive element has an accessibility label, large tap targets, safe-area
   aware on iOS and Android.
10. **Cross-platform** — one design that works on iOS and Android (React Native,
    so: flexbox layout, no CSS grid, be mindful of platform shadow/blur
    differences).

## 9. Open design decisions — things you CAN change

- The **entire palette** — navy / lime / cyan is the current identity, not a
  requirement. A new colour direction is welcome as long as contrast + the
  lime-ish "positive / needs-help" vs "offer" distinction still reads.
- **Typeface** (currently Mulish).
- **Dark mode** — the app is light-only today. Adding a dark theme is a valid
  redesign goal (would need a full token set for both).
- **Card layout, information density, illustration style, iconography, motion.**
- How the **kommune / reach** control looks and where it sits.
- The **onboarding** visual treatment and number of steps (content is fixed).
- Empty / error / loading **illustration** style.

---

## 10. Suggested deliverable order

If producing screens in priority order:

1. **Oppdrag** (home) — sets the whole system: cards, chips, top bar, bottom nav, location row
2. **Oppdragsdetaljer** + **Tilbyderdetaljer** — the two detail screens side by side (prove the type distinction)
3. **Chat** — bubbles + inline offer card + "Tilbud godtatt" state
4. **Innboks** — conversation rows + status tags
5. **Legg ut** choice + one wizard step + preview + success
6. **Søk** with filters + results
7. **Min profil** (public) — ratings, verifications, reliability
8. **Fellesskap** — partners + donations
9. **Onboarding** flow (welcome → login → consent → setup)
10. Component sheet: buttons, pills, fields, avatars, badges, sheets, all states
11. Secondary screens: offers/comparison/agreement, review, saved, notifications, settings, admin

---

## 11. Sample copy (for typesetting real strings)

- Home heading: **"Finn hjelp eller en småjobb nær deg"**
- Location row: **"Lillehammer kommune · Bare min kommune"**
- Section titles: **"Folk som tilbyr hjelp"**, **"Folk som trenger hjelp"**
- Badges: **"Trenger hjelp"**, **"Tilbyr hjelp"**, **"Åpent oppdrag"**, **"Dugnad"**
- Buttons: **"Gi tilbud"**, **"Send melding"**, **"Ta kontakt"**, **"Be om tilbud"**, **"Legg ut"**, **"Godta tilbud"**, **"Avslå"**, **"Se alle"**, **"Bruk posisjonen min"**
- Offer disclaimer: **"Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling."**
- Inbox: **"Innboks"**, **"Søk i meldinger"**, filters **"Alle" / "Uleste"**, tags **"Nytt tilbud" / "Tilbud godtatt"**
- Community hero: **"Sammen gjør vi en forskjell"**
- Empty state example: **"Ingen oppdrag i Lillehammer akkurat nå. Prøv å utvide rekkevidden."**
- Categories: Hage · Rengjøring · Flytting/bæring · Transport/levering · Montering · Snømåking · Maling/vedlikehold · Dyrepass · Datahjelp · Arrangementshjelp · Annet
