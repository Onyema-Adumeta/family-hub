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
import http from 'node:http';
import { readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { tmpdir } from 'node:os';
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
const FAKE_AI_PORT = '3998';
const env = {
  ...process.env,
  DATABASE_URL: url,
  JWT_SECRET: 'test-only-secret-' + Math.random().toString(36).slice(2),
  PORT,
  RATE_LIMIT_MULTIPLIER: '1000',
  // A fake AI provider (below) so tests can check exactly what would be sent.
  ANTHROPIC_API_KEY: 'test-key',
  ANTHROPIC_BASE_URL: `http://127.0.0.1:${FAKE_AI_PORT}`,
  FAKE_AI_URL: `http://127.0.0.1:${FAKE_AI_PORT}`,
  TOKEN_ENCRYPTION_KEY: 'test-only-encryption-key-0123456789',
  // Emails are written to files here instead of being sent.
  EMAIL_OUTBOX_DIR: join(tmpdir(), `familyhub-test-outbox-${process.pid}`),
  APP_URL: 'http://app.test',
  CLOUDINARY_CLOUD_NAME: '', CLOUDINARY_API_KEY: '', CLOUDINARY_API_SECRET: '',
  VAPID_PUBLIC_KEY: '', VAPID_PRIVATE_KEY: '',
  GOOGLE_CLIENT_ID: '', GOOGLE_CLIENT_SECRET: '',
  TEST_API_URL: `http://127.0.0.1:${PORT}`,
};

console.log('▶ Rebuilding the test database from migrations…');
// Use this project's own Prisma CLI (never whatever npx might download).
const prismaCli = join(apiDir, 'node_modules', 'prisma', 'build', 'index.js');
const reset = spawnSync(process.execPath, [prismaCli, 'migrate', 'reset', '--force', '--skip-seed', '--skip-generate'], { cwd: apiDir, env, stdio: 'inherit' });
if (reset.status !== 0) { console.error('✖ Migrations failed on a fresh database'); process.exit(1); }

// Make sure nothing else is already answering on the test port — otherwise the
// tests would silently run against that server instead of this code.
try {
  await fetch(env.TEST_API_URL + '/health');
  console.error(`✖ Something is already running on port ${PORT}. Stop it and try again.`);
  process.exit(1);
} catch { /* port is free, good */ }

// ── Fake AI provider: records every request so tests can inspect it ─────────
const captured = [];
const fakeAi = http.createServer((req, res) => {
  let body = '';
  req.on('data', c => { body += c; });
  req.on('end', () => {
    if (req.url === '/__captured') { res.setHeader('content-type', 'application/json'); return res.end(JSON.stringify(captured)); }
    if (req.url === '/__reset') { captured.length = 0; return res.end('{}'); }
    let parsed = {};
    try { parsed = JSON.parse(body); } catch { /* ignore */ }
    captured.push(parsed);
    const text = JSON.stringify(parsed);
    let reply = 'Hello from the fake assistant';
    if (/trivia/i.test(text)) {
      reply = JSON.stringify(Array.from({ length: 10 }, (_, i) => ({
        question: `Fake question ${i + 1}?`, options: ['A) one', 'B) two', 'C) three', 'D) four'], answer: 'A) one', difficulty: 'easy',
      })));
    } else if (/Extract calendar events/.test(text)) {
      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Vancouver', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
      reply = JSON.stringify([
        { title: 'School picture day', date: '2027-01-12', time: '09:00', emoji: '📸', location: 'Gym' },
        { title: 'Soccer practice', date: today, time: '16:00', emoji: '⚽' },
        { title: 'Broken item', date: 'next tuesday' },
      ]);
    } else if (/family coach/i.test(text)) {
      reply = JSON.stringify({ summary: 'Child 1 had a great week and Parent 1 helped.', tips: ['Praise Child 1 for consistency.'], encouragement: 'Well done!' });
    }
    res.setHeader('content-type', 'application/json');
    res.end(JSON.stringify({ id: 'msg_fake', type: 'message', role: 'assistant', model: parsed.model || 'fake', content: [{ type: 'text', text: reply }], stop_reason: 'end_turn', usage: { input_tokens: 1, output_tokens: 1 } }));
  });
});
await new Promise(r => fakeAi.listen(Number(FAKE_AI_PORT), '127.0.0.1', r));

console.log('▶ Starting the API…');
// Run node directly (no npx/shell wrapper) so stopping it really stops the server.
const api = spawn(process.execPath, ['--import', 'tsx', 'src/index.ts'], { cwd: apiDir, env, stdio: ['ignore', 'pipe', 'pipe'] });
let exited = false;
api.on('exit', () => { exited = true; });
let apiLog = '';
api.stdout.on('data', d => { apiLog += d; });
api.stderr.on('data', d => { apiLog += d; });

const stop = () => { if (!exited) { try { api.kill(); } catch { /* already stopped */ } } try { fakeAi.close(); } catch { /* closed */ } };
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
// Async spawn (not spawnSync) so this process can keep serving the fake AI provider.
const status = await new Promise(resolve => {
  const t = spawn(process.execPath, ['--import', 'tsx', '--test', '--test-concurrency=1', ...files], { cwd: apiDir, env, stdio: 'inherit' });
  t.on('exit', code => resolve(code ?? 1));
});
stop();
if (status !== 0 && process.env.SHOW_API_LOG) console.log(apiLog);
process.exit(status);
