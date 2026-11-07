/**
 * `npm run test-login` only. Swaps four files while bundling, so the app itself has no test login
 * in it: without this step (every store build) these files are never bundled.
 */
const path = require('path');

const here = __dirname;
const SWAPS = {
  [path.join('src', 'api', 'client.ts')]: 'client.ts',
  [path.join('src', 'auth', 'session.ts')]: 'session.ts',
  [path.join('src', 'lib', 'supabase.ts')]: 'supabase.ts',
  [path.join('src', 'screens', 'Onboarding', 'LoginScreen.tsx')]: 'LoginScreen.tsx',
};

module.exports = function withTestLogin(config) {
  // a build server must never get this, whatever the environment says
  if (process.env.EAS_BUILD) throw new Error('The test login can not be part of a build.');
  const previous = config.resolver.resolveRequest;
  config.resolver.resolveRequest = (context, name, platform) => {
    const found = (previous ?? context.resolveRequest)(context, name, platform);
    if (found?.type === 'sourceFile') {
      for (const [end, file] of Object.entries(SWAPS)) {
        if (found.filePath.endsWith(end)) return { type: 'sourceFile', filePath: path.join(here, file) };
      }
    }
    return found;
  };
  return config;
};
