# CLAUDE MASTERPROMPT – BYGG MINNABO FRA A TIL Å

Du er hovedutvikler, produktdesigner, sikkerhetsansvarlig og QA-ansvarlig for MinNabo. Bygg en produksjonsklar mobilapp for småjobber i Innlandet. Dette dokumentet er produktets funksjonelle fasit. Bildene som er vedlagt i Claude-chatten er den visuelle fasiten.

Ikke finn på et nytt design. Analyser først alle vedlagte MinNabo-bilder, identifiser det felles designsystemet og bygg appen slik at den visuelt samsvarer med dem.

## 1. Prioritetsrekkefølge og visuell fasit

Følg denne rekkefølgen ved konflikt:

1. Ufravikelige produktregler i dette dokumentet.
2. Funksjons- og sikkerhetskrav i dette dokumentet.
3. De nyeste vedlagte skjermbildene med lyst tema.
4. Eldre beskrivelser eller kode.

Bildene er bindende referanser for farger, typografi, ikonstil, avrundinger, skygger, kort, knapper, felt, statusmerker, marger, toppfelt, profilbilde, bunnnavigasjon, oppdragskort, samtalelister, chatbobler og tilbudskort. Telefonrammen i mockupene skal ikke bygges inn i appen.

Forventede vedlegg i Claude-chatten:

1. MinNabo-logo med ordmerke.
2. MinNabo-ikon uten tekst.
3. Lys «Oppdrag»-forside.
4. Lys «Fellesskap»-side.
5. Lys «Innboks»-side.
6. Åpen chat med meldinger og tilbudskort.
7. Oppdragsdetaljer for «Klippe plen».
8. Tilbyderdetaljer for «Jeg kan klippe plenen din».

Hvis ett vedlegg mangler, bruk designsystemet fra de andre bildene og dokumenter antakelsen.

## 2. Ufravikelige produktregler

1. MinNabo handler kun om småjobber. Ikke bygg nabolagsfeed, forum eller nyhetsstrøm.
2. Appen skal ikke håndtere betaling mellom brukerne.
3. Ikke bygg kortbetaling, Vipps-betaling, betalingslenke mellom brukere, escrow, wallet, saldo, utbetaling, refusjon, provisjon eller transaksjonsgebyr.
4. Pris og betalingsmåte avtales mellom partene i chatten. Betalingen skjer utenfor MinNabo.
5. Oppdragstaker kan sende et konkret tilbud. Oppdragsgiver kan godta eller avslå tilbudet.
6. «Legg ut» skal først vise «Jeg trenger en jobb utført» og «Jeg ønsker å utføre en jobb».
7. Hele appen skal kun være på norsk bokmål, også feilmeldinger, varsler, e-poster og admintekster.
8. Ikke bygg språkvelger i første versjon.
9. Bruk kun lyst tema. Gamle mørke skisser er ugyldige.
10. «Oppdrag» er appens forside. Det finnes ingen «Hjem»-fane.
11. Profilbildet skal være synlig øverst til høyre på alle innloggede hovedsider og åpne profilen ved trykk.
12. MinNabo formidler jobbmuligheter, men lover ikke ansettelse, inntekt eller garantert arbeid.

## 3. Produktvisjon og språk

MinNabo gjør det enkelt og trygt for mennesker i Innlandet å finne hjelp til småjobber eller tilby egen hjelp i nærheten.

> Småjobber nær deg. Enkelt, trygt og lokalt.

> Sammen skaper vi flere jobbmuligheter i Innlandet, gjør lokal hjelp lettere tilgjengelig og støtter Norges Røde Kors.

> Lokale jobber. Lokal hjelp. Et sterkere fellesskap.

Bruk enkelt, naturlig bokmål. Unngå overdrevne løfter og språk som får småjobber til å høres ut som faste ansettelser.

## 4. Område, kontoer og roller

- Appen dekker hele Innlandet.
- Brukeren velger kommune, sted og ønsket avstand.
- Én konto kan både trenge hjelp og tilby hjelp.
- Privatpersoner og relevante fagbedrifter kan bruke løsningen.
- Aldersgrenser og samtykke fra foresatte skal være konfigurerbare etter juridisk vurdering.

Roller: gjest, registrert bruker, bedriftsbruker, samarbeidspartner og administrator/moderator. Bedriftsbrukere har organisasjonsnummer, kontaktperson, kategorier og verifiseringsstatus. Administrator håndterer brukere, oppføringer, tilbud, rapporter, verifiseringer, partnere og statistikk.

## 5. Registrering og onboarding

