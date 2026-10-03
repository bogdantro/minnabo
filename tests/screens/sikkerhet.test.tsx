import { screen, waitFor, fireEvent } from '@testing-library/react-native';
import { SikkerhetScreen } from '@/screens/SikkerhetScreen';
import { safetyStore } from '@mocks/data/safetyStore';
import { trustedContacts } from '@/lib/trustedContacts';
import { safeTrip } from '@/lib/safeTrip';
import { renderWithProviders } from '../testUtils';

beforeEach(() => {
  safetyStore._reset();
  trustedContacts._reset();
  safeTrip._reset();
});

test('Sikkerhet lists blocked users inline and unblocks after confirming', async () => {
  safetyStore.toggleBlock('u-emma');
  await renderWithProviders(<SikkerhetScreen />);
  expect(screen.getByText('Sikkerhet, rapportering og blokkering')).toBeTruthy();

  await fireEvent.press(await screen.findByLabelText('Opphev blokkering av Emma Larsen'));
  expect(await screen.findByText('Oppheve blokkeringen av Emma Larsen?')).toBeTruthy();
  await fireEvent.press(screen.getByText('Opphev blokkering'));

  await waitFor(() => expect(safetyStore.isBlocked('u-emma')).toBe(false));
  expect(await screen.findByText('Du har ikke blokkert noen')).toBeTruthy();
});

test('Trygg tur needs a trusted contact, then starts and stops', async () => {
  await renderWithProviders(<SikkerhetScreen />);
  expect(screen.getByText('Legg til trygge kontakter')).toBeTruthy();
  expect(screen.queryByText('Start trygg tur')).toBeNull();

  trustedContacts.add('Ola Haugen', '90012345');
  await fireEvent.press(await screen.findByText('Start trygg tur'));
  await waitFor(() => expect(safeTrip.get()).not.toBeNull());
  expect(await screen.findByText('Trygg tur er aktiv')).toBeTruthy();
  expect(screen.getByText(/Deler jobbdagen med Ola til kl\./)).toBeTruthy();

  await fireEvent.press(screen.getByText('Stopp'));
  await waitFor(() => expect(safeTrip.get()).toBeNull());
});

test('tips open one at a time and 112 is reachable', async () => {
  await renderWithProviders(<SikkerhetScreen />);
  expect(screen.getByText(/Avtal jobben på dagtid/)).toBeTruthy();
  await fireEvent.press(screen.getByText('Aldri betal på forhånd til ukjente'));
  expect(screen.getByText(/vanlig tegn på svindel/)).toBeTruthy();
  expect(screen.queryByText(/Avtal jobben på dagtid/)).toBeNull();
  expect(screen.getByText('Er du i akutt fare?')).toBeTruthy();
});
