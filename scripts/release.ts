/**
 * Release a new App Store version in one go.
 *
 *   npm run release              # 1.0.0 → 1.0.1 (fixes, small changes)
 *   npm run release -- minor     # 1.0.1 → 1.1.0 (new features)
 *   npm run release -- major     # 1.1.0 → 2.0.0
 *   npm run release -- --dry-run # only show what would happen
 *
 *   npm run release -- --android                 # Google Play instead of the App Store
 *   npm run release -- --both                    # both stores
 *   npm run release -- --android --same-version  # no new version number (e.g. the first
 *                                                # Android release of a version already on iOS)
 *
 * Android is uploaded to Google Play automatically only once eas.json has a Google service
 * account (submit.production.android.serviceAccountKeyPath) – Google refuses an automatic
 * upload for an app's very first release anyway. Until then the .aab is built and you
 * upload it in the Play Console yourself.
 *
 * Steps: typecheck + tests → raise `expo.version` in app.json → `eas build --auto-submit`
 * (iOS, production). If the build fails, app.json goes back to the old version, so the
 * next try uses the same number. No git commit or tag – not needed for a release.
 * The build number is raised by EAS itself (eas.json: autoIncrement, appVersionSource
 * remote), so only the version people see is handled here.
 *
 * Afterwards, in App Store Connect: pick the build for the new version, write
 * «Nytt i denne versjonen» and submit for review.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export type Bump = 'patch' | 'minor' | 'major';
export type Platform = 'ios' | 'android';

/** Which stores a release goes to: iOS unless --android or --both. */
export function platformsFrom(args: string[]): Platform[] {
  if (args.includes('--both')) return ['ios', 'android'];
  if (args.includes('--android')) return ['android'];
  return ['ios'];
}

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
const EAS_JSON = join(__dirname, '..', 'eas.json');

/** True once eas.json can upload to Google Play by itself (a service account key is set). */
function androidAutoSubmit(): boolean {
  try {
    const eas = JSON.parse(readFileSync(EAS_JSON, 'utf8')) as { submit?: { production?: { android?: { serviceAccountKeyPath?: string } } } };
    return !!eas.submit?.production?.android?.serviceAccountKeyPath;
  } catch {
    return false;
  }
}

/**
 * Only npx needs a shell (on Windows it is npx.cmd, which Node won't start without one).
 * A shell joins the arguments unquoted – that once broke a commit message with a space –
 * so arguments with spaces are refused instead of silently split.
 */
function needsShell(cmd: string, args: string[]): boolean {
  if (process.platform !== 'win32' || cmd !== 'npx') return false;
  if (args.some((a) => /\s/.test(a))) throw new Error(`npx arguments can't contain spaces on Windows: ${args.join(' ')}`);
  return true;
}

/** Runs a command with its output streamed live (tests, the EAS build). */
function runLive(cmd: string, args: string[]): boolean {
  return spawnSync(cmd, args, { stdio: 'inherit', shell: needsShell(cmd, args) }).status === 0;
}

function fail(message: string): never {
  console.error(`\n✗ ${message}`);
  process.exit(1);
}

function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const sameVersion = args.includes('--same-version');
  const platforms = platformsFrom(args);
  const bump = (args.find((a) => !a.startsWith('--')) ?? 'patch') as Bump;
  if (!['patch', 'minor', 'major'].includes(bump)) fail(`Unknown step "${bump}". Use patch, minor or major.`);

  const appJson = readFileSync(APP_JSON, 'utf8');
  const current = (JSON.parse(appJson) as { expo: { version: string } }).expo.version;
  const next = sameVersion ? current : nextVersion(current, bump);
  const stores = platforms.map((p) => (p === 'ios' ? 'App Store' : 'Google Play')).join(' + ');

  console.log(sameVersion ? `Release ${current} (same version) to ${stores}` : `Release ${current} → ${next} to ${stores}`);
  if (dryRun) {
    console.log('(dry run – nothing changed)');
    return;
  }

  console.log('\n1/3 Typecheck and tests …');
  if (!runLive('npx', ['tsc', '--noEmit'])) fail('Typecheck failed – nothing was released.');
  if (!runLive('npx', ['jest', '--silent'])) fail('Tests failed – nothing was released.');

  if (!sameVersion) {
    console.log(`\n2/3 app.json version → ${next}`);
    writeFileSync(APP_JSON, withVersion(appJson, current, next));
  } else {
    console.log(`\n2/3 app.json stays at ${current}`);
  }

  const autoAndroid = androidAutoSubmit();
  const done: string[] = [];
  for (const platform of platforms) {
    const submit = platform === 'ios' || autoAndroid;
    console.log(`\n3/3 ${platform === 'ios' ? 'iPhone' : 'Android'}: build in the EAS cloud${submit ? ' and upload' : ''} …`);
    const build = ['eas-cli', 'build', '--platform', platform, '--profile', 'production', ...(submit ? ['--auto-submit'] : [])];
    if (!runLive('npx', build)) {
      // Back to the old number, so the next try doesn't skip a version – unless another
      // platform already went out with the new one.
      if (!sameVersion && done.length === 0) writeFileSync(APP_JSON, appJson);
      fail(
        `The ${platform} build or upload failed.` +
          (done.length ? ` ${done.join(', ')} already went out with ${next}; run again with --${platform} --same-version.` : ` app.json is back at ${current}.`),
      );
    }
    done.push(platform);
  }

  if (platforms.includes('ios')) {
    console.log(`\n✓ iPhone ${next} is on its way to App Store Connect (TestFlight within ~30 minutes).`);
    console.log(`  App Store Connect: + Version → ${next}, pick the build, «Nytt i denne versjonen», submit for review.`);
  }
  if (platforms.includes('android')) {
    console.log(
      autoAndroid
        ? `\n✓ Android ${next} is uploaded to Google Play. In the Play Console: Production → the new release → «Send til gjennomgang».`
        : `\n✓ Android ${next} is built. Download the .aab from the link above (expo.dev), then in the Play Console:` +
            ' Production (or Intern testing) → Opprett ny utgivelse → upload the .aab.',
    );
  }
}

// Only when run as a script – tests import the helpers above.
if (require.main === module) main();
