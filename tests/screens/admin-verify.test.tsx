import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { VerifiseringssenterScreen } from '@/screens/VerifiseringssenterScreen';
import { BedriftRegistreringScreen } from '@/screens/BedriftRegistreringScreen';
import { AdminScreen } from '@/screens/AdminScreen';
import { profileRepository } from '@mocks/data/profileRepository';
import { safetyStore } from '@mocks/data/safetyStore';
import { renderWithProviders } from '../testUtils';

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

test('Bedrift: org.nr is checked (format + Enhetsregisteret), then the form submits as PENDING', async () => {
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

test('admin panel shows the report queue and resolves a report', async () => {
  safetyStore._reset();
  await renderWithProviders(<AdminScreen />);
  await settle();
  expect(screen.getAllByText('Adminpanel').length).toBeGreaterThan(0);
  const openBefore = safetyStore.openReportCount();
  expect(openBefore).toBeGreaterThan(0);
  fireEvent.press(screen.getAllByText('Marker som håndtert')[0]);
  await waitFor(() => expect(safetyStore.openReportCount()).toBe(openBefore - 1));
});
