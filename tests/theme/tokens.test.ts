import { tokens } from '@/theme';
import nb from '@/i18n/nb';

test('core color tokens exist with expected values', () => {
  expect(tokens.color.navy).toBe('#0B2E4E');
  expect(tokens.color.lime).toBe('#8CC63F');
  expect(tokens.color.cyan).toBe('#22A9E0');
  expect(tokens.color.bg).toBe('#FDFBFA');
});

test('text scale entries carry fontFamily + lineHeight', () => {
  for (const key of ['h1', 'question', 'section', 'cardTitle', 'body', 'meta'] as const) {
    expect(tokens.text[key].fontSize).toBeGreaterThan(0);
    expect(tokens.text[key].lineHeight).toBeGreaterThan(tokens.text[key].fontSize);
    expect(tokens.text[key].fontFamily).toContain('Mulish');
  }
});

test('nb strings are bokmål and complete for slice 0-2', () => {
  expect(nb.tabs.oppdrag).toBe('Oppdrag');
  expect(nb.home.question).toBe('Hva trenger du hjelp med?');
  expect(nb.home.searchPlaceholder).toBe('Søk etter småjobber');
  expect(nb.badge.needsHelp).toBe('Trenger hjelp');
  expect(nb.badge.offersHelp).toBe('Tilbyr hjelp');
  expect(nb.state.offline).toMatch(/nett/i);
});
