import { useState } from 'react';
import { useChores, useMembers, useCreateChore, useUpdateChore, useDeleteChore } from '../hooks/useApi';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒','🚗','🧴','💧'];
const FREQS = ['daily','weekly','once'] as const;

const STATUS_CONFIG = {
  pending:     { label: 'Pending',     icon: '⏳', color: 'rgba(240,240,245,0.4)',  bg: 'rgba(255,255,255,0.06)' },
  in_progress: { label: 'In Progress', icon: '🔥', color: '#FBBF24',                bg: 'rgba(251,191,36,0.1)'  },
  done:        { label: 'Done',        icon: '✅', color: '#4ADE80',                 bg: 'rgba(74,222,128,0.1)'  },
};

function nextStatus(current: string): string {
  if (current === 'pending')     return 'in_progress';
  if (current === 'in_progress') return 'done';
  return 'pending';
}

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function isOverdue(dueDate?: string | null, status?: string) {
  if (!dueDate || status === 'done') return false;
  return new Date() > new Date(dueDate);
}

function formatDue(dueDate?: string | null) {
  if (!dueDate) return null;
  const d = new Date(dueDate);
  const today = new Date();
  today.setHours(0,0,0,0);
  const diff = Math.ceil((d.getTime() - today.getTime()) / 86400000);
  if (diff < 0)  return `${Math.abs(diff)}d overdue`;
  if (diff === 0) return 'Due today';
  if (diff === 1) return 'Due tomorrow';
  return `Due in ${diff}d`;
}

