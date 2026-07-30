import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useMembers } from '../hooks/useApi';
import { useSocket } from '../hooks/useSocket';

interface PackingItem { id: string; name: string; quantity: number; category: string | null; packed: boolean; member: { id: string; name: string; emoji: string; color: string }; }
interface Activity { id: string; title: string; time: string | null; location: string | null; notes: string | null; assignees: { id: string; name: string; emoji: string; color: string }[]; }
interface ItineraryDay { id: string; date: string; title: string | null; notes: string | null; activities: Activity[]; }
interface Trip {
  id: string; title: string; destination: string | null; startDate: string; endDate: string; notes: string | null;
  createdBy: { id: string; name: string; emoji: string; color: string };
  packingItems: PackingItem[];
  itineraryDays: ItineraryDay[];
}

function anchorDate(dateStr: string) { return `${dateStr}T12:00:00`; }
function toDateInputValue(iso: string) { return iso.substring(0, 10); }
function fmtDay(iso: string) {
  return new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
}

function AssigneeChecklist({ members, selected, onToggle }: { members: any[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
      {members.map((m: any) => {
        const checked = selected.includes(m.id);
        return (
          <button key={m.id} onClick={() => onToggle(m.id)} style={{
            display: 'flex', alignItems: 'center', gap: 6, padding: '6px 10px', borderRadius: 20, cursor: 'pointer',
            background: checked ? (m.color || '#7C3AED') + '22' : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${checked ? (m.color || '#7C3AED') : 'rgba(255,255,255,0.1)'}`,
            color: 'var(--text)', fontWeight: 700, fontSize: 12,
          }}>
            <span>{m.emoji}</span><span>{m.name}</span>
          </button>
        );
      })}
    </div>
  );
}

export default function TripDetailPage() {
  const { tripId } = useParams();
  const navigate = useNavigate();
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();
  const memberList = members as any[];

  const [trip, setTrip] = useState<Trip | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'packing' | 'itinerary'>('packing');

  // Packing form state
  const [packName, setPackName] = useState('');
  const [packQty, setPackQty] = useState(1);
  const [packMemberId, setPackMemberId] = useState<string>('');
  const [addingPackFor, setAddingPackFor] = useState<string | null>(null);

  // Itinerary form state
  const [showAddDay, setShowAddDay] = useState(false);
  const [dayDate, setDayDate] = useState('');
  const [dayTitle, setDayTitle] = useState('');
  const [addingActivityDayId, setAddingActivityDayId] = useState<string | null>(null);
  const [actTitle, setActTitle] = useState('');
  const [actTime, setActTime] = useState('');
  const [actLocation, setActLocation] = useState('');
  const [actAssignees, setActAssignees] = useState<string[]>([]);

  async function fetchTrip() {
    try {
      const { data } = await api.get(`/trips/${tripId}`);
      setTrip(data);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchTrip(); }, [tripId]);
  useEffect(() => { setPackMemberId(member?.id || ''); }, [member?.id]);

  useSocket((msg) => {
    if (!trip) return;
    if (msg.type === 'trip:updated' && msg.trip.id === tripId) setTrip(msg.trip);
    if (msg.type === 'trip:deleted' && msg.tripId === tripId) { navigate('/trips'); return; }

    if (msg.type === 'trip:packing_added' && msg.tripId === tripId) {
      setTrip(prev => prev ? { ...prev, packingItems: [...prev.packingItems, msg.item] } : prev);
    }
    if (msg.type === 'trip:packing_updated' && msg.tripId === tripId) {
      setTrip(prev => prev ? { ...prev, packingItems: prev.packingItems.map(p => p.id === msg.item.id ? msg.item : p) } : prev);
    }
    if (msg.type === 'trip:packing_deleted' && msg.tripId === tripId) {
      setTrip(prev => prev ? { ...prev, packingItems: prev.packingItems.filter(p => p.id !== msg.itemId) } : prev);
    }

    if (msg.type === 'trip:day_added' && msg.tripId === tripId) {
      setTrip(prev => prev ? { ...prev, itineraryDays: [...prev.itineraryDays, msg.day].sort((a, b) => a.date.localeCompare(b.date)) } : prev);
    }
    if (msg.type === 'trip:day_updated' && msg.tripId === tripId) {
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.map(d => d.id === msg.day.id ? msg.day : d) } : prev);
    }
    if (msg.type === 'trip:day_deleted' && msg.tripId === tripId) {
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.filter(d => d.id !== msg.dayId) } : prev);
    }

    if (msg.type === 'trip:activity_added') {
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.map(d => d.id === msg.dayId ? { ...d, activities: [...d.activities, msg.activity] } : d) } : prev);
    }
    if (msg.type === 'trip:activity_updated') {
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.map(d => d.id === msg.dayId ? { ...d, activities: d.activities.map(a => a.id === msg.activity.id ? msg.activity : a) } : d) } : prev);
    }
    if (msg.type === 'trip:activity_deleted') {
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.map(d => d.id === msg.dayId ? { ...d, activities: d.activities.filter(a => a.id !== msg.activityId) } : d) } : prev);
    }
  });

  async function handleAddPackItem(forMemberId: string) {
    if (!packName.trim() || !trip) return;
    try {
      const { data } = await api.post(`/trips/${trip.id}/packing`, {
        name: packName.trim(), quantity: packQty, memberId: forMemberId,
      });
      setTrip(prev => prev ? { ...prev, packingItems: [...prev.packingItems, data] } : prev);
      setPackName(''); setPackQty(1); setAddingPackFor(null);
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to add item'); }
  }

  async function togglePacked(item: PackingItem) {
    try {
      const { data } = await api.patch(`/trips/packing/${item.id}`, { packed: !item.packed });
      setTrip(prev => prev ? { ...prev, packingItems: prev.packingItems.map(p => p.id === item.id ? data : p) } : prev);
    } catch {}
  }

  async function deletePackItem(itemId: string) {
    try {
      await api.delete(`/trips/packing/${itemId}`);
      setTrip(prev => prev ? { ...prev, packingItems: prev.packingItems.filter(p => p.id !== itemId) } : prev);
    } catch {}
  }

  async function handleAddDay() {
    if (!dayDate || !trip) return;
    try {
      const { data } = await api.post(`/trips/${trip.id}/days`, {
        date: anchorDate(dayDate), title: dayTitle.trim() || null,
      });
      setTrip(prev => prev ? { ...prev, itineraryDays: [...prev.itineraryDays, data].sort((a, b) => a.date.localeCompare(b.date)) } : prev);
      setDayDate(''); setDayTitle(''); setShowAddDay(false);
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to add day'); }
  }

  async function deleteDay(dayId: string) {
    if (!confirm('Delete this day and all its activities?')) return;
    try {
      await api.delete(`/trips/days/${dayId}`);
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.filter(d => d.id !== dayId) } : prev);
    } catch {}
  }

  function toggleActAssignee(id: string) {
    setActAssignees(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  }

  async function handleAddActivity(dayId: string) {
    if (!actTitle.trim()) return;
    try {
      const { data } = await api.post(`/trips/days/${dayId}/activities`, {
        title: actTitle.trim(), time: actTime || null, location: actLocation || null, assigneeIds: actAssignees,
      });
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.map(d => d.id === dayId ? { ...d, activities: [...d.activities, data] } : d) } : prev);
      setActTitle(''); setActTime(''); setActLocation(''); setActAssignees([]); setAddingActivityDayId(null);
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to add activity'); }
  }

  async function deleteActivity(dayId: string, activityId: string) {
    try {
      await api.delete(`/trips/activities/${activityId}`);
      setTrip(prev => prev ? { ...prev, itineraryDays: prev.itineraryDays.map(d => d.id === dayId ? { ...d, activities: d.activities.filter(a => a.id !== activityId) } : d) } : prev);
    } catch {}
  }

  async function handleDeleteTrip() {
    if (!trip || !confirm(`Delete "${trip.title}"? This can't be undone.`)) return;
    try {
      await api.delete(`/trips/${trip.id}`);
      navigate('/trips');
    } catch { alert('Failed to delete trip'); }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  if (!trip) return (
    <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
      Trip not found. <button onClick={() => navigate('/trips')} style={{ color: '#A78BFA', background: 'none', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Back to trips</button>
    </div>
  );

  // Group packing items by member
  const packingByMember: Record<string, PackingItem[]> = {};
  for (const item of trip.packingItems) {
    if (!packingByMember[item.member.id]) packingByMember[item.member.id] = [];
    packingByMember[item.member.id].push(item);
  }
  const membersWithLists = memberList.filter(m => packingByMember[m.id]?.length || m.id === member?.id);

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <button onClick={() => navigate('/trips')} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: 13, fontWeight: 700, cursor: 'pointer', padding: 0, marginBottom: 12 }}>← All trips</button>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>✈️ {trip.title}</h1>
          {trip.destination && <p style={{ fontSize: 13, color: 'var(--text-muted)', margin: '4px 0 0' }}>📍 {trip.destination}</p>}
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {toDateInputValue(trip.startDate)} → {toDateInputValue(trip.endDate)}
          </p>
        </div>
        <button onClick={handleDeleteTrip} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171', cursor: 'pointer', flexShrink: 0 }}>🗑️ Delete Trip</button>
      </div>
      {trip.notes && <p style={{ fontSize: 12, color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 8 }}>📝 {trip.notes}</p>}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '16px 0' }}>
        {[{ key: 'packing', label: '🎒 Packing', count: trip.packingItems.length }, { key: 'itinerary', label: '🗓️ Itinerary', count: trip.itineraryDays.length }].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ padding: '8px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: tab === t.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${tab === t.key ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`, color: tab === t.key ? '#A78BFA' : 'var(--text-muted)' }}>
            {t.label} <span style={{ opacity: 0.7 }}>({t.count})</span>
          </button>
        ))}
      </div>

      {/* ── Packing tab ── */}
      {tab === 'packing' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {membersWithLists.map(m => {
            const items = packingByMember[m.id] || [];
            const packedCount = items.filter(i => i.packed).length;
            const isAdding = addingPackFor === m.id;
            return (
              <div key={m.id} style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 18 }}>{m.emoji}</span>
                    <span style={{ fontWeight: 800, fontSize: 14 }}>{m.name}'s list</span>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>{packedCount}/{items.length}</span>
                  </div>
                  <button onClick={() => { setAddingPackFor(isAdding ? null : m.id); setPackMemberId(m.id); }} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: isAdding ? 'rgba(124,111,247,0.2)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: isAdding ? '#A78BFA' : 'var(--text-muted)', cursor: 'pointer' }}>{isAdding ? 'Cancel' : '+ Item'}</button>
                </div>

                {items.length === 0 && !isAdding && <div style={{ fontSize: 12, color: 'var(--text-muted)', padding: '6px 0' }}>Nothing added yet</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {items.map(item => (
                    <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px', borderRadius: 10, background: item.packed ? 'rgba(74,222,128,0.06)' : 'rgba(255,255,255,0.03)' }}>
                      <div onClick={() => togglePacked(item)} style={{ width: 20, height: 20, borderRadius: 6, flexShrink: 0, border: `2px solid ${item.packed ? '#4ADE80' : 'rgba(255,255,255,0.25)'}`, background: item.packed ? 'rgba(74,222,128,0.3)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 12 }}>{item.packed ? '✓' : ''}</div>
                      <div style={{ flex: 1, fontSize: 13, fontWeight: 600, textDecoration: item.packed ? 'line-through' : 'none', color: item.packed ? 'var(--text-muted)' : 'var(--text)' }}>
                        {item.name}{item.quantity > 1 ? ` × ${item.quantity}` : ''}
                      </div>
                      <button onClick={() => deletePackItem(item.id)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 15, padding: 2 }}>×</button>
                    </div>
                  ))}
                </div>

                {isAdding && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
                    <input value={packName} onChange={e => setPackName(e.target.value)} placeholder="Item name..." className="input" style={{ flex: 1 }} autoFocus onKeyDown={e => e.key === 'Enter' && handleAddPackItem(m.id)} />
                    <input type="number" min={1} value={packQty} onChange={e => setPackQty(Number(e.target.value) || 1)} className="input" style={{ width: 60 }} />
                    <button onClick={() => handleAddPackItem(m.id)} disabled={!packName.trim()} style={{ padding: '0 14px', borderRadius: 10, background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !packName.trim() ? 0.5 : 1 }}>Add</button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ── Itinerary tab ── */}
      {tab === 'itinerary' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {trip.itineraryDays.map(day => {
            const isAddingAct = addingActivityDayId === day.id;
            return (
              <div key={day.id} style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                  <div>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{fmtDay(day.date)}{day.title ? ` · ${day.title}` : ''}</div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setAddingActivityDayId(isAddingAct ? null : day.id)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: isAddingAct ? 'rgba(124,111,247,0.2)' : 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: isAddingAct ? '#A78BFA' : 'var(--text-muted)', cursor: 'pointer' }}>{isAddingAct ? 'Cancel' : '+ Activity'}</button>
                    <button onClick={() => deleteDay(day.id)} style={{ padding: '5px 8px', borderRadius: 8, fontSize: 12, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.2)', color: '#F87171', cursor: 'pointer' }}>🗑️</button>
                  </div>
                </div>

                {day.activities.length === 0 && !isAddingAct && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>No activities planned</div>}

                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {day.activities.map(act => (
                    <div key={act.id} style={{ padding: '10px 12px', borderRadius: 10, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.06)' }}>
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
                        <div>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{act.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                            {act.time && <span>🕐 {act.time} </span>}
                            {act.location && <span>· 📍 {act.location}</span>}
                          </div>
                        </div>
                        <button onClick={() => deleteActivity(day.id, act.id)} style={{ background: 'none', border: 'none', color: '#F87171', cursor: 'pointer', fontSize: 15, flexShrink: 0 }}>×</button>
                      </div>
                      {act.assignees.length > 0 && (
                        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 6 }}>
                          {act.assignees.map(a => (
                            <span key={a.id} style={{ fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: (a.color || '#7C3AED') + '22', color: 'var(--text)' }}>{a.emoji} {a.name}</span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                {isAddingAct && (
                  <div style={{ marginTop: 10, padding: '12px', borderRadius: 12, background: 'rgba(124,111,247,0.06)', border: '1px solid rgba(124,111,247,0.2)' }}>
                    <input value={actTitle} onChange={e => setActTitle(e.target.value)} placeholder="Activity (e.g. Hike to viewpoint)" className="input" style={{ width: '100%', marginBottom: 8 }} autoFocus />
                    <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                      <input value={actTime} onChange={e => setActTime(e.target.value)} placeholder="Time (e.g. 9:00 AM)" className="input" style={{ flex: 1 }} />
                      <input value={actLocation} onChange={e => setActLocation(e.target.value)} placeholder="Location" className="input" style={{ flex: 1 }} />
                    </div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>WHO'S DOING THIS?</div>
                    <AssigneeChecklist members={memberList} selected={actAssignees} onToggle={toggleActAssignee} />
                    <button onClick={() => handleAddActivity(day.id)} disabled={!actTitle.trim()} style={{ marginTop: 10, width: '100%', padding: '9px', borderRadius: 10, background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !actTitle.trim() ? 0.5 : 1 }}>+ Add Activity</button>
                  </div>
                )}
              </div>
            );
          })}

          {showAddDay ? (
            <div style={{ padding: '14px 16px', borderRadius: 16, background: 'rgba(124,111,247,0.06)', border: '1.5px solid rgba(124,111,247,0.25)' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <input type="date" value={dayDate} onChange={e => setDayDate(e.target.value)} className="input" style={{ flex: 1 }} min={toDateInputValue(trip.startDate)} max={toDateInputValue(trip.endDate)} />
                <input value={dayTitle} onChange={e => setDayTitle(e.target.value)} placeholder="Day title (optional)" className="input" style={{ flex: 1 }} />
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAddDay(false)} style={{ flex: 1, padding: '9px', borderRadius: 10, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleAddDay} disabled={!dayDate} style={{ flex: 2, padding: '9px', borderRadius: 10, background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 700, cursor: 'pointer', opacity: !dayDate ? 0.5 : 1 }}>+ Add Day</button>
              </div>
            </div>
          ) : (
            <button onClick={() => setShowAddDay(true)} style={{ padding: '12px', borderRadius: 16, background: 'rgba(255,255,255,0.04)', border: '1.5px dashed rgba(255,255,255,0.15)', color: 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>+ Add itinerary day</button>
          )}
        </div>
      )}
    </div>
  );
}