- Midlertidig innlogging kan bruke telefonnummer eller e-post med engangskode.
- Arkitekturen skal støtte BankID når avtale og juridisk grunnlag er på plass.
- Samle inn navn, fødselsdato, telefon, e-post, kommune/sted og nødvendige samtykker.
- Profilbilde er valgfritt. Uten bilde vises en nøytral avatar med initialer.
- Spør om formål: «Jeg trenger hjelp», «Jeg ønsker småjobber» eller «Begge deler».
- Valget begrenser ikke kontoen permanent.
- Vis bare omtrentlig sted offentlig.

## 6. Hovednavigasjon

Fast bunnmeny på hovedsidene:

1. Oppdrag – utklippstavleikon
2. Fellesskap – gruppeikon
3. Legg ut – stor fremhevet limegrønn plussknapp
4. Innboks – snakkebobleikon
5. Meny – hamburgerikon

«Oppdrag» er standardrute. «Fellesskap» inneholder støttespillere, samarbeidspartnere og godkjent Røde Kors-innhold. «Meny» samler øvrige funksjoner og innstillinger. Profil er ikke en bunnfane.

Profilbildet er en fast, sirkulær snarvei øverst til høyre med tilgjengelighetsnavnet «Åpne profil». Varselikon ligger til venstre. På detaljsider og chat kan bunnmenyen skjules.

## 7. To forskjellige oppføringstyper

### A. Oppdrag – noen trenger hjelp

Eksempel: «Klippe plen».

- Eier er oppdragsgiver.
- Andre brukere velger «Gi tilbud» eller «Send melding».
- Kort og detaljside merkes «Trenger hjelp» eller «Åpent oppdrag».
- Oppdragstaker sender tilbud til oppdragsgiver.

### B. Tjenestetilbud – noen tilbyr hjelp

Eksempel: «Jeg kan klippe plenen din».

- Eier er tilbyder/oppdragstaker.
- Oppføringen merkes «Tilbyr hjelp».
- Den som trenger hjelp velger «Ta kontakt» eller «Be om tilbud».
- Dette er strukturert tilgjengelighet, ikke et sosialt innlegg eller en fast jobbannonse.

Bruk ulik terminologi, status og primærknapp slik at typene aldri forveksles.

## 8. Flyten etter «Legg ut»

«Legg ut» åpner alltid en valgskjerm.

### Jeg trenger en jobb utført

Stegvis skjema med tittel, beskrivelse, kategori, bilder, sted, omtrentlig område, dato/tid, forventet varighet, budsjett eller «Ønsker tilbud», verktøy, materialer, praktisk informasjon og eventuelle kompetansekrav. Eksakt adresse skjules. Vis forhåndsvisning før publisering.

### Jeg ønsker å utføre en jobb

Stegvis skjema med overskrift, tjenester/kategorier, presentasjon, bilder, område, maksimal avstand, tilgjengelighet, utstyr, transport, erfaring, kvalifikasjoner og ønsket pris/fra-pris eller «Pris avtales». Vis forhåndsvisning før publisering.

## 9. Oppdragssiden – forsiden

Følg vedlagt lys «Oppdrag»-forside tett. Vis MinNabo-logo øverst til venstre, varsel og profilbilde øverst til høyre, «Hva trenger du hjelp med?», søk, kategorier, sted/avstand og relevante oppføringer.

Søk etter gressklipping skal kunne vise begge typer:

- «Klippe plen» – trenger hjelp
- «Jeg kan klippe plenen din» – tilbyr hjelp

Resultatkort må vise tydelig merke «Trenger hjelp» eller «Tilbyr hjelp».

Filtre: type, kategori, avstand, sted, dato/tilgjengelighet, pris/budsjett, verifisert og nyeste. Sortering: relevans, avstand, nyeste og pris/budsjett.

## 10. Oppdragsdetaljer – noen trenger hjelp

Følg vedlagt skjerm «Oppdragsdetaljer». Vis tilbakepil, tittel, varsel, fast profilbilde, bildegalleri, bildeteller, lagreknapp, tittel, kategori, «Åpent oppdrag», pris/budsjett, omtrentlig sted, avstand, dato, varighet, beskrivelse, praktisk informasjon, utstyr og oppdragsgiverkort med vurdering og ekte verifisering.

Handlinger:

- hovedknapp «Gi tilbud»
- sekundærknapp «Send melding»
- tekst «Pris og betaling avtales mellom dere.»

Ikke vis eksakt adresse offentlig.

## 11. Tilbyderdetaljer – noen tilbyr hjelp

