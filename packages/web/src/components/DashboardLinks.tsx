import {useQuery, useQueryClient} from '@tanstack/react-query';
import {useState} from 'react';
import {useAuthStore} from '../store/auth';
import {api} from '../lib/api';
interface DashboardMember {
 id:string; name:string; role:string; canOpenPersonalOS:boolean; canOpenPremed:boolean;
}
export default function DashboardLinks({manage=false}:{manage?:boolean}){
 const member=useAuthStore(s=>s.member);
 const qc=useQueryClient();
 const [busy,setBusy]=useState<string|null>(null),[message,setMessage]=useState('');
 const {data:members=[],isError}=useQuery<DashboardMember[]>({
  queryKey:['dashboard-access',member?.id],
  queryFn:()=>api.get('/members/dashboard-access').then(r=>r.data),
  enabled:!!member, refetchInterval:30000,
 });
 const mine=members.find(m=>m.id===member?.id);
 if(!member)return null;
 async function update(target:DashboardMember,field:'canOpenPersonalOS'|'canOpenPremed',value:boolean){
  setBusy(target.id);setMessage('');
  try{
   await api.patch(`/members/${target.id}/dashboard-access`,{
    canOpenPersonalOS:target.canOpenPersonalOS,canOpenPremed:target.canOpenPremed,[field]:value,
   });
   await qc.invalidateQueries({queryKey:['dashboard-access']});
  }catch{setMessage('Could not save. Please try again.');}finally{setBusy(null);}
 }
 if(manage && member.role!=='parent')return null;
 if(!manage && !mine?.canOpenPersonalOS && !mine?.canOpenPremed)return null;
 return <section className="card" style={{marginBottom:16,padding:16}}>
  <h2 style={{fontSize:16}}>{manage ? 'Dashboard access' : 'Your dashboards'}</h2>
  {!manage && <div style={{display:'flex',gap:12,flexWrap:'wrap'}}>
   {mine?.canOpenPersonalOS&&<a href="https://davidson-personal.hatchable.site/" target="_blank" rel="noopener noreferrer">Open Personal OS ↗</a>}
   {mine?.canOpenPremed&&<a href="https://pre-med-pathway-tracker.dadumeta.chatgpt.site/" target="_blank" rel="noopener noreferrer">Open Pre-med Tracker ↗</a>}
  </div>}
  {manage && <div style={{marginTop:12}}>
   <p style={{fontSize:12}}>Select family names below. These settings control shortcuts; each linked dashboard keeps its own access settings.</p>
   {members.map(m=><div key={m.id} style={{display:'flex',gap:12,flexWrap:'wrap',padding:'8px 0'}}>
    <strong>{m.name}</strong>
    <label><input type="checkbox" disabled={busy!==null} checked={m.canOpenPersonalOS} onChange={e=>update(m,'canOpenPersonalOS',e.target.checked)}/> Personal OS</label>
    <label><input type="checkbox" disabled={busy!==null} checked={m.canOpenPremed} onChange={e=>update(m,'canOpenPremed',e.target.checked)}/> Pre-med</label>
   </div>)}
  </div>}
  <p role="status">{isError?'Dashboard links are not available yet.':message}</p>
 </section>;
}
