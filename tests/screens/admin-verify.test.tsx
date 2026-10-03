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

test('business registration validates the org number', async () => {
  await renderWithProviders(<BedriftRegistreringScreen />);
  await fireEvent.press(screen.getByText('Send til verifisering'));
  await waitFor(() => expect(screen.getByText(/gyldig organisasjonsnummer/)).toBeTruthy());

  await fireEvent.changeText(screen.getByLabelText('Organisasjonsnummer'), '123456789');
  await fireEvent.changeText(screen.getByLabelText('Firmanavn'), 'Testbedrift AS');
  await fireEvent.changeText(screen.getByLabelText('Kontaktperson'), 'Ola Nordmann');
  await fireEvent.changeText(screen.getByLabelText('E-post'), 'post@test.no');
  await fireEvent.press(screen.getByText('Send til verifisering'));
  await waitFor(() => expect(screen.getByText('Sendt inn!')).toBeTruthy());
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
