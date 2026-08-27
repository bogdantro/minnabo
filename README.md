# MinNabo

MinNabo gjør det enkelt og trygt for folk i Innlandet å finne hjelp til småjobber –
eller tilby egen hjelp i nærheten. Appen handler **kun** om småjobber. Den håndterer
**ikke betaling** mellom brukere: pris og betaling avtales og gjennomføres direkte
mellom partene.

> Småjobber nær deg. Enkelt, trygt og lokalt.

Dette repoet er **Fase 1 – MVP**, bygget frontend-først mot et mock-datalag.

## Kom i gang

```bash
npm install
npm start          # åpner Expo – trykk i for iOS-simulator, a for Android, w for web
```

Krever Node 20+ og (for simulator) Xcode / Android Studio. Enklest er å installere
**Expo Go** på telefonen og skanne QR-koden fra `npm start`.

## Tester

```bash
npm test           # Jest + React Native Testing Library
npm run typecheck  # tsc --noEmit
```

## Prosjektstruktur

```
app/                 expo-router-ruter
  _layout.tsx        fontlasting, React Query, safe area
  (tabs)/            bunnfanene: Oppdrag (forside), Fellesskap, Innboks, Meny
  legg-ut.tsx        valgskjerm: trenger jobb / ønsker å utføre jobb
src/
  theme/             design-tokens utledet fra skjermbildene (eneste kilde for farge/type)
  i18n/nb.ts         all synlig tekst på norsk bokmål (ingen språkvelger)
  domain/            entitetstyper, pris (NOK, minste enhet), proposal-tilstandsmaskin
  data/              seed-datasett + in-memory repositories (+ AsyncStorage for egne data)
  api/               MockApiClient (speiler et framtidig REST-API) + React Query-hooks
  components/ui/      designsystem-primitiver
  components/         sammensatte komponenter (TopBar, TabBar, ListingCard …)
  screens/           skjermkomponenter
docs/                design- og byggespesifikasjon + implementasjonsplaner
```

## Bekreftelser (produktregler)

- «Oppdrag» er appens forside. Det finnes ingen «Hjem»-fane.
- Profilbildet er en fast, sirkulær snarvei øverst til høyre på alle innloggede
  hovedsider, og åpner profilen ved trykk (tilgjengelighetsnavn «Åpne profil»).
- Det finnes **to tydelig forskjellige oppføringstyper**: `TASK_REQUEST` (noen trenger
  hjelp) og `SERVICE_OFFER` (noen tilbyr hjelp), med ulik terminologi, status og
  primærknapp. Typen er alltid et lagret felt og utledes aldri fra tekst.
- Tilbud kan godtas i chat, men **betaling skjer aldri i MinNabo**.
- Kun lyst tema. De vedlagte lyse skjermbildene er visuell fasit.

## Hva som er mocket / utenfor omfang i denne leveransen

Ekte server/API/database · ekte innlogging + BankID · ekte bildeopplasting/objektlagring
· adminpanel (kun rutestubb) · bedriftsregistrering (stubb) · ekte analysepipeline ·
feature-flag-tjeneste (kun lokale flagg) · GDPR eksport/sletting-*backend* (kun UI +
lokal oppførsel) · Røde Kors-innhold (feature-flagg **av** til skriftlig godkjenning) ·
**betaling – aldri, i ingen fase**.

## Reversible antakelser

- Fargeverdier er øyemålt fra PNG-ene; justeres når offisielle tokens finnes
  (`src/theme/tokens.ts`).
- Font antatt Mulish; kan byttes uten endring utenfor `src/theme`.
- Fellesskap-, onboarding- og skjemaskjermer er utledet fra det delte designsystemet
  (mangler egne skjermbilder).
- Hjemskjermens resultatkort har et lite «Trenger hjelp»/«Tilbyr hjelp»-merke i tillegg
  til kategorimerket (spec §9 krever typemerke; mockupen viser bare kategori).
- «Aktiv nå» / online-prikk er mock.

## Videre arbeid

Se `docs/minnabo-build-spec-design.md` for full skjermliste og faseplan, og
`docs/superpowers/plans/` for implementasjonsplaner per skive.