export default function ChoresPage() {
  const { data: chores = [], isLoading } = useChores();
  const { data: members = [] }           = useMembers();
  const createChore  = useCreateChore();
  const updateChore  = useUpdateChore();
  const deleteChore  = useDeleteChore();

  const [filter, setFilter]   = useState<'pending'|'in_progress'|'done'|'all'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [editChore, setEditChore] = useState<any>(null); // chore being reassigned/edited

  const [newChore, setNewChore] = useState({
    title: '', emoji: '🧹', assignedToId: '', frequency: 'daily' as typeof FREQS[number],
    stars: 5, proofRequired: false, dueDate: '',
  });

  const allChores = chores as any[];
  const memberList = members as any[];

  const filtered = allChores.filter(c =>
    filter === 'all' ? true : (c.status || 'pending') === filter
  );

  const counts = allChores.reduce((acc: Record<string,number>, c: any) => {
    const s = c.status || 'pending';
    acc[s] = (acc[s] || 0) + 1;
    return acc;
  }, {});

  const overdueCount = allChores.filter(c => isOverdue(c.dueDate, c.status)).length;

  function handleAdvance(chore: any) {
    const next = nextStatus(chore.status || 'pending');
    updateChore.mutate({ id: chore.id, data: { status: next } });
  }

  function handleReassign(chore: any, assignedToId: string) {
    updateChore.mutate({ id: chore.id, data: { assignedToId: assignedToId || null } });
    setEditChore(null);
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

  if (isLoading) return (
    <div style={{ display:'flex', justifyContent:'center', padding:40 }}>
      <div className="spinner" />
    </div>
  );

  const FILTER_TABS: [string,string][] = [
    ['pending',     '⏳ Pending'],
    ['in_progress', '🔥 In Progress'],
    ['done',        '✅ Done'],
    ['all',         '📋 All'],
  ];

  return (
    <div style={{ width:'100%' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:900 }}>✅ Chores</h1>
          {overdueCount > 0 && (
            <div style={{ fontSize:12, fontWeight:800, color:'#F87171', marginTop:2 }}>
              ⚠️ {overdueCount} overdue — streak at risk!
            </div>
          )}
        </div>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary">+ Add chore</button>
      </div>

      {/* Filter tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, background:'var(--bg-secondary)', padding:4, borderRadius:12, border:'1.5px solid var(--border)' }}>
        {FILTER_TABS.map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f as any)} style={{
            flex:1, padding:'8px 4px', borderRadius:8, fontWeight:800, fontSize:12, cursor:'pointer',
            background: filter === f ? 'var(--primary)' : 'transparent',
            color: filter === f ? '#fff' : 'var(--text-secondary)', border:'none',
          }}>
            {label}
            {counts[f] > 0 && f !== 'all' && (
              <span style={{ marginLeft:4, borderRadius:10, fontSize:10, padding:'1px 5px', fontWeight:900,
                background: filter === f ? 'rgba(255,255,255,0.25)' : 'var(--primary)', color:'#fff' }}>
                {counts[f]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Chore list */}
      {filtered.length === 0 ? (
        <div style={{ textAlign:'center', padding:'60px 0', color:'var(--text-muted)', fontWeight:700, fontSize:16 }}>
          {filter === 'pending' ? '🎉 All caught up!' : filter === 'done' ? 'No completed chores yet.' : 'No chores here yet.'}
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(340px, 1fr))', gap:10 }}>
          {filtered.map((chore: any) => {
            const assignee  = memberList.find((m:any) => m.id === chore.assignedToId);
            const status    = chore.status || 'pending';
            const cfg       = STATUS_CONFIG[status as keyof typeof STATUS_CONFIG] || STATUS_CONFIG.pending;
            const avatarUrl = avatarSrc(assignee?.avatarUrl);
            const overdue   = isOverdue(chore.dueDate, status);
            const dueLabel  = formatDue(chore.dueDate);
            const isEditing = editChore?.id === chore.id;

            return (
              <div key={chore.id} className="card" style={{
                opacity: status === 'done' ? 0.75 : 1,
                borderLeft: `4px solid ${overdue ? '#F87171' : assignee?.color || 'var(--border)'}`,
                transition: 'opacity 0.2s',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:12 }}>

                  {/* Status advance button */}
                  <button
                    onClick={() => handleAdvance(chore)}
                    disabled={updateChore.isPending}
                    title={`Move to: ${nextStatus(status)}`}
                    style={{
                      width:40, height:40, borderRadius:'50%', flexShrink:0,
                      border:`2px solid ${cfg.color}`,
                      background: status === 'done' ? '#4ADE80' : cfg.bg,
                      color: status === 'done' ? '#000' : cfg.color,
                      fontSize: status === 'done' ? 16 : 14,
                      cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center',
                      transition:'all 0.15s',
                    }}
                  >
                    {status === 'done' ? '✓' : status === 'in_progress' ? '🔥' : '▶'}
                  </button>

                  <span style={{ fontSize:22 }}>{chore.emoji}</span>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:14, textDecoration: status === 'done' ? 'line-through' : 'none' }}>
                      {chore.title}
                    </div>

                    <div style={{ display:'flex', gap:6, marginTop:4, flexWrap:'wrap', alignItems:'center' }}>

                      {/* Assignee — click to reassign */}
                      <button
                        onClick={() => setEditChore(isEditing ? null : chore)}
                        style={{ background:'none', border:'none', cursor:'pointer', padding:0, display:'flex', alignItems:'center', gap:4 }}
                      >
                        {assignee ? (
                          <>
                            <div style={{ width:16, height:16, borderRadius:'50%', background:assignee.color,
                              display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, overflow:'hidden', flexShrink:0 }}>
                              {avatarUrl
                                ? <img src={avatarUrl} alt={assignee.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                : assignee.emoji}
                            </div>
                            <span style={{ fontSize:11, fontWeight:700, color:'var(--text-secondary)', textDecoration:'underline dotted' }}>{assignee.name}</span>
                          </>
                        ) : (
                          <span style={{ fontSize:11, fontWeight:700, color:'var(--primary)', textDecoration:'underline dotted' }}>+ Assign</span>
                        )}
                      </button>

                      <span style={{ fontSize:11, color:'var(--text-muted)', fontWeight:700 }}>{chore.frequency}</span>

                      <span style={{ fontSize:11, fontWeight:900, padding:'2px 8px', borderRadius:20, background:cfg.bg, color:cfg.color }}>
                        {cfg.icon} {cfg.label}
                      </span>

                      <span style={{ fontSize:11, fontWeight:800, color:'#FBBF24' }}>⭐ {chore.stars}</span>

                      {/* Due date badge */}
                      {dueLabel && (
                        <span style={{ fontSize:10, fontWeight:900, padding:'2px 7px', borderRadius:20,
                          background: overdue ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)',
                          color: overdue ? '#F87171' : 'var(--text-muted)',
                          border: overdue ? '1px solid rgba(248,113,113,0.3)' : 'none',
                        }}>
                          {overdue ? '⚠️' : '📅'} {dueLabel}
                        </span>
                      )}
                    </div>

                    {/* Inline reassign dropdown */}
                    {isEditing && (
                      <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:6 }}>
                        <button
                          onClick={() => handleReassign(chore, '')}
                          style={{ fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:20, cursor:'pointer',
                            background:'rgba(255,255,255,0.06)', border:'1.5px solid var(--border)', color:'var(--text-muted)' }}>
                          Anyone
                        </button>
                        {memberList.map((m:any) => (
                          <button key={m.id}
                            onClick={() => handleReassign(chore, m.id)}
                            style={{ fontSize:11, fontWeight:800, padding:'4px 10px', borderRadius:20, cursor:'pointer',
                              background: chore.assignedToId === m.id ? m.color+'33' : 'rgba(255,255,255,0.06)',
                              border: `1.5px solid ${chore.assignedToId === m.id ? m.color : 'var(--border)'}`,
                              color: chore.assignedToId === m.id ? m.color : 'var(--text-secondary)' }}>
                            {m.emoji} {m.name}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <button
                    onClick={() => deleteChore.mutate(chore.id)}
                    style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:18, padding:4, lineHeight:1 }}
                  >×</button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add chore modal */}
      {showAdd && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:100, padding:16 }}>
          <div className="card" style={{ width:'100%', maxWidth:460, maxHeight:'90vh', overflowY:'auto' }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:20 }}>
              <h2 style={{ fontWeight:900, fontSize:18 }}>+ New Chore</h2>
              <button onClick={() => setShowAdd(false)} style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:20 }}>×</button>
            </div>

            {/* Emoji picker */}
            <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:16 }}>
              {CHORE_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewChore(p => ({ ...p, emoji: e }))} style={{
                  width:36, height:36, borderRadius:8, fontSize:18, cursor:'pointer',
                  background: newChore.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  border: newChore.emoji === e ? '2px solid var(--primary)' : '2px solid transparent',
                }}>{e}</button>
              ))}
            </div>

            <input className="input" placeholder="Chore title..."
              style={{ marginBottom:12, width:'100%' }}
              value={newChore.title}
              onChange={e => setNewChore(p => ({ ...p, title: e.target.value }))}
            />

            {/* Assign to */}
            <select className="input" style={{ marginBottom:12, width:'100%' }}
              value={newChore.assignedToId}
              onChange={e => setNewChore(p => ({ ...p, assignedToId: e.target.value }))}>
              <option value="">Anyone</option>
              {memberList.map((m:any) => (
                <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
              ))}
            </select>

            {/* Frequency */}
            <div style={{ display:'flex', gap:8, marginBottom:12 }}>
              {FREQS.map(f => (
                <button key={f} onClick={() => setNewChore(p => ({ ...p, frequency: f }))} style={{
                  flex:1, padding:'8px', borderRadius:8, fontWeight:800, fontSize:12, cursor:'pointer',
                  background: newChore.frequency === f ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  color: newChore.frequency === f ? '#fff' : 'var(--text-secondary)', border:'none',
                }}>{f}</button>
              ))}
            </div>

            {/* Due date */}
            <div style={{ marginBottom:12 }}>
              <label style={{ fontSize:11, fontWeight:800, color:'var(--text-muted)', display:'block', marginBottom:4 }}>📅 Due date (optional)</label>
              <input type="date" className="input" style={{ width:'100%' }}
                value={newChore.dueDate}
                onChange={e => setNewChore(p => ({ ...p, dueDate: e.target.value }))}
              />
            </div>

            {/* Stars */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
              <span style={{ fontSize:13, fontWeight:700, color:'var(--text-secondary)' }}>Stars:</span>
              {[1,2,3,5,10].map(n => (
                <button key={n} onClick={() => setNewChore(p => ({ ...p, stars: n }))} style={{
                  padding:'4px 10px', borderRadius:8, fontWeight:900, fontSize:12, cursor:'pointer',
                  background: newChore.stars === n ? '#FBBF24' : 'rgba(255,255,255,0.06)',
                  color: newChore.stars === n ? '#000' : 'var(--text-secondary)', border:'none',
                }}>⭐{n}</button>
              ))}
            </div>

            {/* Proof required */}
            <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:12, background:'rgba(255,255,255,0.04)', borderRadius:10 }}>
              <input type="checkbox" id="proof" checked={newChore.proofRequired}
                onChange={e => setNewChore(p => ({ ...p, proofRequired: e.target.checked }))}
                style={{ width:18, height:18, accentColor:'var(--primary)', cursor:'pointer' }}
              />
              <label htmlFor="proof" style={{ fontWeight:700, fontSize:13, cursor:'pointer' }}>📸 Require photo proof</label>
            </div>

            <div style={{ display:'flex', gap:8 }}>
              <button className="btn" style={{ flex:1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex:2 }}
                onClick={handleAdd}
                disabled={!newChore.title.trim() || createChore.isPending}>
                {createChore.isPending ? 'Adding...' : '+ Add Chore'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}