Følg vedlagt skjerm «Tilgjengelig for småjobber». Vis tilbakepil, tittel, varsel, fast profilbilde, stort bilde, merket «Tilbyr hjelp», tittel, kategori, fra-pris eller «Pris avtales», vurderinger, forklarte verifiseringer, område, maksimal avstand, tilgjengelighet, utstyr, «Om tilbudet», erfaring, tjenester og tilbyderkort.

Handlinger:

- hovedknapp «Ta kontakt»
- sekundærknapp «Be om tilbud»
- tekst «Pris og betaling avtales direkte mellom dere.»

Det skal være umulig å misforstå at denne personen tilbyr å utføre jobber.

## 12. Tilbudssystem

Tilbud inneholder foreslått pris i NOK, kort melding, dato/tid, forbehold, spørsmål og referanse til oppføringen. Prisfeltet er kun informasjon.

Oppdragsgiver kan sammenligne tilbud, chatte, be om endring, godta eller avslå. Tilbyderen kan trekke tilbud før godkjenning. Endring etter godkjenning krever revidert tilbud som begge bekrefter.

Ved godkjenning lagres pris, dato, beskrivelse og forbehold som avtalegrunnlag. Vis «Tilbud godtatt» og:

> Betaling avtales og gjennomføres direkte mellom partene. MinNabo håndterer ikke betaling.

## 13. Innboks

Følg vedlagt «Innboks»-skjerm. Vis logo, varsel, fast profilbilde, tittelen «Innboks», søkefelt «Søk i meldinger», filtrene «Alle» og «Uleste» og samtaler med avatar, navn, oppføring, siste melding, tidspunkt, ulest indikator og statuser som «Nytt tilbud» og «Tilbud godtatt».

Samtaler skal være knyttet til en oppføring eller et avtalegrunnlag. «Innboks» er aktiv i bunnmenyen.

## 14. Chat

Følg vedlagt åpen chat. Vis tilbakepil, motpartens avatar/navn, eventuell aktivitetsstatus, rapporteringsmeny, kompakt oppføringskort, chatbobler, tidsstempler, sendt/lest-status, vedlegg, meldingsfelt og «Send tilbud» når rollen tillater det.

Tilbudskortet viser pris, dato, beskrivelse og forbehold. Riktig mottaker kan velge «Godta tilbud» eller «Avslå». Etter godkjenning vises «Tilbud godtatt».

Ikke vis betaling, Vipps eller «Betal nå».

## 15. Statuser, fullføring og vurdering

Oppdragsstatuser: utkast, publisert, mottar tilbud, tilbud godtatt, avtalt, pågår, ferdigmelding sendt, fullført og vurdert. Alternative statuser: avbrutt, tilbud trukket/avslått, utløpt, rapportert eller fjernet.

Tjenestetilbud: utkast, aktivt, pause, utløpt, arkivert eller fjernet.

Begge parter bekrefter fullføring. Uenighet åpner rapportering, men ikke økonomisk tvisteløsning. Etter fullføring kan begge gi én vurdering per avtale.

## 16. Profil, tillit og varsler

Profilen kan vise navn, profilbilde, område, presentasjon, tjenester, kategorier, verifisering, gjennomførte oppdrag, vurderinger og «medlem siden». Verifiseringsmerker må forklare hva som er kontrollert.

Varsler på bokmål: ny melding, nytt/endret/trukket tilbud, tilbud godtatt/avslått, avtalt tidspunkt, ferdigmelding, vurdering og moderatorhandling.

## 17. Fellesskap, støttespillere og Røde Kors

Følg vedlagt lys fellesskapsside.

> Sammen gjør vi en forskjell

> Sammen skaper vi flere jobbmuligheter i Innlandet, gjør lokal hjelp lettere tilgjengelig og støtter Norges Røde Kors.

> Våre samarbeidspartnere er med og bidrar – og en del av sponsorinntektene går til Norges Røde Kors.

- Opptil to hovedpartnere får premiumplassering.
- Lokale støttespillere vises rolig i karusell og på oversikt.
- Ingen rotete logovegg, blinkende banner eller automatisk lyd.
- Sponsoravtaler og betaling håndteres utenfor appen.
- Donasjon gjennomføres ikke inne i MinNabo.
- Ekstern lenke kan åpne offisiell Røde Kors-side etter godkjenning.
- Ikke bygg 80/20-betaling eller pengedeling i appen.
- Vis bare dokumenterte donasjoner som faktisk er overført.
- Røde Kors-navn, logo og lenke ligger bak feature flagg frem til skriftlig godkjenning.

## 18. Designsystem

Designpersonlighet: lokal, trygg, energisk, inkluderende, enkel og moderne.

