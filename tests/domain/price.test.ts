import { formatPrice, formatFromPrice, nok } from '@/domain/price';

const N = ' '; // non-breaking space used as thousands + unit separator

test('formats whole kroner without decimals', () => {
  expect(formatPrice(nok(600))).toBe(`600${N}kr`);
});

test('groups thousands with a non-breaking space', () => {
  expect(formatPrice(nok(1500))).toBe(`1${N}500${N}kr`);
});

test('formatFromPrice prefixes Fra', () => {
  expect(formatFromPrice(nok(500))).toBe(`Fra${N}500${N}kr`);
});
