# MinNabo: the complete app reference for the website

This file describes **everything the MinNabo app is and has**, so the MinNabo website can be designed
to match it: the same brand, the same visual system, the same words, the same rules, and an accurate
description of every feature.

If the website and this file disagree, this file (the app) wins. All copy in quotes is the real,
shipped Norwegian (bokmål) text. Use it word for word.

---

## Contents

1. What MinNabo is
2. Non-negotiable product rules (the website must follow them too)
3. Who uses it
4. The core flow: from oppdrag to vurdering
5. Brand: name, logo, voice, wording
6. Visual design system (colours, type, radius, shadow, motion, icons) with ready-to-use CSS
7. Components and how they look
8. Categories (all 23, with colours and icons)
9. App structure and navigation
10. Every screen, feature by feature
11. Youth account (under 18)
12. Trust, safety and privacy
13. Fellesskap: neighbourhoods, noticeboard, partners, donations
14. Businesses (Bedrift) and Admin
15. Notifications
16. States: loading, empty, error, offline, success, no access
17. Glossary (Norwegian ↔ English)
18. What the website should contain (suggested page map + content)
19. What the website must never show

---

## 1. What MinNabo is

**MinNabo** ("My Neighbour") is a mobile app (iOS and Android, React Native / Expo) for
**småjobber**, small local jobs, in **Innlandet**, Norway.

Someone who needs help posts an **oppdrag** (a task: "I need help with X"). Neighbours nearby send a
**tilbud** (an offer with a suggested price). The poster compares offers, accepts one, they agree
details in the chat, the job gets done, both confirm, and both leave a review.

- **Region:** Innlandet. Launch area: "Innlandet · Lillehammer, Hamar, Gjøvik og omegn". The reach
  control covers your own kommune, the kommuner around it, or "Hele Innlandet" ("Alle 46 kommuner i fylket").
- **Language:** norsk bokmål only. No language switcher.
- **Money:** MinNabo **never handles payment**. Price and payment are agreed directly between the two people.
- **Login:** **Vipps only** (identity check, never payment).
- **Business model visible in the product:** local businesses pay for visibility on the Fellesskap page.
  They **never** pay for placement in search or among oppdrag. Part of the money goes to local clubs
  and associations ("Donasjoner").

**Taglines (from the welcome screen, use these):**

| Slide | Headline | Body |
|---|---|---|
| 1 | "Småjobber nær deg." | "Få hjelp med plenen, flyttelasset eller datamaskinen — av folk som bor i nærheten." |
| 2 | "Ta en småjobb i nabolaget." | "Finn oppdrag i din egen kommune, gi et tilbud og avtal resten i chatten." |
| 3 | "Enkelt, trygt og lokalt." | "Verifiserte profiler, ærlige vurderinger og avtaler i chatten. Pris og betaling avtaler dere direkte." |

Primary CTA in the app: **"Kom i gang"**. Footer line: "Innlandet · Lillehammer, Hamar, Gjøvik og omegn".

Home-screen headline: **"Finn hjelp eller en småjobb nær deg"**.
Fellesskap headline: **"Sammen gjør vi en forskjell"**, sub: "Naboer som hjelper naboer, og lokale bedrifter som støtter nærmiljøet."

**Personality:** local, trustworthy, warm, calm, simple, modern, inclusive. A friendly community tool,
not a gig-economy marketplace and not a classifieds board.

---

## 2. Non-negotiable product rules (the website must follow them too)

1. **Only one listing type: oppdrag** ("Trenger hjelp"). There are **no** service offers, no
   "Folk som tilbyr hjelp", no "Tilbyr hjelp" listings, no provider directory. Helpers respond to oppdrag
   with a tilbud; they do not advertise services.
2. **"Legg ut"** (the raised centre button) goes straight into the post-an-oppdrag wizard. No "what do you want to post" choice.
3. **Login is Vipps only.** No phone/e-mail/password/OTP/BankID login anywhere. Vipps is **never** used for payment.
   Standard sentence: **"Vipps brukes kun til innlogging – aldri til betaling."**
4. **No payment UI ever.** No checkout, no card fields, no "pay in app", no escrow, no fees.
   Near every price or offer show:
   **"Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling."**
5. **Under 18 = youth account** with limited rights (see §11).
6. **Approximate location only.** Never an exact address or a precise map pin. Maps show a soft circle area.
   Copy: "Vi viser bare et omtrentlig område til andre." / "Nøyaktig adresse deler du selv i chatten når dere har avtalt."
7. **No gradients anywhere.** Flat colours only. (Soft shadows are fine.)
8. **Norsk bokmål only**, copy exactly as written here.
9. Oppdrag is the home/default screen. The user's avatar sits top-right on every main screen and opens the profile.
10. Accessibility: 44 px minimum touch targets, labels on icon-only buttons, contrast as designed
    (meta text `#5F6983` passes 4.5:1 on white).

---

## 3. Who uses it

| Role (Norwegian) | Meaning | What they do |
|---|---|---|
| **Oppdragsgiver** | Job poster | Posts an oppdrag, receives tilbud, compares, accepts, chats, confirms completion, reviews |
| **Oppdragstaker / hjelper** | Helper | Browses oppdrag, sends tilbud, chats, does the job, confirms, reviews |
| Both | One account does both | Most people are both. In agreements the app says "Du hjelper" / "Du får hjelp" |
| **Ungdomskonto** | Under-18 user | Can browse and send tilbud only (see §11) |
| **Bedrift** | Verified local business / borettslag / lag og forening | Registers with org.nr, gets a verified business badge. Menu text: "For bedrifter · Borettslag, lag og foreninger" |
| **Partner** | Local sponsor | Shown on Fellesskap on three levels: Hovedpartner (max 4, own page), Lokal helt, Lokal støttespiller (§13.1) |
| **Admin / moderator** | MinNabo staff | Handles reports, business verification, users, flagged oppdrag, partners, stats |

The design centres the **private person**.

---

## 4. The core flow: from oppdrag to vurdering

1. **Legg ut oppdrag**: a 9-step wizard (category → title → description + photos → place → time →
   price → equipment & practical → who can give offers → confirm) → **Forhåndsvisning** → **Publisert**.
2. **Neighbours find it** on the home feed, search, "Se alle", or the personal "Oppdrag for meg" stack.
3. **Gi tilbud** (helper): price in kr (or a suggestion), message, day and time, optional caveats
   ("Forbehold"), preview, send. Or **"Send melding"** to ask a question first.