Utled eksakte tokens fra vedleggene:

- mørk marineblå for hovedtekst, ikoner og overskrifter
- limegrønn for primærhandling, aktiv tilstand og positive statuser
- cyan for sekundær aksent og lenker
- varm hvit sidebakgrunn
- hvite kort og handlingsfelt
- lyse grå/blå toner for skillelinjer og innkommende chatbobler

Komponentregler:

- store overskrifter i marineblå
- avrundede kort med svak kant/skygge
- store trykkflater og god kontrast
- limegrønn gradient kan brukes på hovedknapper og «Legg ut»
- sekundærknapper er hvite med farget kant
- rolige, tekstlige statusmerker
- samme ikonfamilie overalt
- sirkulært profilbilde med cyan kant
- ingen mørkt tema, glassmorfisme, tilfeldige farger eller sterke animasjoner

Bygg responsivt for iOS og Android, følg safe areas og støtt større tekst. WCAG-kontrast og tilgjengelighetsnavn er obligatorisk.

## 19. Kategorier og fagarbeid

Kategorier: hage, rengjøring, flytting/bæring, transport/levering, montering, snømåking, maling/enkelt vedlikehold, dyrepass, datahjelp, arrangementshjelp og annet.

Lovregulert elektriker-, rørlegger-, mur-/konstruksjons- eller annet fagarbeid skal blokkeres eller rutes til relevante verifiserte bedrifter etter juridisk vurdering.

## 20. Trygghet og personvern

- Rapporter bruker, oppføring, tilbud, melding og vurdering.
- Blokkerte brukere kan ikke kontakte hverandre.
- Eksakt hjemmeadresse er aldri offentlig.
- Adresse kan deles etter godtatt tilbud når nødvendig.
- Serveren håndhever roller og tilgang.
- Krypter data under overføring og lagring.
- Ingen hemmeligheter i kildekoden.
- GDPR: samtykkelogg, innsyn, eksport, sletting, lagringstid og formålsbegrensning.
- Moderator har køer, risikoflagg og verktøy mot misbruk.
- Følsomme adminhandlinger logges.
- Ikke samle inn kortnummer, bankkonto eller betalingshistorikk mellom brukerne.

## 21. Forretningsmodell

- Privatbrukere har ikke abonnement.
- MinNabo tar ikke provisjon fra oppdrag.
- Bedrifts-, sponsor- og eventuelle leadavtaler inngås og faktureres utenfor appen.
- Admin kan registrere ekstern avtaleperiode og tilgangsstatus.
- Ikke bygg checkout, abonnementskjøp eller fakturabetaling i mobilappen.

## 22. Obligatoriske skjermer

1. Oppstart og introduksjon
2. Logg inn/opprett konto
3. Verifisering og samtykker
4. Rolle- og stedsoppsett
5. Oppdrag – forside
6. Søk, resultater, filtre og sortering
7. Kort for «Trenger hjelp» og «Tilbyr hjelp»
8. Legg ut – valg mellom de to typene
9. Skjema for «Jeg trenger en jobb utført»
10. Skjema for «Jeg ønsker å utføre en jobb»
11. Forhåndsvisning og publiseringssuksess
12. Oppdragsdetaljer
13. Tilbyderdetaljer
14. Gi/send/be om tilbud
15. Mottatte tilbud og sammenligning
16. Tilbudsdetaljer og revidering
17. Avtalesammendrag
18. Mine oppdrag og tjenestetilbud
19. Innboks
20. Åpen chat
21. Varsler
22. Lagrede oppføringer og søk
23. Offentlig profil og rediger profil
24. Vurderinger og verifiseringssenter
25. Sikkerhet, rapportering og blokkering
26. Fellesskap og samfunnsbidrag
27. Meny, innstillinger, personvern, vilkår, varsler og kontosletting
28. Bedriftsregistrering
29. Adminpanel

Alle viktige skjermer skal ha lasting, tom, feil, frakoblet, suksess og manglende tilgang.

## 23. Teknisk arkitektur og datamodell

Behold godkjent eksisterende stack. Ellers bruk robust kryssplattformarkitektur med TypeScript, tydelig separasjon mellom UI, domene, data og infrastruktur, sikker server/API, relasjonsdatabase, objektlagring, bakgrunnsjobber, feature flags og observability uten lekkasje av persondata.

