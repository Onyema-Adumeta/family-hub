import { prisma } from "../src/db";
prisma.meal.findMany({ select: { id: true, name: true, day: true, week: true } }).then(meals => {
  console.log("TOTAL MEALS IN DB:", meals.length);
  for (const m of meals) console.log(`  ${m.week} | ${m.day} | ${m.name}`);
  process.exit(0);
});
