import nb from '@/i18n/nb';

// Regression: changing Oppsett to two steps also turned Slett konto and Rapporter into «Steg 3 av 2».
test('each flow counts its own steps', () => {
  expect(nb.setup.step(2)).toBe('Steg 2 av 2');
  expect(nb.slettKonto.step(3)).toBe('Steg 3 av 3');
  expect(nb.rapporter.step(3)).toBe('Steg 3 av 3');
});
