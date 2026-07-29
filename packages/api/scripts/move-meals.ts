import { prisma } from "../src/db";

const FROM = "2026-06-16";
const TO   = "2026-06-22";

async function main() {
  const { count } = await prisma.meal.updateMany({
    where: { week: FROM },
    data:  { week: TO },
  });
  console.log(`Moved ${count} meals from week ${FROM} to ${TO}.`);
  await prisma.$disconnect();
}
main().catch(e => { console.error(e); process.exit(1); });
