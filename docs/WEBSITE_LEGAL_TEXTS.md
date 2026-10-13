# Vilkår and Personvern: changes for the website (2026-10-13)

For the website project (`minnaboweb`). The app and the website must show the same Vilkår and the same
Personvern, and every sentence must describe what the system really does. The app side is done. This file
lists what the website has to change.

## What changed in the app and the database

- **App Vilkår** (`src/content/terms.ts` in the app repo) now has the website's 12 sections, word for word,
  except the six sentences in "Vilkår" below. Those six were not true, so they were corrected in the app and
  must be corrected the same way on the website.
- **Vipps e-mail.** The app's login asks Vipps for name, phone number, birth date **and e-mail**
  (`supabase/functions/vipps-login`, scope `openid name phoneNumber birthDate email`). The e-mail is stored in
  `profile_private.email` and `profile_settings.email` and gives the "E-post bekreftet" badge. It is kept, so
  the texts must say so.
- **Retention is now real.** Migration `0064_retention.sql` (app repo, not pushed yet) adds a nightly job.
  The periods in "Personvern, section 5" below are exactly what it does.

## Vilkår (`templates/public/legal/vilkar.html`)

Set `site.terms_updated` to `13. oktober 2026`. Replace these sentences; leave everything else as it is.

| Section | Now | Replace with |
|---|---|---|
| 2 Konto og innlogging med Vipps, bullet 1 | Ved innlogging får vi navn, telefonnummer og fødselsdato fra Vipps for å bekrefte hvem du er og hvor gammel du er. | Ved innlogging får vi navn, telefonnummer, fødselsdato og e-postadresse fra Vipps for å bekrefte hvem du er og hvor gammel du er. |
| 4 Oppdrag og tilbud, bullet 3 | En avtale er inngått når oppdragsgiveren godtar et tilbud og avtalen er bekreftet i chatten. | En avtale er inngått når oppdragsgiveren godtar et tilbud. Da ser dere begge avtalen i appen, og dere ser hverandres telefonnummer. |
| 4 Oppdrag og tilbud, bullet 4 | Må du avlyse, gi beskjed så tidlig som mulig. Gjentatte avlysninger kan påvirke kontoen din. | Må du avlyse, gi beskjed så tidlig som mulig. Gjentatte avlysninger vises på profilen din og kan påvirke kontoen. |
| 6 Vurderinger, bullet 4 | Vi kan fjerne vurderinger som bryter vilkårene, men vi endrer aldri innholdet i en vurdering. | Vi kan fjerne teksten i en vurdering som bryter vilkårene. Vi skriver aldri om det noen har skrevet. |
| 8 Moderering og utestengelse, new bullet after "Ved brudd på vilkårene …" | (missing) | Innhold som flere har rapportert, kan bli skjult automatisk, og en konto som flere har rapportert, kan bli suspendert automatisk, til en moderator har sett på saken. |
| 9 Vilkår for partnere, "Retningslinjer for partnere" | … Kortet skal ikke inneholde kontaktinformasjon, priser eller rabatter. | Retningslinjer for partnere: logo, tekst og lenke skal gjelde bedriften selv, være saklige og følge vilkårene for forbudt innhold. Logo og tekst skal ikke inneholde priser eller rabatter. |
| 9 Vilkår for partnere, new bullet after "Retningslinjer for partnere" | (missing) | Lenke til nettsiden vises for Lokale helter og Hovedpartnere. Hovedpartnere har i tillegg en egen side i appen med telefon, e-post, adresse og åpningstider. |

Why each one was wrong:

- **Section 2:** the e-mail is fetched from Vipps.
- **Section 4, bullet 3:** there is no confirmation step in the chat. Accepting the tilbud creates the avtale
  (`agreement_snapshots`), and from then on each party can read the other's phone number (`shared_contact()`).
- **Section 6:** the moderation action "Fjern innhold" on a vurdering blanks the comment and keeps the stars
  (`update reviews set comment = null`). The vurdering is not removed.
- **Section 8:** `reports_auto_moderate` hides content at `moderation.auto_hide_threshold` (3) reports and
  suspends at `moderation.auto_suspend_threshold` (5).
