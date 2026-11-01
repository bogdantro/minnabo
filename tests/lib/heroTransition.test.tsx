import { act, screen } from '@testing-library/react-native';
import { GIVE_UP_MS, heroTransition } from '@/lib/heroTransition';
import { HeroOverlay } from '@/components/HeroOverlay';
import { renderWithProviders } from '../testUtils';

const card = { x: 20, y: 300, width: 96, height: 120, radius: 18 };
const gallery = { x: 20, y: 100, width: 350, height: 268, radius: 30 };

afterEach(() => {
  heroTransition.finish();
  jest.useRealTimers();
});

test('a tap starts a flight that only the gallery of the same oppdrag can land', () => {
  heroTransition.start('l1', 'https://x/a.jpg', card);
  expect(heroTransition.pendingFor('l1')).toBe(true);
  expect(heroTransition.pendingFor('l2')).toBe(false);
  expect(heroTransition.land('l2', gallery)).toBe(false);
  expect(heroTransition.land('l1', gallery)).toBe(true);
  // only once
  expect(heroTransition.land('l1', gallery)).toBe(false);
  expect(heroTransition.current()?.to).toEqual(gallery);
});

test('a flight nobody lands is dropped, so a later visit is never animated by mistake', () => {
  jest.useFakeTimers();
  heroTransition.start('l1', 'https://x/a.jpg', card);
  jest.advanceTimersByTime(GIVE_UP_MS + 1);
  expect(heroTransition.current()).toBeNull();
  expect(heroTransition.land('l1', gallery)).toBe(false);
});

test('the overlay shows the photo while it flies and never takes touches', async () => {
  await renderWithProviders(<HeroOverlay />);
  expect(screen.queryByTestId('hero-overlay')).toBeNull();
  await act(async () => heroTransition.start('l1', 'https://x/a.jpg', card));
  const fly = screen.getByTestId('hero-overlay');
  expect(fly.props.pointerEvents).toBe('none');
  await act(async () => heroTransition.finish());
  expect(screen.queryByTestId('hero-overlay')).toBeNull();
});