4. **Mottatte tilbud** (poster): offers grouped by oppdrag, with **"Sammenlign"** (side-by-side columns,
   price bars, "Lavest pris" / "Best vurdert").
5. Poster can **Godta** (accept), **Avslå** (decline, with reasons and "Angre"), or **Be om endring**.
   Helper can **Trekk tilbudet** (withdraw) before acceptance.
6. On acceptance the price, date, description and caveats are **frozen** in an **avtale**:
   "Låst avtale", "Avtalt 30. sep kl. 19:42", "Endringer må avtales på nytt i chatten."
   The chat shows **"Tilbud godtatt"** / "Avtalegrunnlaget er låst". Can be added to the phone calendar.
   Can be cancelled ("Avlys avtalen", "Dette kan ikke angres.").
7. **Jobbdag** (job day): shared live workspace with a timer (start / pause / stop), a shared checklist,
   materials with amounts and who sorts them out ("Utlegg gjøres opp direkte mellom dere."),
   before / during / after photos with a drag slider, plus safety tools (Trygg tur, call/SMS, "på vei"/"framme").
8. **Fullføring**: **both** confirm ("Både du og Jonas bekrefter før jobben regnes som fullført.").
   Celebration with drawn check + confetti. "Noe er ikke i orden?" for problems.
9. **Vurdering**: 1–5 stars ("Dårlig", "Ikke bra", "Greit", "Bra", "Fantastisk!"), tags
   ("Punktlig", "Ryddig", "Vennlig", "Grundig", "God kommunikasjon", "Anbefales"), optional comment,
   "Vil du anbefale … til naboer?" Ja/Nei. One review per agreement, from each side.

Rules about reviews (shown in the app):
- "Bare parter i en fullført avtale kan vurdere hverandre."
- "Én vurdering per avtale – fra hver side."
- "Vurderingen vises når begge har vurdert, eller når fristen går ut."
- "Du kan svare offentlig på en vurdering du har fått."

---

## 5. Brand: name, logo, voice, wording

- **Name:** always **MinNabo** (one word, capital M and N).
- **Logo files in the repo:** `design/minnabo-icon.png` (icon), `design/minnabo-wordmark.png`
  (wordmark), `logo.png`, `logo-icon.png`.
- **In-app wordmark:** logo icon 34 px + "MinNabo" in Bricolage Grotesque ExtraBold (800), 21 px, letter-spacing −0.03em, colour ink `#0A1740`.
- The design system's internal name is **"Nabolys"** ("neighbour light").