- **Section 9:** the hovedpartner card in the app has "Besøk nettsiden" and "Ring" buttons, and the
  hovedpartner page shows phone, e-mail, address and opening hours. Lokale støttespillere get no clickable
  link.

The app shows section 12 "Kontakt" as four lines (`Selskap:`, `Organisasjonsnummer:`, `Adresse:`, `E-post:`)
with the same values as the website's contact cards. No change is needed there.

## Personvern (`templates/public/legal/personvern.html`)

Set `site.privacy_updated` to `13. oktober 2026`.

### Kort fortalt

- Now: Vi får **navn, telefon og alder** fra Vipps når du logger inn.
- New: Vi får **navn, telefon, fødselsdato og e-postadresse** fra Vipps når du logger inn.

### 2. Hvilke data vi samler inn

Change two rows:

| Opplysning | Kilde | Brukes til |
|---|---|---|
| **Fødselsdato** | Vipps | Aldersgrense, ungdomskonto for deg under 18, og at kontoen blir en vanlig konto når du fyller 18 |
| **E-postadresse** | Vipps | Viser at e-posten er bekreftet, og at vi kan kontakte deg om kontoen |

(The e-mail row today says "valgfritt" and "Deg". It is neither. The full birth date is stored, not only the
age.)

Add these rows:

| Opplysning | Kilde | Brukes til |
|---|---|---|
| **Bilder** – profilbilde, bilder på oppdrag, i chat og i porteføljen, skjermbilder i rapporter | Deg | Vise profilen og oppdraget, og behandle rapporter |
| **Trygge kontakter og Trygg tur** – navn og telefonnummer til de du legger inn, og når du starter og avslutter en jobb | Deg | Varsle deg og hjelpe deg å si fra til noen du stoler på |
| **Notater om hjemmet** («Porten er på baksiden») | Deg | Vises bare for den du har en avtale med, så lenge jobben pågår |
| **Kobling mellom ungdomskonto og foresatt** | Deg | La en foresatt se hvem den unge har avtale med, og når |
| **Varslingsadresse (push-token)** | Enheten | Sende varsler til telefonen din |
| **Samtykker** – hva du har godtatt, og når | Deg | Dokumentere samtykke |

If the website's own forms are not listed anywhere, add rows for them too (contact form, newsletter,
partner registration), with what is really stored.

### 4. Formål og rettslig grunnlag

- Remove the row "**Statistikk** for å forbedre MinNabo – Samtykke" and the row "**Markedsføring** og måling
  av kampanjer – Samtykke", unless the website really runs such tools. The app has no analytics or marketing
  tools, and section 8 says the website has none either (`site.optional_cookies` is false).
- Add: "**Tips om nye oppdrag i nærheten** (varsler) – Samtykke". This is the only optional consent in the app
  (Meny → Personvern).
- Add under the table: "Vi teller hvor mange ganger et partnerkort er vist og trykket på, per kommune. Tallene
  kan ikke knyttes til deg." (`partner_events` has no profile id.)
- Add under the table: "Når flere har rapportert det samme innholdet eller den samme kontoen, kan innholdet bli
  skjult eller kontoen suspendert automatisk. En moderator ser alltid på saken etterpå, og du kan klage."

### 5. Lagringstid

Replace the whole list with this. It is the same text as the app (`nb.personvern.retention`):

- **Konto og profil:** så lenge du har konto. Når du sletter kontoen, fjernes navn, bilde, telefonnummer,
  e-postadresse, fødselsdato, profiltekst og vurderingene du har fått med en gang. Bildene dine slettes fra
  lagringen innen {{ site.delete_days }} dager.
- **Det andre fortsatt ser:** meldinger, tilbud og avtaler du har vært med på, blir stående hos den andre
  parten under navnet «Slettet bruker». Vurderinger du har gitt, blir også stående uten navnet ditt.
- **Meldinger og bilder:** meldinger og bilder i en samtale slettes 24 måneder etter siste melding. Bilder på
  et avsluttet oppdrag slettes 24 måneder etter siste aktivitet.
