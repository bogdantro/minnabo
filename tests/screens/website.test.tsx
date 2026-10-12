/**
 * What the website's admin controls through the shared database (docs/APP_CHANGES_FINAL.md
 * + APP_CHANGES_UPDATE_1.md): platform switches, partners, categories and moderation.
 */
import { Text } from 'react-native';
import { act, fireEvent, screen, waitFor } from '@testing-library/react-native';
import { apiClient } from '@/api/client';
import { PlatformRealtime } from '@/api/realtime';
import { MaintenanceGate } from '@/components/MaintenanceGate';
import {
  _resetCategoryCatalog,
  activeCategoryArts,
  categoryArtColors,
  categoryBySlug,
  categoryLabel,
  setCategoryCatalog,
  type CategoryRow,
} from '@/domain/categories';
import { reportStage } from '@/domain/reports';
import { CategorySync } from '@/hooks/useCategories';
import { ImpressionWatcher, _resetPartnerStats, logPartnerClick, logPartnerImpression, visibleRatio } from '@/lib/partnerStats';
import { supabase } from '@/lib/supabase';
import { FellesskapScreen } from '@/screens/FellesskapScreen';
import { MyListingsScreen } from '@/screens/MyListingsScreen';
import { OppdragScreen } from '@/screens/OppdragScreen';
import { LoginScreen } from '@/screens/Onboarding/LoginScreen';
import { PartnerScreen } from '@/screens/PartnerScreen';
import { SikkerhetScreen } from '@/screens/SikkerhetScreen';
import { adminStore } from '@mocks/data/adminStore';
import { repositories } from '@mocks/data/repositories';
import { safetyStore } from '@mocks/data/safetyStore';
import { extras } from '@mocks/mockClient';
import { renderWithProviders } from '../testUtils';

const settle = (ms = 400) => new Promise((r) => setTimeout(r, ms));
const WAIT = { timeout: 5000 };

beforeEach(() => {
  jest.clearAllMocks();
  extras.reset();
  adminStore._reset();
  repositories.listings._reset();
  _resetCategoryCatalog();
  _resetPartnerStats();
});
afterEach(() => {
  jest.restoreAllMocks();
  jest.useRealTimers();
});

const rows = (patch: Record<string, Partial<CategoryRow>> = {}): CategoryRow[] =>
  ['hage', 'renhold', 'flytting', 'transport', 'montering', 'snomaking', 'annet'].map((slug, i) => ({
    slug,
    label: categoryBySlug(slug).label,
    active: true,
    sortOrder: (i + 1) * 10,
    ...patch[slug],
  }));

// --- categories -----------------------------------------------------------------------
test('categories: the admin decides order, on/off, label and colours; unknown slugs are ignored', () => {
  setCategoryCatalog([
    ...rows({ hage: { sortOrder: 99, label: 'Hage og uteområde', tileBg: '#112233', iconColor: '#AABBCC' }, snomaking: { active: false } }),
    { slug: 'helt-ny-kategori', label: 'Ny', active: true, sortOrder: 1 },
  ]);
  const arts = activeCategoryArts();
  expect(arts).not.toContain('snomaking'); // switched off → not offered
  expect(arts[arts.length - 1]).toBe('hage'); // sort_order 99 → last
  expect(arts.indexOf('rengjoring')).toBeLessThan(arts.indexOf('flytting'));
  expect(categoryLabel('hage')).toBe('Hage og uteområde');
  expect(categoryArtColors('hage')).toEqual({ bg: '#112233', fg: '#AABBCC' });
  // an old oppdrag in a switched-off category still shows its label
  expect(categoryLabel('snomaking')).toBe('Snømåking');
  expect(categoryBySlug('snomaking').label).toBe('Snømåking');
  // a built-in category the database doesn't list is kept for old oppdrag, but not offered
  expect(arts).not.toContain('dyrepass');
  expect(categoryLabel('dyrepass')).toBe('Dyrepass');
});

test('categories: an empty or failed load keeps the built-in list (offline fallback)', () => {
  const before = activeCategoryArts();
  setCategoryCatalog([]);
  setCategoryCatalog(undefined);
  expect(activeCategoryArts()).toEqual(before);
  expect(before).toContain('hage');
});

test('a category switched off on the website disappears from the chips on Oppdrag', async () => {
  extras.categories = rows({ snomaking: { active: false } });
  await renderWithProviders(
    <>
      <CategorySync />
      <OppdragScreen />
    </>,
  );
  await waitFor(() => expect(screen.queryByText('Snømåking')).toBeNull(), WAIT);
  expect(screen.getAllByText('Hage').length).toBeGreaterThan(0);
});

