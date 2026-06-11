import { useState, useEffect } from 'react';
import { useEvents, useMembers, useCreateEvent, useDeleteEvent } from '../hooks/useApi';
import { api } from '../lib/api';

const MONTH_NAMES = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const DAY_NAMES   = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const EMOJIS      = ['📅','🎂','🏥','✈️','🏫','⚽','🎵','🍕','💼','🎉','🏠','🚗','👨‍👩‍👧','💊','🎓','🎭','🏊','🎪'];
const COLORS      = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C','#A78BFA','#F87171'];

function toLocalDateStr(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

// Strip corrupted/mojibake emoji (e.g. Google imports showing "8Y...")
function cleanEmoji(emoji?: string): string {
  if (!emoji) return '📅';
  if (/^[\x00-\x7F]/.test(emoji)) return '📅';
  return emoji;
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

function parseEventDate(dateStr: string): string {
  if (!dateStr) return '';
  return dateStr.slice(0, 10);
}

function formatDateLabel(dateStr: string, todayStr: string) {
  if (dateStr === todayStr) return 'Today';
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  if (toLocalDateStr(date) === toLocalDateStr(tomorrow)) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
}

function daysUntil(dateStr: string, todayStr: string): string {
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const [ey, em, ed] = dateStr.split('-').map(Number);
  const todayMs = new Date(ty, tm - 1, td).getTime();
  const eventMs = new Date(ey, em - 1, ed).getTime();
  const diff = Math.round((eventMs - todayMs) / 86400000);
  if (diff < 0)  return `${Math.abs(diff)}d ago`;
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  if (diff < 7)  return `In ${diff} days`;
  if (diff < 30) return `In ${Math.round(diff / 7)}w`;
  return `In ${Math.round(diff / 30)}mo`;
}

// ─── Side Panel ───────────────────────────────────────────────────────────────
function EventPanel({ selectedDate, todayStr, selectedEvents, upcomingEvents, members, onAdd, onDelete, onDetail }: {
  selectedDate: string; todayStr: string;
  selectedEvents: any[]; upcomingEvents: any[];
  members: any[]; onAdd: () => void; onDelete: (id: string) => void; onDetail: (ev: any) => void;
}) {
  const isToday = selectedDate === todayStr;
  const dateLabel = formatDateLabel(selectedDate, todayStr);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ borderRadius: 20, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ padding: '14px 16px', background: isToday ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(167,139,250,0.12))' : 'rgba(255,255,255,0.04)', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: 15, color: isToday ? '#A78BFA' : 'var(--text)' }}>
              {isToday ? '📌 ' : ''}{dateLabel}
            </div>
            {selectedEvents.length > 0 && (
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                {selectedEvents.length} event{selectedEvents.length !== 1 ? 's' : ''}
              </div>
            )}
          </div>
          <button onClick={onAdd} style={{ padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.35)' }}>+ Add</button>
        </div>
        <div style={{ padding: selectedEvents.length ? '8px 0' : '20px 16px' }}>
          {selectedEvents.length === 0 ? (
            <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>📭</div>
              <div style={{ fontSize: 12, fontWeight: 600 }}>No events — tap + Add</div>
            </div>
          ) : selectedEvents.map((ev: any) => {
            const assignee = (members as any[]).find(m => m.id === ev.assignedToId);
            const isGoogle = ev.source === 'google';
            return (
              <div key={ev.id} onClick={() => onDetail(ev)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', cursor: 'pointer' }}>
                <div style={{ width: 4, alignSelf: 'stretch', borderRadius: 4, flexShrink: 0, background: ev.color || '#6366F1', minHeight: 36 }} />
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: (ev.color || '#6366F1') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{cleanEmoji(ev.emoji)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ev.title}</div>
                  <div style={{ display: 'flex', gap: 8, marginTop: 3, flexWrap: 'wrap' }}>
                    {ev.time && <span style={{ fontSize: 11, fontWeight: 700, color: ev.color || '#A78BFA' }}>🕐 {ev.time}</span>}
                    {assignee && <span style={{ fontSize: 11, fontWeight: 700, color: assignee.color }}>{assignee.emoji} {assignee.name}</span>}
                    {isGoogle && <span style={{ fontSize: 10, fontWeight: 700, color: '#4285F4', background: 'rgba(66,133,244,0.1)', padding: '1px 6px', borderRadius: 4 }}>Google</span>}
                  </div>
                </div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }} style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', fontSize: 14, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ borderRadius: 20, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)', fontWeight: 900, fontSize: 13, color: 'var(--text-muted)', letterSpacing: '0.06em' }}>
          📆 UPCOMING
        </div>
        <div style={{ padding: upcomingEvents.length ? '6px 0' : '16px' }}>
          {upcomingEvents.length === 0 ? (
            <div style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', fontWeight: 600 }}>No upcoming events</div>
          ) : upcomingEvents.map((ev: any) => {
            const evDateStr = parseEventDate(ev.date);
            const label = daysUntil(evDateStr, todayStr);
            const isEventToday = evDateStr === todayStr;
            const isPast = evDateStr < todayStr;
            return (
              <div key={ev.id} onClick={() => onDetail(ev)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', borderBottom: '1px solid rgba(255,255,255,0.04)', opacity: isPast ? 0.5 : 1, cursor: 'pointer' }}>
                <div style={{ width: 4, height: 38, borderRadius: 4, flexShrink: 0, background: ev.color || '#6366F1' }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 12, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{cleanEmoji(ev.emoji)} {ev.title}</div>
                  <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 2 }}>{ev.time ? `🕐 ${ev.time} · ` : ''}{label}</div>
                </div>
                <div style={{ fontSize: 10, fontWeight: 800, padding: '3px 8px', borderRadius: 20, flexShrink: 0, background: isEventToday ? 'rgba(99,102,241,0.2)' : isPast ? 'rgba(255,255,255,0.05)' : (ev.color || '#6366F1') + '20', color: isEventToday ? '#A78BFA' : isPast ? 'var(--text-muted)' : (ev.color || '#6366F1'), border: `1px solid ${isEventToday ? 'rgba(99,102,241,0.3)' : isPast ? 'rgba(255,255,255,0.08)' : (ev.color || '#6366F1') + '40'}` }}>{label}</div>
                <button onClick={(e) => { e.stopPropagation(); onDelete(ev.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: '4px', opacity: 0.5 }} onMouseEnter={e => (e.currentTarget.style.opacity = '1')} onMouseLeave={e => (e.currentTarget.style.opacity = '0.5')}>×</button>
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
  const { data: events = [], isLoading, refetch } = useEvents();
  const { data: members = [] }                    = useMembers();
  const createEvent = useCreateEvent();
  const deleteEvent = useDeleteEvent();
  const isMobile    = useIsMobile();

  const today = new Date();
  const [year, setYear]                 = useState(today.getFullYear());
  const [month, setMonth]               = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState(toLocalDateStr(today));
  const [showAdd, setShowAdd]           = useState(false);
  const [showPanel, setShowPanel]       = useState(false);
  const [detailEvent, setDetailEvent]   = useState<any | null>(null);
  const [syncing, setSyncing]           = useState(false);
  const [syncMsg, setSyncMsg]           = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '', emoji: '📅', time: '', assignedToId: '', notes: '', color: '#6366F1'
  });

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDay    = new Date(year, month, 1).getDay();
  const todayStr    = toLocalDateStr(today);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('connected') === '1') {
      window.history.replaceState({}, '', '/schedule');
      handleGoogleSync();
    }
  }, []);

  const allItems = (events as any[]).map(ev => ({
    ...ev,
    date: parseEventDate(ev.date),
  }));

  function prevMonth() { if (month === 0) { setMonth(11); setYear(y => y - 1); } else setMonth(m => m - 1); }
  function nextMonth() { if (month === 11) { setMonth(0); setYear(y => y + 1); } else setMonth(m => m + 1); }

  function getEventsForDate(day: number) {
    const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return allItems.filter(e => e.date === dateStr);
  }

  const selectedEvents = allItems
    .filter(e => e.date === selectedDate)
    .sort((a, b) => (a.time || '').localeCompare(b.time || ''));

  const upcomingEvents = allItems
    .filter(e => e.date >= todayStr)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return (a.time || '').localeCompare(b.time || '');
    })
    .slice(0, 10);

  async function handleGoogleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const res = await api.get('/events/sync');
      if (res.data.imported > 0) {
        setSyncMsg(`${res.data.imported} new events imported from Google Calendar!`);
        refetch();
      } else {
        setSyncMsg('Calendar is up to date — no new events found.');
      }
      setTimeout(() => setSyncMsg(null), 4000);
    } catch (e: any) {
      if (e.response?.status === 400) {
        const authRes = await api.get('/events/google/auth');
        window.location.href = authRes.data.url;
      } else {
        setSyncMsg('Sync failed: ' + (e.response?.data?.error || e.message));
        setTimeout(() => setSyncMsg(null), 4000);
      }
    } finally {
      setSyncing(false);
    }
  }

  async function handleCreate() {
    if (!form.title.trim()) return;
    await createEvent.mutateAsync({
      title: form.title.trim(), emoji: form.emoji, date: selectedDate,
      time: form.time || undefined, assignedToId: form.assignedToId || undefined,
      notes: form.notes || undefined, color: form.color,
    });
    setForm({ title: '', emoji: '📅', time: '', assignedToId: '', notes: '', color: '#6366F1' });
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
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );

  return (
    <div style={{ width: '100%', maxWidth: 1000, paddingBottom: 90 }}>
      <style>{`
        @keyframes slideUp { from { transform:translateY(100%) } to { transform:translateY(0) } }
        @keyframes fadeIn  { from { opacity:0 } to { opacity:1 } }
        .cal-day:hover { transform: scale(1.02); }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 900, margin: 0 }}>📅 Schedule</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '3px 0 0' }}>
            {upcomingEvents.length} upcoming event{upcomingEvents.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button onClick={handleGoogleSync} disabled={syncing} style={{
            padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 800,
            background: 'rgba(66,133,244,0.15)', color: '#4285F4',
            border: '1.5px solid rgba(66,133,244,0.3)', cursor: syncing ? 'not-allowed' : 'pointer',
            opacity: syncing ? 0.6 : 1,
          }}>
            {syncing ? 'Syncing...' : '🔄 Sync Google'}
          </button>
          <button onClick={() => setShowAdd(true)} style={{
            padding: '10px 20px', borderRadius: 12, fontSize: 13, fontWeight: 800,
            background: 'var(--primary)', color: '#fff', border: 'none', cursor: 'pointer',
            boxShadow: '0 4px 16px rgba(99,102,241,0.35)',
          }}>+ Add Event</button>
        </div>
      </div>

      {syncMsg && (
        <div style={{
          marginBottom: 16, padding: '10px 16px', borderRadius: 12, fontSize: 13, fontWeight: 600,
          background: syncMsg.includes('failed') ? 'rgba(248,113,113,0.1)' : 'rgba(66,133,244,0.1)',
          border: `1px solid ${syncMsg.includes('failed') ? 'rgba(248,113,113,0.3)' : 'rgba(66,133,244,0.3)'}`,
          color: syncMsg.includes('failed') ? '#F87171' : '#4285F4',
        }}>
          {syncMsg}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 290px', gap: 20, alignItems: 'start' }}>

        {/* Calendar */}
        <div style={{ borderRadius: 20, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid rgba(255,255,255,0.06)', background: 'rgba(255,255,255,0.03)' }}>
            <button onClick={prevMonth} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 16, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>←</button>
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: -0.3 }}>
              {MONTH_NAMES[month]} <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>{year}</span>
            </div>
            <button onClick={nextMonth} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 16, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>→</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', padding: '10px 12px 4px' }}>
            {DAY_NAMES.map(d => (
              <div key={d} style={{ textAlign: 'center', fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', letterSpacing: '0.06em', padding: '4px 0' }}>{d}</div>
            ))}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, padding: '0 12px 14px' }}>
            {Array.from({ length: firstDay }).map((_, i) => <div key={'e' + i} />)}
            {Array.from({ length: daysInMonth }, (_, i) => i + 1).map(day => {
              const dateStr    = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
              const dayEvents  = getEventsForDate(day);
              const isToday    = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;
              const isWeekend  = new Date(year, month, day).getDay() === 0 || new Date(year, month, day).getDay() === 6;
              const hasEvents  = dayEvents.length > 0;
              return (
                <div key={day} className="cal-day" onClick={() => handleDayClick(dateStr)} style={{
                  minHeight: isMobile ? 48 : 72, padding: '5px 4px 4px', borderRadius: 12, cursor: 'pointer', position: 'relative',
                  border: `1.5px solid ${isSelected ? 'var(--primary)' : isToday ? 'rgba(99,102,241,0.4)' : hasEvents ? 'rgba(255,255,255,0.08)' : 'transparent'}`,
                  background: isSelected ? 'linear-gradient(135deg,rgba(99,102,241,0.25),rgba(167,139,250,0.15))' : isToday ? 'rgba(99,102,241,0.08)' : hasEvents ? 'rgba(255,255,255,0.04)' : 'transparent',
                  transition: 'all 0.12s ease',
                  boxShadow: isSelected ? '0 4px 16px rgba(99,102,241,0.2)' : 'none',
                }}>
                  <div style={{
                    fontSize: 12, fontWeight: isToday ? 900 : 600, textAlign: 'center',
                    color: isSelected ? '#fff' : isToday ? '#fff' : isWeekend ? 'rgba(255,255,255,0.5)' : 'var(--text)',
                    marginBottom: 3,
                    ...(isToday && { width: 22, height: 22, borderRadius: '50%', background: 'var(--primary)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 3px' }),
                  }}>{day}</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {dayEvents.slice(0, isMobile ? 2 : 3).map((ev: any) => (
                      <div
                        key={ev.id}
                        onClick={(e) => { e.stopPropagation(); setDetailEvent(ev); }}
                        title={ev.title}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          fontSize: 10, fontWeight: 700, padding: isMobile ? '2px 4px' : '3px 6px',
                          borderRadius: 6, lineHeight: 1.3, cursor: 'pointer',
                          background: (ev.color || '#6366F1') + '22',
                          color: 'var(--text)',
                          overflow: 'hidden', whiteSpace: 'nowrap', textOverflow: 'ellipsis',
                        }}
                      >
                        <span style={{ width: 6, height: 6, borderRadius: '50%', flexShrink: 0, background: ev.color || '#6366F1' }} />
                        {!isMobile && <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{ev.title}</span>}
                      </div>
                    ))}
                    {dayEvents.length > (isMobile ? 2 : 3) && (
                      <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)', paddingLeft: 4 }}>+{dayEvents.length - (isMobile ? 2 : 3)} more</div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <div style={{ padding: '10px 20px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap' }}>
            {[
              { color: 'var(--primary)', label: 'Today', filled: true },
              { color: 'rgba(99,102,241,0.2)', label: 'Selected', border: 'var(--primary)' },
              { color: '#6366F1', label: 'App event', filled: true },
              { color: '#4285F4', label: 'Google', filled: true },
            ].map(({ color, label, border, filled }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: filled ? color : color, border: border ? `1.5px solid ${border}` : 'none' }} />
                <span style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>{label}</span>
              </div>
            ))}
            {isMobile && <span style={{ fontSize: 10, color: 'var(--text-muted)', marginLeft: 'auto' }}>Tap date to view</span>}
          </div>
        </div>

        {!isMobile && (
          <EventPanel
            selectedDate={selectedDate} todayStr={todayStr}
            selectedEvents={selectedEvents} upcomingEvents={upcomingEvents}
            members={members as any[]} onAdd={() => setShowAdd(true)} onDelete={handleDelete} onDetail={setDetailEvent}
          />
        )}
      </div>

      {/* Mobile bottom sheet */}
      {isMobile && showPanel && (
        <>
          <div onClick={() => setShowPanel(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 200, backdropFilter: 'blur(4px)' }} />
          <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 201, background: 'var(--bg)', borderRadius: '24px 24px 0 0', border: '1.5px solid rgba(255,255,255,0.1)', borderBottom: 'none', maxHeight: '80vh', overflowY: 'auto', padding: '20px 16px 100px', boxShadow: '0 -12px 48px rgba(0,0,0,0.5)', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />
            <EventPanel
              selectedDate={selectedDate} todayStr={todayStr}
              selectedEvents={selectedEvents} upcomingEvents={upcomingEvents}
              members={members as any[]}
              onAdd={() => { setShowPanel(false); setShowAdd(true); }}
              onDelete={handleDelete}
              onDetail={setDetailEvent}
            />
          </div>
        </>
      )}

      {/* Event detail popup */}
      {detailEvent && (() => {
        const ev = detailEvent;
        const assignee = (members as any[]).find(m => m.id === ev.assignedToId);
        const isGoogle = ev.source === 'google';
        const dateStr = parseEventDate(ev.date);
        return (
          <div onClick={() => setDetailEvent(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 320, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease', padding: 16 }}>
            <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 420, background: 'var(--surface, #1a1625)', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.1)', padding: 24, boxShadow: '0 16px 60px rgba(0,0,0,0.6)' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 16 }}>
                <div style={{ width: 48, height: 48, borderRadius: 14, flexShrink: 0, background: (ev.color || '#6366F1') + '22', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 26 }}>{cleanEmoji(ev.emoji)}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 18, lineHeight: 1.2 }}>{ev.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{formatDateLabel(dateStr, todayStr)}</div>
                </div>
                {isGoogle && <span style={{ fontSize: 10, fontWeight: 700, color: '#4285F4', background: 'rgba(66,133,244,0.12)', padding: '3px 8px', borderRadius: 6, flexShrink: 0 }}>Google</span>}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
                {ev.time && <div style={{ fontSize: 14, fontWeight: 600 }}>🕐 {ev.time}</div>}
                {assignee && <div style={{ fontSize: 14, fontWeight: 600, color: assignee.color }}>{assignee.emoji} {assignee.name}</div>}
                {ev.notes && <div style={{ fontSize: 13, color: 'var(--text-muted)', lineHeight: 1.5, padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.04)' }}>{ev.notes}</div>}
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setDetailEvent(null)} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }}>Close</button>
                <button onClick={() => { handleDelete(ev.id); setDetailEvent(null); }} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800, background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', cursor: 'pointer' }}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Add event modal */}
      {showAdd && (
        <div onClick={() => setShowAdd(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 300, backdropFilter: 'blur(4px)', animation: 'fadeIn 0.15s ease' }}>
          <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 500, background: 'var(--surface, #1a1625)', borderRadius: '24px 24px 0 0', border: '1.5px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto', boxShadow: '0 -16px 60px rgba(0,0,0,0.6)', animation: 'slideUp 0.3s cubic-bezier(0.34,1.56,0.64,1)' }}>
            <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.15)', margin: '0 auto 20px' }} />
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontWeight: 900, fontSize: 17, marginBottom: 4 }}>➕ New Event</div>
              <div style={{ display: 'inline-block', fontSize: 12, fontWeight: 700, padding: '4px 12px', borderRadius: 20, background: 'rgba(99,102,241,0.15)', color: '#A78BFA', border: '1px solid rgba(99,102,241,0.3)' }}>
                {formatDateLabel(selectedDate, todayStr)}
              </div>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>ICON</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {EMOJIS.map(e => (
                    <button key={e} type="button" onClick={() => setForm(p => ({ ...p, emoji: e }))} style={{ width: 38, height: 38, borderRadius: 10, fontSize: 20, cursor: 'pointer', background: form.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: `2px solid ${form.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}` }}>{e}</button>
                  ))}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>TITLE</label>
                <input className="input" placeholder="Event title..." autoFocus value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))} onKeyDown={e => e.key === 'Enter' && handleCreate()} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>TIME (optional)</label>
                <input className="input" type="time" value={form.time} onChange={e => setForm(p => ({ ...p, time: e.target.value }))} style={{ width: '100%' }} />
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 8 }}>COLOR</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {COLORS.map(c => (
                    <button key={c} type="button" onClick={() => setForm(p => ({ ...p, color: c }))} style={{ width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer', border: `3px solid ${form.color === c ? '#fff' : 'transparent'}`, boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', borderRadius: 14, background: (form.color || '#6366F1') + '18', border: `1.5px solid ${form.color || '#6366F1'}33` }}>
                <div style={{ width: 8, alignSelf: 'stretch', borderRadius: 4, minHeight: 32, background: form.color || '#6366F1', flexShrink: 0 }} />
                <div style={{ width: 36, height: 36, borderRadius: 10, flexShrink: 0, background: (form.color || '#6366F1') + '33', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{form.emoji}</div>
                <div>
                  <div style={{ fontWeight: 800, fontSize: 14 }}>{form.title || 'Event title'}</div>
                  {form.time && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>🕐 {form.time}</div>}
                </div>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>ASSIGN TO (optional)</label>
                <select className="input" value={form.assignedToId} onChange={e => setForm(p => ({ ...p, assignedToId: e.target.value }))} style={{ width: '100%' }}>
                  <option value="">Anyone</option>
                  {(members as any[]).map((m: any) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
              </div>
              <div>
                <label style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>NOTES (optional)</label>
                <textarea className="input" placeholder="Add notes..." rows={2} value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))} style={{ resize: 'vertical', width: '100%' }} />
              </div>
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button style={{ flex: 2, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800, background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer', boxShadow: '0 4px 16px rgba(99,102,241,0.4)', opacity: (!form.title.trim() || createEvent.isPending) ? 0.5 : 1 }} onClick={handleCreate} disabled={!form.title.trim() || createEvent.isPending}>
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