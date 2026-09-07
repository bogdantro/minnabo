import { categoryAccent } from '@/theme';

test('known slugs get their hue, unknown falls back to green', () => {
  expect(categoryAccent('hage').color).toBe('#37B24A');
  expect(categoryAccent('transport').color).toBe('#2E90C4');
  expect(categoryAccent('montering').color).toBe('#8A7DD4');
  expect(categoryAccent('does-not-exist').color).toBe('#37B24A');
});

test('every accent carries a solid colour and a tint', () => {
  for (const slug of ['hage', 'transport', 'montering', 'renhold', 'annet']) {
    const a = categoryAccent(slug);
    expect(a.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
    expect(a.tint).toMatch(/^#[0-9A-Fa-f]{6}$/);
  }
});
