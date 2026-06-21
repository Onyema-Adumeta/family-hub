import { readFileSync, writeFileSync } from "node:fs";
const BASE = "C:\\Users\\Devops\\family-hub\\packages\\api\\src\\routes\\";
const EMDASH = "\u2014", CALENDAR = "\uD83D\uDCC5", DIVIDER = "\u2500".repeat(8);

for (const f of ["events.ts", "grocery.ts", "report.ts"]) {
  const path = BASE + f;
  let t = readFileSync(path, "utf-8");
  const before = t;
  // report.ts AI-tip em-dash (CP1252-flavored): C3 A2 E2 201A AC ...
  t = t.replace(/\u00C3\u00A2\u00E2\u201A\u00AC[\u0080-\uFFFF]*?(?=\s)/g, EMDASH);
  // long divider runs in report.ts comments
  t = t.replace(/(\u00C3\u00A2\u00E2[\u0080-\uFFFF]){4,}/g, DIVIDER);
  // single-encoded em-dash in comments: E2 80 94  OR  CP1252 variant
  t = t.replace(/\u00E2\u20AC\u201D/g, EMDASH);
  t = t.replace(/\u00E2\u0080\u0094/g, EMDASH);
  // calendar emoji literal variants
  t = t.replace(/\u00F0\u0178\u201C\u2026/g, CALENDAR);
  t = t.replace(/\u00F0\u0178\u0093\u2026/g, CALENDAR);
  if (t !== before) { writeFileSync(path, t, { encoding: "utf-8" }); console.log("fixed " + f); }
  else console.log("clean " + f);
}
