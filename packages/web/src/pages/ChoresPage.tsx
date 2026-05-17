import { useState } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { MediaProof } from '../components/MediaProof';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧'];
const FREQS = ['daily','weekly','once'] as const;

type Status = 'pending' | 'in_progress' | 'done';

const STATUS_CONFIG: Record<Status, { label: string; color: string; bg: string; next: Status | null; nextLabel: string }> = {
  pending:     { label: 'Pending',     color: '#94a3b8', bg: 'transparent',          next: 'in_progress', nextLabel: 'Start' },
  in_progress: { label: 'In Progress', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)', next: 'done',        nextLabel: 'Mark Done' },
  done:        { label: 'Done',        color: '#4ADE80', bg: 'rgba(74,222,128,0.15)', next: 'pending',     nextLabel: 'Undo' },
};

function avatarSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

function MemberAvatar({ member, size = 22 }: { member: any; size?: number }) {
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: member.color,
      border: `2px solid ${member.color}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, overflow: 'hidden', flexShrink: 0,
    }}>
      {member.avatarUrl
        ? <img src={avatarSrc(member.avatarUrl)!} alt={member.name}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : member.emoji}
    </div>
  );
}

function StatusBadge({ status }: { status: Status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, padding: '2px 8px', borderRadius: 20,
      background: cfg.bg, color: cfg.color,
      border: `1px solid ${cfg.color}44`,
    }}>{cfg.label}</span>
  );
}

function StatusButton({ status, onClick }: { status: Status; onClick: () => void }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  const icon = status === 'pending' ? '▷' : status === 'in_progress' ? '✓' : '↩';
  return (
    <button onClick={onClick} title={cfg.nextLabel} style={{
      width: 32, height: 32, borderRadius: '50%', flexShrink: 0,
      border: `2px solid ${cfg.color}`,
      background: cfg.bg,
      color: cfg.color,
      fontSize: 13, cursor: 'pointer',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      transition: 'all 0.15s',
    }}>{icon}</button>
  );
}

export default function ChoresPage() {
  const { member } = useAuthStore();
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] } = useMembers();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const deleteChore = useDeleteChore();

  const [filter, setFilter] = useState<'pending' | 'in_progress' | 'done' | 'all'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [proofChoreId, setProofChoreId] = useState<string | null>(null);
  const [newChore, setNewChore] = useState({
    title: '', emoji: '🧹', assignedToId: '',
    frequency: 'daily' as const, stars: 5, proofRequired: false, dueDate: '',
  });

  function getStatus(chore: any): Status {
    // Support both old boolean `done` field and new `status` field
    if (chore.status) return chore.status as Status;
    return chore.done ? 'done' : 'pending';
  }

  const filtered = (chores as any[]).filter(c =>
    filter === 'all' ? true : getStatus(c) === filter
  );

  async function handleAdvanceStatus(chore: any) {
    const current = getStatus(chore);
    const cfg = STATUS_CONFIG[current];
    if (!cfg.next) return;

    // If needs proof and moving to done, request it first
    if (cfg.next === 'done' && chore.proofRequired && !chore.proofUrl) {
      setProofChoreId(chore.id);
      return;
    }

    updateChore.mutate({
      id: chore.id,
      data: { status: cfg.next, done: cfg.next === 'done' },
    });
  }

  async function handleProofUpload(url: string, type: 'image' | 'video') {
    if (!proofChoreId) return;
    updateChore.mutate({
      id: proofChoreId,
      data: { status: 'done', done: true, proofUrl: url, proofType: type },
    });
    setProofChoreId(null);
  }

  function handleAdd() {
    if (!newChore.title.trim()) return;
    createChore.mutate({
      ...newChore,
      assignedToId: newChore.assignedToId || undefined,
      dueDate: newChore.dueDate || undefined,
    });
    setNewChore({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false, dueDate: '' });
    setShowAdd(false);
  }

  const FILTERS: { key: typeof filter; label: string }[] = [
    { key: 'pending',     label: '⏳ Pending' },
    { key: 'in_progress', label: '🔥 In Progress' },
    { key: 'done',        label: '✅ Done' },
    { key: 'all',         label: '📋 All' },
  ];

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>✅ Chores</h1>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize: 13 }}>+ Add chore</button>
      </div>

      {/* Filter tabs */}
      <div style={{
        display: 'flex', gap: 4, marginBottom: 16,
        background: 'var(--bg-secondary)', padding: 4, borderRadius: 10,
        border: '1.5px solid var(--border)',
      }}>
        {FILTERS.map(({ key, label }) => (
          <button key={key} onClick={() => setFilter(key)} style={{
            flex: 1, padding: '7px 4px', borderRadius: 8, fontWeight: 800,
            fontSize: 11, cursor: 'pointer', border: 'none',
            background: filter === key ? 'var(--primary)' : 'transparent',
            color: filter === key ? '#fff' : 'var(--text-secondary)',
          }}>{label}</button>
        ))}
      </div>

      {/* Chore list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontWeight: 700 }}>
          {filter === 'pending' ? '🎉 All caught up!' : filter === 'in_progress' ? 'Nothing in progress.' : 'No chores here yet.'}
        </div>
      ) : filtered.map((chore: any) => {
        const assignee = (members as any[]).find(m => m.id === chore.assignedToId);
        const status = getStatus(chore);
        return (
          <div key={chore.id} className="card" style={{
            marginBottom: 8,
            opacity: status === 'done' ? 0.65 : 1,
            transition: 'opacity 0.2s',
            borderLeft: assignee ? `3px solid ${assignee.color}` : '3px solid var(--border)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <StatusButton status={status} onClick={() => handleAdvanceStatus(chore)} />

              <span style={{ fontSize: 20 }}>{chore.emoji}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 800, fontSize: 14,
                  textDecoration: status === 'done' ? 'line-through' : 'none',
                }}>
                  {chore.title}
                </div>
                <div style={{ display: 'flex', gap: 8, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                  {assignee ? (
                    <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <MemberAvatar member={assignee} size={18} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: assignee.color }}>{assignee.name}</span>
                    </span>
                  ) : (
                    <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-muted)' }}>👥 Anyone</span>
                  )}
                  <span style={{
                    fontSize: 10, fontWeight: 700, color: 'var(--text-muted)',
                    background: 'var(--bg-secondary)', padding: '1px 6px', borderRadius: 4,
                  }}>{chore.frequency}</span>
                  <StatusBadge status={status} />
                  {chore.proofRequired && !chore.proofUrl && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'var(--accent)' }}>📸 proof needed</span>
                  )}
                  {chore.proofUrl && (
                    <a href={chore.proofUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: 10, fontWeight: 700, color: 'var(--sky)' }}>
                      {chore.proofType === 'video' ? '🎥 view' : '📷 view'}
                    </a>
                  )}
                </div>
              </div>

              <span style={{ fontWeight: 900, fontSize: 12, color: 'var(--warning)', flexShrink: 0 }}>
                ⭐{chore.stars}
              </span>

              {member?.role === 'parent' && (
                <button
                  onClick={() => { if (confirm('Delete this chore?')) deleteChore.mutate(chore.id); }}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14, padding: 4, flexShrink: 0 }}
                >🗑️</button>
              )}
            </div>

            {proofChoreId === chore.id && (
              <div style={{ marginTop: 12 }}>
                <MediaProof onUpload={handleProofUpload} onCancel={() => setProofChoreId(null)} />
              </div>
            )}
          </div>
        );
      })}

      {/* Add chore modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>➕ New Chore</div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Emoji picker */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {CHORE_EMOJIS.map(e => (
                  <button type="button" key={e} onClick={() => setNewChore(p => ({ ...p, emoji: e }))} style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: 8, cursor: 'pointer',
                    border: `2px solid ${newChore.emoji === e ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'var(--bg-secondary)',
                  }}>{e}</button>
                ))}
              </div>

              <input
                className="input" placeholder="Chore name"
                value={newChore.title}
                onChange={e => setNewChore(p => ({ ...p, title: e.target.value }))}
                autoFocus
              />

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 4 }}>Frequency</label>
                  <select className="input" value={newChore.frequency}
                    onChange={e => setNewChore(p => ({ ...p, frequency: e.target.value as any }))}>
                    {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 4 }}>⭐ Stars</label>
                  <input type="number" className="input" min={1} max={50} value={newChore.stars}
                    onChange={e => setNewChore(p => ({ ...p, stars: +e.target.value }))} />
                </div>
              </div>

              {/* Assign to */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 8 }}>Assign to</label>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <button type="button"
                    onClick={() => setNewChore(p => ({ ...p, assignedToId: '' }))}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 6,
                      padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                      border: `2px solid ${!newChore.assignedToId ? 'var(--primary)' : 'var(--border)'}`,
                      background: !newChore.assignedToId ? 'rgba(99,102,241,0.1)' : 'var(--bg-secondary)',
                      fontWeight: 700, fontSize: 12,
                      color: !newChore.assignedToId ? 'var(--primary)' : 'var(--text-secondary)',
                    }}>👥 Anyone</button>

                  {(members as any[]).map((m: any) => (
                    <button type="button" key={m.id}
                      onClick={() => setNewChore(p => ({ ...p, assignedToId: m.id }))}
                      style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '6px 12px', borderRadius: 20, cursor: 'pointer',
                        border: `2px solid ${newChore.assignedToId === m.id ? m.color : 'var(--border)'}`,
                        background: newChore.assignedToId === m.id ? `${m.color}22` : 'var(--bg-secondary)',
                        fontWeight: 700, fontSize: 12,
                        color: newChore.assignedToId === m.id ? m.color : 'var(--text-secondary)',
                      }}>
                      <MemberAvatar member={m} size={20} />
                      {m.name}
                    </button>
                  ))}
                </div>
              </div>

              <label style={{
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', background: 'var(--bg-tertiary)', borderRadius: 10, cursor: 'pointer',
              }}>
                <input type="checkbox" checked={newChore.proofRequired}
                  onChange={e => setNewChore(p => ({ ...p, proofRequired: e.target.checked }))}
                  style={{ width: 18, height: 18, accentColor: 'var(--primary)' }} />
                <div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>📸 Require photo/video proof</div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>Kids must submit proof to mark done</div>
                </div>
              </label>

              <div className="flex gap-3">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleAdd}
                  disabled={!newChore.title.trim() || createChore.isPending}>
                  {createChore.isPending ? 'Adding...' : '+ Add Chore'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}