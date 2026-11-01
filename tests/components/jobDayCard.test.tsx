import { screen } from '@testing-library/react-native';
import { chatRepository } from '@mocks/data/chatRepository';
import { JobDayCard, todaysJob } from '@/components/JobDayCard';
import type { AgendaItem } from '@/domain/types';
import { renderWithProviders } from '../testUtils';

const item = (p: Partial<AgendaItem>): AgendaItem => ({
  proposalId: 'p', listingId: 'l', listingTitle: 'Klippe plen', counterpartId: 'u', price: { amountMinor: 0, currency: 'NOK' },
  agreedAt: '2026-10-01T10:00:00Z', fullyCompleted: false, role: 'CLIENT', cancelled: false, ...p,
});

test("only today's next job that isn't done or called off", () => {
  const now = new Date(2026, 9, 31, 9, 0);
  const at = (h: number, d = 31) => new Date(2026, 9, d, h, 0).toISOString();
  expect(todaysJob([item({ scheduledAt: at(14, 30) })], now)).toBeNull();
  expect(todaysJob([item({ scheduledAt: at(14), cancelled: true })], now)).toBeNull();
  expect(todaysJob([item({ scheduledAt: at(14), fullyCompleted: true })], now)).toBeNull();
  expect(todaysJob([item({ proposalId: 'b', scheduledAt: at(16) }), item({ proposalId: 'a', scheduledAt: at(11) })], now)?.proposalId).toBe('a');
});

test('on the job day the card says when and how it stands', async () => {
  const later = new Date();
  later.setHours(Math.min(23, later.getHours() + 1), 0, 0, 0);
  chatRepository.patchAgreement('p-martin-flytting', { scheduledAt: later.toISOString(), cancelledAt: undefined });
  await renderWithProviders(<JobDayCard />);
  expect(await screen.findByTestId('job-day-card')).toBeTruthy();
  expect(screen.getByText(/^I dag kl\. /)).toBeTruthy();
  expect(await screen.findByText(/har ikke bekreftet ennå$/)).toBeTruthy();
});
