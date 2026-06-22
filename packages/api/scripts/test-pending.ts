import { prisma } from "../src/db";
// paste-and-run a one-off: replicate the 8pm query for a quick sanity check
prisma.chore.count({ where: { status: { not: "done" } } }).then(n => { console.log("pending chores:", n); process.exit(0); });
