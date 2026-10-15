import webpush from 'web-push';
import {createECDH} from 'crypto';
import {prisma} from '../db';
const clean=(value?:string)=>(value||'').trim().replace(/^['"]|['"]$/g,'');
export function browserPushConfiguration(){
 const publicKey=clean(process.env.VAPID_PUBLIC_KEY),privateKey=clean(process.env.VAPID_PRIVATE_KEY),subject=clean(process.env.VAPID_SUBJECT);
 if(!publicKey||!privateKey||!subject)return {ready:false,code:'missing_configuration',publicKey:null as string|null};
 try{
  const ecdh=createECDH('prime256v1');ecdh.setPrivateKey(Buffer.from(privateKey,'base64url'));
  if(ecdh.getPublicKey().toString('base64url')!==publicKey)return {ready:false,code:'key_pair_mismatch',publicKey:null as string|null};
  webpush.setVapidDetails(subject,publicKey,privateKey);
  return {ready:true,code:'ready',publicKey};
 }catch{return {ready:false,code:'invalid_configuration',publicKey:null as string|null};}
}
export function webPushConfigured(){return browserPushConfiguration().ready;}
export async function sendBrowserPush(memberId:string,title:string,body:string,url='/',endpoint?:string){
 const config=browserPushConfiguration();
 if(!config.ready)return [{sent:false,code:config.code,statusCode:null as number|null}];
 const subscriptions=await prisma.webPushSubscription.findMany({where:{memberId,...(endpoint?{endpoint}:{})}});
 if(!subscriptions.length)return [{sent:false,code:'no_subscription',statusCode:null as number|null}];
 const category=url==='/chores'?'tasks':url==='/rewards'?'rewards':url==='/chat'?'chat':null;
 return Promise.all(subscriptions.filter(s=>!category||s[category]).map(async s=>{
  try{
   await webpush.sendNotification({endpoint:s.endpoint,keys:{p256dh:s.p256dh,auth:s.auth}},JSON.stringify({title,body,url}),{TTL:3600,timeout:10000,urgency:'normal'});
   return {sent:true,code:'accepted',statusCode:201};
  }catch(e:any){
   const statusCode=typeof e.statusCode==='number'?e.statusCode:null;
   const expired=statusCode===404||statusCode===410;
   if(expired)await prisma.webPushSubscription.deleteMany({where:{id:s.id}});
   // Never return or log push endpoints, private keys or provider response bodies.
   return {sent:false,code:expired?'expired_subscription':statusCode===401||statusCode===403?'provider_authorization_failed':statusCode===429?'provider_rate_limited':statusCode===413?'payload_too_large':'provider_unreachable',statusCode};
  }
 }));
}
