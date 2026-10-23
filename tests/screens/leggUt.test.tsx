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
  expect(screen.getByText('Steg 1 av 8')).toBeTruthy();
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Velg en kategori for å gå videre.')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Hage'));
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Gi oppdraget en tittel')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Plen');
  await fireEvent.press(screen.getByText('Neste'));
  expect(screen.getByText('Tittelen må ha minst 5 tegn.')).toBeTruthy();
});

test('walking all 8 steps ends in Forhåndsvisning with a built oppdrag', async () => {
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
  // no «Hvem kan gi tilbud?» step: everyone logs in with Vipps, so everyone is verified
  expect(screen.getByText('Ser alt riktig ut?')).toBeTruthy();
  expect(screen.getByText('Steg 8 av 8')).toBeTruthy();
  expect(screen.queryByText('Hvem kan gi tilbud?')).toBeNull();
  expect(screen.queryByText('Synlighet')).toBeNull();
  expect(screen.getByText('Nordre Ål, Lillehammer (omtrentlig)')).toBeTruthy();

  await fireEvent.press(screen.getByText('Forhåndsvis'));
  expect(router.push).toHaveBeenCalledWith('/legg-ut/forhandsvisning');
  const l = draftStore.get();
  expect(l?.title).toBe('Klippe plen og rake løv');
  expect(l?.category.slug).toBe('hage');
  expect(l?.priceMode).toBe('BY_AGREEMENT');
  expect(l?.location).toMatchObject({ municipality: 'Lillehammer', place: 'Nordre Ål' });
});

test('Forhåndsvisning publishes and goes straight to Publisert', async () => {
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
  // No extra "Fortsett" tap – publishing goes straight to Publisert.
  await waitFor(() => expect(router.replace).toHaveBeenCalledWith(expect.stringMatching(/^\/legg-ut\/publisert\?id=/)), { timeout: 5000 });
});

// ------------------------------------------------------------
// Drafts are kept without a tap on «Lagre» – the app can be closed by the
// phone at any time (a call, low memory), and the oppdrag must still be there.
// ------------------------------------------------------------
describe('Legg ut keeps a draft by itself', () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const DRAFT_KEY = 'minnabo.leggUt.draft.v3';
  const draft = async () => JSON.parse((await AsyncStorage.getItem(DRAFT_KEY)) ?? 'null');

  beforeEach(() => AsyncStorage.removeItem(DRAFT_KEY));

  test('what was typed is saved shortly after, and is back when the wizard opens again', async () => {
    const first = await renderWithProviders(<LeggUtWizard />);
    await fireEvent.press(screen.getByLabelText('Hage'));
    await fireEvent.press(screen.getByText('Neste'));
    await fireEvent.changeText(screen.getByLabelText('Tittel'), 'Rake løv i hagen');
    await waitFor(async () => expect((await draft())?.state.title).toBe('Rake løv i hagen'), { timeout: 3000 });

    await first.unmount(); // the app was closed – nobody tapped «Lagre utkast»
    await renderWithProviders(<LeggUtWizard />);
    expect(await screen.findByDisplayValue('Rake løv i hagen')).toBeTruthy();
  });

  test('just opening Legg ut leaves no draft behind', async () => {
    await renderWithProviders(<LeggUtWizard />);
    await new Promise((r) => setTimeout(r, 1200));
    expect(await draft()).toBeNull();
  });

  test('«Forkast» throws the draft away for good', async () => {
    await renderWithProviders(<LeggUtWizard />);
    await fireEvent.press(screen.getByLabelText('Hage'));
    await waitFor(async () => expect(await draft()).not.toBeNull(), { timeout: 3000 });
    await fireEvent.press(screen.getAllByLabelText('Lukk')[0]); // the X at the top
    await fireEvent.press(await screen.findByText('Forkast utkastet'));
    await new Promise((r) => setTimeout(r, 1200));
    expect(await draft()).toBeNull();
  });
});

test('after publishing, the app going to the background does not bring the oppdrag back as a draft', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  const { AppState } = require('react-native');
  const { wizardDraft } = require('@/screens/LeggUt/wizardModel');
  const listeners: ((s: string) => void)[] = [];
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_e: unknown, l: unknown) => {
    listeners.push(l as (s: string) => void);
    return { remove: () => undefined };
  });
  await renderWithProviders(<LeggUtWizard />);
  await fireEvent.press(screen.getByLabelText('Hage'));
  await waitFor(async () => expect(await AsyncStorage.getItem('minnabo.leggUt.draft.v3')).not.toBeNull(), { timeout: 3000 });
  await wizardDraft.clear(); // what Forhåndsvisning does when the oppdrag is published
  listeners.forEach((l) => l('background'));
  await new Promise((r) => setTimeout(r, 50));
  expect(await AsyncStorage.getItem('minnabo.leggUt.draft.v3')).toBeNull();
});

test('every oppdrag is open to all naboer – the old «Kun verifiserte» choice is gone', () => {
  const { extrasFor } = require('@/screens/LeggUt/wizardModel');
  // an oppdrag saved earlier with «Kun verifiserte» is opened to all when edited
  expect(extrasFor({ ...emptyWizard(), who: 'verif' }).offerAudience).toBe('ALL');
});

test('a draft saved at the old step 9 opens on the summary', async () => {
  const AsyncStorage = require('@react-native-async-storage/async-storage').default;
  await AsyncStorage.setItem('minnabo.leggUt.draft.v3', JSON.stringify({ state: { ...emptyWizard(), cat: 'hage' }, step: 9 }));
  await renderWithProviders(<LeggUtWizard />);
  expect(await screen.findByText('Steg 8 av 8')).toBeTruthy();
  await AsyncStorage.removeItem('minnabo.leggUt.draft.v3');
});
