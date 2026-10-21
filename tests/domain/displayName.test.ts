import { displayNameOptions } from '@/domain/displayName';

test('a Vipps name gives the full name, first name + initial, and first name', () => {
  expect(displayNameOptions('Mari Haugen')).toEqual(['Mari Haugen', 'Mari H.', 'Mari']);
});

test('a middle name is left out of the short forms', () => {
  expect(displayNameOptions('Mari Anne Haugen')).toEqual(['Mari Anne Haugen', 'Mari H.', 'Mari']);
});

test('æ, ø and å survive in the initial', () => {
  expect(displayNameOptions('Øystein Ågren')).toEqual(['Øystein Ågren', 'Øystein Å.', 'Øystein']);
});

test('a single name has one option, and extra spaces are ignored', () => {
  expect(displayNameOptions('  Mari  ')).toEqual(['Mari']);
  expect(displayNameOptions(' Ola   Nordmann ')).toEqual(['Ola Nordmann', 'Ola N.', 'Ola']);
  expect(displayNameOptions('')).toEqual([]);
});
