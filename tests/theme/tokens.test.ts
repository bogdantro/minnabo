import { tokens } from '@/theme';
import nb from '@/i18n/nb';

test('core color tokens exist with expected values', () => {
  expect(tokens.color.navy).toBe('#0B2E4E');
  expect(tokens.color.lime).toBe('#37B24A');
  expect(tokens.color.cyan).toBe('#22A9E0');
  expect(tokens.color.bg).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(tokens.color.panelFrom).toMatch(/^#[0-9A-Fa-f]{6}$/);
  expect(tokens.color.panelTo).toMatch(/^#[0-9A-Fa-f]{6}$/);
});

test('radius scale carries hero + card', () => {
  expect(tokens.radius.card).toBe(18);
  expect(tokens.radius.hero).toBe(28);
});

test('text scale entries carry fontFamily + lineHeight', () => {
  for (const key of ['display', 'h1', 'question', 'sectionHead', 'section', 'cardTitle', 'body', 'meta'] as const) {
    expect(tokens.text[key].fontSize).toBeGreaterThan(0);
    expect(tokens.text[key].lineHeight).toBeGreaterThan(tokens.text[key].fontSize);
    expect(tokens.text[key].fontFamily).toContain('Mulish');
  }
});

test('type scale steps up: meta < body < cardTitle < sectionHead < display', () => {
  const t = tokens.text;
  expect(t.meta.fontSize).toBeLessThan(t.body.fontSize);
  expect(t.body.fontSize).toBeLessThan(t.cardTitle.fontSize);
  expect(t.cardTitle.fontSize).toBeLessThan(t.sectionHead.fontSize);
  expect(t.sectionHead.fontSize).toBeLessThan(t.display.fontSize);
});

test('nb strings are bokmål and complete for slice 0-2', () => {
  expect(nb.tabs.oppdrag).toBe('Oppdrag');
  expect(nb.home.question).toMatch(/småjobb/);
  expect(nb.home.searchPlaceholder).toMatch(/tjeneste/i);
  expect(nb.badge.needsHelp).toBe('Trenger hjelp');
  expect(nb.badge.offersHelp).toBe('Tilbyr hjelp');
  expect(nb.state.offline).toMatch(/nett/i);
});
