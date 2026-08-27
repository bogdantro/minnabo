# MinNabo – Design & byggespesifikasjon (Fase 1 MVP)

Dato: 2026-08-27
Kilde: `CLAUDE_MINNABO_COMPLETE_BUILD_SPEC.md` (produktfasit) + 7 vedlagte skjermbilder (visuell fasit).

## 0. Bekreftelser (spec §29)

- «Oppdrag» er appens forside. Det finnes ingen «Hjem»-fane.
- Profilbildet er en fast sirkulær snarvei øverst til høyre på alle innloggede hovedsider og åpner profilen ved trykk.
- Det finnes to tydelig forskjellige oppføringstyper: `TASK_REQUEST` (noen trenger hjelp) og `SERVICE_OFFER` (noen tilbyr hjelp), med ulik terminologi, status og primærknapp.
- Tilbud kan godtas i chat, men betaling skjer aldri i MinNabo. Ingen betalingskomponenter i noen fase.
- De vedlagte lyse skjermbildene er visuell fasit.
- Hele appen er på norsk bokmål. Ingen språkvelger.
- Kun lyst tema.

## 1. Teknologivalg

- **Expo (nyeste SDK) + React Native + TypeScript**, `expo-router` (filbasert ruting).
- **Mock-backend**: `src/data/` in-memory repositories seedet fra `seed.ts`, eksponert via typet `src/api/`-klient som speiler et framtidig REST-API. Bytte til ekte backend = bytte klientimplementasjon.
- **TanStack Query** for henting/caching slik at laste-/feil-/tomtilstander blir ekte.
- Brukergenererte data (nye oppføringer, meldinger, tilbud) lagres i `AsyncStorage`.
- **Fonter**: Mulish (Google Fonts) med systemfallback.
- **Ikoner**: Feather (`@expo/vector-icons`), én familie overalt. Logo/ikon fra vedlagte PNG-er som bundlede ressurser.
- **Tester**: Jest + React Native Testing Library.

## 2. Designsystem (utledet fra vedleggene)

### Farger

| Token | Verdi | Bruk |
|---|---|---|
| `navy` | `#0B2E4E` | overskrifter, brødtekst, ikoner, ordmerke |
| `navyMuted` | `#7A8794` | metatekst, bildetekst, placeholder |
| `lime` | `#8CC63F` | primærknapp, FAB, aktiv fane, priser, positiv status |
| `limeGradientEnd` | `#A5D638` | gradient-slutt på primærknapper/FAB |
| `cyan` | `#22A9E0` | lenker, sekundærhandling, stedsnål, «Tilbyr hjelp», sendeknapp, profilring, bedriftsverifisering |
| `bg` | `#FDFBFA` | varm hvit sidebakgrunn |
| `surface` | `#FFFFFF` | kort, handlingsfelt, toppfelt |
| `line` | `#ECEFF2` | skillelinjer, hårfine kortkanter |
| `bubbleIn` | `#EDEFF2` | innkommende chatbobler |
| `bubbleOut` | `#DBF1FB` | utgående chatbobler |
| `star` | `#F5B301` | vurderingsstjerner |
| `shieldGreen` | `#3AAE5C` | «Telefon verifisert»-skjold |
| `dangerText` | `#C0392B` | feilmeldinger, destruktive handlinger |

### Typografi (Mulish)

| Rolle | Størrelse / vekt |
|---|---|
| H1 skjermtittel («Innboks») | 32 / ExtraBold |
| H1 spørsmål («Hva trenger du hjelp med?») | 28 / Bold |
| Seksjonstittel («Jobber nær deg») | 20 / Bold |
| Korttittel | 17 / Bold |
| Brødtekst | 15 / Regular |
| Meta / caption | 13 / Regular |

Alle overskrifter i `navy`.

### Form

- Kort: radius 18, 1px `line`-kant, skygge `0 2px 10px rgba(11,46,78,.06)`.
- Knapper: pille (radius 999), høyde 54. Primær = lime gradient, navy tekst. Sekundær = hvit med lime kant, navy tekst.
- Kategorifliser: 72×72, radius 16, ikon + etikett.
- Statusmerker: hvite/tonede piller med farget kant, 12px tekst.
- Avatar: sirkel, 2px `cyan` ring.
- FAB «Legg ut»: 62px lime gradient sirkel, svart `+`, myk glorie.
- Skjermmarg: 20.

### Navigasjon

Fast bunnmeny (hvit, 5 slots): Oppdrag = clipboard · Fellesskap = users · **Legg ut** = hevet lime FAB · Innboks = message-circle · Meny = menu. Aktiv = lime ikon+etikett, inaktiv = navy. Etiketter alltid synlige. Bunnmeny skjules på detaljsider og chat.

