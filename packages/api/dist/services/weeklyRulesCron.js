"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.evaluateWeeklyRules = evaluateWeeklyRules;
exports.startWeeklyRulesCron = startWeeklyRulesCron;
const client_1 = require("@prisma/client");
const node_cron_1 = __importDefault(require("node-cron"));
const prisma = new client_1.PrismaClient();
function getWeekStart() {
    const d = new Date();
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const mon = new Date(d);
    mon.setDate(diff);
    return mon.toISOString().split('T')[0];
}
async function evaluateWeeklyRules() {
    console.log('[weekly-rules] Evaluating weekly rules...');
    const weekStart = getWeekStart();
    try {
        const rules = await prisma.weeklyRule.findMany({
            where: { active: true },
            include: { assignedTo: true, family: true },
        });
        for (const rule of rules) {
            // Skip if already evaluated this week
            const existing = await prisma.ruleOutcome.findFirst({
                where: { ruleId: rule.id, weekStart },
            });
            if (existing)
                continue;
            // Stars earned from completed chores this week
            const completedChores = await prisma.chore.findMany({
                where: {
                    familyId: rule.familyId,
                    assignedToId: rule.assignedToId,
                    status: 'done',
                    completedAt: { gte: new Date(weekStart) },
                },
                select: { stars: true },
            });
            const starsEarned = completedChores.reduce((sum, c) => sum + (c.stars || 0), 0);
            const passed = starsEarned >= rule.minStars;
            await prisma.ruleOutcome.create({
                data: { ruleId: rule.id, memberId: rule.assignedToId, weekStart, starsEarned, passed },
            });
            if (!passed) {
                const parents = await prisma.member.findMany({
                    where: { familyId: rule.familyId, role: 'parent' },
                });
                for (const parent of parents) {
                    await prisma.notification.create({
                        data: {
                            familyId: rule.familyId,
                            memberId: parent.id,
                            title: `⚠️ ${rule.assignedTo.name} missed their weekly goal`,
                            body: `${rule.assignedTo.name} earned ${starsEarned}/${rule.minStars} ⭐ this week. Consequence: ${rule.consequenceNote || 'Screen time reduced on weekend'}.`,
                            read: false,
                        },
                    });
                }
                await prisma.notification.create({
                    data: {
                        familyId: rule.familyId,
                        memberId: rule.assignedToId,
                        title: `😔 Weekly goal not met`,
                        body: `You earned ${starsEarned} out of ${rule.minStars} ⭐ needed this week. ${rule.consequenceNote || 'Screen time will be reduced this weekend.'}`,
                        read: false,
                    },
                });
                console.log(`[weekly-rules] FAILED: ${rule.assignedTo.name} earned ${starsEarned}/${rule.minStars}`);
            }
            else {
                await prisma.notification.create({
                    data: {
                        familyId: rule.familyId,
                        memberId: rule.assignedToId,
                        title: `🎉 Weekly goal achieved!`,
                        body: `Amazing! You earned ${starsEarned} ⭐ this week and hit your goal of ${rule.minStars}. Great work — enjoy your weekend!`,
                        read: false,
                    },
                });
                console.log(`[weekly-rules] PASSED: ${rule.assignedTo.name} earned ${starsEarned}/${rule.minStars}`);
            }
        }
        console.log('[weekly-rules] Done.');
    }
    catch (e) {
        console.error('[weekly-rules] Error:', e);
    }
}
// Run every Friday at 4:00 PM
function startWeeklyRulesCron() {
    node_cron_1.default.schedule('0 16 * * 5', evaluateWeeklyRules);
    console.log('[weekly-rules] Cron registered — runs every Friday at 4:00 PM');
}
//# sourceMappingURL=weeklyRulesCron.js.map