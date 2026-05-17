import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChores, useMembers, useMeals, useEvents, useMessages, useRewards } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function avatarSrc(url?: string | null) { if (!url) return null; return url.startsWith('http') ? url : `${API_BASE}${url}`; }
function getWeekStart() { const d = new Date(); const day = d.getDay(); const diff = d.getDate()-day+(day===0?-6:1); return new Date(d.setDate(diff)).toISOString().split('T')[0]; }
const TODAY_DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
const TODAY_STR = new Date().toISOString().split('T')[0];

function StatCard({ icon, label, value, gradient }: { icon: string; label: string; value: string | number; gradient: string }) {
  return (
    <div className="animate-fadeIn" style={{ padding:16, borderRadius:'var(--radius)', background:gradient, border:'1.5px solid rgba(255,255,255,0.08)' }}>
      <div style={{ fontSize:26, marginBottom:6 }}>{icon}</div>
      <div style={{ fontSize:24, fontWeight:900 }}>{value}</div>
      <div style={{ fontSize:12, fontWeight:800, color:'rgba(255,255,255,0.65)', marginTop:3 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ icon, title, action, onAction }: { icon: string; title: string; action?: string; onAction?: () => void }) {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
      <h2 style={{ fontSize:16, fontWeight:900 }}>{icon} {title}</h2>
      {action && <button onClick={onAction} style={{ fontSize:12, fontWeight:800, color:'var(--primary)', background:'none', border:'none', cursor:'pointer' }}>{action} arrow</button>}
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return <div style={{ textAlign:'center', padding:'20px 0', color:'var(--text-muted)', fontSize:13, fontWeight:700 }}><div style={{ fontSize:30, marginBottom:6 }}>{icon}</div>{text}</div>;
}

export default function DashboardPage() {
  const { member } = useAuthStore();
  const navigate = useNavigate();
  const { data: chores = [] }   = useChores();
  const { data: members = [] }  = useMembers();
  const { data: meals = [] }    = useMeals(getWeekStart());
  const { data: events = [] }   = useEvents();
  const { data: messages = [] } = useMessages();

  const [greeting, setGreeting] = useState('Good day');
  const [tip] = useState(() => {
    const tips = ['Try completing all daily chores for a streak bonus!','Kids who help with chores are more confident at school.','Set a family goal this week — pick a reward together.','Consistent routines reduce family stress significantly.'];
    return tips[Math.floor(Date.now()/86400000) % tips.length];
  });

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning'); else if (h < 17) setGreeting('Good afternoon'); else setGreeting('Good evening');
  }, []);

  const allChores  = chores as any[];
  const allMembers = members as any[];
  const pending    = allChores.filter(c => (c.status||'pending') === 'pending');
  const inProg     = allChores.filter(c => c.status === 'in_progress');
  const doneToday  = allChores.filter(c => c.status === 'done' && c.completedAt?.startsWith(TODAY_STR));
  const tonightMeal = (meals as any[]).find(m => m.day === TODAY_DAY && m.slot === 'dinner');
  const todayEvents = (events as any[]).filter(e => (e.date||e.startsAt||'').startsWith(TODAY_STR));
  const recentMsgs  = [...(messages as any[])].reverse().slice(0, 3);
  const leaderboard = [...allMembers].sort((a,b) => (b.stars||0)-(a.stars||0)).slice(0,5);

  const activity: { icon:string; text:string; color:string }[] = [];
  allChores.filter(c=>c.status==='done'&&c.completedAt).sort((a,b)=>new Date(b.completedAt).getTime()-new Date(a.completedAt).getTime()).slice(0,3).forEach(c=>{
    const who = allMembers.find(m=>m.id===c.completedById);
    activity.push({ icon:c.emoji||'checkmark', text:`${who?.name||'Someone'} completed "${c.title}"`, color:'#4ADE80' });
  });
  recentMsgs.slice(0,2).forEach(msg=>{
    const who = allMembers.find(m=>m.id===msg.memberId);
    activity.push({ icon:'speech-balloon', text:`${who?.name||'Family'}: "${(msg.content||'').slice(0,50)}"`, color:'#7C6FF7' });
  });

  return (
    <div style={{ width:'100%', maxWidth:1100 }} className="animate-fadeIn">

      {/* Greeting */}
      <div style={{ marginBottom:24 }}>
        <h1 style={{ fontSize:26, fontWeight:900 }}>{greeting}, {member?.name?.split(' ')[0]||'Friend'} {member?.emoji||'wave'}</h1>
        <p style={{ color:'var(--text-secondary)', fontSize:14, marginTop:4 }}>
          {new Date().toLocaleDateString('en-US',{ weekday:'long', month:'long', day:'numeric' })}
        </p>
      </div>

      {/* AI tip */}
      <div style={{ marginBottom:24, padding:'13px 18px', borderRadius:'var(--radius)', background:'linear-gradient(135deg,rgba(124,111,247,0.15),rgba(167,139,250,0.08))', border:'1.5px solid rgba(124,111,247,0.25)', display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>robot</span>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:11, fontWeight:900, color:'var(--primary)', textTransform:'uppercase', letterSpacing:0.8, marginBottom:2 }}>AI Insight</div>
          <div style={{ fontSize:13, fontWeight:700 }}>{tip}</div>
        </div>
        <button onClick={() => navigate('/chat')} className="btn btn-primary" style={{ fontSize:12, padding:'7px 14px', flexShrink:0 }}>Ask AI</button>
      </div>

      {/* Stats */}
      <div className="stagger" style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(130px,1fr))', gap:10, marginBottom:24 }}>
        <StatCard icon="timer" label="Pending chores"    value={pending.length}    gradient="linear-gradient(135deg,rgba(251,191,36,0.18),rgba(245,158,11,0.06))" />
        <StatCard icon="fire"  label="In progress"       value={inProg.length}     gradient="linear-gradient(135deg,rgba(251,146,60,0.18),rgba(244,114,182,0.06))" />
        <StatCard icon="check" label="Done today"        value={doneToday.length}  gradient="linear-gradient(135deg,rgba(74,222,128,0.18),rgba(16,185,129,0.06))"  />
        <StatCard icon="cal"   label="Events today"      value={todayEvents.length} gradient="linear-gradient(135deg,rgba(56,189,248,0.18),rgba(99,102,241,0.06))"  />
        <StatCard icon="star"  label="Your stars"        value={member?.stars||0}  gradient="linear-gradient(135deg,rgba(124,111,247,0.18),rgba(167,139,250,0.06))" />
      </div>

      {/* Main grid */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))', gap:16 }}>

        {/* Pending chores */}
        <div className="card animate-fadeIn">
          <SectionTitle icon="checkmark" title="Today's Chores" action="View all" onAction={() => navigate('/chores')} />
          {pending.length===0 && inProg.length===0
            ? <Empty icon="tada" text="All caught up! Great work." />
            : <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {[...inProg,...pending].slice(0,4).map((c:any) => {
                  const a = allMembers.find(m=>m.id===c.assignedToId);
                  return (
                    <div key={c.id} onClick={()=>navigate('/chores')} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background:'var(--bg-secondary)', cursor:'pointer', border:'1.5px solid var(--border)' }}>
                      <span style={{ fontSize:20 }}>{c.emoji}</span>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:800, fontSize:13 }}>{c.title}</div>
                        <div style={{ fontSize:11, color:'var(--text-muted)' }}>{a?.name||'Anyone'} · stars{c.stars}</div>
                      </div>
                      <span style={{ fontSize:10, fontWeight:900, padding:'3px 8px', borderRadius:20, background: c.status==='in_progress'?'rgba(251,191,36,0.15)':'var(--bg-tertiary)', color: c.status==='in_progress'?'#FBBF24':'var(--text-muted)' }}>
                        {c.status==='in_progress'?'Active':'pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Meal + Events */}
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          <div className="card card-peach animate-fadeIn">
            <SectionTitle icon="fork-and-knife" title="Tonight's Dinner" action="Plan" onAction={()=>navigate('/meals')} />
            {tonightMeal
              ? <div style={{ display:'flex', alignItems:'center', gap:14 }}><span style={{ fontSize:40 }}>{tonightMeal.emoji}</span><div><div style={{ fontWeight:900, fontSize:16 }}>{tonightMeal.name}</div></div></div>
              : <Empty icon="cooking" text="No dinner planned yet." />
            }
          </div>
          <div className="card card-sky animate-fadeIn">
            <SectionTitle icon="calendar" title="Today's Events" action="Calendar" onAction={()=>navigate('/schedule')} />
            {todayEvents.length===0
              ? <Empty icon="mailbox" text="Nothing scheduled today." />
              : todayEvents.slice(0,3).map((ev:any)=>(
                  <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:9, background:'rgba(255,255,255,0.04)', marginBottom:6 }}>
                    <span style={{ fontSize:18 }}>{ev.emoji||'calendar'}</span>
                    <div><div style={{ fontWeight:800, fontSize:13 }}>{ev.title}</div>{ev.time&&<div style={{ fontSize:11, color:'var(--text-muted)' }}>{ev.time}</div>}</div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card animate-fadeIn">
          <SectionTitle icon="trophy" title="Family Leaderboard" action="Rewards" onAction={()=>navigate('/rewards')} />
          {leaderboard.length===0 ? <Empty icon="family" text="No members yet." /> :
            leaderboard.map((m:any, i:number) => {
              const src = avatarSrc(m.avatarUrl);
              const medals=['gold-medal','silver-medal','bronze-medal','4','5'];
              return (
                <div key={m.id} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:10, background: i===0?'rgba(251,191,36,0.08)':'var(--bg-secondary)', border:`1.5px solid ${i===0?'rgba(251,191,36,0.2)':'var(--border)'}`, marginBottom:6 }}>
                  <span style={{ fontSize:18, width:24, textAlign:'center' }}>{['🥇','🥈','🥉','4️⃣','5️⃣'][i]}</span>
                  <div style={{ width:30, height:30, borderRadius:'50%', background:m.color, display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, overflow:'hidden', flexShrink:0 }}>
                    {src ? <img src={src} alt={m.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : m.emoji}
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:900, fontSize:13, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}{m.id===member?.id?' (you)':''}</div>
                    <div style={{ fontSize:11, color:'var(--text-muted)' }}>stars {m.stars||0} {(m.streakDays||0)>0?`fire${m.streakDays}`:''}</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* Recent messages */}
        <div className="card animate-fadeIn">
          <SectionTitle icon="speech-balloon" title="Recent Messages" action="Open chat" onAction={()=>navigate('/chat')} />
          {recentMsgs.length===0 ? <Empty icon="thought-balloon" text="No messages yet. Say hello!" /> :
            recentMsgs.map((msg:any)=>{
              const sender = allMembers.find(m=>m.id===msg.memberId);
              const src = avatarSrc(sender?.avatarUrl);
              return (
                <div key={msg.id} style={{ display:'flex', alignItems:'flex-start', gap:9, marginBottom:10 }}>
                  <div style={{ width:28, height:28, borderRadius:'50%', background:sender?.color||'var(--primary)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, overflow:'hidden' }}>
                    {src ? <img src={src} alt={sender?.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : sender?.emoji||'person'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:11, fontWeight:900, color:sender?.color||'var(--primary)', marginBottom:2 }}>{sender?.name||'Family'}</div>
                    <div style={{ fontSize:13, fontWeight:600, color:'var(--text-secondary)' }}>{(msg.content||'').slice(0,80)}</div>
                  </div>
                </div>
              );
            })
          }
        </div>

        {/* Activity feed */}
        <div className="card animate-fadeIn" style={{ gridColumn:'1 / -1' }}>
          <SectionTitle icon="lightning" title="Family Activity" />
          {activity.length===0 ? <Empty icon="seedling" text="Activity will appear here as your family gets going!" /> :
            <div style={{ display:'flex', flexWrap:'wrap', gap:10 }}>
              {activity.map((a,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:8, padding:'9px 14px', borderRadius:20, background:'var(--bg-secondary)', border:`1.5px solid ${a.color}22`, fontSize:13, fontWeight:700 }}>
                  <span style={{ fontSize:16 }}>{a.icon}</span>
                  <span style={{ color:'var(--text-secondary)' }}>{a.text}</span>
                </div>
              ))}
            </div>
          }
        </div>

      </div>
    </div>
  );
}
