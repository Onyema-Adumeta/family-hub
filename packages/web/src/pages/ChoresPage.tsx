import { useState } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CHORE_EMOJIS = ['\u{1F9F9}','\u{1F37D}','\u{1F6CF}','\u{1F436}','\u{1F331}','\u{1F9FA}','\u{1F6BF}','\u{1F5D1}','\u{1FAA3}','\u{1F9FD}','\u{1F4DA}','\u{1F6D2}','\u{1F697}','\u{1F9F4}','\u{1F4A7}'];
const FREQS = ['daily','weekly','once'] as const;

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: '\u23F3', color: 'var(--text-muted)',   bg: 'rgba(255,255,255,0.06)' },
  in_progress: { label: 'In Progress', icon: '\u{1F525}', color: '#FBBF24',          bg: 'rgba(251,191,36,0.1)'  },
  done:        { label: 'Done',        icon: '\u2705', color: 'var(--success)',       bg: 'rgba(74,222,128,0.1)'  },
};

function nextStatus(current: string): string {
  if (current === 'pending') return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'pending';
}

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

export default function ChoresPage() {
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] } = useMembers();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const deleteChore = useDeleteChore();

  const [filter, setFilter] = useState<'pending'|'in_progress'|'done'|'all'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [newChore, setNewChore] = useState({
    title: '', emoji: '\u{1F9F9}', assignedToId: '', frequency: 'daily' as const, stars: 5, proofRequired: false,
  });

  const filtered = (chores as any[]).filter(c =>
    filter === 'all' ? true : c.status === filter
  );

  function handleAdvance(chore: any) {
    const next = nextStatus(chore.status || 'pending');
    updateChore.mutate({ id: chore.id, data: { status: next } });
  }

  function handleAdd() {
    if (!newChore.title.trim()) return;
    createChore.mutate({ ...newChore, assignedToId: newChore.assignedToId || undefined });
    setNewChore({ title: '', emoji: '\u{1F9F9}', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false });
    setShowAdd(false);
  }

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>;

  const counts = (chores as any[]).reduce((acc: any, c: any) => {
    acc[c.status || 'pending'] = (acc[c.status || 'pending'] || 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>\u2705 Chores</h1>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Add chore</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', padding: 4, borderRadius: 12, border: '1.5px solid var(--border)' }}>
        {([['pending','\u23F3 Pending'],['in_progress','\u{1F525} In Progress'],['done','\u2705 Done'],['all','\u{1F4CB} All']] as const).map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer',
            background: filter === f ? 'var(--primary)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--text-secondary)', border: 'none', position: 'relative'
          }}>
            {label}
            {counts[f] > 0 && f !== 'all' && (
              <span style={{ marginLeft: 4, background: filter === f ? 'rgba(255,255,255,0.25)' : 'var(--primary)', color: '#fff', borderRadius: 10, fontSize: 10, padding: '1px 5px', fontWeight: 900 }}>{counts[f]}</span>
            )}
          </button>
        ))}
      </div>

      {/* Chore list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontWeight: 700, fontSize: 16 }}>
          {filter === 'pending' ? '\u{1F389} All caught up!' : filter === 'done' ? 'No completed chores yet.' : 'No chores here yet.'}
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: 10 }}>
          {filtered.map((chore: any) => {
            const assignee = (members as any[]).find((m: any) => m.id === chore.assignedToId);
            const status = chore.status || 'pending';
            const cfg = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG];
            return (
              <div key={chore.id} className="card" style={{
                opacity: status === 'done' ? 0.7 : 1,
                borderLeft: `4px solid ${assignee?.color || 'var(--border)'}`,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  {/* Advance status button */}
                  <button
                    onClick={() => handleAdvance(chore)}
                    title={`Mark as ${nextStatus(status)}`}
                    style={{
                      width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${cfg.color}`,
                      background: status === 'done' ? 'var(--success)' : cfg.bg,
                      color: status === 'done' ? '#fff' : cfg.color,
                      fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'all 0.15s',
                    }}
                  >{status === 'done' ? '\u2713' : status === 'in_progress' ? '\u{1F525}' : '\u25B6'}</button>

                  <span style={{ fontSize: 22 }}>{chore.emoji}</span>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14, textDecoration: status === 'done' ? 'line-through' : 'none' }}>
                      {chore.title}
                    </div>
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                      {assignee ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 16, height: 16, borderRadius: '50%', background: assignee.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, overflow: 'hidden' }}>
                            {avatarSrc(assignee.avatarUrl)
                              ? <img src={avatarSrc(assignee.avatarUrl)!} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                              : assignee.emoji}
                          </div>
                          <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-secondary)' }}>{assignee.name}</span>
                        </div>
                      ) : <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>Anyone</span>}
                      <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{chore.frequency}</span>
                      <span style={{ fontSize: 11, fontWeight: 900, padding: '2px 8px', borderRadius: 20, background: cfg.bg, color: cfg.color }}>{cfg.icon} {cfg.label}</span>
                      <span style={{ fontSize: 11, fontWeight: 800, color: '#FBBF24' }}>\u2B50 {chore.stars}</span>
                    </div>
                  </div>

                  <button onClick={() => deleteChore.mutate(chore.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 16, padding: 4 }}>\u00D7</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add chore modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 460, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18 }}>\u2795 New Chore</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>\u00D7</button>
            </div>

            {/* Emoji picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {CHORE_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewChore(p => ({ ...p, emoji: e }))} style={{
                  width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer',
                  background: newChore.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  border: newChore.emoji === e ? '2px solid var(--primary)' : '2px solid transparent',
                }}>{e}</button>
              ))}
            </div>

            <input className="input" placeholder="Chore title..." style={{ marginBottom: 12, width: '100%' }}
              value={newChore.title} onChange={e => setNewChore(p => ({ ...p, title: e.target.value }))} />

            <select className="input" style={{ marginBottom: 12, width: '100%' }}
              value={newChore.assignedToId} onChange={e => setNewChore(p => ({ ...p, assignedToId: e.target.value }))}>
              <option value="">Anyone</option>
              {(members as any[]).map((m: any) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              {FREQS.map(f => (
                <button key={f} onClick={() => setNewChore(p => ({ ...p, frequency: f }))} style={{
                  flex: 1, padding: '8px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer',
                  background: newChore.frequency === f ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  color: newChore.frequency === f ? '#fff' : 'var(--text-secondary)', border: 'none',
                }}>{f}</button>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16, padding: 12, background: 'rgba(255,255,255,0.04)', borderRadius: 10 }}>
              <input type="checkbox" id="proof" checked={newChore.proofRequired}
                onChange={e => setNewChore(p => ({ ...p, proofRequired: e.target.checked }))}
                style={{ width: 18, height: 18, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <label htmlFor="proof" style={{ fontWeight: 700, fontSize: 13, cursor: 'pointer' }}>
                \u{1F4F8} Require photo proof
              </label>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleAdd} disabled={!newChore.title.trim() || createChore.isPending}>
                {createChore.isPending ? 'Adding...' : '+ Add Chore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
