import { useState } from 'react';
import { useEvents, useCreateEvent, useDeleteEvent, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const EVENT_COLORS = ['#6366f1','#f59e0b','#10b981','#ef4444','#8b5cf6','#ec4899','#14b8a6'];

export default function SchedulePage() {
  const { member } = useAuthStore();
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [selectedDay, setSelectedDay] = useState<number | null>(today.getDate());
  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'month'|'agenda'>('month');
  const [newEvent, setNewEvent] = useState({ title: '', date: '', time: '', color: EVENT_COLORS[0], memberId: '' });

  const { data: events = [] } = useEvents();
  const { data: members = [] } = useMembers();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const isParent = member?.role === 'parent';
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const eventsForDay = (day: number) => {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (events as any[]).filter((e: any) => e.date?.startsWith(dateStr) || e.startsAt?.startsWith(dateStr));
  };

  const selectedEvents = selectedDay ? eventsForDay(selectedDay) : [];

  const allEvents = (events as any[])
    .filter((e: any) => {
      const d = new Date(e.date);
      return d.getFullYear() === year && d.getMonth() === month;
    })
    .sort((a: any, b: any) => new Date(a.date).getTime() - new Date(b.date).getTime());

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>ðŸ“… Schedule</h1>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {/* View toggle */}
          <div style={{ display: 'flex', background: 'var(--bg-secondary)', border: '1.5px solid var(--border)', borderRadius: 10, overflow: 'hidden' }}>
            {(['month','agenda'] as const).map(v => (
              <button key={v} onClick={() => setView(v)} style={{
                padding: '6px 12px', fontSize: 11, fontWeight: 800, cursor: 'pointer', border: 'none',
                background: view === v ? 'var(--primary)' : 'transparent',
                color: view === v ? '#fff' : 'var(--text-secondary)',
              }}>
                {v === 'month' ? 'ðŸ—“ Month' : 'ðŸ“‹ Agenda'}
              </button>
            ))}
          </div>
          {isParent && (
            <button onClick={() => { setNewEvent(p => ({ ...p, date: selectedDay ? `${year}-${String(month+1).padStart(2,'0')}-${String(selectedDay).padStart(2,'0')}` : '' })); setShowAdd(true); }}
              className="btn btn-primary" style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
              + Event
            </button>
          )}
        </div>
      </div>

      {view === 'month' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 16 }}>
          {/* Calendar */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {/* Month nav */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', borderBottom: '1px solid var(--border)' }}>
              <button onClick={prevMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: '4px 8px' }}>â€¹</button>
              <span style={{ fontWeight: 900, fontSize: 15 }}>{MONTHS[month]} {year}</span>
              <button onClick={nextMonth} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-secondary)', padding: '4px 8px' }}>â€º</button>
            </div>
            {/* Day headers */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', textAlign: 'center', padding: '8px 8px 0' }}>
              {DAYS.map(d => (
                <div key={d} style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
              ))}
            </div>
            {/* Days grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2, padding: '4px 8px 12px' }}>
              {Array.from({ length: firstDayOfMonth }).map((_, i) => <div key={`empty-${i}`} />)}
              {Array.from({ length: daysInMonth }).map((_, i) => {
                const day = i + 1;
                const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
                const isSelected = day === selectedDay;
                const dayEvents = eventsForDay(day);
                return (
                  <button key={day} onClick={() => setSelectedDay(day === selectedDay ? null : day)} style={{
                    position: 'relative', padding: '6px 2px', borderRadius: 8, cursor: 'pointer', border: 'none',
                    background: isSelected ? 'var(--primary)' : isToday ? 'rgba(99,102,241,0.12)' : 'transparent',
                    color: isSelected ? '#fff' : isToday ? 'var(--primary)' : 'var(--text-primary)',
                    fontWeight: isToday || isSelected ? 900 : 600, fontSize: 13,
                    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, minHeight: 44
                  }}>
                    {day}
                    {dayEvents.length > 0 && (
                      <div style={{ display: 'flex', gap: 2, flexWrap: 'wrap', justifyContent: 'center' }}>
                        {dayEvents.slice(0, 3).map((e: any, ei: number) => (
                          <div key={ei} style={{ width: 5, height: 5, borderRadius: '50%', background: isSelected ? 'rgba(255,255,255,0.8)' : (e.color || 'var(--primary)') }} />
                        ))}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selected day events */}
          {selectedDay && (
            <div>
              <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 10, color: 'var(--text-secondary)' }}>
                {MONTHS[month]} {selectedDay}
              </div>
              {selectedEvents.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '24px 0', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13 }}>
                  No events. {isParent ? 'Add one!' : ''}
                </div>
              ) : selectedEvents.map((e: any) => (
                <div key={e.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, background: e.color || 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                    {e.time && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>ðŸ• {e.time}</div>}
                    {e.member && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>{e.member.emoji} {e.member.name}</div>}
                  </div>
                  {isParent && (
                    <button onClick={() => { if (confirm('Delete event?')) deleteEvent.mutate(e.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, color: 'var(--text-muted)' }}>ðŸ—‘</button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      ) : (
        /* Agenda view */
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <span style={{ fontWeight: 900, fontSize: 15 }}>{MONTHS[month]} {year}</span>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={prevMonth} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}>â€¹ Prev</button>
              <button onClick={nextMonth} className="btn btn-ghost" style={{ fontSize: 12, padding: '6px 10px' }}>Next â€º</button>
            </div>
          </div>
          {allEvents.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontWeight: 700 }}>
              No events this month.
            </div>
          ) : allEvents.map((e: any) => {
            const d = new Date(e.date);
            return (
              <div key={e.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{ textAlign: 'center', minWidth: 42, flexShrink: 0 }}>
                  <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)' }}>{DAYS[d.getDay()]}</div>
                  <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--primary)', lineHeight: 1 }}>{d.getDate()}</div>
                </div>
                <div style={{ width: 3, alignSelf: 'stretch', borderRadius: 4, background: e.color || 'var(--primary)', flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.title}</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>
                    {e.time ? `ðŸ• ${e.time}` : ''} {e.member ? `Â· ${e.member.emoji} ${e.member.name}` : ''}
                  </div>
                </div>
                {isParent && (
                  <button onClick={() => { if (confirm('Delete event?')) deleteEvent.mutate(e.id); }}
                    style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 16, padding: 4, color: 'var(--text-muted)' }}>ðŸ—‘</button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add event modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>ðŸ“… Add Event</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <input className="input" placeholder="Event title" value={newEvent.title}
                onChange={e => setNewEvent(p => ({ ...p, title: e.target.value }))} autoFocus />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Date</label>
                  <input type="date" className="input" value={newEvent.date}
                    onChange={e => setNewEvent(p => ({ ...p, date: e.target.value }))} />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Time (optional)</label>
                  <input type="time" className="input" value={newEvent.time}
                    onChange={e => setNewEvent(p => ({ ...p, time: e.target.value }))} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>Color</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {EVENT_COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setNewEvent(p => ({ ...p, color: c }))} style={{
                      width: 28, height: 28, borderRadius: '50%', background: c, border: `3px solid ${newEvent.color === c ? 'var(--text-primary)' : 'transparent'}`, cursor: 'pointer'
                    }} />
                  ))}
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Member (optional)</label>
                <select className="input" value={newEvent.memberId}
                  onChange={e => setNewEvent(p => ({ ...p, memberId: e.target.value }))}>
                  <option value="">Everyone</option>
                  {(members as any[]).map((m: any) => (
                    <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                  ))}
                </select>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }}
                  disabled={!newEvent.title.trim() || !newEvent.date || createEvent.isPending}
                  onClick={() => { createEvent.mutate(newEvent); setShowAdd(false); }}>
                  {createEvent.isPending ? 'Adding...' : '+ Add Event'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
