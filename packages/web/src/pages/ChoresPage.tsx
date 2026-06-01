import { useState, useEffect, useRef } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧','🪟','🧊','🏠'];
const FREQS = ['daily', 'weekly', 'once'] as const;
const DAYS_OF_WEEK = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const DAY_SHORT    = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const API_BASE = import.meta.env.VITE_API_URL || '';

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

function InlineEditForm({ chore, members, onSave, onCancel }: {
  chore: any; members: any[]; onSave: (data: any) => void; onCancel: () => void;
}) {
  const [title, setTitle]           = useState(chore.title);
  const [emoji, setEmoji]           = useState(chore.emoji || '🧹');
  const [stars, setStars]           = useState(chore.stars ?? 5);
  const [frequency, setFreq]        = useState(chore.frequency || 'daily');
  const [dayOfWeek, setDay]         = useState(chore.dayOfWeek || 'Monday');
  const [recurring, setRecurring]   = useState(chore.recurring ?? false);
  const [dueDate, setDueDate]       = useState(chore.dueDate ? chore.dueDate.substring(0,10) : '');
  const [assignedToId, setAssignee] = useState(chore.assignedToId || '');
  const [proofRequired, setProof]   = useState(chore.proofRequired ?? false);
  const [priority, setPriority]     = useState(chore.priority || 'normal');
  const [notes, setNotes]           = useState(chore.notes || '');
  const [saving, setSaving]         = useState(false);

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      await onSave({ title: title.trim(), emoji, stars, frequency, ...(frequency === 'weekly' && { dayOfWeek, recurring }), dueDate: dueDate || null, assignedToId: assignedToId || null, proofRequired, priority, notes: notes || null });
    } finally { setSaving(false); }
  }

  return (
    <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', padding: '14px 14px 16px', background: 'rgba(124,111,247,0.05)' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 12 }}>
        {CHORE_EMOJIS.map(e => (
          <button key={e} onClick={() => setEmoji(e)} style={{ width: 36, height: 36, borderRadius: 8, fontSize: 18, cursor: 'pointer', background: emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: emoji === e ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)' }}>{e}</button>
        ))}
      </div>
      <input value={title} onChange={e => setTitle(e.target.value)} className="input" style={{ width: '100%', marginBottom: 10 }} placeholder="Chore name..." />
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>⚡ PRIORITY</div>
        <div style={{ display: 'flex', gap: 6 }}>
          {[{value:'low',label:'🟢 Low',color:'#4ADE80'},{value:'normal',label:'🔵 Normal',color:'#60A5FA'},{value:'high',label:'🔴 High',color:'#F87171'}].map(p => (
            <button key={p.value} onClick={() => setPriority(p.value)} style={{ flex: 1, padding: '6px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: priority === p.value ? p.color + '22' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${priority === p.value ? p.color : 'rgba(255,255,255,0.1)'}`, color: priority === p.value ? p.color : 'var(--text-muted)' }}>{p.label}</button>
          ))}
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
        <select value={assignedToId} onChange={e => setAssignee(e.target.value)} className="input" style={{ flex: 1 }}>
          <option value="">Anyone</option>
          {members.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
        </select>
        <select value={frequency} onChange={e => setFreq(e.target.value as any)} className="input" style={{ flex: 1 }}>
          {FREQS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
        </select>
      </div>
      {frequency === 'weekly' && (
        <>
          <div style={{ marginBottom: 10 }}>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>📆 DAY OF WEEK</div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              {DAYS_OF_WEEK.map((day, i) => (
                <button key={day} onClick={() => setDay(day)} style={{ padding: '5px 9px', borderRadius: 8, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: dayOfWeek === day ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${dayOfWeek === day ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, color: dayOfWeek === day ? '#fff' : 'var(--text-muted)' }}>{DAY_SHORT[i]}</button>
              ))}
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div onClick={() => setRecurring((v: boolean) => !v)} style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, cursor: 'pointer', background: recurring ? '#FBBF24' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s' }}>
              <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: recurring ? 21 : 3, transition: 'left 0.2s' }} />
            </div>
            <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>🔁 Repeat every week</span>
          </div>
        </>
      )}
      {frequency !== 'weekly' && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>📅 DUE DATE</div>
          <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="input" style={{ width: '100%' }} />
        </div>
      )}
      <div style={{ display: 'flex', gap: 5, marginBottom: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Stars:</span>
        {[1,2,3,5,8,10].map(n => (
          <button key={n} onClick={() => setStars(n)} style={{ padding: '3px 9px', borderRadius: 8, cursor: 'pointer', fontSize: 12, fontWeight: 600, background: stars === n ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: stars === n ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', color: stars === n ? '#fff' : 'var(--text-muted)' }}>⭐{n}</button>
        ))}
      </div>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, fontWeight: 700 }}>📝 NOTES</div>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} className="input" rows={2} placeholder="Add instructions..." style={{ width: '100%', resize: 'vertical' }} />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }}>
        <div onClick={() => setProof((v: boolean) => !v)} style={{ width: 40, height: 22, borderRadius: 11, flexShrink: 0, cursor: 'pointer', background: proofRequired ? 'var(--primary)' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s' }}>
          <div style={{ width: 16, height: 16, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: proofRequired ? 21 : 3, transition: 'left 0.2s' }} />
        </div>
        <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>📸 Require photo proof</span>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <button onClick={onCancel} style={{ flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: 'var(--text)' }}>Cancel</button>
        <button onClick={handleSave} disabled={!title.trim() || saving} style={{ flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 800, cursor: 'pointer', background: 'var(--primary)', border: 'none', color: '#fff', opacity: (!title.trim() || saving) ? 0.5 : 1 }}>{saving ? 'Saving...' : '💾 Save Changes'}</button>
      </div>
    </div>
  );
}

interface Rule {
  id: string; label: string; minStars: number; consequenceNote: string; active: boolean;
  assignedTo: { id: string; name: string; emoji: string; color: string };
  outcomes?: { passed: boolean; starsEarned: number; weekStart: string }[];
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
  const [assignedToId, setAssignedToId] = useState('');
  const [label, setLabel]               = useState('Weekly chores goal');
  const [minStars, setMinStars]         = useState(5);
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
      setAssignedToId(''); setLabel('Weekly chores goal'); setMinStars(5); setConsequenceNote('Screen time reduced on weekend');
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
        <button onClick={() => setShowForm(v => !v)} style={{ padding: '8px 16px', borderRadius: 20, fontSize: 13, fontWeight: 700, background: showForm ? 'rgba(255,255,255,0.06)' : 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer' }}>{showForm ? 'Cancel' : '+ New Rule'}</button>
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
          <button onClick={handleCreate} disabled={saving || !assignedToId} style={{ width: '100%', padding: '12px', borderRadius: 12, background: 'var(--primary)', border: 'none', color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer', opacity: (!assignedToId || saving) ? 0.5 : 1 }}>{saving ? 'Creating...' : '✅ Create Rule'}</button>
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
            const lastOutcome = (rule.outcomes ?? [])[0];
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
                    <button onClick={() => toggleActive(rule)} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: rule.active ? 'rgba(74,222,128,0.12)' : 'rgba(255,255,255,0.06)', border: `1px solid ${rule.active ? 'rgba(74,222,128,0.3)' : 'rgba(255,255,255,0.1)'}`, color: rule.active ? '#4ADE80' : 'var(--text-muted)', cursor: 'pointer' }}>{rule.active ? 'Active' : 'Paused'}</button>
                    <button onClick={() => handleDelete(rule.id)} disabled={deletingId === rule.id} style={{ padding: '5px 10px', borderRadius: 8, fontSize: 11, fontWeight: 700, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#F87171', cursor: 'pointer' }}>{deletingId === rule.id ? '...' : '🗑️'}</button>
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

export default function ChoresPage() {
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] } = useMembers();
  const createChore = useCreateChore();
  const updateChore = useUpdateChore();
  const deleteChore = useDeleteChore();
  const { token } = useAuthStore();

  const [tab, setTab]             = useState<Status | 'all'>('all');
  const [showAdd, setShowAdd]     = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selected, setSelected]   = useState<Set<string>>(new Set());
  const [bulkMode, setBulkMode]   = useState(false);
  const [bulkAssignId, setBulkAssignId] = useState('');
  const [sortBy, setSortBy]       = useState<'created' | 'due' | 'stars' | 'priority'>('created');

  // Track per-chore photo upload state
  const [uploadingId, setUploadingId]   = useState<string | null>(null);
  const [photoPreview, setPhotoPreview] = useState<Record<string, string>>({});
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const [form, setForm] = useState({
    title: '', emoji: '🧹', assignedToId: '',
    frequency: 'daily' as typeof FREQS[number],
    dayOfWeek: 'Monday', recurring: false,
    stars: 5, proofRequired: false, dueDate: '',
    priority: 'normal', notes: '',
  });

  const all    = chores as any[];
  const sorted = [...all].sort((a, b) => {
    if (sortBy === 'due') { if (!a.dueDate) return 1; if (!b.dueDate) return -1; return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime(); }
    if (sortBy === 'stars')    return (b.stars || 0) - (a.stars || 0);
    if (sortBy === 'priority') { const p = { high: 0, normal: 1, low: 2 }; return (p[a.priority as keyof typeof p] ?? 1) - (p[b.priority as keyof typeof p] ?? 1); }
    return 0;
  });

  const counts = {
    all:         all.length,
    pending:     all.filter(c => (c.status || 'pending') === 'pending').length,
    in_progress: all.filter(c => c.status === 'in_progress').length,
    done:        all.filter(c => c.status === 'done').length,
  };
  const overdueCount = all.filter(c => isOverdue(c.dueDate, c.status)).length;
  const list = tab === 'all' ? sorted : sorted.filter(c => (c.status || 'pending') === tab);

  const changeStatus = (chore: any, status: Status) => updateChore.mutate({ id: chore.id, data: { status } });
  const reassign     = (chore: any, assignedToId: string) => updateChore.mutate({ id: chore.id, data: { assignedToId: assignedToId || null } });
  const setDueDateFn = (chore: any, dueDate: string) => updateChore.mutate({ id: chore.id, data: { dueDate: dueDate || null } });

  // ── Photo upload handler ──────────────────────────────────────────────────
  const handlePhotoUpload = async (choreId: string, file: File) => {
    setUploadingId(choreId);
    try {
      // Show local preview immediately while uploading
      const localUrl = URL.createObjectURL(file);
      setPhotoPreview(prev => ({ ...prev, [choreId]: localUrl }));

      // Use fd (not form) to avoid shadowing the component's form state
      const fd = new FormData();
      fd.append('photo', file);
      const res = await fetch(`${API_BASE}/api/chores/${choreId}/photo`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}` },
        // DO NOT set Content-Type — browser sets multipart boundary automatically
        body: fd,
      });
      if (!res.ok) throw new Error('Upload failed');
      const updated = await res.json();

      // Cloudinary returns an absolute URL — use it directly, no API_BASE prefix
      if (updated.photoUrl) {
        setPhotoPreview(prev => ({ ...prev, [choreId]: updated.photoUrl }));
      }
    } catch (e) {
      console.error('Photo upload error:', e);
      alert('Photo upload failed. Please try again.');
      // Remove broken preview on failure
      setPhotoPreview(prev => { const next = { ...prev }; delete next[choreId]; return next; });
    } finally {
      setUploadingId(null);
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  const handleDuplicate = async (chore: any) => {
    try {
      await createChore.mutateAsync({
        title: chore.title + ' (copy)', emoji: chore.emoji,
        assignedToId: chore.assignedToId || null, frequency: chore.frequency,
        stars: chore.stars, proofRequired: chore.proofRequired,
        priority: chore.priority || 'normal', notes: chore.notes || null,
        status: 'pending', dueDate: chore.dueDate ? chore.dueDate.substring(0, 10) : null,
        recurring: chore.recurring || false,
        ...(chore.dayOfWeek && { dayOfWeek: chore.dayOfWeek }),
      });
    } catch (e) { console.error(e); }
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Delete ${selected.size} chores?`)) return;
    for (const id of selected) await deleteChore.mutateAsync(id);
    setSelected(new Set()); setBulkMode(false);
  };

  const handleBulkAssign = async () => {
    for (const id of selected) await updateChore.mutateAsync({ id, data: { assignedToId: bulkAssignId || null } });
    setSelected(new Set()); setBulkMode(false); setBulkAssignId('');
  };

  const handleBulkComplete = async () => {
    for (const id of selected) await updateChore.mutateAsync({ id, data: { status: 'done' } });
    setSelected(new Set()); setBulkMode(false);
  };

  const toggleSelect = (id: string) => {
    setSelected(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    try {
      let dueDate = form.dueDate || null;
      if (form.frequency === 'weekly') {
        const dayIdx = DAYS_OF_WEEK.indexOf(form.dayOfWeek);
        const jsDay  = dayIdx === 6 ? 0 : dayIdx + 1;
        const now  = new Date();
        const diff = (jsDay - now.getDay() + 7) % 7 || 7;
        const next = new Date(now); next.setDate(now.getDate() + diff);
        dueDate = next.toISOString().split('T')[0];
      }
      await createChore.mutateAsync({
        title: form.title.trim(), emoji: form.emoji, assignedToId: form.assignedToId || null,
        frequency: form.frequency, stars: form.stars, proofRequired: form.proofRequired,
        status: 'pending', dueDate, priority: form.priority, notes: form.notes || null,
        recurring: form.frequency === 'weekly' ? form.recurring : false,
        ...(form.frequency === 'weekly' && { dayOfWeek: form.dayOfWeek }),
      });
      setForm({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', dayOfWeek: 'Monday', recurring: false, stars: 5, proofRequired: false, dueDate: '', priority: 'normal', notes: '' });
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  const handleEdit   = async (chore: any, data: any) => { await updateChore.mutateAsync({ id: chore.id, data }); setEditingId(null); };
  const memberList   = members as any[];

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🧹 Chores</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            {counts.done} / {counts.all} done
            {overdueCount > 0 && <span style={{ color: '#F87171', marginLeft: 8 }}>· {overdueCount} overdue</span>}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => { setBulkMode(v => !v); setSelected(new Set()); }} style={{ padding: '9px 14px', background: bulkMode ? 'rgba(124,111,247,0.2)' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${bulkMode ? 'rgba(124,111,247,0.5)' : 'rgba(255,255,255,0.12)'}`, borderRadius: 10, color: bulkMode ? '#A78BFA' : 'var(--text-muted)', fontWeight: 700, fontSize: 13, cursor: 'pointer' }} title="Bulk select">☑️</button>
          <button onClick={() => setShowAdd(true)} style={{ padding: '9px 18px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Add</button>
        </div>
      </div>

      {overdueCount > 0 && (
        <div style={{ background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', borderRadius: 12, padding: '10px 14px', margin: '12px 0' }}>
          <span style={{ fontSize: 13, color: '#F87171', fontWeight: 700 }}>⚠️ {overdueCount} overdue chore{overdueCount > 1 ? 's' : ''} — streaks at risk!</span>
        </div>
      )}

      {bulkMode && (
        <div style={{ padding: '12px 14px', borderRadius: 14, marginBottom: 12, background: 'rgba(124,111,247,0.08)', border: '1.5px solid rgba(124,111,247,0.25)', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>{selected.size} selected</span>
          <select value={bulkAssignId} onChange={e => setBulkAssignId(e.target.value)} className="input" style={{ flex: 1, minWidth: 120, fontSize: 12 }}>
            <option value="">Reassign to...</option>
            {memberList.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
          </select>
          <button onClick={handleBulkAssign} disabled={!bulkAssignId || selected.size === 0} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(99,102,241,0.2)', border: '1px solid rgba(99,102,241,0.4)', color: '#A78BFA', cursor: 'pointer', opacity: (!bulkAssignId || selected.size === 0) ? 0.4 : 1 }}>Reassign</button>
          <button onClick={handleBulkComplete} disabled={selected.size === 0} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(74,222,128,0.1)', border: '1px solid rgba(74,222,128,0.3)', color: '#4ADE80', cursor: 'pointer', opacity: selected.size === 0 ? 0.4 : 1 }}>✅ Mark Done</button>
          <button onClick={handleBulkDelete} disabled={selected.size === 0} style={{ padding: '7px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)', color: '#F87171', cursor: 'pointer', opacity: selected.size === 0 ? 0.4 : 1 }}>🗑️ Delete</button>
        </div>
      )}

      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 6, margin: '14px 0 8px', overflowX: 'auto' }}>
        {[
          { key: 'all',         label: 'All',         icon: '📋', color: '#94A3B8', count: counts.all },
          { key: 'pending',     label: 'Pending',     icon: '⏳', color: '#94A3B8', count: counts.pending },
          { key: 'in_progress', label: 'In Progress', icon: '🔥', color: '#FBBF24', count: counts.in_progress },
          { key: 'done',        label: 'Done',        icon: '✅', color: '#4ADE80', count: counts.done },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{ flexShrink: 0, padding: '7px 12px', background: tab === t.key ? `${t.color}22` : 'rgba(255,255,255,0.05)', border: `1.5px solid ${tab === t.key ? t.color : 'rgba(255,255,255,0.1)'}`, borderRadius: 20, color: tab === t.key ? t.color : 'var(--text-muted)', fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span>{t.icon}</span><span>{t.label}</span>
            <span style={{ background: 'rgba(255,255,255,0.1)', borderRadius: 10, padding: '0 6px', fontSize: 11, fontWeight: 700 }}>{t.count}</span>
          </button>
        ))}
      </div>

      {/* Sort bar */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, alignItems: 'center' }}>
        <span style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>Sort:</span>
        {[{key:'created',label:'Latest'},{key:'due',label:'Due date'},{key:'stars',label:'Stars'},{key:'priority',label:'Priority'}].map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key as any)} style={{ padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 700, cursor: 'pointer', background: sortBy === s.key ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)', border: `1px solid ${sortBy === s.key ? 'rgba(99,102,241,0.4)' : 'rgba(255,255,255,0.1)'}`, color: sortBy === s.key ? '#A78BFA' : 'var(--text-muted)' }}>{s.label}</button>
        ))}
      </div>

      {/* Chore list */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : list.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📋</div>
          {tab === 'all'
            ? <button onClick={() => setShowAdd(true)} style={{ marginTop: 8, padding: '10px 20px', background: 'var(--primary)', border: 'none', borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>+ Add first chore</button>
            : `No ${tab.replace('_', ' ')} chores`}
        </div>
      ) : list.map((chore: any) => {
        const status: Status = chore.status || 'pending';
        const meta        = STATUS_META[status];
        const assignee    = memberList.find(m => m.id === (chore.assignedToId || chore.assignedTo?.id));
        const overdue     = isOverdue(chore.dueDate, status);
        const dueLabel    = dueDateLabel(chore.dueDate, status);
        const streak      = chore.weeklyStreak ?? 0;
        const isRecurring = chore.recurring && chore.frequency === 'weekly';
        const isEditing   = editingId === chore.id;
        const isSelected  = selected.has(chore.id);
        const isUploading = uploadingId === chore.id;

        // Cloudinary URLs are absolute — use directly; no API_BASE prefix needed
        const photoUrl  = photoPreview[chore.id] || chore.photoUrl || null;
        const needsProof = chore.proofRequired && !photoUrl;

        return (
          <div key={chore.id} style={{ background: isSelected ? 'rgba(124,111,247,0.08)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${isSelected ? 'rgba(124,111,247,0.5)' : overdue ? '#F87171' : isEditing ? 'rgba(124,111,247,0.5)' : meta.color + '44'}`, borderRadius: 14, marginBottom: 10, overflow: 'hidden' }}>

            {/* ── Main chore row ── */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 14px' }}>
              {bulkMode && (
                <div onClick={() => toggleSelect(chore.id)} style={{ width: 22, height: 22, borderRadius: 6, flexShrink: 0, border: `2px solid ${isSelected ? '#A78BFA' : 'rgba(255,255,255,0.2)'}`, background: isSelected ? 'rgba(124,111,247,0.3)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', fontSize: 13 }}>
                  {isSelected ? '✓' : ''}
                </div>
              )}
              <span style={{ fontSize: 26, flexShrink: 0 }}>{chore.emoji || '🧹'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  {chore.priority === 'high' && <span style={{ fontSize: 12, flexShrink: 0 }}>🔴</span>}
                  {chore.priority === 'low'  && <span style={{ fontSize: 12, flexShrink: 0 }}>🟢</span>}
                  <div style={{ fontWeight: 700, fontSize: 15, color: status === 'done' ? '#64748B' : 'var(--text)', textDecoration: status === 'done' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{chore.title}</div>
                  {isRecurring && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0, padding: '2px 7px', borderRadius: 20, background: streak > 0 ? 'rgba(251,191,36,0.15)' : 'rgba(255,255,255,0.07)', border: `1px solid ${streak > 0 ? 'rgba(251,191,36,0.4)' : 'rgba(255,255,255,0.12)'}`, fontSize: 11, fontWeight: 800, color: streak > 0 ? '#FBBF24' : 'var(--text-muted)' }}>🔥 {streak}w</div>
                  )}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>⭐{chore.stars}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {chore.frequency}{chore.dayOfWeek ? ` · ${chore.dayOfWeek}` : ''}{isRecurring ? ' · 🔁' : ''}</span>
                  {assignee  && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>· {assignee.emoji} {assignee.name}</span>}
                  {dueLabel  && <span style={{ fontSize: 11, fontWeight: 700, color: overdue ? '#F87171' : '#FBBF24', background: overdue ? 'rgba(248,113,113,0.12)' : 'rgba(251,191,36,0.12)', borderRadius: 6, padding: '1px 6px' }}>📅 {dueLabel}</span>}
                  {needsProof && <span style={{ fontSize: 11, fontWeight: 700, color: '#F97316', background: 'rgba(249,115,22,0.12)', borderRadius: 6, padding: '1px 6px' }}>📸 proof needed</span>}
                </div>
                {chore.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontStyle: 'italic', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📝 {chore.notes}</div>}
              </div>

              {!bulkMode && (
                <>
                  {/* ── Camera button ── */}
                  <div style={{ position: 'relative', flexShrink: 0 }}>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      style={{ display: 'none' }}
                      ref={el => { fileInputRefs.current[chore.id] = el; }}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) handlePhotoUpload(chore.id, file);
                        e.target.value = ''; // reset so same file can be re-selected
                      }}
                    />
                    <button
                      onClick={() => fileInputRefs.current[chore.id]?.click()}
                      disabled={isUploading}
                      title={photoUrl ? 'Replace photo proof' : 'Add photo proof'}
                      style={{
                        width: 28, height: 28, borderRadius: 8, flexShrink: 0,
                        background:  photoUrl   ? 'rgba(74,222,128,0.15)'  : needsProof ? 'rgba(249,115,22,0.15)'  : 'rgba(255,255,255,0.07)',
                        border: `1px solid ${photoUrl ? 'rgba(74,222,128,0.4)' : needsProof ? 'rgba(249,115,22,0.5)' : 'rgba(255,255,255,0.12)'}`,
                        color:       photoUrl   ? '#4ADE80'                : needsProof ? '#F97316'                : 'var(--text-muted)',
                        fontSize: 13, cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        opacity: isUploading ? 0.5 : 1,
                      }}
                    >
                      {isUploading ? '⏳' : photoUrl ? '✅' : '📷'}
                    </button>
                  </div>
                  {/* ── End camera button ── */}

                  <button onClick={() => handleDuplicate(chore)} style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Duplicate">📋</button>
                  <button onClick={() => setEditingId(isEditing ? null : chore.id)} style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: isEditing ? 'rgba(124,111,247,0.2)' : 'rgba(255,255,255,0.07)', border: `1px solid ${isEditing ? 'rgba(124,111,247,0.4)' : 'rgba(255,255,255,0.12)'}`, color: isEditing ? '#A78BFA' : 'var(--text-muted)', fontSize: 13, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }} title="Edit">✏️</button>
                </>
              )}

              <select value={status} onChange={e => changeStatus(chore, e.target.value as Status)} style={{ padding: '6px 8px', background: meta.bg, border: `1.5px solid ${meta.color}66`, borderRadius: 10, color: meta.color, fontSize: 12, fontWeight: 700, cursor: 'pointer', flexShrink: 0 }}>
                <option value="pending">⏳ Pending</option>
                <option value="in_progress">🔥 In Progress</option>
                <option value="done">✅ Done</option>
              </select>
              <button onClick={() => { if (confirm('Delete?')) deleteChore.mutate(chore.id); }} style={{ width: 28, height: 28, borderRadius: 8, flexShrink: 0, background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)', color: '#F87171', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>

            {/* ── Photo thumbnail (shown when a photo exists) ── */}
            {photoUrl && (
              <div style={{ padding: '0 14px 12px', display: 'flex', alignItems: 'center', gap: 10 }}>
                <img
                  src={photoUrl}
                  alt="Proof"
                  style={{ width: 64, height: 64, borderRadius: 10, objectFit: 'cover', border: '2px solid rgba(74,222,128,0.4)', flexShrink: 0 }}
                />
                <div style={{ fontSize: 11, color: '#4ADE80', fontWeight: 700 }}>
                  ✅ Photo proof submitted
                  <div style={{ color: 'var(--text-muted)', fontWeight: 400, marginTop: 2 }}>Tap 📷 to replace</div>
                </div>
              </div>
            )}

            {/* ── Quick-action bar (reassign + due date) ── */}
            {!isEditing && (
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.06)', padding: '8px 14px', display: 'flex', gap: 8, alignItems: 'center' }}>
                <select value={chore.assignedToId || ''} onChange={e => reassign(chore, e.target.value)} style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer' }}>
                  <option value="">👤 Unassigned</option>
                  {memberList.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
                <input type="date" value={chore.dueDate ? chore.dueDate.substring(0,10) : ''} onChange={e => setDueDateFn(chore, e.target.value)} style={{ flex: 1, padding: '5px 8px', fontSize: 12, background: 'rgba(255,255,255,0.05)', border: `1px solid ${overdue ? '#F87171' : 'rgba(255,255,255,0.1)'}`, borderRadius: 8, color: overdue ? '#F87171' : 'var(--text-muted)', cursor: 'pointer' }} />
              </div>
            )}

            {isEditing && <InlineEditForm chore={chore} members={memberList} onSave={(data) => handleEdit(chore, data)} onCancel={() => setEditingId(null)} />}
          </div>
        );
      })}

      {list.length > 0 && !editingId && !bulkMode && (
        <p style={{ textAlign: 'center', fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>📋 duplicate · ✏️ edit · 📷 photo proof · ☑️ bulk select</p>
      )}

      <WeeklyRulesPanel />

      {/* ── Add chore modal ── */}
      {showAdd && (
        <>
          <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 9998, backdropFilter: 'blur(4px)' }} onClick={() => setShowAdd(false)} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999, display: 'flex', justifyContent: 'center' }}>
            <div style={{ width: '100%', maxWidth: 520, background: '#1a1625', borderRadius: '24px 24px 0 0', border: '1.5px solid rgba(255,255,255,0.1)', borderBottom: 'none', padding: '8px 20px 48px', maxHeight: '92vh', overflowY: 'auto' }}>
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.2)', margin: '12px auto 20px' }} />
              <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>+ New Chore</h2>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
                {CHORE_EMOJIS.map(e => (
                  <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{ width: 42, height: 42, borderRadius: 10, fontSize: 22, background: form.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: form.emoji === e ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', cursor: 'pointer' }}>{e}</button>
                ))}
              </div>

              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Chore name..." className="input" style={{ width: '100%', marginBottom: 12 }} autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()} />

              <div style={{ marginBottom: 12 }}>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6, fontWeight: 700 }}>⚡ PRIORITY</div>
                <div style={{ display: 'flex', gap: 6 }}>
                  {[{value:'low',label:'🟢 Low',color:'#4ADE80'},{value:'normal',label:'🔵 Normal',color:'#60A5FA'},{value:'high',label:'🔴 High',color:'#F87171'}].map(p => (
                    <button key={p.value} onClick={() => setForm(f => ({ ...f, priority: p.value }))} style={{ flex: 1, padding: '7px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: form.priority === p.value ? p.color + '22' : 'rgba(255,255,255,0.05)', border: `1.5px solid ${form.priority === p.value ? p.color : 'rgba(255,255,255,0.1)'}`, color: form.priority === p.value ? p.color : 'var(--text-muted)' }}>{p.label}</button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <select value={form.assignedToId} onChange={e => setForm(f => ({ ...f, assignedToId: e.target.value }))} className="input" style={{ flex: 1 }}>
                  <option value="">Anyone</option>
                  {memberList.map(m => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
                <select value={form.frequency} onChange={e => setForm(f => ({ ...f, frequency: e.target.value as any, recurring: false }))} className="input" style={{ flex: 1 }}>
                  {FREQS.map(f => <option key={f} value={f}>{f.charAt(0).toUpperCase() + f.slice(1)}</option>)}
                </select>
              </div>

              {form.frequency === 'weekly' && (
                <>
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 8, fontWeight: 700 }}>📆 Which day of the week?</label>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {DAYS_OF_WEEK.map((day, i) => (
                        <button key={day} onClick={() => setForm(f => ({ ...f, dayOfWeek: day }))} style={{ padding: '6px 10px', borderRadius: 10, fontSize: 12, fontWeight: 700, cursor: 'pointer', background: form.dayOfWeek === day ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: `1.5px solid ${form.dayOfWeek === day ? 'var(--primary)' : 'rgba(255,255,255,0.1)'}`, color: form.dayOfWeek === day ? '#fff' : 'var(--text-muted)' }}>{DAY_SHORT[i]}</button>
                      ))}
                    </div>
                  </div>
                  <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 12, background: form.recurring ? 'rgba(251,191,36,0.08)' : 'rgba(255,255,255,0.04)', border: `1.5px solid ${form.recurring ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.08)'}` }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 800 }}>🔁 Repeat every week</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 3 }}>{form.recurring ? `Resets every ${form.dayOfWeek} · streak tracked 🔥` : 'One-time weekly task'}</div>
                      </div>
                      <div onClick={() => setForm(f => ({ ...f, recurring: !f.recurring }))} style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: form.recurring ? '#FBBF24' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s', cursor: 'pointer' }}>
                        <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.recurring ? 23 : 3, transition: 'left 0.2s' }} />
                      </div>
                    </div>
                  </div>
                </>
              )}

              {form.frequency !== 'weekly' && (
                <div style={{ marginBottom: 12 }}>
                  <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>📅 Due date (optional)</label>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} className="input" style={{ width: '100%' }} />
                </div>
              )}

              <div style={{ display: 'flex', gap: 6, marginBottom: 12, alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Stars:</span>
                {[1,2,3,5,8,10].map(n => (
                  <button key={n} onClick={() => setForm(f => ({ ...f, stars: n }))} style={{ padding: '4px 10px', borderRadius: 8, background: form.stars === n ? 'var(--primary)' : 'rgba(255,255,255,0.07)', border: form.stars === n ? '1px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)', color: form.stars === n ? '#fff' : 'var(--text-muted)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}>⭐{n}</button>
                ))}
              </div>

              <div style={{ marginBottom: 12 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>📝 Notes (optional)</label>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className="input" rows={2} placeholder="Add instructions..." style={{ width: '100%', resize: 'vertical' }} />
              </div>

              <label style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, cursor: 'pointer' }}>
                <div onClick={() => setForm(f => ({ ...f, proofRequired: !f.proofRequired }))} style={{ width: 44, height: 24, borderRadius: 12, flexShrink: 0, background: form.proofRequired ? 'var(--primary)' : 'rgba(255,255,255,0.12)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ width: 18, height: 18, borderRadius: '50%', background: '#fff', position: 'absolute', top: 3, left: form.proofRequired ? 23 : 3, transition: 'left 0.2s' }} />
                </div>
                <span style={{ fontSize: 13 }}>📸 Require photo proof</span>
              </label>

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