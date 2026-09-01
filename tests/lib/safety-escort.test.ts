import { trustedContacts } from '@/lib/trustedContacts';
import { safeTrip } from '@/lib/safeTrip';

beforeEach(() => {
  trustedContacts._reset();
  safeTrip._reset();
});

test('trusted contacts are capped at five', () => {
  for (let i = 0; i < 7; i++) trustedContacts.add(`Kontakt ${i}`, `900000${i}`);
  expect(trustedContacts.list()).toHaveLength(5);
});

test('a safe trip is overdue once its due time passes and clears on check-in', () => {
  const past = new Date(Date.now() - 60_000).toISOString();
  safeTrip.start({
    proposalId: 'p-1',
    label: 'Emma',
    startedAt: new Date().toISOString(),
    dueAt: past,
    contactNames: ['Mor'],
  });
  expect(safeTrip.get()?.proposalId).toBe('p-1');
  expect(Date.now() > Date.parse(safeTrip.get()!.dueAt)).toBe(true);

  safeTrip.checkIn();
  expect(safeTrip.get()).toBeNull();
});
