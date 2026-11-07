// Runs the app in the browser with a test login and demo data: `npm run test-login`.
// Nothing reaches Supabase, Vipps or real users. See dev/test-login/.
import { spawn } from 'node:child_process';

const PORT = '8200';

console.log(`\nMinNabo med testinnlogging: http://localhost:${PORT}\nDen første starten tar et par minutter. Stopp med Ctrl+C.\n`);

const expo = spawn('npx', ['expo', 'start', '--web', '--port', PORT, '--clear'], {
  stdio: 'inherit',
  shell: true,
  env: { ...process.env, MINNABO_TEST_LOGIN: '1' },
});
expo.on('exit', (code) => process.exit(code ?? 0));
