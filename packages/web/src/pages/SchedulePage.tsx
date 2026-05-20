import { useState, useEffect } from 'react';
import { useEvents, useMembers, useCreateEvent, useDeleteEvent } from '../hooks/useApi';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMOJIS      = ['??','??','??','??','??','?','??','??','??','??','??','??','????????','??','??'];
const COLORS      = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA'];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

// Extracted as a proper top-level component to avoid React crash
function EventPanel({ selectedDate, todayStr, selectedEvents, upcomingEvents, members, onAdd, onDelete }: {
  selectedDate: string; todayStr: string;
  selectedEvents: any[]; upcomingEvents: any[];
  members: any[]; onAdd: () => void; onDelete: (id: string) => void;
}) {
  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div className="card">
        <div style={{ fontWeight:900, fontSize:13, marginBottom:10, color:'var(--text-secondary)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <span>
            {selectedDate === todayStr
              ? '?? Today'
              : new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday:'short', month:'short', day:'numeric' })}
          </span>
          <button onClick={onAdd} style={{ fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:20, background:'var(--primary)', color:'#fff', border:'none', cursor:'pointer' }}>
            + Add
          </button>
        </div>

        {selectedEvents.length === 0 ? (
          <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:700, padding:'8px 0', textAlign:'center' }}>
            No events � tap + Add
          </div>
        ) : selectedEvents.map((ev: any) => {
          const assignee = members.find((m: any) => m.id === ev.assignedToId);
          return (
            <div key={ev.id} style={{ display:'flex', alignItems:'flex-start', gap:8, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:3, alignSelf:'stretch', borderRadius:2, flexShrink:0, background:ev.color || 'var(--primary)', minHeight:32 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:13 }}>{ev.emoji} {ev.title}</div>
                {ev.time && <div style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700, marginTop:2 }}>?? {ev.time}</div>}
                {assignee && <div style={{ fontSize:11, fontWeight:700, color:assignee.color, marginTop:2 }}>{assignee.emoji} {assignee.name}</div>}
              </div>
              <button
                onClick={() => onDelete(ev.id)}
                style={{ background:'rgba(248,113,113,0.1)', border:'1px solid rgba(248,113,113,0.25)', borderRadius:8, cursor:'pointer', color:'#F87171', fontSize:13, padding:'6px 8px', flexShrink:0 }}
              >???</button>
            </div>
          );
        })}
      </div>

      <div className="card">
        <div style={{ fontWeight:900, fontSize:13, marginBottom:10, color:'var(--text-secondary)' }}>?? Upcoming</div>
        {upcomingEvents.length === 0 ? (
          <div style={{ fontSize:12, color:'var(--text-muted)', fontWeight:700 }}>No upcoming events</div>
        ) : upcomingEvents.map((ev: any) => {
          const d = new Date(ev.date + 'T12:00:00');
          const dateLabel = d.toISOString().slice(0,10) === todayStr ? 'Today'
            : d.toLocaleDateString('en-US', { month:'short', day:'numeric' });
          return (
            <div key={ev.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 0', borderBottom:'1px solid var(--border)' }}>
              <div style={{ width:3, height:36, borderRadius:2, background:ev.color || 'var(--primary)', flexShrink:0 }} />
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ fontWeight:800, fontSize:12, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ev.emoji} {ev.title}</div>
                <div style={{ fontSize:10, color:'var(--text-muted)', fontWeight:700 }}>{dateLabel}{ev.time ? ' � ' + ev.time : ''}</div>
              </div>
              <button onClick={() => onDelete(ev.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:13, padding:4 }}>???</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function SchedulePage() {
  const { data: events = [], isLoading } = useEvents();
  const { data: members = [] }           = useMembers();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const isMobile    = useIsMobile();

  const today = new Date();
  const [year, setYear]                 = useState(today.getFullYear());
  const [month, setMonth]               = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));
  const [showAdd, setShowAdd]           = useState(false);
  const [showPanel, setShowPanel]       = useState(false);
  const [form, setForm] = useState({ title:'', emoji:'??', time:'', assignedToId:'', notes:'', color:'#6366F1' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const todayStr    = today.toISOString().slice(0, 10);

  function prevMonth() { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  function getEventsForDate(day: number) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return (events as any[]).filter(e => new Date(e.date).toISOString().slice(0,10) === dateStr);
  }

  const selectedEvents = (events as any[])
    .filter(e => new Date(e.date).toISOString().slice(0,10) === selectedDate)
    .sort((a,b) => (a.time||'').localeCompare(b.time||''));

  const upcomingEvents = (events as any[])
    .filter(e => new Date(e.date).toISOString().slice(0,10) >= todayStr)
    .sort((a,b) => { const da = new Date(a.date); const db = new Date(b.date); return (isNaN(da.getTime())?0:da.getTime()) - (isNaN(db.getTime())?0:db.getTime()); })
    .slice(0, 10);

  async function handleCreate() {
    if (!form.title.trim()) return;
    await createEvent.mutateAsync({
      title: form.title.trim(), emoji: form.emoji, date: selectedDate,
      time: form.time || undefined, assignedToId: form.assignedToId || undefined,
      notes: form.notes || undefined, color: form.color,
    });
    setForm({ title:'', emoji:'??', time:'', assignedToId:'', notes:'', color:'#6366F1' });
    setShowAdd(false);
  }

  function handleDayClick(dateStr: string) {
    setSelectedDate(dateStr);
    setShowAdd(false);
    if (isMobile) setShowPanel(true);
  }

  function handleDelete(id: string) {
    if (window.confirm('Delete this event?')) deleteEvent.mutate(id);
  }

  if (isLoading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
      <div style={{ width:32, height:32, borderRadius:'50%', border:'3px solid var(--primary)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ width:'100%', maxWidth:900, paddingBottom:90 }}>
      <style>{`@keyframes slideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}`}</style>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <h1 style={{ fontSize:22, fontWeight:900 }}>?? Schedule</h1>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize:13 }}>+ Add Event</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 300px', gap:20 }}>
        {/* Calendar */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
            <button onClick={prevMonth} className="btn btn-ghost" style={{ padding:'6px 12px', fontSize:13 }}>? Prev</button>
            <div style={{ fontWeight:900, fontSize:16 }}>{MONTH_NAMES[month]} {year}</div>
            <button onClick={nextMonth} className="btn btn-ghost" style={{ padding:'6px 12px', fontSize:13 }}>Next ?</button>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign:'center', fontSize:11, fontWeight:900, color:'var(--text-muted)', padding:'4px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3 }}>
            {Array.from({ length: firstDay }).map((_,i) => <div key={'e'+i} />)}
            {Array.from({ length: daysInMonth }, (_,i) => i+1).map(day => {
              const dateStr    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayEvents  = getEventsForDate(day);
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <div key={day} onClick={() => handleDayClick(dateStr)} style={{
                  minHeight: isMobile ? 44 : 56, padding:'4px', borderRadius:10, cursor:'pointer',
                  border:`2px solid ${isSelected ? 'var(--primary)' : isToday ? 'rgba(124,111,247,0.3)' : 'transparent'}`,
                  background: isSelected ? 'rgba(124,111,247,0.15)' : isToday ? 'rgba(124,111,247,0.05)' : 'var(--bg-secondary)',
                  transition:'all 0.1s',
                }}>
                  <div style={{ fontSize:12, fontWeight:isToday?900:700, color:isToday?'var(--primary)':'var(--text-primary)', marginBottom:2 }}>{day}</div>
                  {dayEvents.slice(0, isMobile?1:2).map((ev:any) => (
                    <div key={ev.id} style={{ fontSize:9, fontWeight:800, padding:'1px 3px', borderRadius:3, background:ev.color||'var(--primary)', color:'#fff', marginBottom:1, overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis' }}>
                      {ev.emoji}{isMobile ? '' : ' '+ev.title}
                    </div>
                  ))}
                  {dayEvents.length > (isMobile?1:2) && (
                    <div style={{ fontSize:9, color:'var(--text-muted)', fontWeight:700 }}>+{dayEvents.length-(isMobile?1:2)}</div>
                  )}
                </div>
              );
            })}
          </div>

          {isMobile && (
            <div style={{ textAlign:'center', fontSize:11, color:'var(--text-muted)', fontWeight:700, marginTop:12 }}>
              Tap a date to see events
            </div>
          )}
        </div>

        {/* Desktop right panel */}
        {!isMobile && (
          <EventPanel
            selectedDate={selectedDate} todayStr={todayStr}
            selectedEvents={selectedEvents} upcomingEvents={upcomingEvents}
            members={members as any[]} onAdd={() => setShowAdd(true)} onDelete={handleDelete}
          />
        )}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && showPanel && (
        <>
          <div onClick={() => setShowPanel(false)} style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:200, backdropFilter:'blur(2px)' }} />
          <div style={{ position:'fixed', left:0, right:0, bottom:0, background:'var(--bg)', zIndex:201, borderRadius:'24px 24px 0 0', border:'1.5px solid var(--border)', borderBottom:'none', maxHeight:'75vh', overflowY:'auto', padding:'20px 16px 100px', boxShadow:'0 -8px 40px rgba(0,0,0,0.4)', animation:'slideUp 0.3s ease' }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'var(--border)', margin:'0 auto 16px' }} />
            <EventPanel
              selectedDate={selectedDate} todayStr={todayStr}
              selectedEvents={selectedEvents} upcomingEvents={upcomingEvents}
              members={members as any[]} onAdd={() => { setShowPanel(false); setShowAdd(true); }} onDelete={handleDelete}
            />
          </div>
        </>
      )}

      {/* Add event modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight:900, fontSize:16, marginBottom:16 }}>
              ? New Event � {new Date(selectedDate+'T12:00:00').toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'})}
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
              <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                {EMOJIS.map(e => (
                  <button type="button" key={e} onClick={() => setForm(p=>({...p,emoji:e}))} style={{ fontSize:18, width:36, height:36, borderRadius:8, cursor:'pointer', border:`2px solid ${form.emoji===e?'var(--primary)':'var(--border)'}`, background:'var(--bg-secondary)' }}>{e}</button>
                ))}
              </div>
              <input className="input" placeholder="Event title" autoFocus value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))} onKeyDown={e=>e.key==='Enter'&&handleCreate()} />
              <input className="input" type="time" value={form.time} onChange={e=>setForm(p=>({...p,time:e.target.value}))} />
              <div style={{ display:'flex', gap:8 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p=>({...p,color:c}))} style={{ width:28, height:28, borderRadius:'50%', background:c, cursor:'pointer', border:`3px solid ${form.color===c?'#fff':'transparent'}` }} />
                ))}
              </div>
              <select className="input" value={form.assignedToId} onChange={e=>setForm(p=>({...p,assignedToId:e.target.value}))}>
                <option value="">Assign to anyone</option>
                {(members as any[]).map((m:any) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
              </select>
              <textarea className="input" placeholder="Notes (optional)" rows={2} value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))} style={{ resize:'vertical' }} />
              <div style={{ display:'flex', gap:10 }}>
                <button className="btn btn-ghost" style={{ flex:1 }} onClick={()=>setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex:2 }} onClick={handleCreate} disabled={!form.title.trim()||createEvent.isPending}>
                  {createEvent.isPending ? 'Saving...' : '+ Add Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