// --- platform switches ------------------------------------------------------------------
test('maintenance mode replaces the app with "Vi oppdaterer MinNabo"; off brings it back', async () => {
  extras.settings.maintenance = true;
  await renderWithProviders(
    <MaintenanceGate>
      <Text>Appen</Text>
    </MaintenanceGate>,
  );
  expect(await screen.findByText('Vi oppdaterer MinNabo', {}, WAIT)).toBeTruthy();
  expect(screen.queryByText('Appen')).toBeNull();

  extras.settings.maintenance = false;
  await fireEvent.press(screen.getByText('Prøv igjen'));
  expect(await screen.findByText('Appen', {}, WAIT)).toBeTruthy();
  expect(screen.queryByText('Vi oppdaterer MinNabo')).toBeNull();
});

test('closed registration: the login screen says so; open registration shows nothing', async () => {
  extras.settings.registrationOpen = false;
  const closed = await renderWithProviders(<LoginScreen />);
  expect(await screen.findByText(/MinNabo tar ikke imot nye brukere akkurat nå\./, {}, WAIT)).toBeTruthy();
  expect(screen.getByText('Fortsett med Vipps')).toBeTruthy(); // existing users still log in
  closed.unmount();
});

test('open registration shows no notice', async () => {
  await renderWithProviders(<LoginScreen />);
  await settle();
  expect(screen.queryByText(/tar ikke imot nye brukere/)).toBeNull();
});

// --- partners ---------------------------------------------------------------------------
test('a partner hidden on the website is not shown; when partners.version changes the list is fetched again', async () => {
  const list = jest.spyOn(apiClient, 'listPartners');
  await renderWithProviders(
    <>
      <PlatformRealtime />
      <FellesskapScreen />
    </>,
  );
  const main = await screen.findAllByText('Hovedpartner', {}, WAIT);
  expect(main.length).toBeGreaterThan(0);
  const shown = (await apiClient.listPartners()).find((p) => p.featured)!;
  expect(screen.getByText(shown.name)).toBeTruthy();

  // the website hides it (unpaid / paused / admin) and bumps partners.version
  adminStore.setActive(shown.id, false);
  const before = list.mock.calls.length;
  const channel = (supabase.channel as jest.Mock).mock.results.at(-1)!.value as { on: jest.Mock };
  const onSettings = channel.on.mock.calls.find((c) => c[1]?.table === 'app_settings')![2] as () => void;
  await act(async () => {
    onSettings();
    await settle(600);
  });
  expect(list.mock.calls.length).toBeGreaterThan(before);
  await waitFor(() => expect(screen.queryByText(shown.name)).toBeNull(), WAIT);
});

test('partner statistics: an impression once per session, a click on "Besøk nettsiden"', async () => {
  logPartnerImpression('p-1', 'Lillehammer');
  logPartnerImpression('p-1', 'Lillehammer');
  logPartnerClick('p-1', 'Lillehammer');
  expect(extras.partnerEvents).toEqual([
    { partnerId: 'p-1', kind: 'impression', kommune: 'Lillehammer' },
    { partnerId: 'p-1', kind: 'click', kommune: 'Lillehammer' },
  ]);

  const partner = (await apiClient.listPartners()).find((p) => p.featured && p.url);
  if (partner) {
    extras.partnerEvents = [];
    await renderWithProviders(<PartnerScreen partnerId={partner.id} />);
    await fireEvent.press(await screen.findByText('Besøk nettsiden', {}, WAIT));
    expect(extras.partnerEvents).toEqual([expect.objectContaining({ partnerId: partner.id, kind: 'click' })]);
  }
});

test('an impression needs the card half visible for a second, without dropping below', () => {
  jest.useFakeTimers();
  const seen: string[] = [];
  const w = new ImpressionWatcher((id) => seen.push(id));
  w.update('a', 0.6);
  jest.advanceTimersByTime(900);
  w.update('a', 0.2); // scrolled away before the second was up
  jest.advanceTimersByTime(500);
  expect(seen).toEqual([]);
  w.update('a', 0.5);
  w.update('a', 0.9); // still visible: the timer keeps running
  jest.advanceTimersByTime(1000);
  expect(seen).toEqual(['a']);
  w.update('b', 0.49);
  jest.advanceTimersByTime(2000);
  expect(seen).toEqual(['a']);
  w.dispose();

  const win = { width: 400, height: 800 };
  expect(visibleRatio({ x: 0, y: 0, width: 400, height: 200 }, win)).toBe(1);
  expect(visibleRatio({ x: 0, y: 700, width: 400, height: 200 }, win)).toBe(0.5);
  expect(visibleRatio({ x: 500, y: 100, width: 150, height: 150 }, win)).toBe(0); // off to the side in the carousel
  expect(visibleRatio({ x: 0, y: 900, width: 400, height: 200 }, win)).toBe(0);
});

