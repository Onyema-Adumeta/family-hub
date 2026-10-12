import {useEffect,useState} from 'react';
import {api} from '../lib/api';
import {useAuthStore} from '../store/auth';
export default function BrowserNotifications(){
 const member=useAuthStore(s=>s.member);
 const [key,setKey]=useState<string|null>(null),[registration,setRegistration]=useState<ServiceWorkerRegistration|null>(null),[enabled,setEnabled]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const [preferences,setPreferences]=useState({tasks:true,rewards:true,chat:true});
 const supported=typeof window!=='undefined'&&window.isSecureContext&&'serviceWorker' in navigator&&'PushManager' in window&&'Notification' in window;
 useEffect(()=>{if(!supported)return;let active=true;
 api.get('/notifications/web-push/config').then(r=>{if(active)setKey(r.data.publicKey)}).catch(()=>{});
 navigator.serviceWorker.ready.then(async reg=>{const sub=await reg.pushManager.getSubscription();if(active){setRegistration(reg);}if(sub){const r=await api.post('/notifications/web-push/status',{endpoint:sub.endpoint});if(active){setEnabled(r.data.enabled);if(r.data.preferences)setPreferences(r.data.preferences);}} }).catch(()=>{if(active)setMessage('Could not check notification setup.');});
 return ()=>{active=false};
 },[member?.id]);
 async function enable(){
  if(!registration||!key)return;setBusy(true);setMessage('');
  try {
   const bytes=Uint8Array.from(atob(key.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
   const sub=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:bytes});
   await api.post('/notifications/web-push/subscribe',sub.toJSON());setEnabled(true);setMessage('Notifications enabled on this device.');
  }catch{setMessage('Could not enable notifications. Check browser permissions and try again.');}finally{setBusy(false);}
 }
 async function disable(){setBusy(true);try{const sub=await registration?.pushManager.getSubscription();if(sub){await api.post('/notifications/web-push/unsubscribe',{endpoint:sub.endpoint});await sub.unsubscribe();}setEnabled(false);setMessage('Notifications disabled on this device.');}catch{setMessage('Could not disable notifications. Try again.');}finally{setBusy(false);}}
 async function changePreference(name:'tasks'|'rewards'|'chat',value:boolean){setBusy(true);try{const sub=await registration?.pushManager.getSubscription();if(!sub)return;const next={...preferences,[name]:value};await api.patch('/notifications/web-push/preferences',{endpoint:sub.endpoint,...next});setPreferences(next);}catch{setMessage('Could not save preferences.');}finally{setBusy(false);}}
 async function test(){setBusy(true);try{const r=await api.post('/notifications/web-push/test');setMessage(r.data.accepted?'Test submitted. Check your device notifications.':'No test was accepted. Enable notifications again.');}catch{setMessage('Test failed. Please try again.');}finally{setBusy(false);}}
 return <section className="card" style={{marginBottom:16,padding:16}}><h2 style={{fontSize:16}}>Notifications</h2>
 {!supported?<p>On iPhone or iPad, add FamilyHub to your home screen and open it there. Otherwise use a browser that supports notifications.</p>:!key?<p>Notifications will be available after the server update is configured.</p>:<><p>Receive task reminders, reward updates and family messages on this device.</p><button disabled={busy||!registration} onClick={enabled?disable:enable}>{enabled?'Disable notifications':'Enable notifications'}</button>{enabled&&<button disabled={busy} onClick={test} style={{marginLeft:12}}>Send test</button>}</>}
 {enabled&&<div style={{display:'flex',gap:12,flexWrap:'wrap',marginTop:12}}>{(['tasks','rewards','chat'] as const).map(name=><label key={name}><input type="checkbox" checked={preferences[name]} disabled={busy} onChange={e=>changePreference(name,e.target.checked)}/>{name==='tasks'?'Task reminders':name==='rewards'?'Reward updates':'Family chat'}</label>)}</div>}
 <p role="status">{message}</p></section>;
}
