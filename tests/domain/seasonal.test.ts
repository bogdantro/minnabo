import { seasonalCategories } from '@/domain/seasonal';
import { FORMS } from '@/screens/LeggUt/wizardConfig';

test('snømåking in November, hage in May', () => {
  expect(seasonalCategories(new Date(2026, 10, 5))[0]).toBe('snomaking');
  expect(seasonalCategories(new Date(2026, 4, 5))[0]).toBe('hage');
});

test('every month suggests three real categories the wizard knows', () => {
  for (let m = 0; m < 12; m++) {
    const cats = seasonalCategories(new Date(2026, m, 1));
    expect(cats).toHaveLength(3);
    cats.forEach((c) => expect(FORMS[c]).toBeDefined());
  }
});