**Voice:** short, warm, direct, du-form, everyday Norwegian. Explain *why* in one line ("Det gjør MinNabo
tryggere for alle."). Reassuring about safety and money, never salesy. Sentence case everywhere.
Numbers Norwegian style: `1 250 kr`, `4,9`, `1,2 km`, `Lør 10. okt kl. 10:00`.

**Words to use / avoid**

| Use | Never use |
|---|---|
| oppdrag, småjobb, tilbud, avtale, hjelper, nabo, nabolag | tjeneste/tjenestetilbud (as a listing), "tilbyr hjelp", gig, kunde, bestilling |
| "Pris og betaling avtales direkte mellom dere" | betal, betaling i appen, kasse, gebyr, provisjon |
| "Logg inn med Vipps" / "Fortsett med Vipps" | "Logg inn med e-post / telefon / BankID", "Betal med Vipps" |
| omtrentlig område | adresse (in public views) |

---

## 6. Visual design system

**Look:** light, soft off-white background (`#F3F5F1`), white rounded cards with soft navy-tinted shadows,
deep navy ink text, one bright **lime** for primary actions, **cyan** as the second accent.
Big rounded corners, pill buttons, generous spacing, playful but calm motion. **Flat colours, no gradients.**

### 6.1 Colours

Core palette:

| Token | Hex | Use |
|---|---|---|
| ink | `#0A1740` | Primary text, dark buttons, selected chips, outgoing chat bubbles |
| ink2 | `#34405F` | Secondary text, body copy on cards |
| mute | `#5F6983` | Meta text (passes 4.5:1 on white) |
| faint | `#8A93A8` | Icons in meta rows, chevrons (not for text) |
| line | `#E4E8EE` | Borders, dividers |
| line2 | `#EEF1F4` | Inner row dividers |
| bg | `#F3F5F1` | Page background |
| surface | `#FFFFFF` | Cards, sheets, nav |
| surface2 | `#F7F8FA` | Quiet info boxes |
| **lime** | `#B8EE3C` | **Primary action** (buttons, FAB, progress). Navy text on top |
| lime2 | `#9BDD2C` | Lime hover/pressed |
| limeDeep | `#3B7300` | Lime-coloured text/icons on light bg, active tab |
| limeTint | `#EDF8D6` | "Trenger hjelp" pill bg, active tab bubble |
| limeDot | `#8BD21E` | Dot inside the "Trenger hjelp" pill |
| cyan | `#19B8EE` | Avatar ring, accent dots |
| cyan2 | `#0A74B4` | Cyan button bg (white text), focus border |
| cyanDeep | `#065C8F` | Links |
| cyanTint | `#DFF2FB` | Cyan pill / info bg |
| star | `#F0A500` | Rating stars |
| danger / dangerTint | `#C23029` / `#FDEBE9` | Errors, destructive |
| warn / warnTint | `#9A5B00` / `#FFF2D9` | Warnings, "Venter på svar" |
| ok / okText / okTint | `#2B8F4E` / `#1D6E3A` / `#E3F5E8` | Success, "Godtatt" |
| verified | `#1B8F4E` | Verified badge |
| notifDot | `#F2542D` | Unread badges, bell dot |
| online | `#2FBF62` | Online dot |
| heart (saved) | `#E5484D` on `#FDECEC` | Saved heart |
| scrim | `rgba(10,23,64,0.45)` | Behind sheets/dialogs |
| lavender / lavenderTint | `#46379E` / `#E8E3FB` | Some icon tiles |
| **vipps** | `#FF5B24` | **Only** the Vipps login button (with tint `#FFF1EB`, deep `#B53A0F`) |
| softBg | `#EAEDF2` | Soft button |
| neutralPill | `#ECEFF3` | Neutral pill |
| track | `#E6E9EE` | Segmented control bg, skeletons |
| limeSoft | `#EEF6E4` | Soft decorative circles / hero backgrounds |

Avatar fallback colours (initials on tinted circle), picked per user:
`a #E4F4C9/#2F5C08` · `b #D6EEFB/#0A5680` · `c #FBE3D7/#8C3A16` · `d #E8E3FB/#46379E` ·
`e #F7E9C4/#6B5200` · `f #D6F2E9/#125F4F` · `g #F7DDE8/#8A2B52` · current user `#0A1740` with white initials.

### 6.2 Typography

- **Display / headings:** **Bricolage Grotesque** (500, 700, 800). Tight negative letter-spacing.
- **Body / UI:** **Figtree** (400, 500, 600, 700, 800).
- Both on Google Fonts.

| Style | Font | Size / line-height | Letter-spacing |
|---|---|---|---|
| Display (hero) | Bricolage 700 | 42 / 43 | −0.035em |
| Celebrate | Bricolage 700 | 38 / 39 | −0.035em |
| H1 | Bricolage 700 | 31 / 33 | −0.03em |
| H2 | Bricolage 700 | 24 / 27 | −0.025em |
| Section title | Bricolage 700 | 21 / 23 | −0.024em |
| H3 | Bricolage 700 | 20 / 23 | −0.02em |
| Brand wordmark | Bricolage 800 | 21 | −0.03em |
| Price | Bricolage 700 | 19 (large 34–38) | −0.02em |
| H4 | Figtree 700 | 16.5 / 21 | – |
| Card title | Figtree 700 | 16 / 20 | – |
| Body | Figtree 400 | 15 / 22.5 | – |
| Button | Figtree 700 | 16 (sm 14, lg 17) | – |
| Label | Figtree 700 | 14 / 17 | – |
| Chip | Figtree 600 | 14 | – |
| Meta | Figtree 400 | 13 / 17.5, colour mute | – |
| Note | Figtree 400 | 12.5 / 17.5, colour mute | – |
| Eyebrow | Figtree 700 | 12, UPPERCASE | 0.08em, colour mute |
| Pill | Figtree 700 | 12 | 0.01em |
| Tab label | Figtree 700 | 11 | – |

### 6.3 Spacing, radius, sizes

- Spacing scale: 4 · 8 · 12 · 16 · 20 · 28 · 40. Mobile side gutter **20 px**.
- Radius: small 10 · 16 · card **22** · listing card **24** · tiles 18 · inputs 17 · dialog 28 ·
  sheet top **32** · nav bar 30 · hero blocks 30 · **pills and buttons fully round (999)**.
- Heights: button 52 (sm 40, lg 58) · input 56 · chip 42 (sm 36) · pill 26 (lg 32) · icon button 44 ·
  search bar 54 · toggle 52×32 · min touch target 44.

### 6.4 Shadows (soft, navy-tinted)

```
card:   0 1px 2px rgba(10,23,64,.04), 0 8px 24px -10px rgba(10,23,64,.14)
medium: 0 2px 6px rgba(10,23,64,.05), 0 16px 36px -14px rgba(10,23,64,.22)
large:  0 24px 60px -16px rgba(10,23,64,.34)          (dialogs, toasts, floating nav)
lime button:  0 10px 22px -10px rgba(110,180,10,.85)
cyan button:  0 10px 22px -10px rgba(8,101,158,.8)
ink button:   0 10px 22px -12px rgba(10,23,64,.8)
focus ring:   0 0 0 4px rgba(25,184,238,.16)
avatar ring:  0 0 0 2px #fff, 0 0 0 4px #19B8EE
```

### 6.5 Motion

- Easing: `cubic-bezier(.2,.8,.2,1)`; springy overshoot: `cubic-bezier(.3,1.45,.5,1)`.
- Entrance: fade up 16 px over 550 ms, list items staggered 50 ms.
- Press: scale 0.97 (buttons), 0.985 (cards), 150 ms.
- Sheets 450 ms, dialogs 350 ms spring scale-in, toasts 450 ms in, visible 2.6 s.
- Celebrations: SVG check drawn over 600 ms inside a lime circle, confetti (lime, cyan, ink, star rectangles) falling 2.4 s.
- Saved heart "pops" (scale 1 → 1.4 → 1). Skeletons pulse opacity 1 → .45 → 1 over 1.3 s (no shimmer gradient).
- Respect reduced motion.

### 6.6 Icons

**Lucide** icon set, stroke width 2, 20 px default (14/16/18/22/24 variants). Rounded line icons, never filled
(except the saved heart). Main ones: `ClipboardList` (Oppdrag), `Users` (Fellesskap), `Plus` (Legg ut),
`MessageSquare` (Innboks), `Menu` (Meny), `Bell`, `Search`, `MapPin`, `Clock`, `Heart`, `Star`,
`BadgeCheck` (verified), `ShieldCheck` (safety), `Calendar`, `Send`, `Handshake`, `Info`.

### 6.7 Ready-to-use CSS variables (copy into the website)

```css
:root{
  --ink:#0A1740; --ink2:#34405F; --mute:#5F6983; --faint:#8A93A8;
  --line:#E4E8EE; --line2:#EEF1F4;
  --bg:#F3F5F1; --surf:#FFFFFF; --surf2:#F7F8FA;
  --lime:#B8EE3C; --lime2:#9BDD2C; --lime-d:#3B7300; --lime-t:#EDF8D6;
  --cyan:#19B8EE; --cyan2:#0A74B4; --cyan-d:#065C8F; --cyan-t:#DFF2FB;
  --star:#F0A500; --danger:#C23029; --danger-t:#FDEBE9;
  --warn:#9A5B00; --warn-t:#FFF2D9; --ok:#2B8F4E; --ok-t:#E3F5E8;
  --soft:#EEF6E4;            /* flat "soft" fill – there are no gradients */
  --vipps:#FF5B24;           /* only for the Vipps button */
  --r-s:10px; --r:16px; --r-l:22px; --r-xl:30px; --r-pill:999px;
  --sh:0 1px 2px rgba(10,23,64,.04),0 8px 24px -10px rgba(10,23,64,.14);
  --sh-m:0 2px 6px rgba(10,23,64,.05),0 16px 36px -14px rgba(10,23,64,.22);
  --sh-l:0 24px 60px -16px rgba(10,23,64,.34);
  --fd:'Bricolage Grotesque','Figtree',system-ui,sans-serif;
  --fb:'Figtree',system-ui,-apple-system,'Segoe UI',sans-serif;
  --ease:cubic-bezier(.2,.8,.2,1); --spring:cubic-bezier(.3,1.45,.5,1);
}
body{background:var(--bg);color:var(--ink);font-family:var(--fb);-webkit-font-smoothing:antialiased}
```

Full source: `design/screens/mn.css` and `src/theme/theme.ts`.

---

## 7. Components and how they look

Reuse these on the website so it feels like the app.

**Buttons** (pill-shaped, Figtree 700):

| Variant | Background | Text | Used for |
|---|---|---|---|
| Primary (lime) | `#B8EE3C` | ink | Main action: "Kom i gang", "Gi tilbud", "Legg ut oppdrag" |
| Cyan | `#0A74B4` | white | Secondary action: "Send melding" |
| Ink | `#0A1740` | white | Strong neutral action |
| Ghost | white + 1.5px `#E4E8EE` border | ink | Tertiary |
| Soft | `#EAEDF2` | ink | Quiet |
| Danger / danger ghost | `#C23029` / white with red border | white / red | Delete, cancel |
| Vipps | `#FF5B24` | white | "Fortsett med Vipps" only |
| Text link | none | `#065C8F` 700 | "Se alle", inline links |

Disabled = 38 % opacity, no shadow. Loading = spinner + changed label ("Sender tilbudet …").

**Pills** (26 px, Figtree 700 12):
- `need` lime tint + lime-deep text + dot: **"Trenger hjelp"**, **"Åpent oppdrag"**
- `neutral` grey: category, "Dugnad", "Gjentakende"
- `dark` ink: "Ny", "Tilbud sendt"
- `warn`: "Endring forespurt", "Venter på svar"
- `ok`: "Godtatt", "Aktiv", "Tilbud godtatt"
- `danger`: "Avslått"

**Chips:** white pill with border, optional 30 px coloured category icon circle; selected = ink background, white text.

**Listing card** (the signature component): white, radius 24, padding 12, soft shadow.
Left: 96 × ≥118 thumbnail (photo or flat **category art**: category colour + centred Lucide icon).
Right: "Trenger hjelp" pill (+ optional neutral pill) → title (bold 16, one line) → owner name + ★ rating →
📍 "Nordre Ål · 1,2 km" → 🕒 "Lør 3. okt · ca. 2 t" → bottom: "Budsjett" label + price in display font
("400 kr", "250 kr / gang", or "Ønsker tilbud"). Round heart save button top-right.

Sample cards (sample content only, to show the shape):

| Category | Title | Place | When | Price |
|---|---|---|---|---|
| Hage | Klippe plen og rake løv | Nordre Ål · 1,2 km | Lør 3. okt · ca. 2 t | Budsjett 400 kr |
| Flytting | Bære sofa til 3. etasje | Stampesletta · 2,8 km | Tor 1. okt · ettermiddag | Budsjett 350 kr |
| Montering | Montere garderobeskap | Søre Ål · 3,1 km | Denne uka · fleksibel | Ønsker tilbud |
| Snømåking | Måke oppkjørselen i vinter (Gjentakende) | Vingrom · 6,0 km | Ved snøfall | 250 kr / gang |
| Annet | Dugnad i Kirkegata borettslag (Dugnad) | Sentrum · 1,9 km | Søn 11. okt · 10–14 | Frivillig |
| Rengjøring | Flyttevask av 3-roms | Kanten · 3,4 km | Fre 9. okt | Budsjett 1 200 kr |

**Cards / lists:** white card radius 22 with soft shadow; list groups with 60 px rows, a 40 px rounded icon
tile, title + grey subtitle, chevron.

**Avatar:** circle with initials on a tinted colour, optional cyan ring (2px white + 2px cyan) and green online dot.

**Verified badge:** `BadgeCheck` icon + "Verifisert med Vipps" in green `#1B8F4E`.

**Stars:** ★ in `#F0A500` + "4,9" bold + "(32)".

**Forms:** 56 px inputs, radius 17, 1.5px border; focus = cyan border + soft cyan ring; errors red with
shake. Amount input is big display numerals with "kr" suffix. Toggles green when on (`#3F9A1A`).
Segmented controls on `#E6E9EE` track with white active segment.

**Overlays:** bottom sheets (radius 32 top, grabber bar), centred dialogs (radius 28), dark ink toasts
with a lime icon circle and a lime **"Angre"** (undo) action.

**Chat:** incoming bubbles white with border, outgoing bubbles ink with white text; ticks
Sendt → Levert → Lest (cyan); typing dots; system messages as small centred pills; an inline
**offer card** (header "Tilbud", big price, date, description, Forbehold, payment note,
"Avslå" / "Godta tilbud").

**Payment note:** ⓘ icon + "Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling." in 12.5 px grey.

**Empty/error illustrations:** two soft tinted circles behind a white 80 × 80 rounded tile (radius 26) with a 32 px icon.

**Bottom navigation (app):** floating white bar (radius 30, slight blur, large shadow), 5 slots:
**Oppdrag · Fellesskap · [Legg ut] · Innboks · Meny**. "Legg ut" is a 62 px **lime circle with a navy +**,
a 5 px white ring, raised 30 px above the bar. Active tab = lime-tint bubble + lime-deep icon and label.

**Top bar (app):** logo + "MinNabo" left; bell (red dot when unread) and the user's avatar right.

---

## 8. Categories (all 23)

Each category has a flat art tile: background colour + icon colour + Lucide icon.

| Category | Lucide icon | Tile bg | Icon colour |
|---|---|---|---|
| Hage | Leaf | `#D9F0BE` | `#3A7010` |
| Rengjøring | Sparkles | `#D3ECFA` | `#0B6FA3` |
| Flytting/bæring | Package | `#F4E6D0` | `#8C5714` |
| Transport/levering | Truck | `#E4E1FA` | `#4F40B5` |
| Montering | Wrench | `#FBE1D5` | `#A5461F` |
| Snømåking | Snowflake | `#DFEAF8` | `#2E5A9A` |
| Maling/vedlikehold | PaintRoller | `#F8DCE7` | `#9E335E` |
| Dyrepass | PawPrint | `#F7EDC6` | `#7A5F00` |
| Datahjelp | Laptop | `#D4F2E8` | `#136F5C` |
| Arrangementshjelp | PartyPopper | `#EEDDF7` | `#7B359F` |
| Snekring/småreparasjoner | Hammer | `#EFE3D3` | `#7A4A1C` |
| Vinduspuss | AppWindow | `#DDF0F7` | `#13708F` |
| Bilpleie | Car | `#E2E7F0` | `#34466B` |
| Handling og ærender | ShoppingCart | `#FBEBD3` | `#8A5300` |
| Leksehjelp | BookOpen | `#E6E2F8` | `#4A3BA8` |
| Hus- og plantevakt | Sprout | `#DCF1DF` | `#2D6B37` |
| Ved og fyring | Axe | `#F6E0D4` | `#8C3F1A` |
| Bortkjøring og rydding | Recycle | `#E0EEE6` | `#2F6248` |
| Sykkelreparasjon | Bike | `#DCEBF6` | `#1F5C8A` |
| Matlaging og baking | ChefHat | `#FBE4E0` | `#9A3426` |
| Selskap og følge | HeartHandshake | `#F7E2EE` | `#8A2F62` |
| Barnevakt | Baby | `#FDF0CF` | `#7A5A00` |
| Annet | LayoutGrid | `#E9ECF1` | `#46506A` |

---

## 9. App structure and navigation

**Bottom tabs:** Oppdrag (home) · Fellesskap · **Legg ut** (raised button → wizard) · Innboks (unread badge) · Meny (sheet).
Hidden on detail screens, chat and wizards.

**Meny sheet** (everything else):

- Header card: avatar, name, ★ rating, "14 jobber", place, "Se profilen din", toggle
  **"Tilgjengelig for småjobber"** ("Naboer kan be deg om tilbud" / "Du er skjult som hjelper").
- **Utforsk** (tiles): Oppdrag "Finn og gi tilbud" · Fellesskap "Nabolag og oppslag" · Innboks "3 uleste meldinger" · Legg ut "Nytt oppdrag"
- **Mitt:** Min profil · Mine avtaler · Mine oppdrag · Mottatte tilbud · Lagrede oppføringer og søk · Varsler
- **Tillit og trygghet:** Vurderinger og verifisering · Sikkerhet, rapportering og blokkering
- **Innstillinger:** Innstillinger · Personvern ("Samtykker og dine data") · Vilkår · Varslinger · For bedrifter ("Borettslag, lag og foreninger") · Adminpanel (admins only)
- Logg ut (confirm dialog: "Logg ut av MinNabo?") · footer "MinNabo · versjon 1.0 · Innlandet" · "MinNabo håndterer ikke betaling."

---

## 10. Every screen, feature by feature

### Onboarding
- **Velkommen:** centred logo, 3 auto-advancing slides (4.2 s, tappable dots) with a small animated phone
  mock (an oppdrag card "Klippe plen · 400 kr" → "Jonas ga et tilbud ★ 4,9 (32) · Jeg kan ta det lørdag!" →
  "Tilbud godtatt"). Button "Kom i gang".
- **Logg inn:** "Logg inn eller opprett konto" / "Vi bruker Vipps for å bekrefte hvem du er. Det gjør MinNabo
  tryggere for alle." Orange button **"Fortsett med Vipps"**. "Innlogging skjer bare med Vipps. Har du ikke Vipps,
  kan du laste det ned gratis." Then a sheet: "Åpner Vipps …" → "Bekreft i Vipps-appen" (pulse) →
  "Identitet bekreftet" (drawn check; name, birth year, phone; "Vi henter kun navn, fødselsår og telefonnummer.
  Ingen betalingsinformasjon.") → "Fortsett". Link "Under 18 år? Se ungdomskonto".
- **Samtykker:** verified identity card, required checkboxes (vilkår, personvern, alder bekreftet) + optional tips,
  "Godta alle", expandable explanations; each consent is stored with a timestamp.
- **Oppsett** (3 steps with progress): navn (from Vipps, optional photo) → formål (3 option cards:
  "Jeg trenger hjelp" / "Jeg ønsker småjobber" / "Begge deler") → kommune ("Bruk posisjonen min" with radar
  animation, or searchable list, optional område) → celebration with confetti → home.

### Oppdrag (home)
- "Hei, {navn}" + **"Finn hjelp eller en småjobb nær deg"**.
- Location row "Lillehammer kommune · Bare min kommune" + "Endre" → sheet **"Hvor vil du se oppdrag?"**:
  "Bruk posisjonen min" → "Fant deg: Lillehammer kommune", kommune list, **Rekkevidde** segmented
  (Min kommune / Nabokommuner / Innlandet) with animated concentric rings, "Du ser bare omtrentlig område",
  "Vis oppdrag".
- Search bar "Søk etter plen, flytting, datahjelp …" → Søk.
- Category chip row (Alle + categories).
- **"Folk som trenger hjelp"** / "Småjobber du kan ta i nærheten": up to 6 listing cards, save heart
  ("Lagret i Lagrede" + Angre). Empty: "Ingen oppdrag i {kommune} akkurat nå. Prøv å utvide rekkevidden." + "Utvid rekkevidde".
- "Se alle oppdrag" (+ "6 nye" badge).
- Dark card **"Oppdrag for meg"** / "Småjobber som passer det du kan".
- Footer payment note.

### Finding oppdrag
- **Søk:** live search, filter sheet (multiple categories, "kun verifiserte", distance slider, sort:
  Relevans / Avstand / Nyeste / Pris), removable filter chips, recent and popular searches, **"Lagre søk"** (with alerts).
- **Se alle:** full list, sort (Nærmest / Nyeste / Pris), category chips, count.
- **Oppdrag for meg:** a swipeable card stack of oppdrag matched to the helper's skills and area.
  "Ikke aktuelt" flies the card away (with Angre), save, **"Se og gi tilbud"**, counter, stack/list toggle,
  "N nye forslag i dag", finished state.
- **Lagrede:** saved oppdrag and saved searches (filters summary, "nye treff" badge, alert bell per search, "Kjør søk").

### Oppdragsdetaljer
Photo gallery (counter, dots, swipe), save + share, **"Åpent oppdrag"** pill, title, budget card,
info grid (sted, når, varighet, kategori), a **stylised approximate-area map (circle, never a pin)**,
description, practical info and equipment, **owner card** (avatar, name, rating, verified, member since → profile),
"Rapporter" link. Sticky bottom: payment note + **"Send melding"** + **"Gi tilbud"**.

**Gi tilbud sheet:** amount with quick chips (or let the price be agreed), message with templates and a counter,
day and time chips, optional "Forbehold", validation, preview card, "Sender tilbudet …", success with
drawn check → chat. The footer then reads "Tilbud sendt".

**Ny samtale (Send melding):** pinned oppdrag card, opener chips that fill the message, the conversation is
created on the first message.

### Tilbud and avtaler (poster side)
- **Mottatte tilbud:** Alle / Nye / Besvart, grouped by your oppdrag, status pills, "Sammenlign".
- **Tilbudsdetaljer:** offer timeline, Godta (summary sheet + required checkbox → confetti → Avtale / Chat),
  Avslå (reason chips, Angre), Be om endring (topics), sender view: "Trekk tilbudet". Youth offers are marked
  "Ungdomskonto · 16 år".
- **Sammenlign:** side-by-side columns, animated price bars, "Lavest pris" / "Best vurdert", sort, choose → "Gå videre med …".
- **Avtalesammendrag:** "Låst avtale" stamp (AVTALT / AVLYST), countdown ("Om 11 dager"), parties
  (Oppdragsgiver / Oppdragstaker), Pris, Dato, Varighet, Sted ("Nordre Ål (adressen er delt i chatten)"),
  Beskrivelse, Forbehold, Fremdrift timeline, payment note, "Åpne chat", "Del med trygg kontakt",
  "Legg i kalender", "Åpne jobbdag", "Avlys avtalen".
- **Mine avtaler:** Kommende / Fullført, week strip with dots, role pills "Du hjelper" / "Du får hjelp", "Uten dato" group.
- **Mine oppdrag:** Aktive / Pauset / Arkivert; actions Rediger, Pause/Aktiver, Arkiver, Slett (with Angre).

### Innboks and chat
- **Innboks:** live search, Alle / Uleste, status tags per conversation (e.g. tilbud sendt, avtale), unread markers,
  "Merk alle som lest", read ticks on my last message.
- **Chat:** header with name, "Aktiv nå" dot, menu (profil, oppføring, demp, rapporter, blokker).
  Pinned (collapsible) oppdrag card and a pinned message. Inline offer card with Godta / Avslå → green banner
  "Avtale inngått" + system message. Tap a bubble for reactions (👍 ❤️ 😊 ✅), long-press to pin.
  Quick replies. Attach sheet: Bilde, Kamera, **Foreslå tid** (time card with "Passer" / "Foreslå annen"),
  Send tilbud (helper only), Del sted (only after an agreement). Message status Sendt → Levert → Lest, typing indicator.

### Jobbdag, Fullføring, Vurdering
See §4 steps 7–9. Jobbdag has a dark ink hero card with the live timer ("Arbeidstid i dag", "Estimat ca. 5 t",
Startet / Pauser / Totalt, Pause / Stopp), tabs **Sjekkliste** (progress ring, "dere ser samme liste") /
**Materialer** (sum, who sorts it out) / **Bilder** (Før / Underveis / Etter, drag slider), and
**"Marker jobben som ferdig"**.

### Legg ut (post an oppdrag), 9 steps
Progress bar "Steg 3 av 9", back, "Lagre utkast", per-step validation with a shake, slide transitions.

1. **"Hva trenger du hjelp med?"** – category grid. "Finner du ikke riktig kategori? Velg «Annet» …"
2. **"Gi oppdraget en tittel"** – suggestions; "Minst 5 tegn. Unngå adresse og telefonnummer i tittelen."
   Good vs bad example: «Male gjerdet i hagen» vs «Trenger hjelp snarest».
3. **"Beskriv oppdraget"** – description, category-specific quick questions ("Noen raske spørsmål"), photos with
   a cover photo ("Unngå husnummer, bilskilt og ansikter.").
4. **"Hvor skal jobben gjøres?"** – GPS or kommune + område; "Vi viser bare et omtrentlig område til andre."
5. **"Når passer det?"** – week calendar, time of day (multi), approximate duration.
6. **"Hva med pris?"** – budget ("Vises på oppdraget") or **"Ønsker tilbud"** ("Naboer sender deg et prisforslag.
   Du sammenligner og velger selv."), optional private estimate ("Valgfritt · vises ikke"), "Prisen er veiledende – dere avtaler selv." + payment note.
7. **"Utstyr og praktisk"**.
8. **"Hvem kan gi tilbud?"** – who can respond, max distance slider 1–30 km.
9. **"Ser alt riktig ut?"** – summary with "Endre" per section → **"Legg ut oppdrag"**.

Then **Forhåndsvisning** (Kortet / Detaljsiden toggle, readiness checklist, Publiser) and **Publisert**
(drawn check + confetti, the live card, "Del" sheet: copy link / SMS / e-post / share, "Se oppføringen", "Til forsiden").

### Profil
- **Min profil / public profile:** photo with cyan ring, name, "Verifisert med Vipps", place, "Medlem siden mars 2024",
  stats (fullførte jobber, ★ 4,9 · 11 vurderinger, "svarer vanligvis innen 1 t"), tabs **Om** (Presentasjon, languages,
  "Har bil", availability, Tjenester og kategorier, Verifisering, **Pålitelighet** bars "Svært pålitelig",
  **Anbefalt av naboer**) / **Vurderinger** (filters, "Det naboer trekker fram", owner replies) /
  **Portefølje** (before/after photos). Own view: "Slik ser andre deg" preview, private details
  (masked phone/e-mail, "Hjemmenotater · Deles ved avtale"). **Feriemodus** hides your oppdrag
  ("Feriemodus er på – oppføringene dine er skjult"). On others: "Ta kontakt", "Følg", flag → Rapporter.
- **Rediger profil:** photo, name locked "Fra Vipps", visningsnavn, kommune/område, presentation, portfolio manager.

### Settings
- **Innstillinger:** account (from Vipps), location, push / e-post switches, feriemodus, text size, Personvern,
  Vilkår, Bedrift, Logg ut, Slett konto.
- **Varslinger:** master pause, Push / E-post per type, quiet hours (timeline + time picker), "Send et testvarsel".
- **Vilkår:** table of contents chips, reading-progress bar, **"Kort fortalt"** summary box per section, "Til toppen", share/download.
- **Slett konto:** 3 steps (what gets deleted → active-agreement warning → type **SLETT**) → goodbye.

---

## 11. Youth account (Ungdomskonto, under 18)

Detected from Vipps age. Intro: "Vipps viser at du er 16 år. Da får du en ungdomskonto – laget for å ta småjobber hos naboene."

**"Dette kan du gjøre"**
- Se oppdrag i nærheten
- Gi tilbud til folk som trenger hjelp
- Chatte om tilbudene du har gitt
- Få vurderinger når jobben er gjort

**"Låst til du fyller 18"**
- Legge ut egne oppdrag
- Sende melding uten å ha gitt tilbud
- Fellesskap, nabolag og oppslagstavle
- Vurdere andre og lagre søk
- Bedriftskonto

"Oppdragsgivere ser at tilbudet ditt kommer fra en ungdomskonto. Kontoen blir vanlig automatisk når du fyller 18."
Youth app has 4 tabs only (Oppdrag · Mine tilbud · Innboks · Profil), **no Legg ut button**, and a lime/ink
"Ungdomskonto" marker. "En samtale åpnes når du gir et tilbud. Du kan ikke starte samtaler på egen hånd."
Limits are enforced on the server, not just in the UI. Minimum age is still a legal open question (placeholder `[minstealder]`).

---

## 12. Trust, safety and privacy

- **Vipps identity for everyone.** "Fullt verifisert med Vipps": Vipps-ID, telefon and e-post. "Hva ble sjekket?" explains each check.
  Businesses are additionally verified against Enhetsregisteret.
- **Reviews** only after a completed agreement (rules in §4). Reliability score, neighbour endorsements ("Anbefalt av naboer" –
  only people with a completed agreement can recommend).
- **Approximate location** everywhere public. The exact address is shared by the people themselves in chat after agreeing.
- **Sikkerhet, rapportering og blokkering** ("Verktøy som hjelper deg å møte naboer trygt."):
  - **Trygg tur** – "Del jobbdagen din": trusted contacts get an SMS with who you meet, the approximate area and when
    you expect to be done; you stop it when safely home; extend 1 t; reminder to contacts if you don't stop in time.
  - **Trygge kontakter** – up to 5 people (Norwegian mobile, relation chips), stored on the phone.
  - **Rapporter** – a user, oppdrag, message or review. Reasons: "Svindel eller krav om forhåndsbetaling",
    "Trakassering", "Upassende innhold", "Falsk profil", "Farlig oppdrag", "Annet". Optional screenshot,
    option to block. "Den du rapporterer får ikke vite at det var deg." Status: Mottatt → Under behandling → Avgjort.
  - **Blokkering** – "De kan ikke se oppføringene dine eller sende deg meldinger".
  - **Tips** – "Møt i dagslys", "Stol på magefølelsen", "Del jobbdagen med en trygg kontakt", never pay in advance.
  - **"Er du i akutt fare?"** "Ring 112. Politiets vanlige nummer er 02800."
- **Personvern:** consent log with timestamps (each change is a new row), optional tips consent,
  **data export** (download your data), retention rules accordion, links to Vilkår and Slett konto.
  Vipps gives only name, birth year and phone number – "Ingen betalingsinformasjon."

---

## 13. Fellesskap

Tab page "Fellesskap i {kommune}" with hero "Sammen gjør vi en forskjell".

- **Nabolag:** one group per area, e.g. "Nordre Ål nabolag · 247 medlemmer", avatar stack; "Bli med" / "Forlat";
  tabs Oppdrag / Oppslag scoped to the area.
- **Oppslagstavle** ("Oppslag fra naboene" – "Gi bort, lån ut, finn igjen – eller bare si fra om noe som skjer i nabolaget."):
  kinds **Gis bort · Mistet og funnet · Utlån av verktøy · Generelt**; post cards, compose sheet (type, title, text,
  optional photo), public comments ("Svar"), save, owner can mark "Avsluttet".
- **Partners** – intro note: "Lokale bedrifter støtter MinNabo. De betaler for synlighet her – aldri for plass i søket."
  See §13.1 for the three partner levels.
- **Donasjoner:** "Gitt videre til lag og foreninger" – list of local clubs with period, amount and "Overført".
  Only donations that have actually been transferred are shown ("Ingen donasjoner er overført ennå." when empty).
  "Vis alle donasjoner" / "Vis færre".
- **Røde Kors:** "Kommer – Samarbeid med Røde Kors er under avklaring." (hidden behind a feature flag until
  written approval from Norges Røde Kors).

### 13.1 Partner levels (three tiers)

Fellesskap shows local businesses on **three levels**, from most to least prominent. Partners never get better
placement in search or among oppdrag: "Partnere betaler for synlighet på Fellesskap. De får aldri bedre plass i søk
eller blant oppdrag." Sponsor deals and invoicing happen **outside the app**; there is no partner sign-up or payment in the app.

| Level | Max | Where it shows | How it looks | What tapping does |
|---|---|---|---|---|
| **Hovedpartner** (main partner) | **4** in total ("Maks 4 hovedpartnere") | Every user in Innlandet (not scoped to a kommune). Section "Hovedpartnere" – "Partnerne som støtter MinNabo i Innlandet" | **Large card**: wide cover photo, "Hovedpartner" badge (award icon), logo tile (76 px), name, tagline, "Les mer om oss" | Opens the partner's **own page** (`/partner/<id>`) |
| **Lokal helt** (local hero) | No fixed limit | Only users in that partner's kommune. Section "Lokale helter" – "Bedrifter som gjør en ekstra innsats i {kommune}" | **Card** with logo, name, tagline and a "Lokal helt" pill (lime, heart icon) | Opens a **short information sheet** |
| **Lokal støttespiller** (local supporter) | No fixed limit | Only users in that partner's kommune. Section "Lokale støttespillere" | **Logo + name only**, in a calm horizontal carousel (two at a time, prev/next arrows, "1–2 av 6 bedrifter", no autoplay) | Nothing (no sheet, no page) |

**Hovedpartner page** (`/partner/<id>`, title "Hovedpartner"): wide cover photo (168 px, ink background when there is no photo),
logo tile overlapping the cover, "Hovedpartner" badge, name and tagline, then sections that appear only when filled in:
**"Om oss"** (about), **"Til naboene"** (what they offer neighbours), **"Kontakt"** (Nettside, Telefon, E-post, Adresse,
Åpningstider, Område), a photo **gallery**, the button **"Besøk nettsiden"**, the partner note, and **"Takk for støtten"**
(toast "Takken er sendt til {navn}").

**Lokal helt sheet:** logo, name, bransje/tagline, short text, "Partner siden", "Nettside", "Område", the partner note,
and "Takk for støtten".

**Empty states:** "Hovedpartnere kommer snart." · "Ingen lokale helter i {kommune} ennå." ·
"Ingen lokale støttespillere i {kommune} ennå." Missing logos show a dashed placeholder tile labelled "Logo".

**Who decides:** MinNabo staff in Adminpanel → Partnere. They switch a partner on as hovedpartner (only when a slot is
free: "Maks 4 hovedpartnere. Slå av en av dem før du kan velge en ny."), mark a støttespiller as "Lokal helt", or add/remove
it from the carousel. A hovedpartner is never also a lokal helt. Partner texts, logos and photos are entered by MinNabo
(the partner delivers them).

Partner logos and names are placeholders until partners deliver them.

**For the website:** a "Bli partner" / "For bedrifter" section can explain the three levels exactly as above
(Hovedpartner · Lokal helt · Lokal støttespiller), say that partners pay for **visibility on Fellesskap only, never for
placement in search**, that part of the money goes to local lag og foreninger, and that deals are made directly with
MinNabo (contact, no online checkout). Do not publish prices for the levels unless MinNabo provides them.

---

## 14. Businesses (Bedrift) and Admin

- **Bedrift / "For bedrifter":** for local businesses, borettslag, lag og foreninger. Register with org.nr
  (format + checksum + **live lookup in Enhetsregisteret** for name, address, form), contact details, categories,
  consent → status timeline Sendt → Til verifisering → Verifisert (or rejected → send again).
- **Adminpanel** (admins only): KPIs, report queue (Avvis / Fjern innhold / Advar bruker + Angre), business approval,
  user search + suspend, flagged oppdrag hide/show, partners (hovedpartner slots, max 4 · "Lokal helt" · carousel on/off), weekly stats.

---

## 15. Notifications

**Varsler** screen: filter chips **Alle · Tilbud · Meldinger · Avtaler · Annet** with counts, grouped
"I dag" / "I går" / "Tidligere", unread rows tinted with a dot, every row opens the right screen,
"Merk alle som lest". Push and e-mail per type, quiet hours, saved-search alerts.

---

## 16. States (every screen has them)

- **Laster:** grey pulsing skeletons in the shape of the content (no shimmer gradient).
- **Tom:** soft illustration tile + title + one helpful line + an action (e.g. "Utvid rekkevidde").
- **Feil:** friendly message + "Prøv igjen".
- **Frakoblet:** banner, cached content greyed, "Tilkoblet igjen", last-updated time.
- **Suksess:** drawn check in a lime circle (+ confetti for big moments: published, agreement, completed).
- **Ingen tilgang:** lock tile, e.g. youth-locked features.
- **Toasts** with **"Angre"** for reversible actions (save, decline, archive, delete, mark as read).

---

## 17. Glossary

| Norwegian | English |
|---|---|
| oppdrag | task / job request |
| småjobb | small job |
| tilbud / gi tilbud | offer / make an offer |
| avtale / avtalesammendrag | agreement / agreement summary |
| oppdragsgiver / oppdragstaker | poster / helper |
| hjelper / nabo / nabolag | helper / neighbour / neighbourhood |
| budsjett / "Ønsker tilbud" | budget / "open to offers" |
| forbehold | caveats / conditions |
| jobbdag / fullføring / vurdering | job day / completion / review |
| Legg ut | Post |
| Innboks / Varsler / Varslinger | Inbox / Notifications / Notification settings |
| Fellesskap / Oppslagstavle | Community / Noticeboard |
| Lagrede | Saved |
| trygg tur / trygge kontakter | safe trip / trusted contacts |
| feriemodus | vacation mode |
| ungdomskonto | youth account |
| kommune / rekkevidde | municipality / reach |
| Angre | Undo |

---

## 18. What the website should contain (suggested)

The website's job: explain MinNabo, build trust, and send people to download the app. Suggested sections,
each using real app copy:

1. **Hero:** "Småjobber nær deg." + "Få hjelp med plenen, flyttelasset eller datamaskinen — av folk som bor i nærheten."
   App Store / Google Play buttons (links: to be provided), a phone showing the Oppdrag home screen
   (screenshots in `design/screenshots/` and repo root: `homepage.png`, `newhomepage.png`, `inboks.png`,
   `jobdetail_oppdragiver.png`, `jobdetail_oppdragstaker.png`). Region line "Innlandet · Lillehammer, Hamar, Gjøvik og omegn".
2. **Slik fungerer det** – two short paths:
   - *Trenger du hjelp?* Legg ut et oppdrag → få tilbud fra naboer → sammenlign og godta → avtal resten i chatten → vurder hverandre.
   - *Vil du ta småjobber?* Finn oppdrag i kommunen din → gi et tilbud → gjør jobben → få vurderinger.
3. **Kategorier** – the 23 categories as flat colour tiles with Lucide icons (§8).
4. **Trygghet** – Vipps-verifisering ("Vipps brukes kun til innlogging – aldri til betaling."), vurderinger kun etter
   fullført avtale, omtrentlig sted, Trygg tur og trygge kontakter, rapportering og blokkering, "Ring 112".
5. **Pris og betaling** – "Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling." No fees shown.
6. **For unge (under 18)** – the youth-account can/can't lists (§11). Do not state a minimum age until it is decided.
7. **Fellesskap** – nabolag, oppslagstavle, local partners ("betaler for synlighet – aldri for plass i søket"), donations to local clubs.
8. **For bedrifter / Bli partner** – two separate things: (a) a verified **Bedrift** account for borettslag, lag og foreninger
   and local trades (verified via Enhetsregisteret), and (b) **partnership** on Fellesskap at three levels –
   Hovedpartner (max 4, own page), Lokal helt, Lokal støttespiller (§13.1). Contact MinNabo; no online sign-up or payment.
9. **FAQ** – Koster det noe? Hvordan betaler vi? (directly between you) Hvorfor Vipps? Hva ser andre av adressen min? Kan jeg bruke appen under 18?
10. **Footer** – Vilkår, Personvern, contact, "MinNabo håndterer ikke betaling."

**Website styling checklist (to match the app):** background `#F3F5F1`; white cards radius 22–24 with the soft navy shadow;
Bricolage Grotesque headings with tight tracking; Figtree body; lime `#B8EE3C` pill buttons with navy text as the
primary CTA; cyan `#0A74B4` secondary; links `#065C8F`; "Trenger hjelp" lime-tint pills; Lucide line icons;
flat category tiles; fade-up entrance animations with the app's easing; **no gradients**; generous whitespace;
mobile first with a 20 px side gutter.

---

## 19. What the website must never show

- Service offers / "Tilbyr hjelp" / "Folk som tilbyr hjelp" / provider listings or a "hire a pro" directory.
- Any payment: checkout, prices for the app, fees, commission, "betal med Vipps", card logos.
- Login with e-mail, phone, password or BankID. Only Vipps.
- Exact addresses or precise map pins.
- Gradients (backgrounds, buttons, text).
- English UI copy, or Norwegian copy that differs from the app's.
- Sample people from the designs (Mari Haugen, Kari Holm, Jonas Lie …) presented as real users or real testimonials.
- Partner names/logos until real partners have delivered them.
- Partner levels other than the three in §13.1, more than 4 hovedpartnere, or any hint that partners rank higher in search.

---

*Sources in this repo: `design/screens/*.dc.html` (every screen), `design/screens/mn.css` (design system),
`src/theme/theme.ts` (tokens), `docs/COMPONENTS.md`, `docs/SCREENS.md`, `src/domain/categories.ts`.
A shorter summary is in `MINNABO_DESIGN_BRIEF.md` (repo root).*
