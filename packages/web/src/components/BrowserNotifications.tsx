import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
const HELP:Record<string,string>={
 missing_configuration:'The API host is missing one or more notification settings. A parent needs to check VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY and VAPID_SUBJECT in Railway.',
 key_pair_mismatch:'The public and private notification keys do not belong to the same pair. Correct the pair on the API host; do not generate different pairs for each device.',
 invalid_configuration:'The API notification keys or contact address are invalid. Check the three VAPID settings on the API host.',
 no_subscription:'This device is not registered on the server. Choose Reconnect this device.',
 expired_subscription:'This device registration expired and was removed. Choose Reconnect this device.',
 provider_authorization_failed:'The push provider rejected the server credentials. Check the VAPID key pair on Railway, then reconnect this device.',
 provider_rate_limited:'The push provider is temporarily limiting requests. Wait a few minutes and retry.',
 payload_too_large:'The notification was too large. This needs a server fix.',
 provider_unreachable:'The server could not reach the push provider. Check API logs and try again.',
};
export function keyBytes(key:string){const raw=key.replace(/-/g,'+').replace(/_/g,'/');return Uint8Array.from(atob(raw+'='.repeat((4-raw.length%4)%4)),c=>c.charCodeAt(0));}
export function sameKey(sub:PushSubscription,key:string){const value=sub.options.applicationServerKey;if(!value)return true;const a=new Uint8Array(value),b=keyBytes(key);return a.length===b.length&&a.every((n,i)=>n===b[i]);}
export default function BrowserNotifications(){
 const member=useAuthStore(s=>s.member);
 const [key,setKey]=useState<string|null>(null),[configCode,setConfigCode]=useState('checking'),[registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null);
 const [permission,setPermission]=useState<NotificationPermission| 'unsupported'>(typeof Notification==='undefined'?'unsupported':Notification.permission);
 const [subscribed,setSubscribed]=useState(false),[enabled,setEnabled]=useState(false),[stale,setStale]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [preferences,setPreferences]=useState({tasks:true,rewards:true,chat:true});
 const supported=typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 useEffect(()=>{if(!supported)return;let active=true;let timer:ReturnType<typeof setTimeout>;
 async function check(){try{
  setPermission(Notification.permission);
  const r=await api.get('/notifications/web-push/config');if(!active)return;setKey(r.data.publicKey);setConfigCode(r.data.code || (r.data.publicKey?'ready':'missing_configuration'));
  const reg=await Promise.race([navigator.serviceWorker.ready,new Promise<never>((_,reject)=>{timer=setTimeout(()=>reject(new Error('worker_timeout')),12000);})]);clearTimeout(timer);if(!active)return;setRegistration(reg);
  const sub=await reg.pushManager.getSubscription();if(!active)return;setSubscribed(!!sub);setStale(!!sub&&!!r.data.publicKey&&!sameKey(sub,r.data.publicKey));
  if(sub){const status=await api.post('/notifications/web-push/status',{endpoint:sub.endpoint});if(active){setEnabled(status.data.enabled);if(status.data.preferences)setPreferences(status.data.preferences);}}else setEnabled(false);
 }catch(e:any){if(active)setMessage(e.message==='worker_timeout'?'The background worker is not ready. Reload Kinroost once, then open Settings again.':'Could not check notification setup. Check your connection and reload.');}}
 void check();return()=>{active=false;clearTimeout(timer)};
 },[member?.id]);
 function failure(e:any){const name=e?.name;if(name==='NotAllowedError')return 'Permission is blocked. Allow notifications for Kinroost in browser site settings and in the device notification settings.';if(name==='InvalidStateError')return 'This registration uses an older notification key. Choose Reconnect this device.';return e?.response?.data?.error||'Could not connect notifications. Try reconnecting this device.';}
 async function connect(renew=false){if(!registration||!key)return;setBusy(true);setMessage('');try{
  const allowed=await Notification.requestPermission();setPermission(allowed);if(allowed!=='granted'){setMessage('Notifications were not allowed. Change the browser site permission before trying again.');return;}
  let sub=await registration.pushManager.getSubscription();
  if(sub&&(renew||!sameKey(sub,key))){await api.post('/notifications/web-push/unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();sub=null;setEnabled(false);setSubscribed(false);}
  sub=sub||await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:keyBytes(key)});
  await api.post('/notifications/web-push/subscribe',sub.toJSON());setSubscribed(true);setEnabled(true);setStale(false);setMessage('This device is registered. Run the local display test and the server delivery test below.');
 }catch(e){setMessage(failure(e));}finally{setBusy(false);}}
 async function disable(){setBusy(true);try{const sub=await registration?.pushManager.getSubscription();if(sub){await api.post('/notifications/web-push/unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}setEnabled(false);setSubscribed(false);setMessage('Notifications disabled for this device only.');}catch(e){setMessage(failure(e));}finally{setBusy(false);}}
 async function localTest(){if(!registration)return;setBusy(true);try{await registration.showNotification('Kinroost display test',{body:'This test was created on this device, without using the server.',icon:'/icon-192.png',tag:'familyhub-display-test',data:{url:new URL('/',location.origin).href}});setMessage('Display requested on this device. If nothing appears, check Do Not Disturb, device notification permissions and browser notification settings.');}catch(e){setMessage(failure(e));}finally{setBusy(false);}}
 async function serverTest(){setBusy(true);try{const sub=await registration?.pushManager.getSubscription();if(!sub){setMessage(HELP.no_subscription);return;}const r=await api.post('/notifications/web-push/test',{endpoint:sub.endpoint});if(r.data.accepted)setMessage('The push provider accepted the test for THIS device. This does not confirm display. If the local test works but this test does not appear, reconnect once and check the browser background settings.');else{const result=r.data.results?.[0];setMessage((HELP[result?.code]||'Delivery failed. Update the API so it returns the diagnostic result.')+(result?.statusCode?` (Provider status ${result.statusCode})`:''));}}catch(e:any){setMessage(e.response?.data?.error||'Server test failed. Check API availability.');}finally{setBusy(false);}}
 async function preference(name:'tasks'|'rewards'|'chat',value:boolean){setBusy(true);try{const sub=await registration?.pushManager.getSubscription();if(!sub)return;const next={...preferences,[name]:value};await api.patch('/notifications/web-push/preferences',{endpoint:sub.endpoint,...next});setPreferences(next);}catch{setMessage('Could not save notification preferences.');}finally{setBusy(false);}}
 return <section className="card" style={{marginBottom:16,padding:20}}><h2 style={{fontSize:17}}>Notifications on this device</h2>
 {!supported?<p>Use a browser that supports Web Push. On iPhone/iPad, open Kinroost from its Home Screen app.</p>:<>
 <p style={{margin:'10px 0',color:'var(--text-secondary)'}}>Each person enables their own devices. Tests here target this device, not another phone on the same profile.</p>
 <dl style={{display:'grid',gridTemplateColumns:'1fr auto',gap:8,fontSize:13,marginBottom:14}}><dt>Browser permission</dt><dd>{permission}</dd><dt>Background worker</dt><dd>{registration?'Ready':'Checking'}</dd><dt>Device subscription</dt><dd>{stale?'Needs reconnect':subscribed?'Present':'Not connected'}</dd><dt>Server registration</dt><dd>{enabled?'Saved':'Not saved'}</dd><dt>Server configuration</dt><dd>{configCode==='ready'?'Valid':configCode==='checking'?'Checking':'Needs attention'}</dd></dl>
 {configCode!=='ready'&&configCode!=='checking'&&<p role="alert">{HELP[configCode]||'Server configuration could not be verified.'}</p>}
 <div style={{display:'flex',gap:8,flexWrap:'wrap'}}>{!enabled&&<button className="btn btn-primary" disabled={busy||!registration||!key} onClick={()=>connect()}>Enable notifications</button>}
 {(enabled||subscribed)&&<><button className="btn btn-ghost" disabled={busy||!registration||!key} onClick={()=>connect(true)}>Reconnect this device</button><button className="btn btn-ghost" disabled={busy} onClick={disable}>Disable on this device</button></>}
 <button className="btn btn-ghost" disabled={busy||!registration||permission!=='granted'} onClick={localTest}>1. Local display test</button><button className="btn btn-ghost" disabled={busy||!enabled||stale||!key} onClick={serverTest}>2. Server delivery test</button></div>
 {enabled&&<div style={{display:'flex',gap:14,flexWrap:'wrap',marginTop:16}}>{(['tasks','rewards','chat'] as const).map(name=><label key={name}><input type="checkbox" checked={preferences[name]} disabled={busy} onChange={e=>preference(name,e.target.checked)}/> {name==='tasks'?'Task reminders':name==='rewards'?'Reward updates':'Family chat'}</label>)}</div>}
 </>}
 <p role="status" style={{marginTop:12,lineHeight:1.5}}>{message}</p></section>;
}
