import { render, screen, fireEvent } from '@testing-library/react-native';
import { ListingCard } from '@/components/ListingCard';
import { listings } from '@/data/seed';

const task = listings.find((l) => l.title === 'Klippe plen')!;
const offer = listings.find((l) => l.type === 'SERVICE_OFFER')!;

test('task card shows price, place and the "Trenger hjelp" badge', async () => {
  await render(<ListingCard listing={task} onPress={() => {}} />);
  expect(screen.getByText(/600/)).toBeTruthy();
  expect(screen.getByText(/Lillehammer/)).toBeTruthy();
  expect(screen.getByText('Trenger hjelp')).toBeTruthy();
});

test('service offer card shows the "Tilbyr hjelp" badge', async () => {
  await render(<ListingCard listing={offer} onPress={() => {}} />);
  expect(screen.getByText('Tilbyr hjelp')).toBeTruthy();
});

test('fires onPress when tapped', async () => {
  const fn = jest.fn();
  await render(<ListingCard listing={task} onPress={fn} />);
  await fireEvent.press(screen.getByLabelText(/Klippe plen/));
  expect(fn).toHaveBeenCalled();
});
