import { fireEvent, screen, waitFor } from '@testing-library/react-native';
import { ForMegScreen } from '@/screens/ForMegScreen';
import { dismissedLeads } from '@/lib/dismissedLeads';
import { renderWithProviders } from '../testUtils';

beforeEach(() => dismissedLeads._reset());

// The demo user (u-mb) can do Hage, Montering and Flytting – a Hage oppdrag ranks first.
const counter = () => screen.getByText(/^\d+ av \d+$/).props.children as string;

test('shows matched oppdrag first as a card stack with "why" chips and a counter', async () => {
  await renderWithProviders(<ForMegScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  expect(screen.getByText('Passer Hage')).toBeTruthy();
  expect(counter()).toMatch(/^1 av \d+$/);
  expect(screen.getByText('Se og gi tilbud')).toBeTruthy();
  expect(screen.getByText(/MinNabo håndterer ikke betaling/)).toBeTruthy();
});

test('"Ikke aktuelt" moves to the next card and "Angre" brings it back', async () => {
  jest.useFakeTimers();
  try {
    await renderWithProviders(<ForMegScreen />);
    await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Ikke aktuelt'));
    jest.advanceTimersByTime(500);
    await waitFor(() => expect(counter()).toMatch(/^2 av /));
    await fireEvent.press(screen.getByLabelText('Angre siste'));
    await waitFor(() => expect(counter()).toMatch(/^1 av /));
    expect(screen.getByText('Klippe plen')).toBeTruthy();
  } finally {
    jest.useRealTimers();
  }
});

test('list view hides an item with the x button', async () => {
  await renderWithProviders(<ForMegScreen />);
  await waitFor(() => expect(screen.getByText('Klippe plen')).toBeTruthy());
  await fireEvent.press(screen.getByText('Liste'));
  await fireEvent.press(screen.getByLabelText('Ikke aktuelt: Klippe plen'));
  await waitFor(() => expect(screen.queryByText('Klippe plen')).toBeNull());
  expect(screen.getByText('Angre siste')).toBeTruthy();
});
