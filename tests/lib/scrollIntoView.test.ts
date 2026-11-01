import { scrollIntoView } from '@/lib/scrollIntoView';

const scroll = () => ({ scrollTo: jest.fn() });
const at = (y: number) => ({ measureLayout: (_c: never, ok: (x: number, y: number) => void) => ok(0, y) });

test('scrolls so the field sits just below the top, with room for its label', () => {
  const s = scroll();
  scrollIntoView(at(640), {}, s, 48);
  expect(s.scrollTo).toHaveBeenCalledWith({ y: 592, animated: true });
});

test('a field near the top never scrolls past the start', () => {
  const s = scroll();
  scrollIntoView(at(10), {}, s, 48);
  expect(s.scrollTo).toHaveBeenCalledWith({ y: 0, animated: true });
});

test('nothing to measure (unmounted, or no native layout): nothing happens', () => {
  const s = scroll();
  scrollIntoView(null, {}, s);
  scrollIntoView({}, {}, s);
  scrollIntoView(at(100), null, s);
  expect(s.scrollTo).not.toHaveBeenCalled();
});
