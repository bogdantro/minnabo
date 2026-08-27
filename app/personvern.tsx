import { InfoPageScreen } from '@/screens/InfoPageScreen';

export default function Route() {
  return (
    <InfoPageScreen
      title="Personvern"
      sections={[
        { body: 'MinNabo behandler personopplysninger etter GDPR. Vi samler kun inn det som trengs for å levere tjenesten: navn, fødselsdato, kontaktinformasjon, kommune/sted og nødvendige samtykker.' },
        { heading: 'Sted', body: 'Kun omtrentlig sted vises offentlig. Eksakt hjemmeadresse er aldri offentlig, og kan bare deles etter et godtatt tilbud når det er nødvendig.' },
        { heading: 'Betaling', body: 'MinNabo håndterer ikke betaling mellom brukere og lagrer verken kortnummer, bankkonto eller betalingshistorikk mellom brukerne.' },
        { heading: 'Dine rettigheter', body: 'Du kan be om innsyn, eksport og sletting av dine data, og se samtykkeloggen din. Data krypteres under overføring og lagring.' },
      ]}
    />
  );
}
