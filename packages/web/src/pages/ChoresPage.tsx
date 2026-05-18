import { useState, useRef } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧','🪟','🧊','🏠'];
const FREQS = ['daily', 'weekly', 'once'] as const;

type Status = 'pending' | 'in_progress' | 'done';

const COLUMNS: { key: Status; label: string; icon: string; color: string; bg: string; border: string }[] = [
  { key: 'pending',     label: 'Pending',     icon: '⏳', color: '#94A3B8', bg: 'rgba(148,163,184,0.06)', border: 'rgba(148,163,184,0.2)' },
  { key: 'in_progress', label: 'In Progress', icon: '🔥', color: '#FBBF24', bg: 'rgba(251,191,36,0.06)',  border: 'rgba(251,191,36,0.3)'  },
  { key: 'done',        label: 'Done',        icon: '✅', color: '#4ADE80', bg: 'rgba(74,222,128,0.06)',  border: 'rgba(74,222,128,0.3)'  },
];

function nextStatus(s: Status): Status {
  if (s === 'pending') return 'in_progress';
  if (s === 'in_progress') return 'done';
  return 'pending';
}

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function MemberAvatar({ member, size = 22 }: { member: any; size?: number }) {
  const src = avatarSrc(member?.avatarUrl);
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: member?.color || '#6366F1',
      border: `2px solid ${member?.color || '#6366F1'}`,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontSize: size * 0.5, overflow: 'hidden', flexShrink: 0,
    }}>
      {src
        ? <img src={src} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : <span>{member?.emoji || '👤'}</span>}
    </div>
  );
}