- **Oppdrag, tilbud og avtaler:** avsluttede oppdrag som ikke førte til en avtale, slettes helt etter 24
  måneder. For jobber som ble avtalt, beholder vi tittel, pris og tidspunkt så lenge kontoen finnes, fordi
  vurderingene bygger på dem.
- **Vurderinger:** så lenge den som fikk vurderingen, har konto.
- **Rapporter:** slettes 24 måneder etter at de er ferdig behandlet.
- **Varsler:** slettes etter 12 måneder.
- **Kontoer som ikke brukes:** en konto som ikke er brukt på {{ site.inactive_months }} måneder, slettes. Du
  får et varsel i appen 30 dager før. Dette gjelder ikke kontoer som er stengt for brudd på vilkårene.
- **Partnere (bedrifter):** keep the existing line.

Remove "**Statistikk:** lagres bare i anonymisert form." No statistics are stored about people; the admin
numbers are counted live from the rows above.

Also state how long the website's own data is kept, and check that `apps/core/management/commands/cleanup.py`
really does it: contact-form messages, newsletter subscribers (including unsubscribed and unconfirmed ones),
the e-mail outbox (sent rows: 180 days today), and the admin audit log. If a period is not enforced by code,
either build it or do not promise it.

### 6. Deling med andre

- Now: **Andre brukere** ser navnet ditt, profilen, vurderinger og omtrentlig sted. Telefonnummeret ditt vises
  ikke.
- New: **Andre brukere** ser navnet ditt, profilen, vurderinger og omtrentlig sted. Telefonnummeret ditt vises
  ikke offentlig. Den du har en avtale med, kan se det.
- Add: **Foresatte** som er koblet til en ungdomskonto, ser hvem den unge har avtale med, og når. De ser ikke
  samtalene.
- Databehandlere: add **Expo (push-varsler til appen)**. Push notifications go through Expo's service
  (`exp.host`), which is in the USA, so this is a transfer outside the EEA. Bogdan must confirm the wording
  with the lawyer, and also which region the Supabase project runs in before a region is named.

### 7. Dine rettigheter

- "Trekke samtykke: Endre cookie-valg når du vil (se punkt 8)." There are no optional cookies. Change to:
  "Trekke samtykke: Slå av tips om oppdrag i appen under Meny → Personvern."
- The rest is correct: Meny → Personvern has the consent log, export and "Slett konto".

### Unchanged

Sections 1, 3, 8, 9 and 10 match what the system does.

## Technical notes for the website repo

- **Migration `0064_retention.sql`** is the app's. The next free number for a website migration is **0065**.
  Do not change functions it creates (`run_retention`, `retention_tick`, `queue_file_purge`,
  `account_last_active`, `accounts_awaiting_auth_delete`, `profile_deleted_scrub`, `delete_my_account`).
- **Local dev database:** 0064 reads `auth.users.last_sign_in_at` and `auth.sessions.created_at`, `updated_at`
  and `refreshed_at`. The hosted project has them. The local stand-in `auth` schema (`minnabo_dev`) has only
  `auth.sessions.user_id`, so add those columns to the stand-in or 0064 will fail there.
- **New tables:** `storage_purge_queue` and `inactivity_notices`. No client can read them and the admin needs
  no models for them.
- **What the admin will notice:** handled rapporter older than 24 months disappear, varsler older than 12
  months disappear, and a deleted user no longer has vurderinger, kommune or categories. Vurderinger, avtaler
  and tilbud of finished jobs stay.
- **Bug fixed in `delete_my_account`:** it used to "avlyse" every finished job of the person who deleted the
  account, and reopened the other party's finished oppdrag. Only unfinished avtaler are cancelled now.
- `site.delete_days` (30) and `site.inactive_months` (24) are still right. `site.report_hours` (12) is a
  promise about how fast moderators answer; only Bogdan can keep it.

## When you are done

Read both pages top to bottom against the code and report every sentence you could not confirm. The two
Vilkår texts must be identical apart from layout, and the Lagringstid list must be identical to the app's.
