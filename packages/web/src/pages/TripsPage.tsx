import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useSocket } from '../hooks/useSocket';

interface Trip {
  id: string;
  title: string;
  destination: string | null;
  startDate: string;
  endDate: string;
  notes: string | null;
  createdBy: { id: string; name: string; emoji: string; color: string };
  packingItems: { id: string; packed: boolean }[];
  itineraryDays: { id: string }[];
}

// Anchor a YYYY-MM-DD date-input value to local noon before sending to the
// API. Sending the bare date string lets `new Date(str)` on the backend
// parse it as UTC midnight, which shifts the displayed day in negative UTC
// offsets - the same bug already fixed on the meals page.
function anchorDate(dateStr: string) {
  return `${dateStr}T12:00:00`;
}

// Round-trip an ISO datetime back to a YYYY-MM-DD value for a date input,
// without going through `new Date()` (which would reintroduce the shift).
function toDateInputValue(iso: string) {
  return iso.substring(0, 10);
}

function fmtRange(startIso: string, endIso: string) {
  const start = new Date(startIso);
  const end = new Date(endIso);
  const opts: Intl.DateTimeFormatOptions = { month: 'short', day: 'numeric' };
  const sameYear = start.getFullYear() === end.getFullYear();
  return `${start.toLocaleDateString('en-US', opts)} – ${end.toLocaleDateString('en-US', { ...opts, year: sameYear ? undefined : 'numeric' })}, ${end.getFullYear()}`;
}

export default function TripsPage() {
  const navigate = useNavigate();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [notes, setNotes] = useState('');

  async function fetchTrips() {
    try {
      const { data } = await api.get('/trips');
      setTrips(data);
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { fetchTrips(); }, []);

  useSocket((msg) => {
    if (msg.type === 'trip:created') setTrips(prev => [...prev, msg.trip].sort((a, b) => a.startDate.localeCompare(b.startDate)));
    if (msg.type === 'trip:updated') setTrips(prev => prev.map(t => t.id === msg.trip.id ? msg.trip : t));
    if (msg.type === 'trip:deleted') setTrips(prev => prev.filter(t => t.id !== msg.tripId));
  });

  function resetForm() {
    setTitle(''); setDestination(''); setStartDate(''); setEndDate(''); setNotes('');
  }

  async function handleCreate() {
    if (!title.trim() || !startDate || !endDate) return;
    setSaving(true);
    try {
      const { data } = await api.post('/trips', {
        title: title.trim(),
        destination: destination.trim() || null,
        startDate: anchorDate(startDate),
        endDate: anchorDate(endDate),
        notes: notes.trim() || null,
      });
      setTrips(prev => [...prev, data].sort((a, b) => a.startDate.localeCompare(b.startDate)));
      resetForm();
      setShowAdd(false);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to create trip');
    } finally { setSaving(false); }
  }

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 60 }}>
      <div style={{ width: 36, height: 36, borderRadius: '50%', border: '3px solid var(--primary)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite' }} />
      <style>{'@keyframes spin{to{transform:rotate(360deg)}}'}</style>
    </div>
  );

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>✈️ Trips</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>{trips.length} planned</p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{ padding: '9px 18px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ New Trip</button>
      </div>

      {trips.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>🧳</div>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 12 }}>No trips planned yet</div>
          <button onClick={() => setShowAdd(true)} style={{ padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Plan a trip</button>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 16 }}>
          {trips.map(trip => {
            const packedCount = trip.packingItems.filter(p => p.packed).length;
            const totalItems = trip.packingItems.length;
            return (
              <button
                key={trip.id}
                onClick={() => navigate(`/trips/${trip.id}`)}
                style={{
                  textAlign: 'left', padding: '16px', borderRadius: 16, cursor: 'pointer',
                  background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)',
                  color: 'var(--text)', display: 'flex', flexDirection: 'column', gap: 6,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
                  <div style={{ fontWeight: 800, fontSize: 16 }}>{trip.title}</div>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>{trip.createdBy.emoji} {trip.createdBy.name}</span>
                </div>
                {trip.destination && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>📍 {trip.destination}</div>}
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>📅 {fmtRange(trip.startDate, trip.endDate)}</div>
                <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#A78BFA', background: 'rgba(124,111,247,0.12)', padding: '3px 9px', borderRadius: 20 }}>
                    🎒 {packedCount}/{totalItems} packed
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 700, color: '#FBBF24', background: 'rgba(251,191,36,0.12)', padding: '3px 9px', borderRadius: 20 }}>
                    🗓️ {trip.itineraryDays.length} day{trip.itineraryDays.length !== 1 ? 's' : ''} planned
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showAdd && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998, backdropFilter: 'blur(4px)' }} onClick={() => setShowAdd(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 520, background: '#1a1625', borderRadius: '24px 24px 0 0', border: '1.5px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: '8px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '12px auto 20px' }} />
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>✈️ New Trip</h2>

              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Trip name (e.g. Summer in Banff)" className="input" style={{ width: '100%', marginBottom: 12 }} autoFocus />
              <input value={destination} onChange={e => setDestination(e.target.value)} placeholder="Destination (optional)" className="input" style={{ width: '100%', marginBottom: 12 }} />

              <div style={{ display: 'flex', gap: 10, marginBottom: 12 }}>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>START DATE</label>
                  <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)} className="input" style={{ width: '100%' }} />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 4, fontWeight: 700 }}>END DATE</label>
                  <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)} className="input" style={{ width: '100%' }} min={startDate || undefined} />
                </div>
              </div>

              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" className="input" rows={2} style={{ width: '100%', marginBottom: 18, resize: 'vertical' }} />

              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => setShowAdd(false)} style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }}>Cancel</button>
                <button onClick={handleCreate} disabled={!title.trim() || !startDate || !endDate || saving} style={{ flex: 2, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800, background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer', opacity: (!title.trim() || !startDate || !endDate || saving) ? 0.5 : 1 }}>
                  {saving ? 'Creating...' : '+ Create Trip'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}