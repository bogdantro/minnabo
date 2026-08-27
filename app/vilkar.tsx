import { InfoPageScreen } from '@/screens/InfoPageScreen';

export default function Route() {
  return (
    <InfoPageScreen
      title="Vilkår"
      sections={[
        { body: 'MinNabo formidler kontakt mellom folk som trenger hjelp til småjobber og folk som vil utføre dem i Innlandet. MinNabo lover ikke ansettelse, inntekt eller garantert arbeid.' },
        { heading: 'Pris og betaling', body: 'Pris og betalingsmåte avtales mellom partene i chatten. Betalingen skjer utenfor MinNabo. Et tilbud er kun informasjon om foreslått pris.' },
        { heading: 'Ansvar', body: 'Partene er selv ansvarlige for å avtale, gjennomføre og gjøre opp for oppdrag. Uenighet kan rapporteres, men MinNabo tilbyr ikke økonomisk tvisteløsning.' },
        { heading: 'Fagarbeid', body: 'Lovregulert elektriker-, rørlegger- og mur-/konstruksjonsarbeid skal ikke utføres via private oppdrag, og rutes til relevante verifiserte bedrifter.' },
      ]}
    />
  );
}
