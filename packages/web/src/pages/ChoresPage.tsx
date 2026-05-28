import { useState, useEffect } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧','🪟','🧊','🏠'];
const FREQS = ['daily', 'weekly', 'once'] as const;
const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_SHORT    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

type Status = 'pending' | 'in_progress' | 'done';

const STATUS_META: Record<Status, { label: string; icon: string; color: string; bg: string }> = {
  pending:     { label: 'Pending',     icon: '⏳', color: '#94A3B8', bg: 'rgba(148,163,184,0.15)' },
  in_progress: { label: 'In Progress', icon: '🔥', color: '#FBBF24', bg: 'rgba(251,191,36,0.15)'  },
  done:        { label: 'Done',        icon: '✅', color: '#4ADE80', bg: 'rgba(74,222,128,0.15)'  },
};

function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'done') return false;
  return new Date() > new Date(dueDate);
}
function dueDateLabel(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'done') return null;
  const d = new Date(dueDate);
  const today = new Date(); today.setHours(0,0,0,0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)   return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff}d`;
}

// ─── Weekly Rules Panel ───────────────────────────────────────────────────────
interface Rule {
  id: string; label: string; minStars: number; consequenceNote: string; active: boolean;
  assignedTo: { id: string; name: string; emoji: string; color: string };
  outcomes: { passed: boolean; starsEarned: number; weekStart: string }[];
}

function WeeklyRulesPanel() {
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();
  const isParent = member?.role === 'parent';

  const [rules, setRules]           = useState<Rule[]>([]);
  const [loading, setLoading]       = useState(true);
  const [showForm, setShowForm]     = useState(false);
  const [saving, setSaving]         = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [assignedToId, setAssignedToId]       = useState('');
  const [label, setLabel]                     = useState('Weekly chores goal');
  const [minStars, setMinStars]               = useState(5);
  const [consequenceNote, setConsequenceNote] = useState('Screen time reduced on weekend');

  useEffect(() => {
    if (!isParent) return;
    api.get('/rules').then(r => setRules(r.data)).catch(() => {}).finally(() => setLoading(false));
  }, [isParent]);

  async function handleCreate() {
    if (!assignedToId) return alert('Please select a family member');
    setSaving(true);
    try {
      const { data } = await api.post('/rules', { assignedToId, label, minStars, consequenceNote });
      setRules(prev => [data, ...prev]);
      setShowForm(false);
      setAssignedToId(''); setLabel('Weekly chores goal'); setMinStars(5);
      setConsequenceNote('Screen time reduced on weekend');
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to create rule'); }
    finally { setSaving(false); }
  }

  async function toggleActive(rule: Rule) {
    try {
      const { data } = await api.patch(`/rules/${rule.id}`, { active: !rule.active });
      setRules(prev => prev.map(r => r.id === rule.id ? data : r));
    } catch { alert('Failed to update rule'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rule?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/rules/${id}`);
      setRules(prev => prev.filter(r => r.id !== id));
    } catch { alert('Failed to delete rule'); }
    finally { setDeletingId(null); }
  }

  const nonParentMembers = (members as any[]).filter(m => m.role !== 'parent');
  if (!isParent) return null;

  return (
    <div style={{ marginTop: 32, padding: '20px', borderRadius: 20, background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h2 style={{ fontSize: 15, fontWeight: 900, margin: 0 }}>⚡ Weekly Rules</h2>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '4px 0 0' }}>Star goals evaluated every Friday at 4pm</p>
        </div>
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: showForm ? 'rgba(255,255,255,0.06)' : 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer' }}>
          {showForm ? 'Cancel' : '+ New Rule'}
        </button>
      </div>

      {showForm && (
        <div style={{ padding: '16px', borderRadius: 16, marginBottom: 16, background: 'rgba(124,111,247,0.08)', border: '1.5px solid rgba(124,111,247,0.25)' }}>
          <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 12, color: '#A78BFA' }}>New Weekly Rule</div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>WHO DOES THIS APPLY TO?</label>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {nonParentMembers.map((m: any) => (
                <button key={m.id} onClick={() => setAssignedToId(m.id)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20, cursor: 'pointer', background: assignedToId === m.id ? m.color + '30' : 'rgba(255,255,255,0.06)', border: `2px solid ${assignedToId === m.id ? m.color : 'transparent'}`, color: 'var(--text)', fontWeight: 700, fontSize: 13 }}>
                  <span>{m.emoji}</span> {m.name}
                </button>
              ))}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 700 }}>RULE NAME</label>
            <input value={label} onChange={e => setLabel(e.target.value)} className="input" style={{ width: '100%' }} placeholder="e.g. Weekly chores goal" />
          </div>
          <div style={{ marginBottom: 12 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 6, fontWeight: 700 }}>MINIMUM STARS REQUIRED</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
              <button onClick={() => setMinStars(v => Math.max(1, v - 1))} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }}>−</button>
              <div style={{ fontSize: 28, fontWeight: 900, minWidth: 50, textAlign: 'center' }}>{minStars} <span style={{ fontSize: 16 }}>⭐</span></div>
              <button onClick={() => setMinStars(v => v + 1)} style={{ width: 36, height: 36, borderRadius: 10, fontSize: 20, background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }}>+</button>
            </div>
          </div>
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 11, color: 'var(--text-muted)', display: 'block', marginBottom: 5, fontWeight: 700 }}>CONSEQUENCE IF NOT MET</label>
            <input value={consequenceNote} onChange={e => setConsequenceNote(e.target.value)} className="input" style={{ width: '100%' }} placeholder="e.g. Screen time reduced by 2h on weekend" />
          </div>
          <button onClick={handleCreate} disabled={saving || !assignedToId} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (!assignedToId || saving) ? 0.5 : 1 }}>
            {saving ? 'Creating...' : '✅ Create Rule'}
          </button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: 20 }}>Loading rules...</div>
      ) : rules.length === 0 ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '20px 0' }}>
          <div style={{ fontSize: 32, marginBottom: 8 }}>⚡</div>
          <div style={{ fontSize: 13, fontWeight: 600 }}>No rules yet. Create one to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map(rule => {
            const lastOutcome = rule.outcomes[0];
            return (
              <div key={rule.id} style={{ padding: '14px 16px', borderRadius: 16, background: rule.active ? 'rgba(255,255,255,0.04)' : 'rgba(255,255,255,0.02)', border: `1.5px solid ${rule.active ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.04)'}`, opacity: rule.active ? 1 : 0.55 }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
                  <div style={{ width: 42, height: 42, borderRadius: '50%', flexShrink: 0, background: rule.assignedTo.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>{rule.assignedTo.emoji}</div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{rule.label}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{rule.assignedTo.name} · Must earn <strong style={{ color: '#FBBF24' }}>⭐ {rule.minStars}</strong> by Friday 4pm</div>
                    <div style={{ fontSize: 11, color: '#F87171', marginTop: 4 }}>⚠️ {rule.consequenceNote}</div>
                    {lastOutcome && (
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, marginTop: 8, padding: '3px 10px', borderRadius: 20, background: lastOutcome.passed ? 'rgba(74,222,128,0.12)' : 'rgba(239,68,68,0.12)', border: `1px solid ${lastOutcome.passed ? 'rgba(74,222,128,0.3)' : 'rgba(239,68,68,0.3)'}`, fontSize: 11, fontWeight: 700, color: lastOutcome.passed ? '#4ADE80' : '#F87171' }}>
                        {lastOutcome.passed ? '✅' : '❌'} Last week: {lastOutcome.starsEarned} ⭐
                      </div>
                    )}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                    <button onClick={() => toggleActive(rule)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: rule.active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${rule.active ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`, color: rule.active ? '#4ADE80' : 'var(--text-muted)', cursor: 'pointer' }}>
                      {rule.active ? 'Active' : 'Paused'}
                    </button>
                    <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', cursor: 'pointer' }}>
                      {deletingId === rule.id ? '...' : '🗑️'}
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ChoresPage() {
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] } = useMembers();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const deleteChore = useDeleteChore();

  const [tab, setTab]         = useState<Status | 'all'>('all');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({
    title: '', emoji: '🧹', assignedToId: '',
    frequency: 'daily' as typeof FREQS[number],
    dayOfWeek: 'Monday',
    stars: 5, proofRequired: false, dueDate: '',
  });

  const all = chores as any[];
  const counts = {
    all:         all.length,
    pending:     all.filter(c => (c.status || 'pending') === 'pending').length,
    in_progress: all.filter(c => c.status === 'in_progress').length,
    done:        all.filter(c => c.status === 'done').length,
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
      // For weekly chores, compute next occurrence of chosen day as the dueDate
      let dueDate = form.dueDate || null;
      if (form.frequency === 'weekly' && !form.dueDate) {
        const dayIdx = DAYS_OF_WEEK.indexOf(form.dayOfWeek); // 0=Mon
        const jsDay  = dayIdx === 6 ? 0 : dayIdx + 1;        // convert to JS (0=Sun)
        const now = new Date();
        const diff = (jsDay - now.getDay() + 7) % 7 || 7;
        const next = new Date(now);
        next.setDate(now.getDate() + diff);
        dueDate = next.toISOString().split('T')[0];
      }
      await createChore.mutateAsync({
        title: form.title.trim(),
        emoji: form.emoji,
        assignedToId: form.assignedToId || null,
        frequency: form.frequency,
        stars: form.stars,
        proofRequired: form.proofRequired,
        status: 'pending',
        dueDate,
        // store dayOfWeek in notes or as extra field if your API supports it
        ...(form.frequency === 'weekly' && { dayOfWeek: form.dayOfWeek }),
      });
      setForm({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', dayOfWeek: 'Monday', stars: 5, proofRequired: false, dueDate: '' });
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
        <button onClick={() => setShowAdd(true)} style={{ padding: '9px 18px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Add</button>
      </div>

      {/* Overdue banner */}
      {overdueCount > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '10px 14px', margin: '12px 0' }}>
          <span style={{ fontSize: 13, color: '#F87171', fontWeight: 700 }}>⚠️ {overdueCount} overdue chore{overdueCount > 1 ? 's' : ''} — streaks at risk!</span>
        </div>
      )}

      {/* Filter tabs */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0', overflowX: 'auto' }}>
        {[
          { key: 'all',         label: 'All',        icon: '📋', color: '#94A3B8', count: counts.all         },
          { key: 'pending',     label: 'Pending',     icon: '⏳', color: '#94A3B8', count: counts.pending     },
          { key: 'in_progress', label: 'In Progress', icon: '🔥', color: '#FBBF24', count: counts.in_progress },
          { key: 'done',        label: 'Done',        icon: '✅', color: '#4ADE80', count: counts.done        },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flexShrink: 0, padding: '7px 12px', background: tab === t.key ? `${t.color}22` : 'rgba(255,255,255,0.05)', border: `1.5px solid ${tab === t.key ? t.color : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, color: tab === t.key ? t.color : 'var(--text-muted)', fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{t.icon}</span><span>{t.label}</span>
            <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Chores list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>{tab === 'done' ? '🎉' : tab === 'pending' ? '✅' : '📋'}</div>
          {tab === 'all'
            ? <button onClick={() => setShowAdd(true)} style={{ marginTop: 8, padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Add first chore</button>
            : `No ${tab.replace('_', ' ')} chores`}
        </div>
      ) : list.map((chore: any) => {
        const status: Status = chore.status || 'pending';
        const meta     = STATUS_META[status];
        const assignee = memberList.find(m => m.id === (chore.assignedToId || chore.assignedTo?.id));
        const overdue  = isOverdue(chore.dueDate, status);
        const dueLabel = dueDateLabel(chore.dueDate, status);

        return (
          <div key={chore.id} style={{ background: 'rgba(255,255,255,0.04)', border: `1.5px solid ${overdue ? '#F87171' : meta.color + '44'}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '13px 14px' }}>
              <span style={{ fontSize: 26, flexShrink: 0 }}>{chore.emoji || '🧹'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15, color: status === 'done' ? '#64748B' : 'var(--text)', textDecoration: status === 'done' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chore.title}</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⭐{chore.stars}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {chore.frequency}{chore.dayOfWeek ? ` · ${chore.dayOfWeek}` : ''}</span>
                  {assignee && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {assignee.emoji} {assignee.name}</span>}
                  {dueLabel && (
                    <span style={{ fontSize: 11, fontWeight: 700, color: overdue ? '#F87171' : '#FBBF24', background: overdue ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', borderRadius: 6, padding: '1px 6px' }}>📅 {dueLabel}</span>
                  )}
                </div>
              </div>
              <select value={status} onChange={e => changeStatus(chore, e.target.value as Status)} style={{ padding: '6px 8px', background: meta.bg, border: `1.5px solid ${meta.color}66`, borderRadius: 10, color: meta.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                <option value="pending">⏳ Pending</option>
                <option value="in_progress">🔥 In Progress</option>
                <option value="done">✅ Done</option>
              </select>
              <button onClick={() => { if (confirm('Delete?')) deleteChore.mutate(chore.id); }} style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
              <select value={chore.assignedToId || ''} onChange={e => reassign(chore, e.target.value)} style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer' }}>
                <option value="">👤 Unassigned</option>
                {memberList.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
              </select>
              <input type="date" value={chore.dueDate ? chore.dueDate.substring(0,10) : ''} onChange={e => setDueDate(chore, e.target.value)} style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${overdue ? '#F87171' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: overdue ? '#F87171' : 'var(--text-muted)', cursor: 'pointer' }} />
            </div>
          </div>
        );
      })}

      {list.length > 0 && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
          Use the dropdown to change status · reassign or set due date below each card
        </p>
      )}

      {/* Weekly Rules Panel */}
      <WeeklyRulesPanel />

      {/* ── Add Modal ── */}
      {showAdd && (
        <>
          {/* Full-screen backdrop — covers everything including sidebar */}
          <div
            style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998, backdropFilter: 'blur(4px)' }}
            onClick={() => setShowAdd(false)}
          />
          {/* Sheet */}
          <div style={{
            position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
            display: 'flex', justifyContent: 'center',
          }}>
            <div style={{
              width: '100%', maxWidth: 520,
              background: '#1a1625',
              borderRadius: '24px 24px 0 0',
              border: '1.5px solid rgba(255,255,255,0.1)', borderBottom: 'none',
              padding: '8px 20px 48px',
              maxHeight: '92vh', overflowY: 'auto',
            }}>
              {/* Handle */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '12px auto 20px' }} />
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>+ New Chore</h2>

              {/* Emoji picker */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {CHORE_EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{ width: 42, height: 42, borderRadius: 10, fontSize: 22, background: form.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: form.emoji === e ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{e}</button>
                ))}
              </div>

              {/* Title */}
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Chore name..." className="input" style={{ width: '100%', marginBottom: 12 }}
                autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()} />

              {/* Assign + Frequency */}
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))} className="input" style={{ flex: 1 }}>
                  <option value="">Anyone</option>
                  {memberList.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any }))} className="input" style={{ flex: 1 }}>
                  {FREQS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>

              {/* Day of week picker — only when weekly */}
              {form.frequency === 'weekly' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8, fontWeight: 700 }}>
                    📆 Which day of the week?
                  </label>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {DAYS_OF_WEEK.map((day, i) => (
                      <button key={day} onClick={() => setForm(f => ({ ...f, dayOfWeek: day }))} style={{
                        padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer',
                        background: form.dayOfWeek === day ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                        border: `1.5px solid ${form.dayOfWeek === day ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`,
                        color: form.dayOfWeek === day ? '#fff' : 'var(--text-muted)',
                      }}>{DAY_SHORT[i]}</button>
                    ))}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Next occurrence will be set as the due date automatically
                  </div>
                </div>
              )}

              {/* Due date (manual override, hidden for weekly since auto-set) */}
              {form.frequency !== 'weekly' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>📅 Due date (optional)</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="input" style={{ width: '100%' }} />
                </div>
              )}

              {/* Stars */}
              <div style={{ display: 'flex', gap: 6, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Stars:</span>
                {[1, 2, 3, 5, 8, 10].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, stars: n }))} style={{ padding: '4px 10px', borderRadius: 8, background: form.stars === n ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: form.stars === n ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', color: form.stars === n ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>⭐{n}</button>
                ))}
              </div>

              {/* Proof toggle */}
              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
                <div onClick={() => setForm(f => ({ ...f, proofRequired: !f.proofRequired }))} style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: form.proofRequired ? 'var(--primary)' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.proofRequired ? 23 : 3, transition: 'left 0.2s' }} />
                </div>
                <span style={{ fontSize: 13 }}>Require photo proof</span>
              </label>

              {/* Actions */}
              <div style={{ display: 'flex', gap: 8 }}>
                <button style={{ flex: 1, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text)', cursor: 'pointer' }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button style={{ flex: 2, padding: '12px', borderRadius: 12, fontSize: 14, fontWeight: 800, background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer', opacity: (!form.title.trim() || createChore.isPending) ? 0.5 : 1 }} onClick={handleAdd} disabled={!form.title.trim() || createChore.isPending}>
                  {createChore.isPending ? 'Adding...' : '+ Add Chore'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}