Minimumsentiteter: User, Profile, Verification, BusinessProfile, Location, Category, Listing, TaskDetails, ServiceOfferDetails, ListingImage, Availability, Equipment, SavedListing, SavedSearch, Proposal, ProposalRevision, AgreementSnapshot, Conversation, ConversationParticipant, Message, MessageAttachment, CompletionConfirmation, Review, Report, Block, Notification, Partner, PartnerPlacement, ExternalAgreementStatus, DonationRecord, FeatureFlag, ConsentRecord og AuditLog.

`Listing.type` skal minst støtte `TASK_REQUEST` og `SERVICE_OFFER`. Type skal aldri utledes bare fra tekst. Pris lagres i minste valutaenhet med valuta NOK. Ikke opprett betalingstabell for brukerbetaling.

## 24. API og autorisasjon

API-et støtter registrering, profil, søk, begge oppføringstyper, tilbud, chat, fullføring, vurdering, rapportering, partnerinnhold og admin.

- bare eier redigerer/arkiverer egen oppføring
- bare relevant rolle sender, godtar, avslår eller trekker tilbud
- bare deltakere leser samtalen
- idempotens for meldinger og tilbud
- rate limiting på innlogging, chat, tilbud og rapporter
- validering av bilder, type, størrelse og metadata
- alle adminhandlinger autoriseres server-side

## 25. Analyse

Mål aktive brukere, publiserte oppdrag/tjenestetilbud, søk til detaljvisning, detaljvisning til kontakt/tilbud, tilbud sendt/godtatt, fullførte oppdrag, svar-/gjennomføringstid, rapportfrekvens, partnerplasseringer og dokumenterte donasjoner. Ikke bruk nedlastinger som eneste suksessmål.

## 26. Test og visuell kvalitet

Test domene, API, database, komponenter, begge publiseringsflyter, autorisasjon, blokkering, rapportering, nettverksfeil, dobbelttrykk, skjermleser, kontrast og dynamisk tekst.

E2E-flyter:

1. Finn oppdrag → gi tilbud → chat → godta → fullfør → vurder.
2. Finn tilbyder → ta kontakt → be om tilbud → godta → fullfør → vurder.

Bruk visuelle regresjonstester mot vedleggene. Før en skjerm godkjennes, sammenlign farger, avstander, størrelser, fontvekter, ikoner, kort og knapper med riktig bilde.

## 27. Utviklingsfaser

### Fase 0 – design og fundament

Analyser vedlegg, etabler tokens/komponentbibliotek og dokumenter ruter, datamodell og sikkerhet.

### Fase 1 – MVP

Onboarding, profil, sted, Oppdrag-forside, søk, begge oppføringstyper, begge detaljsider, tilbud, innboks, chat, fullføring, vurdering, rapportering og blokkering.

### Fase 2 – kvalitet

Bedre filtre, lagring, varsler, verifisering, moderering og analyse.

### Fase 3 – fellesskap og partnere

Fellesskap, partnerrotasjon og eksternt godkjent Røde Kors-innhold.

### Fase 4 – lansering

Sikkerhet, personvern, ytelse, tilgjengelighet, butikkkrav og produksjonsovervåkning.

## 28. Definisjon av ferdig

En funksjon er ikke ferdig før den matcher relevant vedlagt design, bruker korrekt bokmål, håndterer alle UI-tilstander, håndhever autorisasjon på server, ikke utfører betaling, skiller oppføringstypene korrekt, følger profil-/navigasjonsreglene, oppfyller sikkerhet/personvern og har beståtte tester.

## 29. Arbeidsinstruks til Claude

1. Les hele dokumentet og analyser alle vedlagte bilder før kode.
2. Lag først en oversikt som kobler hvert vedlegg til riktig skjerm.
3. Utled design-tokens og gjenbrukbare komponenter fra bildene.
4. Lag en faseplan og dokumenter bare reelle blokkeringer.
5. Bygg vertikale, testbare flyter.
6. Ikke endre produktreglene eller introduser betaling.
7. Ikke finn på en annen merkevare, palett, navigasjon eller mørkt tema.
8. Bruk ekte appkomponenter; ikke bygg telefonrammen fra mockupene.
9. Bruk logoer/bilder som prosjektressurser der rettighetene tillater det. Ikke legg hele skjermbilder inn som UI.
10. Sammenlign hver ferdig skjerm mot vedlegget og korriger visuelle avvik.
11. Dokumenter reversible antakelser.
12. Lever fungerende kode, migrasjoner, tester og oppdatert README.

Start med å bekrefte:

- «Oppdrag» er forsiden.
- Profilbildet er synlig øverst til høyre.
- Det finnes to tydelig forskjellige oppføringstyper.
- Tilbud kan godtas i chat, men betaling skjer aldri i MinNabo.
- De vedlagte lyse bildene er visuell fasit.
