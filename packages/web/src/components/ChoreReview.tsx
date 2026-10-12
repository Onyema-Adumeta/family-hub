import {useState} from 'react';
import {useQuery,useQueryClient} from '@tanstack/react-query';
import {useAuthStore} from '../store/auth';
import {api} from '../lib/api';
function groupKey(c:any){let title=c.title.toLowerCase().replace(/[^a-z0-9 ]/g,' ').trim();if(/brush.*teeth/.test(title))title='brush teeth';else if(/\bbed\b/.test(title)&&/clean|tidy|make/.test(title))title='make bed';else if(/\broom\b/.test(title)&&/clean|tidy/.test(title))title='tidy room';return title+'|'+(c.assignees?.length?c.assignees.map((a:any)=>a.id).sort().join(','):c.assignedToId||'unassigned');}
export default function ChoreReview(){
 const member=useAuthStore(s=>s.member),qc=useQueryClient();const [ids,setIds]=useState<string[]>([]),[archived,setArchived]=useState(false),[busy,setBusy]=useState(false),[notice,setNotice]=useState('');
 const {data=[],isLoading,isError}=useQuery<any[]>({queryKey:['chore-review'],queryFn:()=>api.get('/chores/review').then(r=>r.data),enabled:member?.role==='parent'});
 if(member?.role!=='parent')return null;
 const today=new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 const active=data.filter(c=>!c.archivedAt&&c.status!=='done'),counts:Record<string,number>={};active.forEach(c=>{const key=groupKey(c);counts[key]=(counts[key]||0)+1;});
 const items=archived?data.filter(c=>c.archivedAt):active;
 async function act(action:'archive'|'restore'|'restart'){
  if(!ids.length)return;
  if(!confirm(action==='archive'?'Archive selected unfinished tasks? You can restore them here.':action==='restart'?'Set selected daily/weekly routines due today? Existing stars and completions stay unchanged.':'Restore the selected tasks?'))return;
  setBusy(true);setNotice('');try{const r=await api.post('/chores/review',{ids,action});setNotice(`${r.data.updated} tasks updated.`);setIds([]);await Promise.all([qc.invalidateQueries({queryKey:['chore-review']}),qc.invalidateQueries({queryKey:['chores']}),qc.invalidateQueries({queryKey:['report']})]);}catch(e:any){setNotice(e.response?.data?.error||'Could not save changes.');}finally{setBusy(false);}
 }
 return <section className="card" style={{padding:16,marginBottom:16}}><h2 style={{fontSize:16}}>Review routines and duplicates</h2><p style={{fontSize:12}}>Choose what to keep together. Similar titles are suggestions, not automatic duplicates. Completed work and stars are preserved.</p><label><input type="checkbox" checked={archived} onChange={e=>{setArchived(e.target.checked);setIds([]);}}/> Show archived tasks</label>
 {isLoading&&<p>Loading tasks…</p>}{isError&&<p role="alert">Could not load tasks.</p>}
 {items.map(c=>{const date=c.dueDate?.slice(0,10),overdue=date&&date<today;return <label key={c.id} style={{display:'block',padding:'10px 0',borderBottom:'1px solid var(--border)'}}><input type="checkbox" disabled={busy} checked={ids.includes(c.id)} onChange={e=>setIds(s=>e.target.checked?[...s,c.id]:s.filter(id=>id!==c.id))}/> <strong>{c.title}</strong><div style={{fontSize:12,marginLeft:24,color:'var(--text-muted)'}}>{c.assignees?.map((a:any)=>a.name).join(', ')||c.assignedTo?.name||'Unassigned'} · {c.frequency}{date?` · ${overdue?'Overdue since':'Due'} ${date}`:' · No due date'}{!archived&&counts[groupKey(c)]>1?' · Similar task found':''}</div></label>})}
 {!isLoading&&!items.length&&<p>No {archived?'archived':'unfinished'} tasks.</p>}
 <div style={{display:'flex',gap:8,flexWrap:'wrap',marginTop:12}}>{archived?<button disabled={!ids.length||busy} onClick={()=>act('restore')}>Restore selected</button>:<><button disabled={!ids.length||busy} onClick={()=>act('restart')}>Restart selected routines today</button><button disabled={!ids.length||busy} onClick={()=>act('archive')}>Archive selected duplicates</button></>}</div><p role="status">{notice}</p></section>;
}
