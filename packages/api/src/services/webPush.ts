import webpush from 'web-push';
import { prisma } from '../db';
export function webPushConfigured() {
 return !!(process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY && process.env.VAPID_SUBJECT);
}
export async function sendBrowserPush(memberId: string, title: string, body: string, url = '/') {
 if (!webPushConfigured()) return [];
 webpush.setVapidDetails(process.env.VAPID_SUBJECT!, process.env.VAPID_PUBLIC_KEY!, process.env.VAPID_PRIVATE_KEY!);
 const subscriptions = await prisma.webPushSubscription.findMany({where: {memberId}});
 const category=url==='/chores'?'tasks':url==='/rewards'?'rewards':url==='/chat'?'chat':null;
 return Promise.all(subscriptions.filter(s=>!category||s[category]).map(async s => {
  try {
   await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url}),{TTL:3600});
   return {sent:true};
  } catch(e:any) {
   if (e.statusCode === 404 || e.statusCode === 410) await prisma.webPushSubscription.deleteMany({where:{id:s.id}});
   console.error('Browser push failed:', e.statusCode || 'network');
   return {sent:false};
  }
 }));
}
