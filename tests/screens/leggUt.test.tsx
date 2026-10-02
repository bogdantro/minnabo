import { screen, fireEvent, waitFor } from '@testing-library/react-native';
import { router } from 'expo-router';
import { LeggUtWizard } from '@/screens/LeggUt/LeggUtWizard';
import { PreviewScreen } from '@/screens/LeggUt/PreviewScreen';
import { draftStore } from '@/data/draftStore';
import { buildListing, emptyWizard, upcomingDays } from '@/screens/LeggUt/wizardModel';
import { renderWithProviders } from '../testUtils';

const DAY_LABEL = /^(Man|Tir|Ons|Tor|Fre|Lør|Søn) \d+\. /;

beforeEach(() => {
  jest.clearAllMocks();
  draftStore.clear();
});

test('Legg ut opens straight into step 1 and validates before moving on', async () => {
  await renderWithProviders(<LeggUtWizard />);
  expect(screen.getByText('Hva trenger du hjelp med?')).toBeTruthy();
  expect(screen.getByText('Steg 1 av 9')).toBeTruthy();
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Velg en kategori for å gå videre.')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Hage'));
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Gi oppdraget en tittel')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Plen');
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Tittelen må ha minst 5 tegn.')).toBeTruthy();
});

test('walking all 9 steps ends in Forhåndsvisning with a built oppdrag', async () => {
  await renderWithProviders(<LeggUtWizard />);
  await fireEvent.press(screen.getByLabelText('Hage'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Klippe plen og rake løv'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.changeText(screen.getByLabelText('Beskrivelse'), 'Plenen er ca. 300 m² og løvet skal i sekker.');
  await fireEvent.press(screen.getByText('Plen'));
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.changeText(screen.getByLabelText('Område eller bydel'), 'Nordre Ål');
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getAllByLabelText(DAY_LABEL)[2]);
  await fireEvent.press(screen.getByText('Neste'));
  await fireEvent.press(screen.getByText('Neste')); // Pris: Ønsker tilbud
  await fireEvent.press(screen.getByText('Neste')); // Utstyr
  await fireEvent.press(screen.getByText('Neste')); // Hvem
  expect(screen.getByText('Ser alt riktig ut?')).toBeTruthy();
  expect(screen.getByText('Nordre Ål, Lillehammer (omtrentlig)')).toBeTruthy();

  await fireEvent.press(screen.getByText('Forhåndsvis'));
  expect(router.push).toHaveBeenCalledWith('/legg-ut/forhandsvisning');
  const l = draftStore.get();
  expect(l?.title).toBe('Klippe plen og rake løv');
  expect(l?.category.slug).toBe('hage');
  expect(l?.priceMode).toBe('BY_AGREEMENT');
  expect(l?.location).toMatchObject({ municipality: 'Lillehammer', place: 'Nordre Ål' });
});

test('Forhåndsvisning publishes and continues to Publisert', async () => {
  const s = {
    ...emptyWizard('Lillehammer'),
    cat: 'hage' as const,
    title: 'Klippe plen',
    desc: 'Plenen er ca. 300 m² og løvet skal i sekker.',
    area: 'Nordre Ål',
    priceMode: 'budget' as const,
    amount: '400',
  };
  draftStore.set(buildListing(s, upcomingDays(new Date())));
  await renderWithProviders(<PreviewScreen />);
  expect(screen.getByText('Klar til publisering')).toBeTruthy();
  await fireEvent.press(screen.getByText('Detaljsiden'));
  expect(screen.getByText('Åpent oppdrag')).toBeTruthy();
  await fireEvent.press(screen.getByText('Publiser'));
  await waitFor(() => expect(screen.getByText('Publisert – fortsett')).toBeTruthy(), { timeout: 5000 });
  await fireEvent.press(screen.getByText('Publisert – fortsett'));
  expect(router.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/legg-ut\/publisert\?id=/));
});
