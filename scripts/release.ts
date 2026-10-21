/**
 * Release a new App Store version in one go.
 *
 *   npm run release              # 1.0.0 → 1.0.1 (fixes, small changes)
 *   npm run release -- minor     # 1.0.1 → 1.1.0 (new features)
 *   npm run release -- major     # 1.1.0 → 2.0.0
 *   npm run release -- --dry-run # only show what would happen
 *
 * Steps: check that everything is committed → typecheck + tests → raise `expo.version`
 * in app.json → commit "Release x.y.z" + tag vx.y.z → `eas build --auto-submit` (iOS,
 * production). The build number is raised by EAS itself (eas.json: autoIncrement,
 * appVersionSource remote), so only the version people see is handled here.
 *
 * Afterwards, in App Store Connect: pick the build for the new version, write
 * «Nytt i denne versjonen» and submit for review.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Bump = 'patch' | 'minor' | 'major';

/** '1.0.9' + 'patch' → '1.0.10'; 'minor' → '1.1.0'; 'major' → '2.0.0'. */
export function nextVersion(version: string, bump: Bump): string {
  const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(version);
  if (!m) throw new Error(`app.json's version must look like 1.2.3, got "${version}".`);
  const [major, minor, patch] = m.slice(1).map(Number);
  if (bump === 'major') return `${major + 1}.0.0`;
  if (bump === 'minor') return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
}

/**
 * app.json with only the version changed – the rest of the file (formatting, key order)
 * is left exactly as it was, so the release commit is a one-line diff.
 */
export function withVersion(appJson: string, from: string, to: string): string {
  const line = new RegExp(`("version"\\s*:\\s*")${from.replace(/\./g, '\\.')}(")`, 'g');
  const hits = appJson.match(line)?.length ?? 0;
  if (hits !== 1) throw new Error(`Expected "version": "${from}" exactly once in app.json, found it ${hits} times.`);
  return appJson.replace(line, `$1${to}$2`);
}

const APP_JSON = join(__dirname, '..', 'app.json');

/** Runs a command with its output shown; stops the release if it fails. */
function run(cmd: string, args: string[], what: string): string {
  const res = spawnSync(cmd, args, { stdio: ['inherit', 'pipe', 'inherit'], shell: process.platform === 'win32', encoding: 'utf8' });
  if (res.status !== 0) {
    if (res.stdout) process.stdout.write(res.stdout);
    fail(`${what} failed – nothing was released.`);
  }
  return res.stdout ?? '';
}

/** Like run(), but streams everything live (tests, the EAS build). */
function runLive(cmd: string, args: string[]): boolean {
  return spawnSync(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' }).status === 0;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const bump = (args.find((a) => !a.startsWith('--')) ?? 'patch') as Bump;
  if (!['patch', 'minor', 'major'].includes(bump)) fail(`Unknown step "${bump}". Use patch, minor or major.`);

  // The build must be exactly what the release commit contains.
  const dirty = run('git', ['status', '--porcelain'], 'git status').trim();
  if (dirty) fail(`There are uncommitted changes. Commit or stash them first:\n${dirty}`);
  const branch = run('git', ['rev-parse', '--abbrev-ref', 'HEAD'], 'git branch').trim();

  const appJson = readFileSync(APP_JSON, 'utf8');
  const current = (JSON.parse(appJson) as { expo: { version: string } }).expo.version;
  const next = nextVersion(current, bump);
  const tag = `v${next}`;
  if (run('git', ['tag', '--list', tag], 'git tag').trim()) fail(`Tag ${tag} already exists – was ${next} released already?`);

  console.log(`Release ${current} → ${next} from branch «${branch}»`);
  if (dryRun) {
    console.log('(dry run – nothing changed)');
    return;
  }

  console.log('\n1/4 Typecheck and tests …');
  if (!runLive('npx', ['tsc', '--noEmit'])) fail('Typecheck failed – nothing was released.');
  if (!runLive('npx', ['jest', '--silent'])) fail('Tests failed – nothing was released.');

  console.log(`\n2/4 app.json version → ${next}`);
  writeFileSync(APP_JSON, withVersion(appJson, current, next));

  console.log(`\n3/4 Commit and tag ${tag}`);
  run('git', ['add', 'app.json'], 'git add');
  run('git', ['commit', '-m', `Release ${next}`], 'git commit');
  run('git', ['tag', tag], 'git tag');

  console.log('\n4/4 Build in the EAS cloud and send it to App Store Connect …');
  if (!runLive('npx', ['eas-cli', 'build', '--platform', 'ios', '--profile', 'production', '--auto-submit'])) {
    // The version commit stays: the next try builds the same version, no new bump needed.
    fail(
      `The build or upload failed. app.json already says ${next} (commit + tag ${tag}).\n` +
        '  Fix the problem, then build the same version again with:\n' +
        '  npx eas-cli build --platform ios --profile production --auto-submit',
    );
  }

  console.log(`\n✓ ${next} is on its way to App Store Connect (shows up in TestFlight within ~30 minutes).`);
  console.log('  Push the release commit:  git push && git push --tags');
  console.log(`  Then in App Store Connect: + Version → ${next}, pick the build, «Nytt i denne versjonen», submit for review.`);
}

// Only when run as a script – tests import the helpers above.
if (require.main === module) main();
