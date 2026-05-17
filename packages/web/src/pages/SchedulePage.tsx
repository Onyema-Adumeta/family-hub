import { useState } from 'react';
import { useEvents, useMembers, useCreateEvent, useDeleteEvent } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

export default function SchedulePage() {
  const { member } = useAuthStore();
  const { data: events = [], isLoading } = useEvents();
  const { data: members = [] } = useMembers();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(today.toISOString().slice(0, 10));
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ title: '', emoji: '📅', time: '', assignedToId: '', notes: '', color: '#6366F1' });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay = new Date(year, month, 1).getDay();
  const todayStr = today.toISOString().slice(0, 10);

  function prevMonth() {
    if (month === 0) { setMonth(11); setYear(y => y - 1); }
    else setMonth(m => m - 1);
  }
  function nextMonth() {
    if (month === 11) { setMonth(0); setYear(y => y + 1); }
    else setMonth(m => m + 1);
  }

  function getEventsForDate(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return (events as any[]).filter(e => {
      const d = new Date(e.date);
      return d.toISOString().slice(0, 10) === dateStr;
    });
  }

  const selectedEvents = (events as any[]).filter(e => {
    return new Date(e.date).toISOString().slice(0, 10) === selectedDate;
  }).sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const upcomingEvents = (events as any[])
    .filter(e => new Date(e.date).toISOString().slice(0, 10) >= todayStr)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    .slice(0, 10);

  async function handleCreate() {
    if (!form.title.trim()) return;
    await createEvent.mutateAsync({
      title: form.title.trim(),
      emoji: form.emoji,
      date: selectedDate,
      time: form.time || undefined,
      assignedToId: form.assignedToId || undefined,
      notes: form.notes || undefined,
      color: form.color,
    });
    setForm({ title: '', emoji: '📅', time: '', assignedToId: '', notes: '', color: '#6366F1' });
    setShowAdd(false);
  }

  const EMOJIS = ['📅','🎂','🏥','✈️','🏫','⚽','🎵','🍕','💼','🎉','🏠','🚗','👨‍👩‍👧','💊','🎓'];
  const COLORS = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA'];

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ maxWidth: 800 }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>📅 Schedule</h1>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize: 13 }}>+ Add Event</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20 }}>
        {/* Calendar */}
        <div>
          {/* Month nav */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
            <button onClick={prevMonth} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }}>← Prev</button>
            <div style={{ fontWeight: 900, fontSize: 16 }}>{MONTH_NAMES[month]} {year}</div>
            <button onClick={nextMonth} className="btn btn-ghost" style={{ padding: '6px 12px', fontSize: 13 }}>Next →</button>
          </div>

          {/* Day headers */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: 4 }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          {/* Calendar grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 2 }}>
            {Array.from({ length: firstDay }).map((_, i) => (
              <div key={'e' + i} />
            ))}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents = getEventsForDate(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              return (
                <div
                  key={day}
                  onClick={() => { setSelectedDate(dateStr); setShowAdd(false); }}
                  style={{
                    minHeight: 52, padding: '4px', borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${isSelected ? 'var(--primary)' : isToday ? 'rgba(99,102,241,0.3)' : 'transparent'}`,
                    background: isSelected ? 'rgba(99,102,241,0.15)' : isToday ? 'rgba(99,102,241,0.05)' : 'var(--bg-secondary)',
                    transition: 'all 0.1s',
                  }}
                >
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 900 : 700,
                    color: isToday ? 'var(--primary)' : 'var(--text-primary)',
                    marginBottom: 2,
                  }}>{day}</div>
                  {dayEvents.slice(0, 2).map((ev: any) => (
                    <div key={ev.id} style={{
                      fontSize: 9, fontWeight: 800, padding: '1px 3px', borderRadius: 3,
                      background: ev.color || 'var(--primary)', color: '#fff',
                      marginBottom: 1, overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                    }}>{ev.emoji} {ev.title}</div>
                  ))}
                  {dayEvents.length > 2 && (
                    <div style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 700 }}>+{dayEvents.length - 2}</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right panel */}
        <div>
          {/* Selected day events */}
          <div className="card" style={{ marginBottom: 12 }}>
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>
              {selectedDate === todayStr ? '📌 Today' : selectedDate}
            </div>
            {selectedEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, padding: '8px 0' }}>
                No events — <span style={{ color: 'var(--primary)', cursor: 'pointer' }} onClick={() => setShowAdd(true)}>add one</span>
              </div>
            ) : selectedEvents.map((ev: any) => {
              const assignee = (members as any[]).find(m => m.id === ev.assignedToId);
              return (
                <div key={ev.id} style={{
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  padding: '8px 0', borderBottom: '1px solid var(--border)',
                }}>
                  <div style={{
                    width: 3, alignSelf: 'stretch', borderRadius: 2, flexShrink: 0,
                    background: ev.color || 'var(--primary)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{ev.emoji} {ev.title}</div>
                    {ev.time && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>🕐 {ev.time}</div>}
                    {assignee && <div style={{ fontSize: 11, fontWeight: 700, color: assignee.color }}>{assignee.emoji} {assignee.name}</div>}
                  </div>
                  {member?.role === 'parent' && (
                    <button onClick={() => { if (confirm('Delete event?')) deleteEvent.mutate(ev.id); }}
                      style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 13, padding: 2 }}>🗑️</button>
                  )}
                </div>
              );
            })}
          </div>

          {/* Upcoming */}
          <div className="card">
            <div style={{ fontWeight: 900, fontSize: 13, marginBottom: 10, color: 'var(--text-secondary)' }}>📆 Upcoming</div>
            {upcomingEvents.length === 0 ? (
              <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700 }}>No upcoming events</div>
            ) : upcomingEvents.map((ev: any) => {
              const d = new Date(ev.date);
              const dateLabel = d.toISOString().slice(0, 10) === todayStr ? 'Today' : d.toLocaleDateString('en', { month: 'short', day: 'numeric' });
              return (
                <div key={ev.id} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
                  <div style={{ width: 3, height: 32, borderRadius: 2, background: ev.color || 'var(--primary)', flexShrink: 0 }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 12 }}>{ev.emoji} {ev.title}</div>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{dateLabel}{ev.time ? ' · ' + ev.time : ''}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Add event modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>➕ New Event — {selectedDate}</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Emoji picker */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {EMOJIS.map(e => (
                  <button type="button" key={e} onClick={() => setForm(p => ({ ...p, emoji: e }))} style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${form.emoji === e ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'var(--bg-secondary)',
                  }}>{e}</button>
                ))}
              </div>

              <input className="input" placeholder="Event title" autoFocus
                value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
                onKeyDown={e => e.key === 'Enter' && handleCreate()}
              />

              <input className="input" type="time" value={form.time}
                onChange={e => setForm(p => ({ ...p, time: e.target.value }))}
              />

              {/* Color picker */}
              <div style={{ display: 'flex', gap: 8 }}>
                {COLORS.map(c => (
                  <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} style={{
                    width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
                    border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`,
                  }} />
                ))}
              </div>

              {/* Assign to */}
              <select className="input" value={form.assignedToId}
                onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))}>
                <option value="">Anyone</option>
                {(members as any[]).map((m: any) => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                ))}
              </select>

              <textarea className="input" placeholder="Notes (optional)" rows={2}
                value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                style={{ resize: 'vertical' }}
              />

              <div className="flex gap-3">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleCreate}
                  disabled={!form.title.trim() || createEvent.isPending}>
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