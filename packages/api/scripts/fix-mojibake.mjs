import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const EMDASH    = '\u2014';
const LARROW    = '\u2190';
const CALENDAR  = '\uD83D\uDCC5';
const DIVIDER   = '\u2500'.repeat(8);

const REPLACEMENTS = [
  [/(\u00C3\u00A2\u00E2\u0080\u00C2)+/g, DIVIDER],
  ['\u00C3\u00A2\u00E2\u0080\u009A\u00C2\u00A2\u00E2\u0080\u00A0', EMDASH],
  ['\u00C3\u0192\u00C2\u00A2\u00C3\u00A2\u00E2\u0080\u009A\u00C2\u00A0\u00C3\u201A\u00C2', LARROW],
  ['\u00E2\u0080\u0094', EMDASH],
  ['\u00F0\u0178\u201C\u2026', CALENDAR],
];

const FILES = [
  'src/routes/events.ts',
  'src/routes/grocery.ts',
  'src/routes/report.ts',
];

let changed = 0;
for (const rel of FILES) {
  const path = join(process.cwd(), rel);
  let text;
  try {
    text = readFileSync(path, 'utf-8');
  } catch {
    console.log('  SKIP  ' + rel + ' (not found)');
    continue;
  }
  const before = text;
  for (const [find, rep] of REPLACEMENTS) {
    text = find instanceof RegExp ? text.replace(find, rep) : text.split(find).join(rep);
  }
  if (text !== before) {
    writeFileSync(path, text, { encoding: 'utf-8' });
    console.log('  fixed ' + rel);
    changed++;
  } else {
    console.log('  clean ' + rel);
  }
}
console.log('\nDone. Rewrote ' + changed + ' file(s) as UTF-8.');
