import { useState, useEffect } from 'react';
import { useEvents, useMembers, useCreateEvent, useDeleteEvent, useChores } from '../hooks/useApi';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMOJIS      = ['📅','🎂','🏥','✈️','🏫','⚽','🎵','🍕','💼','🎉','🏠','🚗','👨‍👩‍👧','💊','🎓','🎭','🏊','🎪'];
const COLORS      = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA','#F87171'];

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

function formatDateLabel(dateStr: string, todayStr: string) {
  if (dateStr === todayStr) return 'Today';
  const d = new Date(dateStr + 'T12:00:00');
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toLocalDateStr(d) === toLocalDateStr(tomorrow)) return 'Tomorrow';
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function daysUntil(dateStr: string, todayStr: string): string {
  const diff = Math.round((new Date(dateStr + 'T12:00:00').getTime() - new Date(todayStr + 'T12:00:00').getTime()) / 86400000);
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7)  return `In ${diff} days`;
  if (diff < 30) return `In ${Math.round(diff/7)}w`;
  return `In ${Math.round(diff/30)}mo`;
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function EventPanel({ selectedDate, todayStr, selectedEvents, upcomingEvents, members, onAdd, onDelete }: {
  selectedDate: string; todayStr: string;
  selectedEvents: any[]; upcomingEvents: any[];
  members: any[]; onAdd: () => void; onDelete: (id: string) => void;
}) {
  const isToday = selectedDate === todayStr;
  const dateLabel = formatDateLabel(selectedDate, todayStr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

      {/* Selected day panel */}
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        {/* Panel header */}
        <div style={{
          padding: '14px 16px',
          background: isToday
            ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(167,139,250,0.12))'
            : 'rgba(255,255,255,0.04)',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: isToday ? '#A78BFA' : 'var(--text)' }}>
              {isToday ? '📌 ' : ''}{dateLabel}
            </div>
            {selectedEvents.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {selectedEvents.length} item{selectedEvents.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <button onClick={onAdd} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800,
            background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(99,102,241,0.35)',
          }}>+ Add</button>
        </div>

        {/* Events for selected day */}
        <div style={{ padding: selectedEvents.length ? '8px 0' : '20px 16px' }}>
          {selectedEvents.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No events — tap + Add</div>
            </div>
          ) : selectedEvents.map((ev: any) => {
            const assignee = (members as any[]).find(m => m.id === ev.assignedToId);
            return (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                {/* Color bar */}
                <div style={{
                  width: 4, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0,
                  background: ev.color || '#6366F1', minHeight: 36,
                }} />
                {/* Emoji */}
                <div style={{
                  width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                  background: (ev.color || '#6366F1') + '22',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 18,
                }}>{ev.emoji || '📅'}</div>
                {/* Info */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {ev.title}
                    </div>
                    {ev.isChore && (
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '2px 6px', borderRadius: 20, flexShrink: 0,
                        background: 'rgba(245,158,11,0.15)', color: '#F59E0B',
                        border: '1px solid rgba(245,158,11,0.3)',
                      }}>chore</span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    {ev.time && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: ev.color || '#A78BFA' }}>
                        🕐 {ev.time}
                      </span>
                    )}
                    {assignee && (
                      <span style={{ fontSize: 11, fontWeight: 700, color: assignee.color }}>
                        {assignee.emoji} {assignee.name}
                      </span>
                    )}
                  </div>
                </div>
                {/* Only show delete for real events, not chores */}
                {!ev.isChore && (
                  <button onClick={() => onDelete(ev.id)} style={{
                    width: 30, height: 30, borderRadius: 8, flexShrink: 0,
                    background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                    color: '#F87171', fontSize: 14, cursor: 'pointer',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming events */}
      <div style={{
        borderRadius: 20, overflow: 'hidden',
        border: '1.5px solid rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.03)',
      }}>
        <div style={{
          padding: '12px 16px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          fontWeight: 900, fontSize: 13, color: 'var(--text-muted)',
          letterSpacing: '0.06em',
        }}>
          📆 UPCOMING
        </div>
        <div style={{ padding: upcomingEvents.length ? '6px 0' : '16px' }}>
          {upcomingEvents.length === 0 ? (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>
              No upcoming events
            </div>
          ) : upcomingEvents.slice(0, 8).map((ev: any) => {
            const evDateStr = toLocalDateStr(new Date(ev.date || ev.dueDate));
            const label = daysUntil(evDateStr, todayStr);
            const isEventToday = evDateStr === todayStr;
            return (
              <div key={ev.id} style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '9px 16px',
                borderBottom: '1px solid rgba(255,255,255,0.04)',
              }}>
                <div style={{
                  width: 4, height: 38, borderRadius: 4, flexShrink: 0,
                  background: ev.color || '#6366F1',
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700, fontSize: 12,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {ev.emoji} {ev.title}
                    {ev.isChore && <span style={{ marginLeft: 4, fontSize: 10, color: '#F59E0B' }}>· chore</span>}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>
                    {ev.time ? `🕐 ${ev.time} · ` : ''}{label}
                  </div>
                </div>
                <div style={{
                  fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, flexShrink: 0,
                  background: isEventToday ? 'rgba(99,102,241,0.2)' : (ev.color || '#6366F1') + '20',
                  color: isEventToday ? '#A78BFA' : (ev.color || '#6366F1'),
                  border: `1px solid ${isEventToday ? 'rgba(99,102,241,0.3)' : (ev.color || '#6366F1') + '40'}`,
                }}>
                  {label}
                </div>
                {!ev.isChore && (
                  <button onClick={() => onDelete(ev.id)} style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    color: 'var(--text-muted)', fontSize: 14, padding: '4px',
                    opacity: 0.5, transition: 'opacity 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
                  onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}
                  >×</button>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function SchedulePage() {
  const { data: events = [], isLoading } = useEvents();
  const { data: chores = [] }            = useChores();
  const { data: members = [] }           = useMembers();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const isMobile    = useIsMobile();

  const today = new Date();
  const [year, setYear]                 = useState(today.getFullYear());
  const [month, setMonth]               = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(today));
  const [showAdd, setShowAdd]           = useState(false);
  const [showPanel, setShowPanel]       = useState(false);
  const [form, setForm] = useState({ title:'', emoji:'📅', time:'', assignedToId:'', notes:'', color:'#6366F1' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const todayStr = toLocalDateStr(today);

  // Convert chores with due dates into calendar-compatible items
  const choreEvents = (chores as any[])
    .filter(c => c.dueDate && c.status !== 'done')
    .map(c => ({
      id:           'chore-' + c.id,
      title:        c.title,
      emoji:        c.emoji || '🧹',
      date:         toLocalDateStr(new Date(c.dueDate)),
      color:        '#F59E0B',
      isChore:      true,
      assignedToId: c.assignedToId,
    }));

  const allItems = [...(events as any[]), ...choreEvents];

  function prevMonth() { if (month===0){setMonth(11);setYear(y=>y-1);}else setMonth(m=>m-1); }
  function nextMonth() { if (month===11){setMonth(0);setYear(y=>y+1);}else setMonth(m=>m+1); }

  function getEventsForDate(day: number) {
    const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
    return allItems.filter(e => { try { return (e.date || '').slice(0,10) === dateStr; } catch { return false; } });
  }

  const selectedEvents = allItems
    .filter(e => { try { return (e.date || '').slice(0,10) === selectedDate; } catch { return false; } })
    .sort((a,b) => (a.time||'').localeCompare(b.time||''));

  const upcomingEvents = allItems
    .filter(e => { try { return (e.date || '').slice(0,10) >= todayStr; } catch { return false; } })
    .sort((a,b) => { try { return new Date(a.date).getTime() - new Date(b.date).getTime(); } catch { return 0; } })
    .slice(0, 10);

  async function handleCreate() {
    if (!form.title.trim()) return;
    await createEvent.mutateAsync({
      title: form.title.trim(), emoji: form.emoji, date: selectedDate,
      time: form.time || undefined, assignedToId: form.assignedToId || undefined,
      notes: form.notes || undefined, color: form.color,
    });
    setForm({ title:'', emoji:'📅', time:'', assignedToId:'', notes:'', color:'#6366F1' });
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
    <div style={{ display:'flex', justifyContent:'center', alignItems:'center', padding: 60 }}>
      <div style={{ width:36, height:36, borderRadius:'50%', border:'3px solid var(--primary)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ width:'100%', maxWidth:1000, paddingBottom:90 }}>
      <style>{`
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        .cal-day:hover { transform: scale(1.02); }
      `}</style>

      {/* ── Header ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900, margin:0 }}>📅 Schedule</h1>
          <p style={{ fontSize:12, color:'var(--text-muted)', margin:'3px 0 0' }}>
            {upcomingEvents.length} upcoming item{upcomingEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding:'10px 20px', borderRadius:12, fontSize:13, fontWeight:800,
          background:'var(--primary)', color:'#fff', border:'none', cursor:'pointer',
          boxShadow:'0 4px 16px rgba(99,102,241,0.35)',
        }}>+ Add Event</button>
      </div>

      <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 290px', gap:20, alignItems:'start' }}>

        {/* ── Calendar ── */}
        <div style={{
          borderRadius:20, overflow:'hidden',
          border:'1.5px solid rgba(255,255,255,0.08)',
          background:'rgba(255,255,255,0.03)',
        }}>
          {/* Month nav */}
          <div style={{
            display:'flex', alignItems:'center', justifyContent:'space-between',
            padding:'16px 20px',
            borderBottom:'1px solid rgba(255,255,255,0.06)',
            background:'rgba(255,255,255,0.03)',
          }}>
            <button onClick={prevMonth} style={{
              width:36, height:36, borderRadius:10, fontSize:16,
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
              color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>←</button>
            <div style={{ fontWeight:900, fontSize:18, letterSpacing:-0.3 }}>
              {MONTH_NAMES[month]} <span style={{ color:'var(--text-muted)', fontWeight:600 }}>{year}</span>
            </div>
            <button onClick={nextMonth} style={{
              width:36, height:36, borderRadius:10, fontSize:16,
              background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.1)',
              color:'var(--text)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
            }}>→</button>
          </div>

          {/* Day headers */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', padding:'10px 12px 4px' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{
                textAlign:'center', fontSize:11, fontWeight:900,
                color:'var(--text-muted)', letterSpacing:'0.06em', padding:'4px 0',
              }}>{d}</div>
            ))}
          </div>

          {/* Day cells */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:3, padding:'0 12px 14px' }}>
            {Array.from({ length: firstDay }).map((_,i) => <div key={'e'+i} />)}
            {Array.from({ length: daysInMonth }, (_,i) => i+1).map(day => {
              const dateStr    = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
              const dayEvents  = getEventsForDate(day);
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isWeekend  = [0,6].includes(new Date(dateStr).getDay());
              const hasEvents  = dayEvents.length > 0;

              return (
                <div
                  key={day}
                  className="cal-day"
                  onClick={() => handleDayClick(dateStr)}
                  style={{
                    minHeight: isMobile ? 48 : 64,
                    padding:'5px 4px 4px',
                    borderRadius:12,
                    cursor:'pointer',
                    position:'relative',
                    border:`1.5px solid ${
                      isSelected ? 'var(--primary)'
                      : isToday   ? 'rgba(99,102,241,0.4)'
                      : hasEvents ? 'rgba(255,255,255,0.08)'
                      : 'transparent'
                    }`,
                    background: isSelected
                      ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(167,139,250,0.15))'
                      : isToday
                        ? 'rgba(99,102,241,0.08)'
                        : hasEvents
                          ? 'rgba(255,255,255,0.04)'
                          : 'transparent',
                    transition:'all 0.12s ease',
                    boxShadow: isSelected ? '0 4px 16px rgba(99,102,241,0.2)' : 'none',
                  }}
                >
                  {/* Day number */}
                  <div style={{
                    fontSize:12, fontWeight: isToday ? 900 : 600, textAlign:'center',
                    color: isSelected ? '#fff'
                          : isToday   ? 'var(--primary)'
                          : isWeekend ? 'rgba(255,255,255,0.5)'
                          : 'var(--text)',
                    marginBottom:3,
                    ...(isToday && {
                      width:22, height:22, borderRadius:'50%',
                      background:'var(--primary)',
                      color:'#fff',
                      display:'flex', alignItems:'center', justifyContent:'center',
                      margin:'0 auto 3px',
                    }),
                  }}>{day}</div>

                  {/* Event pills */}
                  <div style={{ display:'flex', flexDirection:'column', gap:1 }}>
                    {dayEvents.slice(0, isMobile ? 1 : 2).map((ev:any) => (
                      <div key={ev.id} style={{
                        fontSize:9, fontWeight:800,
                        padding:'2px 4px', borderRadius:4,
                        background: ev.color || '#6366F1',
                        color:'#fff',
                        overflow:'hidden', whiteSpace:'nowrap', textOverflow:'ellipsis',
                        lineHeight:1.4,
                      }}>
                        {ev.emoji}{isMobile ? '' : ' '+ev.title}
                      </div>
                    ))}
                    {dayEvents.length > (isMobile ? 1 : 2) && (
                      <div style={{
                        fontSize:9, fontWeight:800, color:'var(--text-muted)',
                        paddingLeft:2,
                      }}>+{dayEvents.length - (isMobile ? 1 : 2)} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Legend */}
          <div style={{
            padding:'10px 20px 14px',
            borderTop:'1px solid rgba(255,255,255,0.06)',
            display:'flex', gap:16, alignItems:'center', flexWrap:'wrap',
          }}>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:'var(--primary)' }} />
              <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>Today</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:12, height:12, borderRadius:3, border:'1.5px solid var(--primary)', background:'rgba(99,102,241,0.2)' }} />
              <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>Selected</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:'#6366F1' }} />
              <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>Event</span>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <div style={{ width:12, height:12, borderRadius:3, background:'#F59E0B' }} />
              <span style={{ fontSize:10, color:'var(--text-muted)', fontWeight:600 }}>Chore due</span>
            </div>
            {isMobile && (
              <span style={{ fontSize:10, color:'var(--text-muted)', marginLeft:'auto' }}>Tap date to view</span>
            )}
          </div>
        </div>

        {/* ── Desktop side panel ── */}
        {!isMobile && (
          <EventPanel
            selectedDate={selectedDate} todayStr={todayStr}
            selectedEvents={selectedEvents} upcomingEvents={upcomingEvents}
            members={members as any[]} onAdd={() => setShowAdd(true)} onDelete={handleDelete}
          />
        )}
      </div>

      {/* ── Mobile bottom sheet ── */}
      {isMobile && showPanel && (
        <>
          <div onClick={() => setShowPanel(false)} style={{
            position:'fixed', inset:0, background:'rgba(0,0,0,0.6)',
            zIndex:200, backdropFilter:'blur(4px)',
          }} />
          <div style={{
            position:'fixed', left:0, right:0, bottom:0, zIndex:201,
            background:'var(--bg)', borderRadius:'24px 24px 0 0',
            border:'1.5px solid rgba(255,255,255,0.1)', borderBottom:'none',
            maxHeight:'80vh', overflowY:'auto',
            padding:'20px 16px 100px',
            boxShadow:'0 -12px 48px rgba(0,0,0,0.5)',
            animation:'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 20px' }} />
            <EventPanel
              selectedDate={selectedDate} todayStr={todayStr}
              selectedEvents={selectedEvents} upcomingEvents={upcomingEvents}
              members={members as any[]}
              onAdd={() => { setShowPanel(false); setShowAdd(true); }}
              onDelete={handleDelete}
            />
          </div>
        </>
      )}

      {/* ── Add event modal ── */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{
          position:'fixed', inset:0, background:'rgba(0,0,0,0.7)',
          display:'flex', alignItems:'flex-end', justifyContent:'center',
          zIndex:300, backdropFilter:'blur(4px)',
          animation:'fadeIn 0.15s ease',
        }}>
          <div onClick={e => e.stopPropagation()} style={{
            width:'100%', maxWidth:500,
            background:'var(--surface, #1a1625)',
            borderRadius:'24px 24px 0 0',
            border:'1.5px solid rgba(255,255,255,0.1)', borderBottom:'none',
            padding:'24px 20px 40px',
            maxHeight:'90vh', overflowY:'auto',
            boxShadow:'0 -16px 60px rgba(0,0,0,0.6)',
            animation:'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)',
          }}>
            {/* Handle */}
            <div style={{ width:40, height:4, borderRadius:2, background:'rgba(255,255,255,0.15)', margin:'0 auto 20px' }} />

            {/* Title */}
            <div style={{ marginBottom:18 }}>
              <div style={{ fontWeight:900, fontSize:17, marginBottom:4 }}>➕ New Event</div>
              <div style={{
                display:'inline-block', fontSize:12, fontWeight:700,
                padding:'4px 12px', borderRadius:20,
                background:'rgba(99,102,241,0.15)', color:'#A78BFA',
                border:'1px solid rgba(99,102,241,0.3)',
              }}>
                {formatDateLabel(selectedDate, todayStr)}
              </div>
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
              {/* Emoji picker */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:8 }}>ICON</label>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6 }}>
                  {EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => setForm(p=>({...p,emoji:e}))} style={{
                      width:38, height:38, borderRadius:10, fontSize:20, cursor:'pointer',
                      background: form.emoji===e ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                      border: `2px solid ${form.emoji===e ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                      transition:'all 0.1s',
                    }}>{e}</button>
                  ))}
                </div>
              </div>

              {/* Title input */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>TITLE</label>
                <input
                  className="input" placeholder="Event title..." autoFocus
                  value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
                  onKeyDown={e=>e.key==='Enter'&&handleCreate()}
                  style={{ width:'100%' }}
                />
              </div>

              {/* Time */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>TIME (optional)</label>
                <input className="input" type="time" value={form.time}
                  onChange={e=>setForm(p=>({...p,time:e.target.value}))}
                  style={{ width:'100%' }} />
              </div>

              {/* Color picker */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:8 }}>COLOR</label>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p=>({...p,color:c}))} style={{
                      width:32, height:32, borderRadius:'50%', background:c, cursor:'pointer',
                      border:`3px solid ${form.color===c ? '#fff' : 'transparent'}`,
                      boxShadow: form.color===c ? `0 0 0 2px ${c}` : 'none',
                      transition:'all 0.15s',
                    }} />
                  ))}
                </div>
              </div>

              {/* Preview pill */}
              <div style={{
                display:'flex', alignItems:'center', gap:10,
                padding:'12px 14px', borderRadius:14,
                background:(form.color || '#6366F1') + '18',
                border:`1.5px solid ${form.color || '#6366F1'}33`,
              }}>
                <div style={{
                  width:8, alignSelf:'stretch', borderRadius:4, minHeight:32,
                  background:form.color || '#6366F1', flexShrink:0,
                }} />
                <div style={{
                  width:36, height:36, borderRadius:10, flexShrink:0,
                  background:(form.color || '#6366F1') + '33',
                  display:'flex', alignItems:'center', justifyContent:'center', fontSize:18,
                }}>{form.emoji}</div>
                <div>
                  <div style={{ fontWeight:800, fontSize:14 }}>{form.title || 'Event title'}</div>
                  {form.time && <div style={{ fontSize:11, color:'var(--text-muted)', marginTop:2 }}>🕐 {form.time}</div>}
                </div>
              </div>

              {/* Assign */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>ASSIGN TO (optional)</label>
                <select className="input" value={form.assignedToId}
                  onChange={e=>setForm(p=>({...p,assignedToId:e.target.value}))}
                  style={{ width:'100%' }}>
                  <option value="">Anyone</option>
                  {(members as any[]).map((m:any) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
              </div>

              {/* Notes */}
              <div>
                <label style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', display:'block', marginBottom:6 }}>NOTES (optional)</label>
                <textarea className="input" placeholder="Add notes..." rows={2}
                  value={form.notes} onChange={e=>setForm(p=>({...p,notes:e.target.value}))}
                  style={{ resize:'vertical', width:'100%' }} />
              </div>

              {/* Actions */}
              <div style={{ display:'flex', gap:10, marginTop:4 }}>
                <button style={{
                  flex:1, padding:'12px', borderRadius:12, fontSize:14, fontWeight:700,
                  background:'rgba(255,255,255,0.07)', border:'1px solid rgba(255,255,255,0.12)',
                  color:'var(--text)', cursor:'pointer',
                }} onClick={()=>setShowAdd(false)}>Cancel</button>
                <button style={{
                  flex:2, padding:'12px', borderRadius:12, fontSize:14, fontWeight:800,
                  background:'var(--primary)', border:'none', color:'#fff', cursor:'pointer',
                  boxShadow:'0 4px 16px rgba(99,102,241,0.4)',
                  opacity: (!form.title.trim() || createEvent.isPending) ? 0.5 : 1,
                }} onClick={handleCreate} disabled={!form.title.trim()||createEvent.isPending}>
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