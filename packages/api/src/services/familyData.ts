// Export and deletion of a family's data (PIPEDA / BC PIPA: access and deletion).
import { prisma } from '../db';
import { PUBLIC_FAMILY_SELECT, PUBLIC_MEMBER_SELECT } from '../lib/guards';

/**
 * Everything Kinroost holds about a family, as plain JSON.
 * Left out on purpose: password hashes, sign-in versions, push tokens and
 * browser push endpoints, Google tokens, billing ids, and one-time email links.
 */
export async function exportFamilyData(familyId: string) {
  const family = await prisma.family.findUniqueOrThrow({
    where: { id: familyId },
    select: { ...PUBLIC_FAMILY_SELECT, aiConsentAt: true, termsAcceptedAt: true, termsVersion: true, childConsentAt: true, googleTokens: true, screenMinutesPerStar: true, centsPerStar: true, currency: true },
  });
  const { googleTokens, ...familyOut } = family;
  const memberIds = (await prisma.member.findMany({ where: { familyId }, select: { id: true } })).map(m => m.id);
  const byFamily = { where: { familyId } };
  const [
    members, chores, choreCompletions, meals, events, rewards, redemptions, messages, quests,
    notifications, groceryItems, weeklyRules, triviaSessions, gameScores, wishlist, trips, memories, auditLog,
    achievements, goals, bankEntries,
  ] = await Promise.all([
    prisma.member.findMany({ where: { familyId }, select: { ...PUBLIC_MEMBER_SELECT, email: true, emailVerifiedAt: true } }),
    prisma.chore.findMany({ ...byFamily, include: { assignees: { select: { id: true, name: true } } } }),
    prisma.choreCompletion.findMany(byFamily),
    prisma.meal.findMany({ ...byFamily, include: { assignees: { select: { id: true, name: true } } } }),
    prisma.event.findMany(byFamily),
    prisma.reward.findMany(byFamily),
    prisma.redemption.findMany(byFamily),
    prisma.message.findMany({ ...byFamily, include: { acknowledgements: true, votes: true } }),
    prisma.quest.findMany(byFamily),
    prisma.notification.findMany(byFamily),
    prisma.groceryItem.findMany(byFamily),
    prisma.weeklyRule.findMany({ ...byFamily, include: { outcomes: true } }),
    prisma.triviaSession.findMany({ ...byFamily, include: { questions: true, answers: true } }),
    prisma.gameScore.findMany(byFamily),
    prisma.wishlistItem.findMany({ where: { memberId: { in: memberIds } } }),
    prisma.trip.findMany({ ...byFamily, include: { packingItems: true, itineraryDays: { include: { activities: { include: { assignees: { select: { id: true, name: true } } } } } } } }),
    prisma.memory.findMany(byFamily),
    prisma.auditLog.findMany({ ...byFamily, orderBy: { createdAt: 'asc' } }),
    prisma.achievement.findMany(byFamily),
    prisma.familyGoal.findMany(byFamily),
    prisma.bankEntry.findMany(byFamily),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    format: 'Kinroost export v1',
    family: { ...familyOut, googleCalendarConnected: !!googleTokens },
    members, chores, choreCompletions, meals, events, rewards, redemptions, messages, quests,
    notifications, groceryItems, weeklyRules, triviaSessions, gameScores, wishlist, trips, memories, auditLog,
    achievements, goals, bankEntries,
  };
}

/** Permanently deletes a family and everything in it. */
export async function deleteFamilyData(familyId: string) {
  const memberIds = (await prisma.member.findMany({ where: { familyId }, select: { id: true } })).map(m => m.id);
  const byFamily = { where: { familyId } };
  await prisma.$transaction([
    prisma.message.deleteMany(byFamily),                 // acknowledgements and votes cascade
    prisma.triviaSession.deleteMany(byFamily),           // questions and answers cascade
    prisma.triviaAnswer.deleteMany({ where: { memberId: { in: memberIds } } }),
    prisma.ruleOutcome.deleteMany({ where: { OR: [{ rule: { familyId } }, { memberId: { in: memberIds } }] } }),
    prisma.weeklyRule.deleteMany(byFamily),
    prisma.redemption.deleteMany({ where: { OR: [{ familyId }, { memberId: { in: memberIds } }] } }),
    prisma.reward.deleteMany(byFamily),
    prisma.chore.deleteMany(byFamily),
    prisma.meal.deleteMany(byFamily),
    prisma.event.deleteMany(byFamily),
    prisma.groceryItem.deleteMany(byFamily),
    prisma.quest.deleteMany(byFamily),
    prisma.notification.deleteMany(byFamily),
    prisma.automation.deleteMany(byFamily),
    prisma.memory.deleteMany(byFamily),
    prisma.gameScore.deleteMany(byFamily),
    prisma.trip.deleteMany(byFamily),                    // packing, days and activities cascade
    prisma.member.deleteMany(byFamily),                  // wishlist, push, completions, email links cascade
    prisma.family.delete({ where: { id: familyId } }),   // audit log and completions cascade
  ]);
}

/**
 * Removes one member and their personal data. Shared family records they
 * touched (trips they created, grocery items they added, rules they set up)
 * are handed to the parent doing the removal instead of being deleted.
 */
export async function deleteMemberData(memberId: string, familyId: string, handOverToId: string) {
  const rulesForMember = { assignedToId: memberId, familyId };
  await prisma.$transaction([
    prisma.message.deleteMany({ where: { memberId, familyId } }),
    prisma.triviaAnswer.deleteMany({ where: { memberId } }),
    prisma.ruleOutcome.deleteMany({ where: { OR: [{ memberId }, { rule: rulesForMember }] } }),
    prisma.weeklyRule.deleteMany({ where: rulesForMember }),
    prisma.weeklyRule.updateMany({ where: { createdById: memberId, familyId }, data: { createdById: handOverToId } }),
    prisma.redemption.deleteMany({ where: { memberId } }),
    prisma.quest.updateMany({ where: { memberId, familyId }, data: { memberId: null } }),
    prisma.chore.updateMany({ where: { assignedToId: memberId, familyId }, data: { assignedToId: null } }),
    prisma.chore.updateMany({ where: { completedById: memberId, familyId }, data: { completedById: null } }),
    prisma.meal.updateMany({ where: { assignedToId: memberId, familyId }, data: { assignedToId: null } }),
    prisma.event.updateMany({ where: { assignedToId: memberId, familyId }, data: { assignedToId: null } }),
    prisma.groceryItem.updateMany({ where: { addedById: memberId, familyId }, data: { addedById: handOverToId } }),
    prisma.trip.updateMany({ where: { createdById: memberId, familyId }, data: { createdById: handOverToId } }),
    prisma.packingItem.deleteMany({ where: { memberId } }),
    prisma.gameScore.deleteMany({ where: { memberId } }),
    prisma.notification.deleteMany({ where: { memberId, familyId } }),
    prisma.member.delete({ where: { id: memberId } }),   // wishlist, push, completions, email links, assignments cascade
  ]);
}
