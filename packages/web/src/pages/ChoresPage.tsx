import { useState } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧','🪟','🧊','🏠'];
const FREQS = ['daily', 'weekly', 'once'] as const;

type Status = 'pending' | 'in_progress' | 'done';

const STATUSES: { key: Status; label: string; icon: string; color: string; bg: string }[] = [
  { key: 'pending',     label: 'Pending',     icon: '⏳', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  { key: 'in_progress', label: 'In Progress', icon: '🔥', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)'  },
  { key: 'done',        label: 'Done',        icon: '✅', color: '#4ADE80', bg: 'rgba(74,222,128,0.15)'  },
];

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

  const [activeTab, setActiveTab] = useState<Status | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resetting, setResetting] = useState(false);

  const [form, setForm] = useState({
    title: '', emoji: '🧹', assignedToId: '',
    frequency: 'daily' as typeof FREQS[number],
    stars: 5, proofRequired: false,
  });

  const allChores = chores as any[];

  const counts: Record<string, number> = {
    all: allChores.length,
    pending: allChores.filter(c => (c.status || 'pending') === 'pending').length,
    in_progress: allChores.filter(c => (c.status || 'pending') === 'in_progress').length,
    done: allChores.filter(c => (c.status || 'pending') === 'done').length,
  };

  const filtered = activeTab === 'all'
    ? allChores
    : allChores.filter(c => (c.status || 'pending') === activeTab);

  const setStatus = async (chore: any, status: Status) => {
    if ((chore.status || 'pending') === status) return;
    try {
      await updateChore.mutateAsync({ id: chore.id, data: { status } });
      setExpandedId(null);
    } catch (e) { console.error(e); }
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    try {
      await createChore.mutateAsync({ ...form, status: 'pending' });
      setForm({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false });
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  const resetAll = async () => {
    if (!confirm('Reset ALL chores back to Pending?')) return;
    setResetting(true);
    for (const c of allChores) {
      if ((c.status || 'pending') !== 'pending') {
        await updateChore.mutateAsync({ id: c.id, data: { status: 'pending' } });
      }
    }
    setResetting(false);
  };

  // Detect bad-data state: everything is in_progress and nothing is pending/done
  const allInProgress = counts.in_progress === counts.all && counts.all > 0 && counts.pending === 0 && counts.done === 0;

  const ChoreCard = ({ chore }: { chore: any }) => {
    const status: Status = chore.status || 'pending';
    const cfg = STATUSES.find(s => s.key === status)!;
    const assignee = (members as any[]).find(m => m.id === chore.assignedToId || m.id === chore.assignedTo?.id);
    const isExpanded = expandedId === chore.id;

    return (
      <div style={{
        background: 'rgba(255,255,255,0.04)',
        border: `1.5px solid ${cfg.color}55`,
        borderRadius: 14,
        marginBottom: 10,
        overflow: 'hidden',
        transition: 'border-color 0.2s',
      }}>
        {/* Card header — tap to expand */}
        <div
          onClick={() => setExpandedId(isExpanded ? null : chore.id)}
          style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 14px', cursor: 'pointer',
            userSelect: 'none',
          }}
        >
          <span style={{ fontSize: 24, flexShrink: 0 }}>{chore.emoji || '🧹'}</span>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 700, fontSize: 15,
              color: status === 'done' ? '#64748B' : 'var(--text)',
              textDecoration: status === 'done' ? 'line-through' : 'none',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{chore.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: cfg.color, background: cfg.bg,
                borderRadius: 20, padding: '2px 8px',
              }}>{cfg.icon} {cfg.label}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>⭐{chore.stars}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>· {chore.frequency}</span>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {assignee && (
              <div style={{
                width: 28, height: 28, borderRadius: '50%',
                background: assignee.color || '#6366F1',
                border: `2px solid ${assignee.color || '#6366F1'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 13, overflow: 'hidden', flexShrink: 0,
              }}>
                {assignee.avatarUrl
                  ? <img src={avatarSrc(assignee.avatarUrl)!} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : assignee.emoji || '👤'}
              </div>
            )}
            <span style={{
              color: 'var(--text-muted)', fontSize: 11,
              display: 'inline-block',
              transform: isExpanded ? 'rotate(180deg)' : 'none',
              transition: 'transform 0.2s',
            }}>▼</span>
          </div>
        </div>

        {/* Expanded panel */}
        {isExpanded && (
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.07)',
            padding: '12px 14px',
            background: 'rgba(0,0,0,0.15)',
          }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.08em', marginBottom: 10 }}>
              MOVE TO
            </div>

            {/* 3-state selector */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 12 }}>
              {STATUSES.map(s => (
                <button
                  key={s.key}
                  onClick={() => setStatus(chore, s.key)}
                  style={{
                    padding: '12px 6px',
                    background: status === s.key ? s.bg : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${status === s.key ? s.color : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 12,
                    color: status === s.key ? s.color : 'var(--text-muted)',
                    fontWeight: status === s.key ? 800 : 500,
                    fontSize: 11, cursor: 'pointer',
                    transition: 'all 0.15s',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', gap: 5,
                    position: 'relative',
                  }}
                >
                  {status === s.key && (
                    <div style={{
                      position: 'absolute', top: -2, right: -2,
                      width: 12, height: 12, borderRadius: '50%',
                      background: s.color, fontSize: 8,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      color: '#000', fontWeight: 900,
                    }}>✓</div>
                  )}
                  <span style={{ fontSize: 22 }}>{s.icon}</span>
                  <span style={{ textAlign: 'center', lineHeight: 1.2 }}>{s.label}</span>
                </button>
              ))}
            </div>

            {/* Delete */}
            <button
              onClick={() => { if (confirm('Delete this chore?')) deleteChore.mutate(chore.id); }}
              style={{
                width: '100%', padding: '8px',
                background: 'rgba(248,113,113,0.08)',
                border: '1px solid rgba(248,113,113,0.2)',
                borderRadius: 10, color: '#F87171',
                fontWeight: 600, fontSize: 12, cursor: 'pointer',
              }}
            >🗑 Delete chore</button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧹 Chores</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {counts.done} / {counts.all} done today
          </p>
        </div>
        <button
          onClick={() => setShowAdd(true)}
          style={{
            padding: '9px 18px', background: 'var(--primary)',
            border: 'none', borderRadius: 10, color: '#fff',
            fontWeight: 700, fontSize: 14, cursor: 'pointer',
          }}
        >+ Add</button>
      </div>

      {/* Bad-data banner */}
      {allInProgress && (
        <div style={{
          background: 'rgba(251,191,36,0.1)',
          border: '1px solid rgba(251,191,36,0.35)',
          borderRadius: 12, padding: '12px 14px', marginTop: 12, marginBottom: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap',
        }}>
          <span style={{ fontSize: 13, color: '#FBBF24', flex: 1 }}>
            ⚠️ All chores are stuck on "In Progress" from an earlier data issue.
          </span>
          <button
            onClick={resetAll}
            disabled={resetting}
            style={{
              padding: '7px 14px', flexShrink: 0,
              background: 'rgba(251,191,36,0.2)',
              border: '1px solid #FBBF24',
              borderRadius: 8, color: '#FBBF24',
              fontSize: 12, fontWeight: 700, cursor: 'pointer',
            }}
          >{resetting ? 'Resetting...' : 'Reset all to Pending'}</button>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0', overflowX: 'auto', paddingBottom: 2 }}>
        {[
          { key: 'all',         label: 'All',         icon: '📋', color: '#94A3B8' },
          ...STATUSES,
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            style={{
              flexShrink: 0,
              padding: '7px 14px',
              background: activeTab === tab.key ? `${tab.color}22` : 'rgba(255,255,255,0.05)',
              border: `1.5px solid ${activeTab === tab.key ? tab.color : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 20,
              color: activeTab === tab.key ? tab.color : 'var(--text-muted)',
              fontSize: 13, fontWeight: activeTab === tab.key ? 700 : 500,
              cursor: 'pointer', transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', gap: 5,
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            <span style={{
              background: activeTab === tab.key ? `${tab.color}33` : 'rgba(255,255,255,0.08)',
              borderRadius: 10, padding: '1px 7px',
              fontSize: 11, fontWeight: 700,
            }}>{counts[tab.key] ?? 0}</span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px' }}>
          <div style={{ fontSize: 40, marginBottom: 10 }}>
            {activeTab === 'done' ? '🎉' : activeTab === 'pending' ? '✅' : '📋'}
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
            {activeTab === 'done' ? 'Nothing done yet' :
             activeTab === 'pending' ? 'No pending chores — nice!' :
             activeTab === 'in_progress' ? 'Nothing in progress' : 'No chores yet'}
          </div>
          {activeTab === 'all' && (
            <button onClick={() => setShowAdd(true)} style={{
              marginTop: 14, padding: '10px 20px',
              background: 'var(--primary)', border: 'none',
              borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>+ Add first chore</button>
          )}
        </div>
      ) : (
        filtered.map(chore => <ChoreCard key={chore.id} chore={chore} />)
      )}

      {/* Hint text */}
      {filtered.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 8 }}>
          Tap a card to change its status
        </p>
      )}

      {/* ── ADD MODAL ── */}
      {showAdd && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
            display: 'flex', alignItems: 'flex-end', zIndex: 1000,
          }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>+ New Chore</h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {CHORE_EMOJIS.map(e => (
                <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{
                  width: 38, height: 38, borderRadius: 8, fontSize: 20,
                  background: form.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  border: form.emoji === e ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}>{e}</button>
              ))}
            </div>

            <input
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Chore name..."
              className="input" style={{ width: '100%', marginBottom: 12 }}
              autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()}
            />

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={form.assignedToId}
                onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
                className="input" style={{ flex: 1 }}>
                <option value="">Anyone</option>
                {(members as any[]).map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                ))}
              </select>
              <select value={form.frequency}
                onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}
                className="input" style={{ flex: 1 }}>
                {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Stars:</span>
              {[1, 2, 3, 5, 8, 10].map(n => (
                <button key={n} onClick={() => setForm(f => ({ ...f, stars: n }))} style={{
                  padding: '4px 10px', borderRadius: 8,
                  background: form.stars === n ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                  border: form.stars === n ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                  color: form.stars === n ? '#fff' : 'var(--text-muted)',
                  cursor: 'pointer', fontSize: 13, fontWeight: 600,
                }}>⭐{n}</button>
              ))}
            </div>

            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <div onClick={() => setForm(f => ({ ...f, proofRequired: !f.proofRequired }))}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: form.proofRequired ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                  position: 'relative', transition: 'background 0.2s', flexShrink: 0,
                }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: form.proofRequired ? 23 : 3,
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: 13 }}>Require photo proof</span>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }}
                onClick={handleAdd}
                disabled={!form.title.trim() || createChore.isPending}
              >{createChore.isPending ? 'Adding...' : '+ Add Chore'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}