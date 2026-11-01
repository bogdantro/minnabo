import { completenessPct, completenessSteps } from '@/domain/profileCompleteness';
import type { PublicProfile } from '@/domain/types';

const base = { id: 'u', location: { municipality: 'Lillehammer', place: 'Lillehammer' }, verifications: [] } as unknown as PublicProfile;

test('a bare profile starts at 0 % with the photo as the first step', () => {
  const s = completenessSteps(base, 0, false);
  expect(completenessPct(s)).toBe(0);
  expect(s.find((x) => !x.done)?.id).toBe('photo');
});

test('the real before/after portfolio counts, not the old photo list', () => {
  const s = completenessSteps({ ...base, avatarUrl: 'a.jpg', presentation: 'Hei', portfolio: [] }, 2, true);
  expect(s.find((x) => x.id === 'port')?.done).toBe(true);
  expect(completenessPct(s)).toBe(67);
});
