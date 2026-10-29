import { sendBrowserPush, webPushConfigured, browserPushConfiguration } from '../services/webPush';
import { Router } from 'express';
import { AuthRequest } from '../middleware/auth';

const router = Router();
import { prisma } from '../db';
import { memberInFamily, requireParent } from '../lib/guards';

// ─── Read notifications ───────────────────────────────────────────────────────

router.get('/', async (req: AuthRequest, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: {
        familyId: req.familyId,
        OR: [{ memberId: req.memberId }, { memberId: null }],
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });
    res.json(notifications);
  } catch (e) {
    res.status(500).json({ error: 'Failed to fetch notifications' });
  }
});

router.patch('/:id/read', async (req: AuthRequest, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { id: req.params.id, familyId: req.familyId, OR: [{ memberId: req.memberId }, { memberId: null }] },
      data: { read: true },
    });
    if (!result.count) return res.status(404).json({ error: 'Notification not found' });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark read' });
  }
});

router.patch('/read-all', async (req: AuthRequest, res) => {
  try {
    await prisma.notification.updateMany({
      where: { familyId: req.familyId, memberId: req.memberId },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to mark all read' });
  }
});

// ─── Push token registration ──────────────────────────────────────────────────

// POST /api/notifications/register-push
// Called from the web/mobile app after the user grants notification permission.
// Stores the Expo push token on the member row so cron jobs can reach them.
router.post('/register-push', async (req: AuthRequest, res) => {
  const { token } = req.body as { token?: string };
  if (!token) return res.status(400).json({ error: 'token is required' });

  try {
    await prisma.member.update({
      where: { id: req.memberId },
      data: { pushToken: token },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// DELETE /api/notifications/register-push  — unsubscribe (e.g. on sign-out)
router.delete('/register-push', async (req: AuthRequest, res) => {
  try {
    await prisma.member.update({
      where: { id: req.memberId },
      data: { pushToken: null },
    });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove push token' });
  }
});

// ─── Send a push notification ─────────────────────────────────────────────────

// Shared helper — used by the route below AND importable by cron jobs / other routes
export async function sendPushToMember(memberId: string, title: string, body: string) {
  const url = /reward/i.test(title) ? '/rewards' : /chore|task/i.test(title) ? '/chores' : '/';
  await sendBrowserPush(memberId, title, body, url);
  const member = await prisma.member.findUnique({ where: { id: memberId } });
  if (!member?.pushToken) return { sent: false, reason: 'no token' };

  const payload = {
    to: member.pushToken,
    title,
    body,
    sound: 'default',
    data: { memberId },
  };

  const response = await fetch('https://exp.host/--/api/v2/push/send', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const result = await response.json() as { data?: { status: string; message?: string } };
  const status = result?.data?.status;

  // Expo returns 'DeviceNotRegistered' when the token is stale — clean it up
  if (status === 'error' && result?.data?.message === 'DeviceNotRegistered') {
    await prisma.member.update({ where: { id: memberId }, data: { pushToken: null } });
    return { sent: false, reason: 'DeviceNotRegistered — token cleared' };
  }

  return { sent: status === 'ok', status };
}

// POST /api/notifications/send
// Body: { memberId, title, body }
// Also saves a DB notification record so it shows up in the bell/list.
router.post('/send', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { memberId, title, body } = req.body as { memberId?: string; title?: string; body?: string };
  if (!memberId || !title || !body) {
    return res.status(400).json({ error: 'memberId, title, and body are required' });
  }
  if (typeof title !== 'string' || typeof body !== 'string' || title.length > 120 || body.length > 500) {
    return res.status(400).json({ error: 'Title or message is too long' });
  }
  if (!(await memberInFamily(memberId, req.familyId!))) return res.status(404).json({ error: 'Member not found' });

  try {
    // Save to DB so it shows in the notification list regardless of push delivery
    await prisma.notification.create({
      data: {
        familyId: req.familyId!,
        memberId,
        title,
        body,
        read: false,
      },
    });

    const pushResult = await sendPushToMember(memberId, title, body);
    res.json({ ok: true, push: pushResult });
  } catch (e) {
    res.status(500).json({ error: 'Failed to send notification' });
  }
});

// POST /api/notifications/broadcast
// Sends to every member in the family who has a push token
router.post('/broadcast', async (req: AuthRequest, res) => {
  if (!requireParent(req, res)) return;
  const { title, body } = req.body as { title?: string; body?: string };
  if (!title || !body) return res.status(400).json({ error: 'title and body are required' });
  if (typeof title !== 'string' || typeof body !== 'string' || title.length > 120 || body.length > 500) {
    return res.status(400).json({ error: 'Title or message is too long' });
  }

  try {
    const members = await prisma.member.findMany({
      where: { familyId: req.familyId },
      select: { id: true, pushToken: true },
    });

    // Save one DB notification per member
    await prisma.notification.createMany({
      data: members.map(m => ({
        familyId: req.familyId!,
        memberId: m.id,
        title,
        body,
        read: false,
      })),
    });

    // Fire push notifications concurrently
    const results = await Promise.allSettled(
      members.filter(m => m.pushToken).map(m => sendPushToMember(m.id, title, body))
    );

    res.json({ ok: true, sent: results.filter(r => r.status === 'fulfilled').length });
  } catch (e) {
    res.status(500).json({ error: 'Failed to broadcast notification' });
  }
});

router.get('/web-push/config', (req: AuthRequest, res) => {
 const config=browserPushConfiguration();res.json({publicKey:config.publicKey,ready:config.ready,code:config.code});
});
router.post('/web-push/subscribe', async (req: AuthRequest, res) => {
 const {endpoint,keys} = req.body || {};
 let target: URL;
 try { target = new URL(endpoint); } catch { return res.status(400).json({error:'Invalid subscription'}); }
 // Restrict server-side requests to known browser push providers.
 const host=target.hostname;
 const allowed=host==='fcm.googleapis.com'||host==='updates.push.services.mozilla.com'||host==='push.services.mozilla.com'||host==='web.push.apple.com'||host.endsWith('.notify.windows.com');
 if(target.protocol!=='https:'||target.port||target.username||target.password||!allowed||typeof keys?.p256dh!=='string'||typeof keys?.auth!=='string'||keys.p256dh.length>200||keys.auth.length>200) return res.status(400).json({error:'Unsupported subscription'});
 if(!webPushConfigured()) return res.status(503).json({error:'Browser notifications are not configured yet'});
 try {
  // A shared browser can change accounts; the explicit new opt-in transfers its endpoint.
  await prisma.webPushSubscription.upsert({where:{endpoint},create:{memberId:req.memberId!,endpoint,p256dh:keys.p256dh,auth:keys.auth},update:{memberId:req.memberId!,p256dh:keys.p256dh,auth:keys.auth}});
  res.json({ok:true});
 } catch {res.status(500).json({error:'Could not save browser subscription'});}
});
router.post('/web-push/unsubscribe', async (req: AuthRequest,res) => {
 try {await prisma.webPushSubscription.deleteMany({where:{memberId:req.memberId!,endpoint:String(req.body.endpoint || '')}});res.json({ok:true});}
 catch {res.status(500).json({error:'Could not remove subscription'});}
});
router.post('/web-push/status', async(req:AuthRequest,res)=>{
 try {const subscription=await prisma.webPushSubscription.findFirst({where:{memberId:req.memberId!,endpoint:String(req.body.endpoint||'')}});res.json({enabled:!!subscription,preferences:subscription?{tasks:subscription.tasks,rewards:subscription.rewards,chat:subscription.chat}:null});}
 catch{res.status(500).json({error:'Could not check subscription'});}
});
router.patch('/web-push/preferences',async(req:AuthRequest,res)=>{
 const {endpoint,tasks,rewards,chat}=req.body||{};
 if(typeof tasks!=='boolean'||typeof rewards!=='boolean'||typeof chat!=='boolean')return res.status(400).json({error:'Invalid preferences'});
 try{await prisma.webPushSubscription.updateMany({where:{memberId:req.memberId!,endpoint:String(endpoint||'')},data:{tasks,rewards,chat}});res.json({ok:true});}
 catch{res.status(500).json({error:'Could not save preferences'});}
});
router.post('/web-push/test' , async (req:AuthRequest,res) => {
 const endpoint=req.body?.endpoint;
 if(typeof endpoint!=='string'||!endpoint)return res.status(400).json({error:'Enable notifications on this device first'});
 try {const results=await sendBrowserPush(req.memberId!,'FamilyHub notification test','This is a server test for this device.','/',endpoint);res.json({accepted:results.some(r=>r.sent),results});}
 catch {res.status(500).json({error:'Test could not be sent'});}
});
export default router;