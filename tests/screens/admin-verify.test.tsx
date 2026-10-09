import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { VerifiseringssenterScreen } from '@/screens/VerifiseringssenterScreen';
import { BedriftRegistreringScreen } from '@/screens/BedriftRegistreringScreen';
import { AdminScreen } from '@/screens/AdminScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { safetyStore } from '@mocks/data/safetyStore';
import { _resetFlagOverrides, setFlagOverride } from '@/config/featureFlags';
import { renderWithProviders } from '../testUtils';

afterEach(() => _resetFlagOverrides());

const settle = () => new Promise((r) => setTimeout(r, 400));

test('Verifisering shows Vipps + verified methods, what was checked and the trust checklist', async () => {
  profileRepository._reset();
  await renderWithProviders(<VerifiseringssenterScreen />);
  expect(await screen.findByText('Du er verifisert')).toBeTruthy();
  // seed: Marius has phone + e-mail verified → fully verified
  expect(screen.getByText('Fullt verifisert med Vipps')).toBeTruthy();
  expect(screen.getByText('Hva ble sjekket?')).toBeTruthy(); // Vipps row open by default
  expect(screen.getByText('Navn hentet fra Vipps: Marius B.')).toBeTruthy();
  expect(screen.queryByText('BankID')).toBeNull(); // rule 3: Vipps only

  await fireEvent.press(screen.getByLabelText('Telefon, Bekreftet'));
  expect(await screen.findByText('Bekreftet 15. januar 2026')).toBeTruthy();

  await fireEvent.press(screen.getByLabelText('Bedrift, Ikke aktuelt'));
  expect(await screen.findByText('Registrer bedrift')).toBeTruthy();

  // checklist is computed from the real profile (photo + presentation + categories done)
  expect(screen.getByText('3 av 6 fullført')).toBeTruthy();
});

test('For bedrifter shows only the information card while the form is switched off', async () => {
  await renderWithProviders(<BedriftRegistreringScreen />);
  expect(await screen.findByText('For bedrifter')).toBeTruthy();
  expect(screen.queryByText('Send til verifisering')).toBeNull();
  expect(screen.queryByLabelText('Organisasjonsnummer')).toBeNull();
});

test('Bedrift: org.nr is checked (format + Enhetsregisteret), then the form submits as PENDING', async () => {
  setFlagOverride('businessForm', true);
  const { businessStore } = require('@mocks/data/businessStore');
  const realFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({
    ok: true,
    status: 200,
    json: async () => ({
      organisasjonsnummer: '923609016',
      navn: 'TESTFIRMA AS',
      organisasjonsform: { beskrivelse: 'Aksjeselskap' },
      forretningsadresse: { adresse: ['Storgata 1'], postnummer: '2609', poststed: 'LILLEHAMMER' },
    }),
  }) as unknown as typeof fetch;
  try {
    await renderWithProviders(<BedriftRegistreringScreen />);
    await fireEvent.press(await screen.findByText('Send til verifisering'));
    expect(screen.getByText('Skriv organisasjonsnummeret')).toBeTruthy();
    expect(screen.getByText('Velg minst én kategori')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Organisasjonsnummer'), '123456789');
    expect(screen.getByText('Organisasjonsnummer starter med 8 eller 9')).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('Organisasjonsnummer'), '923609016');
    expect(await screen.findByText('TESTFIRMA AS')).toBeTruthy();
    expect(screen.getByText(/2609 Lillehammer · Aksjeselskap/)).toBeTruthy();

    await fireEvent.changeText(screen.getByLabelText('E-post'), 'post@test.no');
    await fireEvent.changeText(screen.getByLabelText('Telefon'), '91234567');
    await fireEvent.press(screen.getByRole('checkbox', { name: 'Hage' }));
    await fireEvent.press(screen.getByRole('checkbox', { name: /Jeg bekrefter at jeg kan representere/ }));
    await fireEvent.press(screen.getByText('Send til verifisering'));

    expect(await screen.findByText('Sendt til verifisering')).toBeTruthy();
    const me = profileRepository.currentUserId;
    expect(businessStore.get(me)).toMatchObject({ orgNr: '923609016', companyName: 'TESTFIRMA AS', status: 'PENDING', phone: '+4791234567', categorySlugs: ['hage'] });
  } finally {
    global.fetch = realFetch;
  }
});