// --- moderation -------------------------------------------------------------------------
test('report stages: Mottatt → Under behandling → Avgjort', () => {
  expect(reportStage({ status: 'OPEN' })).toBe('received');
  expect(reportStage({ status: 'OPEN', claimedAt: '2026-10-11T10:00:00Z' })).toBe('processing');
  expect(reportStage({ status: 'RESOLVED', claimedAt: '2026-10-11T10:00:00Z' })).toBe('resolved');
});

test('Mine rapporter on Sikkerhet: a new report reads "Mottatt"', async () => {
  safetyStore._reset();
  safetyStore.submitReport({ targetType: 'USER', targetId: 'u-emma', reason: 'Trakassering', byProfileId: 'u-mb' });
  await renderWithProviders(<SikkerhetScreen />);
  expect(await screen.findByText('Mine rapporter', {}, WAIT)).toBeTruthy();
  expect(screen.getAllByText('Mottatt').length).toBeGreaterThan(0);
  expect(screen.getByText('Trakassering')).toBeTruthy();
  expect(screen.queryByText('Under behandling')).toBeNull();
});

test('a report claimed on the website reads "Under behandling"', async () => {
  safetyStore._reset();
  const r = safetyStore.submitReport({ targetType: 'USER', targetId: 'u-emma', reason: 'Trakassering', byProfileId: 'u-mb' });
  extras.claimedReports[r.id] = '2026-10-11T10:00:00Z';
  await renderWithProviders(<SikkerhetScreen />);
  expect(await screen.findByText('Under behandling', {}, WAIT)).toBeTruthy();
  expect(screen.getByText('Trakassering')).toBeTruthy();
});

test('Mine oppdrag: a hidden oppdrag shows the banner with the reason and "Kontakt oss"', async () => {
  Object.assign(repositories.listings.get('l-male-gjerdet')!, {
    moderation: { hidden: true, reason: 'Skjult automatisk etter flere rapporter.', pendingReview: false },
  });
  await renderWithProviders(<MyListingsScreen />);
  expect(await screen.findByText('Oppdraget er skjult av MinNabo', {}, WAIT)).toBeTruthy();
  expect(screen.getByText('Skjult automatisk etter flere rapporter.')).toBeTruthy();
  expect(screen.getByText('Kontakt oss')).toBeTruthy();
  expect(screen.getByText('Skjult av MinNabo')).toBeTruthy();
});

test('Mine oppdrag: a first oppdrag waiting for approval reads "Venter på godkjenning", not hidden', async () => {
  Object.assign(repositories.listings.get('l-male-gjerdet')!, {
    moderation: { hidden: true, reason: 'Venter på godkjenning', pendingReview: true },
  });
  await renderWithProviders(<MyListingsScreen />);
  expect((await screen.findAllByText('Venter på godkjenning', {}, WAIT)).length).toBeGreaterThan(0);
  expect(screen.queryByText('Oppdraget er skjult av MinNabo')).toBeNull();
});

test('opening an oppdrag that was closed shows "Oppdraget er avsluttet", not an error', async () => {
  const expoRouter = require('expo-router');
  jest.spyOn(expoRouter, 'useLocalSearchParams').mockReturnValue({ id: 'l-male-gjerdet' });
  Object.assign(repositories.listings.get('l-male-gjerdet')!, { status: 'REMOVED' });
  const ListingDetailRoute = require('../../app/oppdrag/[id]').default;
  await renderWithProviders(<ListingDetailRoute />);
  expect(await screen.findByText('Oppdraget er avsluttet.', {}, WAIT)).toBeTruthy();
  expect(screen.queryByText('Noe gikk galt')).toBeNull();
});

