import { readFileSync } from 'fs';
import { join } from 'path';

const root = join(__dirname, '..', '..');
const read = (f: string) => readFileSync(join(root, f), 'utf8');

// Rule 3: login is Vipps only. The test login exists for the PC and must never reach a phone.
test('the test login only comes in through its own start command', () => {
  expect(read('metro.config.js')).toContain("process.env.MINNABO_TEST_LOGIN === '1'");
  expect(read('scripts/test-login.mjs')).toContain("MINNABO_TEST_LOGIN: '1'");
  expect(read('eas.json')).not.toContain('MINNABO_TEST_LOGIN');
  expect(read('scripts/release.ts')).not.toContain('MINNABO_TEST_LOGIN');
});

test('a build server refuses the test login', () => {
  expect(read('dev/test-login/metro.js')).toContain('process.env.EAS_BUILD');
});

test('the app itself never imports the test login', () => {
  for (const f of ['src/auth/session.ts', 'src/lib/supabase.ts', 'src/api/client.ts', 'src/screens/Onboarding/LoginScreen.tsx']) {
    expect(read(f)).not.toContain('test-login');
  }
});
