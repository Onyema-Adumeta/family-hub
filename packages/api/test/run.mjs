// Runs the API test suite against a throwaway local PostgreSQL database.
//
//   Set TEST_DATABASE_URL to an EMPTY local test database, then:  pnpm --filter @family-hub/api test
//
// What it does:
//   1. Refuses to run against anything that looks like production (Neon, Railway, non-local hosts).
//   2. Wipes the test database and rebuilds it from the committed migrations only
//      (this is also the "fresh install works" check from the Muse report).
//   3. Starts the API on port 3999 with test-only secrets and no external services.
//   4. Runs every test/*.test.ts file, then stops the API.
import { spawn, spawnSync } from 'node:child_process';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const apiDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  console.error('Set TEST_DATABASE_URL to an empty LOCAL database, e.g. postgresql://postgres:postgres@localhost:5432/familyhub_test');
  process.exit(1);
}
const host = (() => { try { return new URL(url).hostname; } catch { return ''; } })();
if (!['localhost', '127.0.0.1', '::1'].includes(host) && process.env.ALLOW_REMOTE_TEST_DB !== 'yes') {
  console.error(`Refusing to run: TEST_DATABASE_URL points at "${host}". The suite WIPES the database, so it only runs against localhost.`);
  process.exit(1);
}

const PORT = '3999';
const env = {
  ...process.env,
  DATABASE_URL: url,
  JWT_SECRET: 'test-only-secret-' + Math.random().toString(36).slice(2),
  PORT,
  RATE_LIMIT_MULTIPLIER: '1000',
  ANTHROPIC_API_KEY: '',
  CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
  VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  TEST_API_URL: `http://127.0.0.1:${PORT}`,
};
const shell = process.platform === 'win32';
const npx = shell ? 'npx.cmd' : 'npx';

console.log('▶ Rebuilding the test database from migrations…');
const reset = spawnSync(npx, ['prisma', 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'], { cwd: apiDir, env, stdio: 'inherit', shell });
if (reset.status !== 0) { console.error('✖ Migrations failed on a fresh database'); process.exit(1); }

// Make sure nothing else is already answering on the test port — otherwise the
// tests would silently run against that server instead of this code.
try {
  await fetch(env.TEST_API_URL + '/health');
  console.error(`✖ Something is already running on port ${PORT}. Stop it and try again.`);
  process.exit(1);
} catch { /* port is free, good */ }

console.log('▶ Starting the API…');
// Run node directly (no npx/shell wrapper) so stopping it really stops the server.
const api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: apiDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
let exited = false;
api.on('exit', () => { exited = true; });
let apiLog = '';
api.stdout.on('data', d => { apiLog += d; });
api.stderr.on('data', d => { apiLog += d; });

const stop = () => { if (!exited) { try { api.kill(); } catch { /* already stopped */ } } };
process.on('exit', stop);

async function waitForApi() {
  for (let i = 0; i < 60; i++) {
    if (exited) break;
    try { if ((await fetch(env.TEST_API_URL + '/health')).ok) return; } catch { /* not up yet */ }
    await new Promise(r => setTimeout(r, 500));
  }
  console.error('✖ API did not start:\n' + apiLog);
  process.exit(1);
}
await waitForApi();

const files = readdirSync(join(apiDir, 'test')).filter(f => f.endsWith('.test.ts')).map(f => join('test', f));
console.log('▶ Running tests…');
const run = spawnSync(npx, ['tsx', '--test', '--test-concurrency=1', ...files], { cwd: apiDir, env, stdio: 'inherit', shell });
stop();
if (run.status !== 0 && process.env.SHOW_API_LOG) console.log(apiLog);
process.exit(run.status ?? 1);
