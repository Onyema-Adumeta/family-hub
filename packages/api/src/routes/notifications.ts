import { sendBrowserPush, webPushConfigured, browserPushConfiguration } from '../services/webPush';
import { isExpoToken, pushToMember, registerPhone } from '../services/push';
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
// ─── Phones (Expo push) ──────────────────────────────────────────────────────
// POST /api/notifications/register-push  { token, platform }
// The phone app calls this after the person allows notifications. A phone
// belongs to whoever signed in on it last.
router.post('/register-push', async (req: AuthRequest, res) => {
  const { token, platform } = req.body || {};
  if (!isExpoToken(token)) return res.status(400).json({ error: 'Not a valid push token' });
  try {
    const device = await registerPhone(req.memberId!, token, String(platform || ''));
    res.json({ ok: true, preferences: { tasks: device.tasks, rewards: device.rewards, chat: device.chat } });
  } catch (e) {
    console.error('register-push failed', e);
    res.status(500).json({ error: 'Failed to save push token' });
  }
});

// DELETE /api/notifications/register-push  { token }  — on sign-out, or when switched off.
// Without a token (older app versions) it removes all of this member's phones.
router.delete('/register-push', async (req: AuthRequest, res) => {
  try {
    const token = req.body?.token;
    await prisma.pushDevice.deleteMany({ where: { memberId: req.memberId, ...(isExpoToken(token) ? { token } : {}) } });
    if (!isExpoToken(token)) await prisma.member.update({ where: { id: req.memberId }, data: { pushToken: null } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: 'Failed to remove push token' });
  }
});

// PATCH /api/notifications/push-preferences  { token, tasks, rewards, chat } — per phone
router.patch('/push-preferences', async (req: AuthRequest, res) => {
  const { token, tasks, rewards, chat } = req.body || {};
  if (!isExpoToken(token) || typeof tasks !== 'boolean' || typeof rewards !== 'boolean' || typeof chat !== 'boolean') {
    return res.status(400).json({ error: 'Invalid preferences' });
  }
  try {
    const r = await prisma.pushDevice.updateMany({ where: { memberId: req.memberId, token }, data: { tasks, rewards, chat } });
    if (!r.count) return res.status(404).json({ error: 'This phone is not set up for notifications' });
    res.json({ ok: true });
  } catch { res.status(500).json({ error: 'Could not save preferences' }); }
});

// POST /api/notifications/push-test — sends a test to all of my devices
router.post('/push-test', async (req: AuthRequest, res) => {
  const r = await pushToMember(req.memberId!, { title: 'Kinroost test 🔔', body: 'Notifications are working on this device.', url: '/', category: 'general' });
  res.json({ ok: true, ...r });
});

// ─── Send a push notification ─────────────────────────────────────────────────

/** Kept for older callers: pushes to every phone and browser of a member. */
export async function sendPushToMember(memberId: string, title: string, body: string) {
  return pushToMember(memberId, { title, body });
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
      select: { id: true },
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
      members.map(m => pushToMember(m.id, { title, body, url: '/', category: 'general' }))
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
 try {const results=await sendBrowserPush(req.memberId!,'Kinroost notification test','This is a server test for this device.','/',endpoint);res.json({accepted:results.some(r=>r.sent),results});}
 catch {res.status(500).json({error:'Test could not be sent'});}
});
export default router;