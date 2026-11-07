import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * «Når kan du?» closed the whole offer sheet: the date field opens a sheet of its own, and the
 * library's default replaced (and dismissed) the one below. Seen in a browser; the library is
 * mocked under Jest, so this checks the setting that fixed it.
 */
test('a sheet opened from a sheet stacks on top instead of closing the one below', () => {
  const src = readFileSync(join(__dirname, '../../src/components/ui/Sheet.tsx'), 'utf8');
  expect(src).toContain('stackBehavior="push"');
});