test('Admin: report queue – Avvis resolves, Angre puts it back; tab counts follow', async () => {
  safetyStore._reset();
  await renderWithProviders(<AdminScreen />);
  expect(await screen.findByText('Kø · 2 åpne')).toBeTruthy();
  expect(screen.getByText('Ventende verifiseringer')).toBeTruthy();
  // oldest first: the MESSAGE report (24 aug) comes before the LISTING one (25 aug)
  expect(screen.getByText('Upassende oppførsel')).toBeTruthy();
  expect(screen.getAllByText('Avvis').length).toBe(2);

  await fireEvent.press(screen.getAllByText('Avvis')[0]);
  expect(await screen.findByText('Kø · 1 åpne')).toBeTruthy();
  expect(screen.getByText('Behandlet')).toBeTruthy();
  expect(screen.getByText('Avvist')).toBeTruthy();
  expect(safetyStore.openReportCount()).toBe(1);

  await fireEvent.press(screen.getByLabelText('Angre behandling'));
  expect(await screen.findByText('Kø · 2 åpne')).toBeTruthy();
  expect(safetyStore.openReportCount()).toBe(2);
});

test('Admin: approving a business sets it verified; suspending a user; max 4 main partners', async () => {
  const { businessStore } = require('@mocks/data/businessStore');
  const { adminStore } = require('@mocks/data/adminStore');
  const realFetch = global.fetch;
  global.fetch = jest.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ organisasjonsnummer: '923609016', navn: 'X' }) }) as unknown as typeof fetch;
  try {
    await renderWithProviders(<AdminScreen />);
    await fireEvent.press(await screen.findByRole('tab', { name: /Verifisering/ }));
    expect(await screen.findByText('Bedrifter som venter · 2')).toBeTruthy();
    expect(screen.getByText('Berg Maling og Hage AS')).toBeTruthy();
    await fireEvent.press(screen.getAllByText('Godkjenn')[0]);
    await waitFor(() => expect(businessStore.list().find((b: { profileId: string }) => b.profileId === 'u-andreas').status).toBe('APPROVED'));
    expect(businessStore.list().find((b: { profileId: string }) => b.profileId === 'u-jonas').status).toBe('PENDING');
    expect(await screen.findByText('Verifisert')).toBeTruthy();

    await fireEvent.press(screen.getByRole('tab', { name: /Brukere/ }));
    await fireEvent.press(await screen.findByLabelText('Suspender Jonas Berg'));
    await waitFor(() => expect(adminStore.isSuspended('u-jonas')).toBe(true));
    expect(await screen.findByText('Suspendert')).toBeTruthy();
    expect(screen.queryByLabelText('Suspender Marius B.')).toBeNull(); // admins can't be suspended

    await fireEvent.press(screen.getByRole('tab', { name: /Partnere/ }));
    // two of the four hovedpartner places are taken in the seed
    expect(await screen.findByText('2 / 4')).toBeTruthy();
    expect(screen.queryByText('Maks 4 hovedpartnere. Slå av en av dem før du kan velge en ny.')).toBeNull();

    // fill the last two places → the limit kicks in
    adminStore.setMain(require('@mocks/data/seedCommunity').partners, 'p-local-1', true);
    adminStore.setMain(require('@mocks/data/seedCommunity').partners, 'p-local-2', true);
    expect(() => adminStore.setMain(require('@mocks/data/seedCommunity').partners, 'p-local-3', true)).toThrow('Maks 4 hovedpartnere.');
    adminStore._reset();
  } finally {
    global.fetch = realFetch;
  }
});

test('Admin: non-admins get no access', async () => {
  const mod = require('@/hooks/useCurrentUser');
  const spy = jest.spyOn(mod, 'useCurrentUser').mockReturnValue({ isLoading: false, isAdmin: false, initials: 'MB' });
  try {
    await renderWithProviders(<AdminScreen />);
    await settle();
    expect(screen.queryByText('Kø · 2 åpne')).toBeNull();
    expect(screen.queryByText('Avvis')).toBeNull();
  } finally {
    spy.mockRestore();
  }
});
