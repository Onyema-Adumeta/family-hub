import { sendBrowserPush } from './webPush';
import cron from 'node-cron';
import { prisma } from '../db';
import { generateTriviaSession } from '../routes/trivia';
import { buildBriefing } from '../routes/insights';

async function generateDailyTrivia() {
  // Only families where a parent has switched AI features on.
  const families = await prisma.family.findMany({ where: { aiConsentAt: { not: null } }, select: { id: true, name: true } });
  for (const family of families) {
    // Check if a session already exists for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const existing = await prisma.triviaSession.findFirst({
      where: { familyId: family.id, createdAt: { gte: today } },
    });
    if (existing) continue;

    const result = await generateTriviaSession(family.id);

    if ('error' in result) {
      console.error(`[trivia] Generation failed for family ${family.name}:`, result.error);
      continue;
    }

    console.log(`[trivia] Generated daily "${result.categoryName}" session for family ${family.name}`);
  }
}

export function setupCron() {
  // Reset daily chores at midnight
  cron.schedule('0 0 * * *', async () => {
    console.log('Resetting daily chores...');
    await prisma.chore.updateMany({
      where: { frequency: 'daily', archivedAt:null },
      data: { status: 'pending', completedAt: null, completedById: null }
    });
  });

  // Morning briefing at 7:30 Vancouver time: a personal summary for each member
  // ("Good morning, Maya! 3 chores for you today, soccer at 16:00, tacos for dinner").
  cron.schedule('30 7 * * *', async () => {
    try {
      const members = await prisma.member.findMany({ select: { id: true, familyId: true, role: true } });
      for (const m of members) {
        try {
          const b = await buildBriefing(m.familyId, m.id, m.role === 'parent');
          await prisma.notification.create({ data: { familyId: m.familyId, memberId: m.id, title: '☀️ Your day', body: b.summary } });
          await sendBrowserPush(m.id, '☀️ Your day', b.summary, '/');
        } catch (e) { console.error('[briefing] failed for member', m.id, e); }
      }
    } catch (e) { console.error('[briefing] job failed', e); }
  }, { timezone: 'America/Vancouver' });

  // Personal due/overdue reminders, at 4pm Vancouver time (including DST).
  cron.schedule('0 16 * * *', async () => {
   try {
    const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
    const members=await prisma.member.findMany({select:{id:true,familyId:true}});
    for(const member of members){
     const chores=await prisma.chore.findMany({where:{familyId:member.familyId,archivedAt:null,status:{not:'done'},OR:[{assignedToId:member.id},{assignees:{some:{id:member.id}}}]}});
     const due=chores.filter(c=>c.dueDate?c.dueDate.toISOString().slice(0,10)<=today:c.frequency==='daily');
     if(due.length) await sendBrowserPush(member.id,'Tasks need your attention',`${due.length} assigned task${due.length===1?'':'s'} due or overdue.`, '/chores');
    }
   }catch(e){console.error('Browser reminder job failed',e);}
  }, {timezone:'America/Vancouver'});

  // Weekly reset on Sunday midnight
  cron.schedule('0 0 * * 0', async () => {
    await prisma.chore.updateMany({
      where: { frequency: 'weekly', archivedAt:null },
      data: { status: 'pending', completedAt: null, completedById: null }
    });
  });

  // Daily trivia generation at 6am
  cron.schedule('0 6 * * *', async () => {
    console.log('[trivia] Generating daily trivia sessions...');
    await generateDailyTrivia().catch(e => console.error('[trivia] cron error:', e));
  });

  console.log('⏰ Cron jobs scheduled');
}