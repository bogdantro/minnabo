# MinNabo

MinNabo gjør det enkelt og trygt for folk i Innlandet å finne hjelp til småjobber –
eller tilby egen hjelp i nærheten. Appen handler **kun** om småjobber. Den håndterer
**ikke betaling** mellom brukere: pris og betaling avtales og gjennomføres direkte
mellom partene.

> Småjobber nær deg. Enkelt, trygt og lokalt.

Dette repoet er **Fase 1 – MVP**, bygget frontend-først mot et mock-datalag. Alt kjører
uten server; brukergenererte data lagres i minne (og `AsyncStorage` der det gir mening).

## Kom i gang

```bash
npm install
npm start          # åpner Expo – trykk i (iOS), a (Android) eller w (web)
```

Krever Node 20+. Enklest: installer **Expo Go** på telefonen og skann QR-koden.

## Tester

```bash
npm test           # Jest + React Native Testing Library (78 tester)
npm run typecheck  # tsc --noEmit (strict)
```

## Skjermer som er bygget

- **Onboarding**: velkommen → logg inn (engangskode `0000` i demoen) → samtykker →
  rolle og sted
- **Oppdrag** (forside): søk, kategorier, «Folk som trenger hjelp» og «Folk som tilbyr
  hjelp» med «Se alle» → egne lister; tilbyderlista har en rad med aktive brukere
- **Søk**: fritekst, filtre (type, kategori, avstand, verifisert) i bunnark, sortering
- **Oppdragsdetaljer** (`TASK_REQUEST`) og **Tilbyderdetaljer** (`SERVICE_OFFER`) –
  ulik terminologi, status og knapper; ruting skjer på `Listing.type`
- **Legg ut**: valgskjerm → to stegvise skjemaer → forhåndsvisning → publiseringssuksess
- **Gi tilbud / Be om tilbud**: oppretter samtale og sender tilbud/forespørsel
- **Innboks** og **Chat**: oppføringskort, chatbobler, sendt/lest, tilbudskort med
  «Godta tilbud»/«Avslå», «Tilbud godtatt»-divider, «marker som fullført»
- **Fullføring** (begge bekrefter) og **Vurdering** (én per avtale)
- **Profil** (egen + offentlig), **rediger profil**, **verifiseringssenter** (stubb)
- **Varsler**, **Lagrede oppføringer**, **Mine oppdrag og tjenester**
- **Fellesskap**: hovedpartnere, lokale støttespillere, dokumenterte bidrag
- **Meny** (halvskjerms bunnark med alle sider), **Innstillinger**, **Personvern**,
  **Vilkår**, **Varslinger**, **Kontosletting**
- **Sikkerhet**: rapportering (5 årsaker → moderator) og blokkering (skjuler brukerens
  oppføringer og samtaler)

Hver hovedskjerm har laste-, tom-, feil-, frakoblet- og suksesstilstander, og en fast
topplinje med tilbakepil og MinNabo-logo (også på feilsider).

## Prosjektstruktur

```
app/                 expo-router-ruter (filbasert)
  (tabs)/            Oppdrag (forside), Fellesskap, Innboks
src/
  theme/             design-tokens utledet fra skjermbildene
  i18n/nb.ts         all synlig tekst på norsk bokmål (ingen språkvelger)
  domain/            entitetstyper, pris (NOK, minste enhet), proposal-tilstandsmaskin
  data/              seed + in-memory repositories/stores (listings, chat, profil,
                     lagrede, sikkerhet, auth, utkast)
  api/               MockApiClient (speiler et framtidig REST-API) + React Query-hooks
  components/         designsystem-primitiver + sammensatte komponenter
  screens/           skjermkomponenter
docs/                design- og byggespesifikasjon + implementasjonsplaner
tests/               domene, komponenter, skjermer og to E2E-flyter
```

## E2E-flyter (testet på mock-data)

1. Finn oppdrag → gi tilbud → chat → godta → fullfør → vurder
2. Finn tilbyder → ta kontakt → be om tilbud → godta → fullfør → vurder

## Bekreftelser (produktregler)

- «Oppdrag» er appens forside. Det finnes ingen «Hjem»-fane.
- Profilbildet er en fast sirkulær snarvei øverst til høyre på alle innloggede
  hovedsider og åpner profilen (tilgjengelighetsnavn «Åpne profil»).
- To tydelig forskjellige oppføringstyper: `TASK_REQUEST` og `SERVICE_OFFER`. Typen er
  et lagret felt og utledes aldri fra tekst.
- Tilbud kan godtas i chat, men **betaling skjer aldri i MinNabo** – i ingen fase.
- Kun lyst tema. De vedlagte lyse skjermbildene er visuell fasit.

## Hva som er mocket / utenfor omfang

Ekte server/API/database · ekte innlogging + BankID · ekte bildeopplasting/objektlagring
(mock-velger mangler foreløpig) · adminpanel · bedriftsregistrering (stubb) · ekte
analysepipeline · feature-flag-tjeneste (kun `src/config/featureFlags.ts`) · GDPR
eksport/sletting-*backend* (kun UI + lokal oppførsel) · Røde Kors-innhold (feature-flagg
**av**) · **betaling – aldri**.

## Reversible antakelser

- Fargeverdier er øyemålt fra PNG-ene; justeres når offisielle tokens finnes
  (`src/theme/tokens.ts`).
- Font antatt Mulish; kan byttes uten endring utenfor `src/theme`.
- Fellesskap-, onboarding-, skjema- og innstillingsskjermer er utledet fra det delte
  designsystemet (mangler egne skjermbilder).
- Hjemskjermens resultatkort har et lite «Trenger hjelp»/«Tilbyr hjelp»-merke i tillegg
  til kategorimerket.
- `authStore.isOnboarded` er `true` som standard, så appen åpner på Oppdrag. Onboarding
  nås via «Logg ut» / «Slett konto».
- «Aktiv nå» / online-status er mock.
- Test: `fireEvent` må alltid `await`-es i dette RNTL 14-oppsettet.

Se `docs/minnabo-build-spec-design.md` for full skjermliste og faseplan.
