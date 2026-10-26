import {useEffect,useState} from 'react';
import {useNavigate} from 'react-router-dom';
import {useAuthStore} from '../store/auth';
import {useChores,useMembers,useMeals,useEvents,useMessages} from '../hooks/useApi';
import DashboardLinks from '../components/DashboardLinks';
import RewardGoal from '../components/RewardGoal';
function day(date=new Date()){return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Vancouver',year:'numeric',month:'2-digit',day:'2-digit'}).format(date);}
const panel={background:'var(--bg-card)',border:'1px solid var(--border)',borderRadius:14,padding:20};
export default function DashboardPage(){
 const member=useAuthStore(s=>s.member),navigate=useNavigate();
 const [today,setToday]=useState(()=>day());
 useEffect(()=>{const timer=setInterval(()=>setToday(day()),60000);return()=>clearInterval(timer);},[]);
 const {data:chores=[],isLoading,isError}=useChores(),{data:members=[]}=useMembers(),{data:events=[]}=useEvents(),{data:messages=[]}=useMessages();
 const monday=new Date();monday.setDate(monday.getDate()-((monday.getDay()+6)%7));const {data:meals=[]}=useMeals(day(monday));
 const all=chores as any[],people=members as any[],parent=member?.role==='parent';
 const mine=(c:any)=>c.assignedToId===member?.id||c.assignees?.some((a:any)=>a.id===member?.id);
 const open=all.filter(c=>!c.archivedAt&&c.status!=='done'),myOpen=open.filter(mine);
 const due=(c:any)=>c.dueDate?c.dueDate.slice(0,10)<=today:c.frequency==='daily';
 const order=(a:any,b:any)=>(a.dueDate||'9999').localeCompare(b.dueDate||'9999');
 const myToday=myOpen.filter(due).sort(order),myLater=myOpen.filter(c=>!due(c)).sort(order);
 const scope=parent?open:myOpen,overdue=scope.filter(c=>c.dueDate&&c.dueDate.slice(0,10)<today);
 const completed=all.filter(c=>c.status==='done'&&c.completedAt&&day(new Date(c.completedAt))===today&&(parent||mine(c)||c.completedById===member?.id));
 const upcoming=(events as any[]).filter(e=>(e.date||e.startsAt||'').slice(0,10)>=today).sort((a,b)=>(a.date||a.startsAt||'').localeCompare(b.date||b.startsAt||'')).slice(0,3);
 const weekday=new Intl.DateTimeFormat('en-US',{timeZone:'America/Vancouver',weekday:'long'}).format(new Date());
 const dinner=(meals as any[]).find(m=>m.day===weekday&&m.slot==='dinner');
 const recent=[...(messages as any[])].reverse().slice(0,3);
 return <div className="calm-dashboard" style={{maxWidth:1040,margin:'0 auto',paddingBottom:32}}>
  <header style={{marginBottom:24}}><p className="calm-eyebrow">FAMILY HUB</p><h1 style={{fontSize:'clamp(24px,4vw,32px)',fontWeight:700,margin:'6px 0'}}>Welcome, {member?.name?.split(' ')[0]||'family'}</h1><p className="calm-muted">{new Date().toLocaleDateString(undefined,{weekday:'long',month:'long',day:'numeric'})} · Your day, at a glance</p></header>
  <section data-family-today-v21="true" aria-label="Daily focus" style={{...panel,marginBottom:18,background:'linear-gradient(135deg,var(--bg-card),rgba(91,130,225,.07))'}}>
   <div className="calm-section-heading"><div><p className="calm-eyebrow">TODAY'S FOCUS</p><h2 style={{margin:'4px 0'}}>{parent?'Keep the family moving':'Your next three wins'}</h2></div><button className="btn btn-ghost" onClick={()=>navigate('/chores')}>{parent?'Manage chores':'See all tasks'}</button></div>
   <p className="calm-muted" style={{margin:'6px 0 14px'}}>{parent?'A quick view of what needs attention today.':'Just three things to focus on. Finish one, then tackle the next.'}</p>
   {isLoading?<p className="calm-muted">Loading daily prioritiesâ€¦</p>:isError?<p role="alert">Daily priorities are unavailable right now.</p>:myToday.length===0?<p className="calm-muted">All clear for today. Nice work!</p>:myToday.slice(0,3).map((c:any,i:number)=><button key={c.id} className="calm-task" onClick={()=>navigate('/chores')} style={{width:'100%',textAlign:'left'}}><span style={{display:'flex',alignItems:'center',gap:12}}><span aria-hidden="true" style={{display:'inline-grid',placeItems:'center',width:32,height:32,borderRadius:10,background:'var(--bg-card)',border:'1px solid var(--border)',flexShrink:0}}>{i+1}</span><span><strong>{c.title}</strong><small>{c.dueDate?.slice(0,10)<today?'Overdue Â· start here':c.status==='in_progress'?'Already in progress':'Ready when you are'}</small></span></span><span aria-hidden="true">â†’</span></button>)}
   {myToday.length>3&&<p className="calm-muted" style={{marginTop:10}}>+{myToday.length-3} more {myToday.length-3===1?'task':'tasks'} available in Chores.</p>}
   <div style={{display:'flex',flexWrap:'wrap',gap:8,marginTop:14}}><button className="btn btn-ghost" onClick={()=>navigate('/schedule')}>View today's plan</button><button className="btn btn-ghost" onClick={()=>navigate('/rewards')}>{parent?'Review rewards':'My rewards'}</button></div>
  </section>
  <DashboardLinks />
  <div className="calm-stats"><div><span>Due for you</span><strong>{myToday.length}</strong></div><div><span>{parent?'Family overdue':'Your overdue'}</span><strong>{overdue.length}</strong></div><div><span>{parent?'Family completed today':'Completed today'}</span><strong>{completed.length}</strong></div></div>
  <section style={{...panel,marginBottom:18}}><div className="calm-section-heading"><h2>Your tasks today</h2><button className="btn btn-ghost" onClick={()=>navigate('/chores')}>Open chores</button></div>
   {isLoading?<p>Loading your tasks…</p>:isError?<p role="alert">Tasks could not load. Please refresh.</p>:!myToday.length?<p className="calm-muted">No assigned tasks due today. You’re up to date.</p>:myToday.map(c=><button className="calm-task" key={c.id} onClick={()=>navigate('/chores')}><span><strong>{c.title}</strong><small>{c.status==='in_progress'?'In progress':c.dueDate?.slice(0,10)<today?'Overdue · review or complete':'Due today'}</small></span><span aria-hidden="true">→</span></button>)}
   {!!myLater.length&&<details style={{marginTop:14}}><summary>{myLater.length} later or unscheduled tasks</summary>{myLater.map(c=><button className="calm-task" key={c.id} onClick={()=>navigate('/chores')}><span>{c.title}<small>{c.dueDate?.slice(0,10)||'No deadline set'}</small></span><span>→</span></button>)}</details>}
  </section>
  {parent&&overdue.length>0&&<div className="calm-attention" style={{marginBottom:18}}><div><strong>{overdue.length} family tasks need a review</strong><p>Keep routines current. Review older tasks and possible duplicates in Settings.</p></div><button className="btn btn-ghost" onClick={()=>navigate('/settings')}>Review tasks</button></div>}
  <RewardGoal />
  <div className="calm-two-columns">
   <section style={panel}><div className="calm-section-heading"><h2>Coming up</h2><button className="btn btn-ghost" onClick={()=>navigate('/schedule')}>Calendar</button></div>{upcoming.length?upcoming.map(e=><div className="calm-row" key={e.id}><strong>{e.title}</strong><small>{(e.date||e.startsAt||'').slice(0,10)}{e.time?' · '+e.time:''}</small></div>):<p className="calm-muted">No upcoming events.</p>}<div className="calm-row"><strong>Tonight’s dinner</strong><p className="calm-muted">{dinner?.name||'Not planned yet'}</p><button className="btn btn-ghost" onClick={()=>navigate('/meals')}>Open meals</button></div></section>
   <section style={panel}><div className="calm-section-heading"><h2>Family messages</h2><button className="btn btn-ghost" onClick={()=>navigate('/chat')}>Open chat</button></div>{recent.length?recent.map(m=><button className="calm-task" key={m.id} onClick={()=>navigate('/chat')}><span><strong>{people.find(p=>p.id===m.memberId)?.name||m.member?.name||'Family'}</strong><small>{(m.text||m.pollQuestion||(m.mediaUrl?'Shared an attachment':'Message')).slice(0,100)}</small></span></button>):<p className="calm-muted">No messages yet.</p>}</section>
  </div>
  <details style={{...panel,marginTop:18}}><summary style={{cursor:'pointer',fontWeight:600}}>More family tools</summary><div className="calm-tools">{[['Rewards','/rewards'],['Games','/games'],['Grocery list','/grocery'],['Weekly insights','/report'],['Quests','/quests'],['Wishlist','/wishlist'],['Trips','/trips'],['Settings','/settings']].map(([label,path])=><button className="btn btn-ghost" key={path} onClick={()=>navigate(path)}>{label}</button>)}</div><p className="calm-muted">Games are available every day. Your family’s screen-time rules stay with you.</p></details>
 </div>;
}