Toppfelt:
- Hjem/Innboks: logo+ordmerke venstre, varselbjelle (cyan prikk) + avatar høyre.
- Detalj: tilbakepil, sentrert tittel, bjelle + avatar.
- Chat: tilbakepil, avatar+navn+«Aktiv nå», kebab (rapporteringsmeny).

## 3. Skjermkart (vedlegg → skjerm)

| Vedlegg | Skjerm |
|---|---|
| `logo.png` | Ordmerke i toppfelt, oppstart |
| `logo-icon.png` | App-ikon, kompakt toppfelt |
| `homepage.png` | Oppdrag – forside |
| `inboks.png` | Innboks |
| `inboks-detail.png` | Åpen chat med tilbudskort |
| `jobdetail_oppdragiver.png` | Oppdragsdetaljer (`TASK_REQUEST`) |
| `jobdetail_oppdragstaker.png` | Tilbyderdetaljer (`SERVICE_OFFER`) |
| *mangler* | Fellesskap – utledes fra designsystemet |
| *mangler* | Onboarding (oppstart, innlogging, verifisering/samtykker, rolle/sted) – utledes |
| *mangler* | Skjemaer, forhåndsvisning, innstillinger – utledes |

## 4. Domenemodell (delmengde for Fase 1)

Typer i `src/domain/`: User, Profile, Verification, BusinessProfile, Location, Category, Listing, TaskDetails, ServiceOfferDetails, ListingImage, Availability, Equipment, SavedListing, SavedSearch, Proposal, ProposalRevision, AgreementSnapshot, Conversation, ConversationParticipant, Message, MessageAttachment, CompletionConfirmation, Review, Report, Block, Notification, Partner.

Regler:
- `Listing.type ∈ { 'TASK_REQUEST', 'SERVICE_OFFER' }`. Type er alltid et eksplisitt felt, aldri utledet fra tekst.
- Pris: `{ amountMinor: number, currency: 'NOK' }`. Ingen betalingstabell for brukerbetaling.
- Proposal-tilstandsmaskin som ren modul med enhetstester: `DRAFT → SENT → (WITHDRAWN | DECLINED | ACCEPTED)`; `ACCEPTED` + revidering → `REVISION_PENDING → (ACCEPTED | DECLINED)`.
- Ved godtatt tilbud lagres `AgreementSnapshot` (pris, dato, beskrivelse, forbehold) som avtalegrunnlag.
- Fullføring: begge parter bekrefter (`CompletionConfirmation` per deltaker) → `fullført` → én vurdering per avtale per part.

Oppdragsstatuser: utkast, publisert, mottar tilbud, tilbud godtatt, avtalt, pågår, ferdigmelding sendt, fullført, vurdert. Alternative: avbrutt, tilbud trukket/avslått, utløpt, rapportert, fjernet.
Tjenestetilbud: utkast, aktivt, pause, utløpt, arkivert, fjernet.

## 5. Skjermer i Fase 1 (spec §22/§27, alle med laste/tom/feil/frakoblet/suksess/manglende tilgang)

1. Oppstart/introduksjon
2. Logg inn / opprett konto (telefon eller e-post med engangskode – mocket)
3. Verifisering og samtykker (samtykkelogg lokalt)
4. Rolle- og stedsoppsett (kommune, sted, ønsket avstand; «Jeg trenger hjelp» / «Jeg ønsker småjobber» / «Begge deler»)
5. Oppdrag – forside
6. Søk, resultater, filtre (type, kategori, avstand, sted, dato/tilgjengelighet, pris/budsjett, verifisert, nyeste) og sortering (relevans, avstand, nyeste, pris/budsjett)
7. Kort for «Trenger hjelp» og «Tilbyr hjelp» (tydelig merke på hvert kort)
8. Legg ut – valgskjerm: «Jeg trenger en jobb utført» / «Jeg ønsker å utføre en jobb»
9. Stegvis skjema: «Jeg trenger en jobb utført»
10. Stegvis skjema: «Jeg ønsker å utføre en jobb»
11. Forhåndsvisning + publiseringssuksess
12. Oppdragsdetaljer (`TASK_REQUEST`) – hovedknapp «Gi tilbud», sekundær «Send melding», tekst «Pris og betaling avtales mellom dere.»
13. Tilbyderdetaljer (`SERVICE_OFFER`) – hovedknapp «Ta kontakt», sekundær «Be om tilbud», tekst «Pris og betaling avtales direkte mellom dere.»
14. Gi / send / be om tilbud
15. Mottatte tilbud og sammenligning
16. Tilbudsdetaljer og revidering
17. Avtalesammendrag
18. Mine oppdrag og tjenestetilbud
19. Innboks
20. Åpen chat (kompakt oppføringskort, chatbobler, sendt/lest, vedlegg, tilbudskort med «Godta tilbud»/«Avslå», «Tilbud godtatt»-divider, «Send tilbud» når rollen tillater). Ingen betaling/Vipps/«Betal nå».
21. Varsler
22. Lagrede oppføringer og søk
23. Offentlig profil + rediger profil
24. Vurderinger + verifiseringssenter (verifiseringsmerker forklarer hva som er kontrollert)
25. Sikkerhet, rapportering og blokkering (rapporter bruker/oppføring/tilbud/melding/vurdering; blokkerte kan ikke kontakte hverandre)
26. Fellesskap og samfunnsbidrag (rolig karusell, opptil to hovedpartnere; Røde Kors bak feature-flagg **av**)
27. Meny, innstillinger, personvern, vilkår, varsler, kontosletting

