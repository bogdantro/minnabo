import { menuReturn } from '@/lib/menuReturn';

beforeEach(() => menuReturn._reset());

test('back to the screen Meny was opened on opens Meny again, once', () => {
  menuReturn.arm('/fellesskap');
  expect(menuReturn.take('/varsler')).toBe(false); // the page Meny opened is not a main screen
  expect(menuReturn.take('/fellesskap')).toBe(true);
  expect(menuReturn.take('/fellesskap')).toBe(false);
});

test('going to another main screen forgets it, so Meny never pops up somewhere else', () => {
  menuReturn.arm('/');
  expect(menuReturn.take('/innboks')).toBe(false);
  expect(menuReturn.take('/')).toBe(false);
});