export default function ChoresPage() {
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] } = useMembers();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const deleteChore = useDeleteChore();

  const [showAdd, setShowAdd] = useState(false);
  const [view, setView] = useState<'kanban' | 'list'>('kanban');
  const [listFilter, setListFilter] = useState<Status | 'all'>('all');
  const [newChore, setNewChore] = useState({
    title: '', emoji: '🧹', assignedToId: '',
    frequency: 'daily' as typeof FREQS[number],
    stars: 5, proofRequired: false,
  });

  // Drag state
  const [dragId, setDragId] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<Status | null>(null);
  const dragItem = useRef<any>(null);

  const allChores = chores as any[];

  const choresByStatus = (status: Status) =>
    allChores.filter(c => (c.status || 'pending') === status);

  const handleAdvance = async (chore: any) => {
    const next = nextStatus(chore.status || 'pending');
    try {
      await updateChore.mutateAsync({ id: chore.id, data: { status: next } });
    } catch (e) { console.error(e); }
  };

  const handleStatusSet = async (chore: any, status: Status) => {
    if (chore.status === status) return;
    try {
      await updateChore.mutateAsync({ id: chore.id, data: { status } });
    } catch (e) { console.error(e); }
  };

  // --- Drag handlers ---
  const onDragStart = (e: React.DragEvent, chore: any) => {
    dragItem.current = chore;
    setDragId(chore.id);
    e.dataTransfer.effectAllowed = 'move';
  };
  const onDragEnd = () => {
    setDragId(null);
    setDragOver(null);
    dragItem.current = null;
  };
  const onDragOver = (e: React.DragEvent, col: Status) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOver(col);
  };
  const onDrop = async (e: React.DragEvent, col: Status) => {
    e.preventDefault();
    const chore = dragItem.current;
    if (chore && chore.status !== col) {
      await handleStatusSet(chore, col);
    }
    setDragId(null);
    setDragOver(null);
  };

  const handleAdd = async () => {
    if (!newChore.title.trim()) return;
    try {
      await createChore.mutateAsync({ ...newChore, status: 'pending' });
      setNewChore({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false });
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  // ── Chore Card ──────────────────────────────────────────────
  const ChoreCard = ({ chore }: { chore: any }) => {
    const status: Status = chore.status || 'pending';
    const col = COLUMNS.find(c => c.key === status)!;
    const assignee = (members as any[]).find(m => m.id === chore.assignedToId || m.id === chore.assignedTo?.id);
    const isDragging = dragId === chore.id;

    return (
      <div
        draggable
        onDragStart={e => onDragStart(e, chore)}
        onDragEnd={onDragEnd}
        style={{
          background: isDragging ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
          border: `1px solid ${isDragging ? col.color : 'rgba(255,255,255,0.1)'}`,
          borderRadius: 12,
          padding: '12px 14px',
          marginBottom: 8,
          cursor: 'grab',
          opacity: isDragging ? 0.5 : 1,
          transition: 'all 0.15s ease',
          userSelect: 'none',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
          <span style={{ fontSize: 22, flexShrink: 0 }}>{chore.emoji || '🧹'}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontWeight: 600,
              fontSize: 14,
              color: status === 'done' ? '#94A3B8' : 'var(--text)',
              textDecoration: status === 'done' ? 'line-through' : 'none',
              whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
            }}>{chore.title}</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: col.color,
                background: `${col.color}22`, borderRadius: 6,
                padding: '2px 7px',
              }}>{col.icon} {col.label}</span>
              <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                ⭐ {chore.stars}
              </span>
              {chore.frequency && (
                <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  · {chore.frequency}
                </span>
              )}
            </div>
          </div>
          {/* Assignee avatar */}
          {assignee && (
            <MemberAvatar member={assignee} size={26} />
          )}
        </div>

        {/* Action row */}
        <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
          {/* Advance button */}
          {status !== 'done' && (
            <button
              onClick={() => handleAdvance(chore)}
              style={{
                flex: 1,
                padding: '6px 0',
                background: status === 'pending' ? 'rgba(251,191,36,0.15)' : 'rgba(74,222,128,0.15)',
                border: `1px solid ${status === 'pending' ? '#FBBF24' : '#4ADE80'}`,
                borderRadius: 8,
                color: status === 'pending' ? '#FBBF24' : '#4ADE80',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >
              {status === 'pending' ? '▶ Start' : '✓ Mark Done'}
            </button>
          )}
          {status === 'done' && (
            <button
              onClick={() => handleStatusSet(chore, 'pending')}
              style={{
                flex: 1, padding: '6px 0',
                background: 'rgba(148,163,184,0.1)',
                border: '1px solid rgba(148,163,184,0.3)',
                borderRadius: 8, color: '#94A3B8',
                fontSize: 12, fontWeight: 600, cursor: 'pointer',
              }}
            >↩ Undo</button>
          )}
          <button
            onClick={() => deleteChore.mutate(chore.id)}
            style={{
              width: 30, height: 30, borderRadius: 8,
              background: 'rgba(248,113,113,0.1)',
              border: '1px solid rgba(248,113,113,0.2)',
              color: '#F87171', fontSize: 13, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >×</button>
        </div>
      </div>
    );
  };

  // ── Kanban Column ────────────────────────────────────────────
  const KanbanColumn = ({ col }: { col: typeof COLUMNS[0] }) => {
    const items = choresByStatus(col.key);
    const isOver = dragOver === col.key;

    return (
      <div
        onDragOver={e => onDragOver(e, col.key)}
        onDrop={e => onDrop(e, col.key)}
        style={{
          flex: 1, minWidth: 0,
          background: isOver ? `${col.color}15` : col.bg,
          border: `2px solid ${isOver ? col.color : col.border}`,
          borderRadius: 16,
          padding: '14px 12px',
          transition: 'all 0.15s ease',
          minHeight: 200,
        }}
      >
        {/* Column header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
          <span style={{ fontSize: 16 }}>{col.icon}</span>
          <span style={{ fontWeight: 700, fontSize: 13, color: col.color, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            {col.label}
          </span>
          <span style={{
            marginLeft: 'auto',
            background: `${col.color}22`, color: col.color,
            borderRadius: 20, padding: '1px 8px', fontSize: 12, fontWeight: 700,
          }}>{items.length}</span>
        </div>

        {/* Drop hint */}
        {isOver && dragItem.current && (
          <div style={{
            border: `2px dashed ${col.color}`,
            borderRadius: 10, padding: '10px',
            marginBottom: 8, textAlign: 'center',
            color: col.color, fontSize: 13, fontWeight: 600,
            background: `${col.color}10`,
          }}>Drop here → {col.label}</div>
        )}

        {items.length === 0 && !isOver && (
          <div style={{
            textAlign: 'center', padding: '24px 0',
            color: 'var(--text-muted)', fontSize: 13,
            border: '2px dashed rgba(255,255,255,0.08)',
            borderRadius: 10,
          }}>
            Drag tasks here
          </div>
        )}

        {items.map(chore => (
          <ChoreCard key={chore.id} chore={chore} />
        ))}
      </div>
    );
  };

  // ── List view ────────────────────────────────────────────────
  const listItems = listFilter === 'all'
    ? allChores
    : allChores.filter(c => (c.status || 'pending') === listFilter);

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧹 Chores</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {allChores.filter(c => (c.status || 'pending') === 'done').length} / {allChores.length} done today
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {/* View toggle */}
          <button
            onClick={() => setView(v => v === 'kanban' ? 'list' : 'kanban')}
            style={{
              padding: '8px 14px',
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: 10, color: 'var(--text)',
              fontSize: 13, cursor: 'pointer',
            }}
          >{view === 'kanban' ? '☰ List' : '⊞ Board'}</button>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)',
              border: 'none', borderRadius: 10,
              color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: 'pointer',
            }}
          >+ Add</button>
        </div>
      </div>

      {/* Quick stats */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, overflowX: 'auto' }}>
        {COLUMNS.map(col => {
          const count = choresByStatus(col.key).length;
          return (
            <div key={col.key} style={{
              flexShrink: 0,
              background: `${col.color}15`,
              border: `1px solid ${col.color}44`,
              borderRadius: 10, padding: '8px 14px',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <span>{col.icon}</span>
              <span style={{ fontWeight: 700, color: col.color }}>{count}</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>{col.label}</span>
            </div>
          );
        })}
      </div>

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : view === 'kanban' ? (
        /* ── KANBAN BOARD ── */
        <div style={{
          display: 'flex', gap: 10,
          /* On mobile, scroll horizontally */
          overflowX: 'auto',
          paddingBottom: 8,
          minHeight: 300,
        }}>
          {COLUMNS.map(col => <KanbanColumn key={col.key} col={col} />)}
        </div>
      ) : (
        /* ── LIST VIEW ── */
        <div>
          {/* Filter tabs */}
          <div style={{ display: 'flex', gap: 6, marginBottom: 12 }}>
            {(['all', ...COLUMNS.map(c => c.key)] as const).map(f => (
              <button
                key={f}
                onClick={() => setListFilter(f as any)}
                style={{
                  padding: '6px 12px', borderRadius: 8,
                  background: listFilter === f ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  border: 'none', color: listFilter === f ? '#fff' : 'var(--text-muted)',
                  fontSize: 12, fontWeight: 600, cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >{f === 'all' ? 'All' : f.replace('_', ' ')}</button>
            ))}
          </div>
          {listItems.map(chore => <ChoreCard key={chore.id} chore={chore} />)}
          {listItems.length === 0 && (
            <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No chores here</div>
          )}
        </div>
      )}

      {/* ── ADD MODAL ── */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0,
          background: 'rgba(0,0,0,0.7)',
          display: 'flex', alignItems: 'flex-end',
          zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>+ New Chore</h2>

            {/* Emoji row */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {CHORE_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewChore(n => ({ ...n, emoji: e }))}
                  style={{
                    width: 36, height: 36, borderRadius: 8, fontSize: 18,
                    background: newChore.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    border: newChore.emoji === e ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    cursor: 'pointer',
                  }}>{e}</button>
              ))}
            </div>

            {/* Title */}
            <input
              value={newChore.title}
              onChange={e => setNewChore(n => ({ ...n, title: e.target.value }))}
              placeholder="Chore name..."
              className="input"
              style={{ width: '100%', marginBottom: 12 }}
              autoFocus
            />

            {/* Assign & Frequency */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select
                value={newChore.assignedToId}
                onChange={e => setNewChore(n => ({ ...n, assignedToId: e.target.value }))}
                className="input" style={{ flex: 1 }}
              >
                <option value="">Anyone</option>
                {(members as any[]).map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                ))}
              </select>
              <select
                value={newChore.frequency}
                onChange={e => setNewChore(n => ({ ...n, frequency: e.target.value as any }))}
                className="input" style={{ flex: 1 }}
              >
                {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Stars */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'var(--text-muted)', marginRight: 4 }}>Stars:</span>
              {[1,2,3,5,8,10].map(n => (
                <button key={n} onClick={() => setNewChore(c => ({ ...c, stars: n }))}
                  style={{
                    padding: '4px 10px', borderRadius: 8,
                    background: newChore.stars === n ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                    border: newChore.stars === n ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                    color: newChore.stars === n ? '#fff' : 'var(--text-muted)',
                    cursor: 'pointer', fontSize: 13, fontWeight: 600,
                  }}>⭐{n}</button>
              ))}
            </div>

            {/* Proof toggle */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <div
                onClick={() => setNewChore(n => ({ ...n, proofRequired: !n.proofRequired }))}
                style={{
                  width: 44, height: 24, borderRadius: 12,
                  background: newChore.proofRequired ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                  position: 'relative', transition: 'background 0.2s',
                }}
              >
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3,
                  left: newChore.proofRequired ? 23 : 3,
                  transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: 13 }}>Require photo proof</span>
            </label>

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                className="btn btn-primary" style={{ flex: 2 }}
                onClick={handleAdd}
                disabled={!newChore.title.trim() || createChore.isPending}
              >{createChore.isPending ? 'Adding...' : '+ Add Chore'}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}