import { prisma } from "../src/db";

async function main() {
  const events = await prisma.event.findMany({ select: { id: true, emoji: true, title: true } });
  let fixed = 0;
  for (const ev of events) {
    const e = ev.emoji ?? "";
    if (e.includes("\u00F0") || e.includes("\u00C3") || e.includes("\u00E2")) {
      await prisma.event.update({ where: { id: ev.id }, data: { emoji: "\uD83D\uDCC5" } });
      console.log("  fixed: " + ev.title);
      fixed++;
    }
  }
  console.log("\nDone. Repaired " + fixed + " of " + events.length + " events.");
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
