import { useState } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧','🪟','🧊','🏠'];
const FREQS = ['daily', 'weekly', 'once'] as const;
type Status = 'pending' | 'in_progress' | 'done';

const STATUS_META: Record<Status, { label: string; icon: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     icon: '⏳', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  in_progress: { label: 'In Progress', icon: '🔥', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)'  },
  done:        { label: 'Done',        icon: '✅', color: '#4ADE80', bg: 'rgba(74,222,128,0.15)'  },
};

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'done') return false;
  return new Date() > new Date(dueDate);
}

function dueDateLabel(dueDate?: string | null, status?: string) {
  if (!dueDate) return null;
  if (status === 'done') return null;
  const d = new Date(dueDate);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff}d`;
}

export default function ChoresPage() {
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] } = useMembers();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const deleteChore = useDeleteChore();

  const [tab, setTab]       = useState<Status | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', emoji: '🧹', assignedToId: '',
    frequency: 'daily' as typeof FREQS[number],
    stars: 5, proofRequired: false, dueDate: '',
  });

  const all = chores as any[];
  const counts = {
    all: all.length,
    pending:     all.filter(c => (c.status || 'pending') === 'pending').length,
    in_progress: all.filter(c => (c.status || 'pending') === 'in_progress').length,
    done:        all.filter(c => (c.status || 'pending') === 'done').length,
  };
  const overdueCount = all.filter(c => isOverdue(c.dueDate, c.status)).length;
  const list = tab === 'all' ? all : all.filter(c => (c.status || 'pending') === tab);

  const changeStatus = (chore: any, status: Status) =>
    updateChore.mutate({ id: chore.id, data: { status } });

  const reassign = (chore: any, assignedToId: string) =>
    updateChore.mutate({ id: chore.id, data: { assignedToId: assignedToId || null } });

  const setDueDate = (chore: any, dueDate: string) =>
    updateChore.mutate({ id: chore.id, data: { dueDate: dueDate || null } });

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    try {
      await createChore.mutateAsync({
        ...form,
        status: 'pending',
        dueDate: form.dueDate || null,
        assignedToId: form.assignedToId || null,
      });
      setForm({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false, dueDate: '' });
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  const memberList = members as any[];

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧹 Chores</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {counts.done} / {counts.all} done today
            {overdueCount > 0 && <span style={{ color: '#F87171', marginLeft: 8 }}>· {overdueCount} overdue</span>}
          </p>
        </div>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '9px 18px', background: 'var(--primary)',
          border: 'none', borderRadius: 10, color: '#fff',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>+ Add</button>
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 12, padding: '10px 14px', margin: '12px 0',
        }}>
          <span style={{ fontSize: 13, color: '#F87171', fontWeight: 700 }}>
            ⚠️ {overdueCount} overdue chore{overdueCount > 1 ? 's' : ''} — streaks at risk!
          </span>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0', overflowX: 'auto' }}>
        {[
          { key: 'all', label: 'All', icon: '📋', color: '#94A3B8', count: counts.all },
          { key: 'pending',     ...STATUS_META.pending,     count: counts.pending     },
          { key: 'in_progress', ...STATUS_META.in_progress, count: counts.in_progress },
          { key: 'done',        ...STATUS_META.done,        count: counts.done        },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            flexShrink: 0, padding: '7px 12px',
            background: tab === t.key ? `${t.color}22` : 'rgba(255,255,255,0.05)',
            border: `1.5px solid ${tab === t.key ? t.color : 'rgba(255,255,255,0.1)'}`,
            borderRadius: 20, color: tab === t.key ? t.color : 'var(--text-muted)',
            fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
            display: 'flex', alignItems: 'center', gap: 5,
          }}>
            <span>{t.icon}</span><span>{t.label}</span>
            <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* List */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>
            {tab === 'done' ? '🎉' : tab === 'pending' ? '✅' : '📋'}
          </div>
          {tab === 'all'
            ? <button onClick={() => setShowAdd(true)} style={{
                marginTop: 8, padding: '10px 20px', background: 'var(--primary)',
                border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>+ Add first chore</button>
            : `No ${tab.replace('_', ' ')} chores`}
        </div>
      ) : list.map((chore: any) => {
        const status: Status = chore.status || 'pending';
        const meta = STATUS_META[status];
        const assignee = memberList.find(m => m.id === (chore.assignedToId || chore.assignedTo?.id));
        const overdue  = isOverdue(chore.dueDate, status);
        const dueLabel = dueDateLabel(chore.dueDate, status);

        return (
          <div key={chore.id} style={{
            background: 'rgba(255,255,255,0.04)',
            border: `1.5px solid ${overdue ? '#F87171' : meta.color + '44'}`,
            borderRadius: 14, marginBottom: 10, overflow: 'hidden',
          }}>
            {/* Main row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{chore.emoji || '🧹'}</span>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontWeight: 700, fontSize: 15,
                  color: status === 'done' ? '#64748B' : 'var(--text)',
                  textDecoration: status === 'done' ? 'line-through' : 'none',
                  whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                }}>{chore.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⭐{chore.stars}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {chore.frequency}</span>
                  {assignee && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {assignee.emoji} {assignee.name}</span>}
                  {dueLabel && (
                    <span style={{
                      fontSize: 11, fontWeight: 700,
                      color: overdue ? '#F87171' : '#FBBF24',
                      background: overdue ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)',
                      borderRadius: 6, padding: '1px 6px',
                    }}>📅 {dueLabel}</span>
                  )}
                </div>
              </div>

              {/* Status dropdown */}
              <select
                value={status}
                onChange={e => changeStatus(chore, e.target.value as Status)}
                style={{
                  padding: '6px 8px',
                  background: meta.bg,
                  border: `1.5px solid ${meta.color}66`,
                  borderRadius: 10, color: meta.color,
                  fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0,
                }}
              >
                <option value="pending">⏳ Pending</option>
                <option value="in_progress">🔥 In Progress</option>
                <option value="done">✅ Done</option>
              </select>

              <button onClick={() => { if (confirm('Delete?')) deleteChore.mutate(chore.id); }} style={{
                width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                color: '#F87171', fontSize: 16, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>×</button>
            </div>

            {/* Reassign + due date row (always visible, compact) */}
            <div style={{
              borderTop: '1px solid rgba(255,255,255,0.06)',
              padding: '8px 14px',
              display: 'flex', gap: 8, alignItems: 'center',
            }}>
              {/* Reassign */}
              <select
                value={chore.assignedToId || ''}
                onChange={e => reassign(chore, e.target.value)}
                style={{
                  flex: 1, padding: '5px 8px', fontSize: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.1)',
                  borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer',
                }}
              >
                <option value="">👤 Unassigned</option>
                {memberList.map(m => (
                  <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                ))}
              </select>

              {/* Due date */}
              <input
                type="date"
                value={chore.dueDate ? chore.dueDate.substring(0, 10) : ''}
                onChange={e => setDueDate(chore, e.target.value)}
                style={{
                  flex: 1, padding: '5px 8px', fontSize: 12,
                  background: 'rgba(255,255,255,0.05)',
                  border: `1px solid ${overdue ? '#F87171' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 8, color: overdue ? '#F87171' : 'var(--text-muted)',
                  cursor: 'pointer',
                }}
              />
            </div>
          </div>
        );
      })}

      {list.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Use the dropdown to change status · reassign or set due date below each card
        </p>
      )}

      {/* ── ADD MODAL ── */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>+ New Chore</h2>

            {/* Emoji */}
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

            {/* Title */}
            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Chore name..." className="input"
              style={{ width: '100%', marginBottom: 12 }}
              autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()} />

            {/* Assign + Frequency */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))}
                className="input" style={{ flex: 1 }}>
                <option value="">Anyone</option>
                {memberList.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
              </select>
              <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))}
                className="input" style={{ flex: 1 }}>
                {FREQS.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            {/* Due date */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>
                📅 Due date (optional)
              </label>
              <input type="date" value={form.dueDate}
                onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))}
                className="input" style={{ width: '100%' }} />
            </div>

            {/* Stars */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
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

            {/* Proof */}
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
              <div onClick={() => setForm(f => ({ ...f, proofRequired: !f.proofRequired }))} style={{
                width: 44, height: 24, borderRadius: 12, flexShrink: 0,
                background: form.proofRequired ? 'var(--primary)' : 'rgba(255,255,255,0.12)',
                position: 'relative', transition: 'background 0.2s',
              }}>
                <div style={{
                  width: 18, height: 18, borderRadius: '50%', background: '#fff',
                  position: 'absolute', top: 3, left: form.proofRequired ? 23 : 3, transition: 'left 0.2s',
                }} />
              </div>
              <span style={{ fontSize: 13 }}>Require photo proof</span>
            </label>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }}
                onClick={handleAdd} disabled={!form.title.trim() || createChore.isPending}>
                {createChore.isPending ? 'Adding...' : '+ Add Chore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}