import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { GuardianSheet } from '@/components/GuardianSheet';
import { KommuneWaitlist } from '@/components/KommuneWaitlist';
import { ShareSheet } from '@/components/chat/ChatSheets';
import { buildListing, emptyWizard, upcomingDays, wizardFromListing } from '@/screens/LeggUt/wizardModel';
import { toast } from '@/lib/toast';
import { extras } from '@mocks/mockClient';
import { renderWithProviders } from '../testUtils';

beforeEach(() => extras.reset());

// --- venteliste -----------------------------------------------------------------
test('waiting list: a kommune outside the launch area is stored', async () => {
  await renderWithProviders(<KommuneWaitlist />);
  await fireEvent.press(screen.getByText(/Bor du i en annen kommune/));
  await fireEvent.changeText(screen.getByLabelText('Hvilken kommune bor du i?'), 'Elv');
  // a suggestion from the Innlandet list fills the field
  await fireEvent.press(await screen.findByText('Elverum'));
  await fireEvent.press(screen.getByText('Si fra til meg'));
  await waitFor(() => expect(extras.waitlist).toEqual(['Elverum']));
  expect(await screen.findByText('Takk! Vi sier fra når MinNabo kommer til Elverum.')).toBeTruthy();
});

test('waiting list: empty input and launch kommuner are refused', async () => {
  await renderWithProviders(<KommuneWaitlist />);
  await fireEvent.press(screen.getByText(/Bor du i en annen kommune/));
  await fireEvent.press(screen.getByText('Si fra til meg'));
  expect(screen.getByText('Skriv navnet på kommunen')).toBeTruthy();
  await fireEvent.changeText(screen.getByLabelText('Hvilken kommune bor du i?'), 'Lillehammer');
  await fireEvent.press(screen.getByText('Si fra til meg'));
  expect(screen.getByText(/MinNabo er allerede i Lillehammer/)).toBeTruthy();
  expect(extras.waitlist).toEqual([]);
});

// --- foresatt -------------------------------------------------------------------
test('foresatt: an adult links with the code from the youth and can remove the link', async () => {
  await renderWithProviders(<GuardianSheet visible onClose={() => {}} />);
  const input = await screen.findByLabelText('Kode fra ungdommen');
  await fireEvent.changeText(input, 'abc 234');
  await fireEvent.press(screen.getByText('Koble til'));
  await waitFor(() => expect(extras.guardian.youths).toHaveLength(1));
  expect(await screen.findByText('Ola N.')).toBeTruthy();
  expect(screen.getByText('Ungdomskonto · 16 år')).toBeTruthy();
  await fireEvent.press(screen.getByText('Fjern'));
  await waitFor(() => expect(extras.guardian.youths).toHaveLength(0));
});

test('foresatt: a wrong code says so', async () => {
  const error = jest.spyOn(toast, 'error');
  await renderWithProviders(<GuardianSheet visible onClose={() => {}} />);
  await fireEvent.changeText(await screen.findByLabelText('Kode fra ungdommen'), 'ZZZ999');
  await fireEvent.press(screen.getByText('Koble til'));
  await waitFor(() => expect(error).toHaveBeenCalledWith('Koden er feil eller har utløpt. Be om en ny kode.'));
  expect(extras.guardian.youths).toHaveLength(0);
  error.mockRestore();
});

test('foresatt: a youth account makes a code to hand over', async () => {
  extras.guardian.youth = true;
  await renderWithProviders(<GuardianSheet visible onClose={() => {}} />);
  await fireEvent.press(await screen.findByText('Lag kode til en foresatt'));
  expect(await screen.findByText('ABC 234')).toBeTruthy();
  expect(screen.getByText('Lag ny kode')).toBeTruthy();
  // a youth never sees the "enter code" side
  expect(screen.queryByLabelText('Kode fra ungdommen')).toBeNull();
});

// --- del sted -------------------------------------------------------------------
const share = (canPlace: boolean, onPlace = jest.fn()) => (
  <ShareSheet
    visible
    onClose={() => {}}
    busy={false}
    canOffer={false}
    canPlace={canPlace}
    onImage={() => {}}
    onCamera={() => {}}
    onTime={() => {}}
    onPlace={onPlace}
    onOffer={() => {}}
  />
);

test('"Del sted" is locked until a tilbud is accepted', async () => {
  const info = jest.spyOn(toast, 'info');
  const onPlace = jest.fn();
  await renderWithProviders(share(false, onPlace));
  await fireEvent.press(await screen.findByLabelText('Del sted – låst til et tilbud er godtatt'));
  expect(onPlace).not.toHaveBeenCalled();
  expect(info).toHaveBeenCalledWith('Adressen kan deles når et tilbud er godtatt.', expect.anything());
  info.mockRestore();
});

test('"Del sted" opens once there is an avtale', async () => {
  const onPlace = jest.fn();
  await renderWithProviders(share(true, onPlace));
  await fireEvent.press(await screen.findByLabelText('Del sted'));
  expect(onPlace).toHaveBeenCalled();
});

// --- gjentakende oppdrag --------------------------------------------------------
test('a repeating oppdrag carries its cadence, and editing reads it back', () => {
  const days = upcomingDays(new Date());
  const s = { ...emptyWizard('Lillehammer'), cat: 'hage' as const, title: 'Plenklipp', desc: 'Klippe plenen', repeat: 'BIWEEKLY' as const };
  const listing = buildListing(s, days);
  expect(listing.task?.recurrence).toBe('BIWEEKLY');
  expect(wizardFromListing(listing, null).repeat).toBe('BIWEEKLY');
  // one time is the default
  expect(buildListing({ ...s, repeat: undefined }, days).task?.recurrence).toBeUndefined();
});
