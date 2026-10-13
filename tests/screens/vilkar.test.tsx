import { screen, fireEvent } from '@testing-library/react-native';
import { VilkarScreen } from '@/screens/VilkarScreen';
import { TERMS_SECTIONS } from '@/content/terms';
import { renderWithProviders } from '../testUtils';

test('Vilkår has the same 12 sections as the website, "Kort fortalt", TOC chips and the accepted date', async () => {
  await renderWithProviders(<VilkarScreen />);
  expect(screen.getByText('Kort fortalt')).toBeTruthy();
  expect(TERMS_SECTIONS.map((s) => s.title)).toEqual([
    'Om tjenesten', 'Konto og innlogging med Vipps', 'Ungdomskonto under 18', 'Oppdrag og tilbud', 'Pris og betaling', 'Vurderinger',
    'Forbudt innhold', 'Moderering og utestengelse', 'Partnere og synlighet', 'Ansvar', 'Endringer', 'Kontakt',
  ]);
  for (const s of TERMS_SECTIONS) expect(screen.getAllByText(s.title).length).toBeGreaterThan(0);
  expect(screen.getByText(/Er du mellom 15 og 18 år/)).toBeTruthy();
  expect(screen.getByText('Vilkår for partnere')).toBeTruthy();
  // what Vipps really hands over, and the payment rule
  expect(screen.getByText(/navn, telefonnummer, fødselsdato og e-postadresse fra Vipps/)).toBeTruthy();
  expect(screen.getByText('Pris og betaling avtales direkte mellom dere. MinNabo håndterer ikke betaling mellom brukere.')).toBeTruthy();
  expect(screen.getByText(/Sist oppdatert 13\. oktober 2026 · Lesetid ca\. 8 min/)).toBeTruthy();
  // no unfilled placeholders reach the user
  expect(screen.queryByText(/\[e-postadresse\]|\[aldersgrense\]|\[antall\]/)).toBeNull();
  expect(await screen.findByText('15. januar 2026')).toBeTruthy();
  await fireEvent.press(screen.getByLabelText('5. Pris og betaling'));
});