test('Bedrift: a rejection shows the reason and "Send inn på nytt"', async () => {
  const { businessStore } = require('@mocks/data/businessStore');
  const { BedriftRegistreringScreen } = require('@/screens/BedriftRegistreringScreen');
  businessStore._reset();
  businessStore.submit('u-mb', { orgNr: '923609016', companyName: 'Testfirma AS', contactPerson: 'Marius B.', email: 'm@test.no', phone: '91234567', categorySlugs: ['hage'] });
  businessStore.decide('u-mb', false, 'Organisasjonsnummeret tilhører et annet firma.');
  await renderWithProviders(<BedriftRegistreringScreen />);
  expect(await screen.findByText('Grunn: Organisasjonsnummeret tilhører et annet firma.', {}, WAIT)).toBeTruthy();
  expect(screen.getByText('Send inn på nytt')).toBeTruthy();
  businessStore._reset();
});

test('only hovedpartnere have a page: a støttespiller opened by direct link shows no website link', async () => {
  const supporter = (await apiClient.listPartners()).find((p) => !p.featured && !p.localHero)!;
  expect(supporter).toBeTruthy();
  await renderWithProviders(<PartnerScreen partnerId={supporter.id} />);
  expect(await screen.findByText('Fant ikke partneren', {}, WAIT)).toBeTruthy();
  expect(screen.queryByText('Besøk nettsiden')).toBeNull();
  expect(screen.queryByText(supporter.name)).toBeNull();
});

// --- hovedpartner card: straight to the partner, and "N naboer har takket" -----------------
const withContact = async () => {
  const all = await apiClient.listPartners();
  const main = all.find((p) => p.featured)!;
  const list = all.map((p) => (p.id === main.id ? { ...p, url: 'https://partner.example.no', phone: '61 25 00 00' } : p));
  jest.spyOn(apiClient, 'listPartners').mockResolvedValue(list);
  return main;
};

test('hovedpartner card: "Besøk nettsiden" and "Ring" go straight there and count as clicks', async () => {
  const { Linking } = require('react-native');
  const { router } = require('expo-router');
  const open = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
  const main = await withContact();
  await renderWithProviders(<FellesskapScreen />);

  await fireEvent.press(await screen.findByLabelText(`Besøk nettsiden til ${main.name}`, {}, WAIT));
  expect(open).toHaveBeenLastCalledWith('https://partner.example.no');
  await fireEvent.press(screen.getByLabelText(`Ring ${main.name}`));
  expect(open).toHaveBeenLastCalledWith('tel:61250000');

  expect(extras.partnerEvents.filter((e) => e.kind === 'click').map((e) => e.partnerId)).toEqual([main.id, main.id]);
  // the buttons don't open the partner page
  expect((router.push as jest.Mock).mock.calls.some((c) => String(c[0]).startsWith('/partner/'))).toBe(false);
});

test('a hovedpartner without website and phone shows no action buttons', async () => {
  await renderWithProviders(<FellesskapScreen />);
  await screen.findAllByText('Hovedpartner', {}, WAIT);
  expect(screen.queryByText('Besøk nettsiden')).toBeNull();
  expect(screen.queryByText('Ring')).toBeNull();
});

test('"N naboer har takket": shown on the card, counted once per person', async () => {
  const main = (await apiClient.listPartners()).find((p) => p.featured)!;
  extras.partnerThanks = { [main.id]: { count: 46, mine: false } };
  const card = await renderWithProviders(<FellesskapScreen />);
  expect(await screen.findByText('46 naboer har takket', {}, WAIT)).toBeTruthy();
  card.unmount();
});

test('thanking a partner raises the count and can only be done once', async () => {
  const main = (await apiClient.listPartners()).find((p) => p.featured)!;
  extras.partnerThanks = { [main.id]: { count: 46, mine: false } };
  await renderWithProviders(<PartnerScreen partnerId={main.id} />);
  await fireEvent.press(await screen.findByText('Takk for støtten', {}, WAIT));
  expect(await screen.findByText('47 naboer har takket', {}, WAIT)).toBeTruthy();
  expect(await screen.findByText('Du har takket', {}, WAIT)).toBeTruthy();
  expect(screen.queryByText('Takk for støtten')).toBeNull();
  // a second call from the same person does not count again
  expect(await apiClient.thankPartner(main.id)).toBe(47);
});

test('nobody has thanked yet: no count is shown, and the first thank reads "1 nabo har takket"', async () => {
  const main = (await apiClient.listPartners()).find((p) => p.featured)!;
  await renderWithProviders(<PartnerScreen partnerId={main.id} />);
  await screen.findByText('Takk for støtten', {}, WAIT);
  expect(screen.queryByText(/har takket/)).toBeNull();
  await fireEvent.press(screen.getByText('Takk for støtten'));
  expect(await screen.findByText('1 nabo har takket', {}, WAIT)).toBeTruthy();
});
