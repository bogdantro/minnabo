import { screen } from '@testing-library/react-native';
import { ChatScreen } from '@/screens/ChatScreen';
import { listingPrice } from '@/components/OppdragCard';
import { chatRepository } from '@mocks/data/chatRepository';
import { repositories } from '@mocks/data/repositories';
import { renderWithProviders } from '../testUtils';

beforeEach(() => chatRepository._reset());

test('the chat on a «Tilbyr hjelp» post says «Tilbyr hjelp», not «Trenger hjelp», with its «Fra» price', async () => {
  const conv = chatRepository.findOrCreateConversationForListing('l-tilbyr-gressklipping');
  await renderWithProviders(<ChatScreen conversation={conv} onBack={() => {}} />);
  expect(await screen.findByText('Tilbyr hjelp')).toBeTruthy();
  expect(screen.queryByText('Trenger hjelp')).toBeNull();
  expect(await screen.findByText('Fra 500 kr')).toBeTruthy();
});

test('a fixed price on «Tilbyr hjelp» is «Fast pris», never the oppdrag word «Budsjett»', () => {
  const offer = { ...repositories.listings.get('l-tilbyr-gressklipping')!, priceMode: 'FIXED' as const };
  expect(listingPrice(offer).label).toBe('Fast pris');
  const oppdrag = repositories.listings.list({ type: 'TASK_REQUEST' }).find((l) => l.priceMode === 'FIXED' || l.priceMode === 'BUDGET');
  if (oppdrag) expect(listingPrice(oppdrag).label).toBe('Budsjett');
});

test('«Gi tilbud» on the helper\'s own offer uses the post\'s price, not the oppdrag words', async () => {
  const { GiTilbudSheet } = require('@/components/GiTilbudSheet');
  const { profiles } = require('@mocks/data/seed');
  const offer = repositories.listings.get('l-tilbyr-gressklipping')!;
  await renderWithProviders(
    <GiTilbudSheet listing={offer} visible onClose={() => {}} recipient={profiles.emma} conversationId="c-test" />,
  );
  expect(await screen.findByText('I innlegget: 500 kr')).toBeTruthy();
  expect(screen.getByText('Din pris')).toBeTruthy();
  expect(screen.queryByText(/Budsjett/)).toBeNull();
  expect(screen.queryByText('Oppdrag')).toBeNull();
  expect(screen.getByText('Som i innlegget')).toBeTruthy();
});
