import { screen, waitFor } from '@testing-library/react-native';
import { alwaysShowsUp } from '@/domain/reliability';
import { ReliableBadge } from '@/components/ReliableBadge';
import { ListingCard } from '@/components/ui';
import { profileRepository } from '@mocks/data/profileRepository';
import { profiles } from '@mocks/data/seed';
import { renderWithProviders } from '../testUtils';

test('«Møter alltid opp» needs 100 % over at least 5 jobs', () => {
  expect(alwaysShowsUp({ completed: 5, showsUp: 100 })).toBe(true);
  expect(alwaysShowsUp({ completed: 4, showsUp: 100 })).toBe(false);
  expect(alwaysShowsUp({ completed: 12, showsUp: 92 })).toBe(false);
  expect(alwaysShowsUp({ completed: 8 })).toBe(false);
  expect(alwaysShowsUp(undefined)).toBe(false);
});

test('a helper with 6 jobs and no no-shows gets the badge', async () => {
  await renderWithProviders(<ReliableBadge profileId={profiles.mb.id} />);
  expect(await screen.findByText('Møter alltid opp')).toBeTruthy();
});

test('one counted no-show takes the badge away', async () => {
  profileRepository.reportNoShow(profiles.mb.id);
  await renderWithProviders(<ReliableBadge profileId={profiles.mb.id} />);
  await waitFor(() => expect(screen.queryByText('Møter alltid opp')).toBeNull());
  profileRepository._reset();
});

test('an offer card shows the line under the helper’s name', async () => {
  await renderWithProviders(
    <ListingCard title="Hagehjelp" category="hage" ownerName="Ola" priceValue="Etter avtale" kind="offer" reliable onPress={() => {}} />,
  );
  expect(screen.getByTestId('reliable-badge')).toBeTruthy();
});
