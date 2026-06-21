import { readFileSync, writeFileSync } from "node:fs";

const BASE = "C:\\Users\\Devops\\family-hub\\packages\\api\\src\\routes\\";
const EMDASH = "\u2014";
const LARROW = "\u2190";
const CALENDAR = "\uD83D\uDCC5";
const DIVIDER = "\u2500".repeat(8);

const REPLACEMENTS = [
  [/(\u00C3\u00A2\u00E2\u0080\u00C2)+/g, DIVIDER],
  ["\u00C3\u00A2\u00E2\u0080\u009A\u00C2\u00A2\u00E2\u0080\u00A0", EMDASH],
  ["\u00C3\u0192\u00C2\u00A2\u00C3\u00A2\u00E2\u0080\u009A\u00C2\u00A0\u00C3\u201A\u00C2", LARROW],
  ["\u00E2\u0080\u0094", EMDASH],
  ["\u00F0\u0178\u201C\u2026", CALENDAR],
];

for (const f of ["events.ts", "grocery.ts", "report.ts"]) {
  const path = BASE + f;
  let text = readFileSync(path, "utf-8");
  const before = text;
  for (const [find, rep] of REPLACEMENTS) {
    text = find instanceof RegExp ? text.replace(find, rep) : text.split(find).join(rep);
  }
  if (text !== before) { writeFileSync(path, text, { encoding: "utf-8" }); console.log("fixed " + f); }
  else console.log("clean " + f);
}
