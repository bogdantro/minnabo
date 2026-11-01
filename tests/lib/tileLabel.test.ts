import { CATEGORIES } from '@/domain/categories';
import { MAX_TILE_WORD, tileLabel } from '@/lib/tileLabel';

test('long compounds split where the words join, never mid-word', () => {
  expect(tileLabel('Sykkelreparasjon').text).toBe('Sykkel-\nreparasjon');
  expect(tileLabel('Arrangementshjelp').text).toBe('Arrangements-\nhjelp');
  expect(tileLabel('Bortkjøring og rydding').text).toBe('Bort-\nkjøring og rydding');
  expect(tileLabel('Snekring/småreparasjoner').text).toBe('Snekring/​små-\nreparasjoner');
});

test('short names are left alone', () => {
  expect(tileLabel('Hage')).toEqual({ text: 'Hage', small: false });
  expect(tileLabel('Rengjøring')).toEqual({ text: 'Rengjøring', small: false });
});

test('a long word with no known ending gets the smaller font instead of breaking', () => {
  expect(tileLabel('Kjempelangtordutenkjentending')).toEqual({ text: 'Kjempelangtordutenkjentending', small: true });
});

test('every built-in category fits a tile', () => {
  for (const c of CATEGORIES) {
    const { text, small } = tileLabel(c.label);
    const pieces = text.split(/[\s/​\n]+/).map((w) => w.replace(/-$/, ''));
    expect({ label: c.label, ok: small || pieces.every((w) => w.length <= MAX_TILE_WORD + 1) }).toEqual({ label: c.label, ok: true });
  }
});