Senere faser (rutestubb / dokumentert): 28. Bedriftsregistrering, 29. Adminpanel.

## 6. Utenfor omfang for denne leveransen (README dokumenterer)

Ekte server/API/database · ekte auth + BankID · ekte bildeopplasting/objektlagring (kun mock-velger) · adminpanel (kun rutestubb) · bedriftsregistrering (stubb) · ekte analysepipeline · feature-flag-tjeneste (kun lokale flagg) · GDPR eksport/sletting *backend* (kun UI + lokal oppførsel) · Røde Kors-innhold (feature-flagg **av**) · **betaling – aldri, i ingen fase**.

## 7. Implementasjon – 13 vertikale skiver

| # | Innhold |
|---|---|
| 0 | Scaffold, design-tokens, fontlasting, UI-primitiver, ikoner, logoressurser, navigasjonsskall med bunnfaner + toppfelt-varianter |
| 1 | Mock-datalag + seed + API-klient + TanStack Query + domenetyper + proposal-tilstandsmaskin (m/ tester) |
| 2 | Oppdrag – forside (pikselnær `homepage.png`), alle tilstander |
| 3 | Søk, resultater, filtre, sortering |
| 4 | Begge detaljsider (pikselnær `jobdetail_*`) |
| 5 | Oppføringstype-separasjon + «Legg ut»-valg + begge stegvise skjemaer + forhåndsvisning + publiseringssuksess |
| 6 | Innboks + Chat + tilbudskort i chat (pikselnær `inboks.png` / `inboks-detail.png`) |
| 7 | Tilbudssystem: gi/be om tilbud, mottatte tilbud, sammenligning, revidering, avtalesammendrag |
| 8 | Mine oppdrag/tjenestetilbud + fullføring (begge bekrefter) + vurderinger |
| 9 | Profil (offentlig + rediger) + verifiseringssenter + lagrede oppføringer/søk + varsler |
| 10 | Onboarding: oppstart/intro → innlogging (mock engangskode) → samtykker → rolle + sted |
| 11 | Fellesskap (utledet) + Meny/innstillinger/personvern/vilkår/varslinger/kontosletting |
| 12 | Trygghet: rapportering/blokkering koblet overalt + frakoblet/feil/tom-polering + visuell regresjon mot de 7 bildene |

## 8. E2E-flyter som må fungere på mock-data

1. Finn oppdrag → gi tilbud → chat → godta → fullfør → vurder.
2. Finn tilbyder → ta kontakt → be om tilbud → godta → fullfør → vurder.

## 9. Testdekning

Domene (proposal-tilstandsmaskin, prisformattering, type-separasjon), UI-primitiver, begge publiseringsflyter, blokkering/rapportering, nettverksfeil, dobbelttrykk, skjermleser-navn, kontrast, dynamisk tekst, de to E2E-flytene.

## 10. Reversible antakelser

- Fargeverdier er øyemålt fra PNG-ene; justeres når offisielle tokens finnes.
- Font antatt Mulish; byttes til offisiell font uten kodeendring utenfor `src/theme/`.
- Fellesskap-, onboarding- og skjemaskjermer er utledet fra delt designsystem.
- Hjemskjermens resultatkort får et lite «Trenger hjelp»/«Tilbyr hjelp»-merke i tillegg til kategorimerket (spec §9 krever typemerke; mockupen viser bare kategori).
- «Aktiv nå»/online-prikk er mock.
