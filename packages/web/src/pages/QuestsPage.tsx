import { useState } from 'react';
import { useQuests, useCreateQuest, useDeleteQuest, useCompleteQuest, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const QUEST_EMOJIS = ['🗡️','🏆','🧩','🚀','🌟','🦁','🐉','🧙','⚔️','🛡️','🎯','🔮'];
const DIFFICULTIES = [
  { label: 'Easy', value: 'easy', stars: 5, color: '#10b981' },
  { label: 'Medium', value: 'medium', stars: 10, color: '#f59e0b' },
  { label: 'Hard', value: 'hard', stars: 20, color: '#ef4444' },
  { label: 'Epic', value: 'epic', stars: 50, color: '#8b5cf6' },
];

export default function QuestsPage() {
  const { member } = useAuthStore();
  const { data: quests = [] } = useQuests();
  const { data: members = [] } = useMembers();
  const createQuest = useCreateQuest();
  const deleteQuest = useDeleteQuest();
  const completeQuest = useCompleteQuest();

  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'active'|'completed'|'all'>('active');
  const [newQuest, setNewQuest] = useState({
    emoji: '🗡️', title: '', description: '', difficulty: 'easy', stars: 5, memberId: '', deadline: ''
  });

  const isParent = member?.role === 'parent';

  const filteredQuests = (quests as any[]).filter((q: any) => {
    if (filter === 'active') return !q.completedAt;
    if (filter === 'completed') return !!q.completedAt;
    return true;
  });

  const difficultyInfo = (d: string) => DIFFICULTIES.find(x => x.value === d) || DIFFICULTIES[0];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>🗡️ Quests</h1>
        {isParent && (
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize: 13 }}>
            + New Quest
          </button>
        )}
      </div>

      {/* Stats row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Active', value: (quests as any[]).filter((q: any) => !q.completedAt).length, emoji: '⚔️', color: 'var(--primary)' },
          { label: 'Completed', value: (quests as any[]).filter((q: any) => !!q.completedAt).length, emoji: '✅', color: 'var(--success)' },
          { label: 'Total Stars', value: (quests as any[]).filter((q: any) => !!q.completedAt).reduce((acc: number, q: any) => acc + (q.stars || 0), 0), emoji: '⭐', color: 'var(--warning)' },
        ].map(s => (
          <div key={s.label} className="card" style={{ textAlign: 'center', padding: '12px 8px' }}>
            <div style={{ fontSize: 20, marginBottom: 4 }}>{s.emoji}</div>
            <div style={{ fontWeight: 900, fontSize: 20, color: s.color }}>{s.value}</div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['active','completed','all'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: filter === f ? 'var(--primary)' : 'var(--bg-secondary)',
            color: filter === f ? '#fff' : 'var(--text-secondary)',
            border: `1.5px solid ${filter === f ? 'var(--primary)' : 'var(--border)'}`
          }}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {/* Quests list */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 10 }}>
        {filteredQuests.map((q: any) => {
          const diff = difficultyInfo(q.difficulty);
          const isCompleted = !!q.completedAt;
          const isAssignedToMe = !q.memberId || q.memberId === member?.id;
          return (
            <div key={q.id} className="card" style={{ opacity: isCompleted ? 0.7 : 1, position: 'relative', overflow: 'hidden' }}>
              {isCompleted && (
                <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 20 }}>✅</div>
              )}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{ fontSize: 30, flexShrink: 0 }}>{q.emoji}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 900, fontSize: 15, textDecoration: isCompleted ? 'line-through' : 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {q.title}
                  </div>
                  {q.description && (
                    <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 600, marginTop: 2 }}>
                      {q.description}
                    </div>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 900, background: diff.color + '22', color: diff.color }}>
                  {diff.label}
                </span>
                <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 900, background: 'rgba(245,158,11,0.12)', color: 'var(--warning)' }}>
                  ⭐ {q.stars}
                </span>
                {q.member && (
                  <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800, background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
                    {q.member.emoji} {q.member.name}
                  </span>
                )}
                {q.deadline && (
                  <span style={{ padding: '3px 8px', borderRadius: 10, fontSize: 10, fontWeight: 800, background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                    📅 {new Date(q.deadline).toLocaleDateString()}
                  </span>
                )}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {!isCompleted && (isParent || isAssignedToMe) && (
                  <button onClick={() => { if (confirm(`Complete quest "${q.title}" for ⭐${q.stars}?`)) completeQuest.mutate(q.id); }}
                    className="btn btn-primary" style={{ flex: 1, fontSize: 12, minHeight: 38 }}
                    disabled={completeQuest.isPending}>
                    ✅ Complete
                  </button>
                )}
                {isParent && (
                  <button onClick={() => { if (confirm('Delete quest?')) deleteQuest.mutate(q.id); }}
                    style={{ padding: '6px 10px', borderRadius: 8, background: 'var(--bg-tertiary)', border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: 14, minHeight: 38, minWidth: 38 }}>
                    🗑
                  </button>
                )}
              </div>
            </div>
          );
        })}
        {filteredQuests.length === 0 && (
          <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)', fontWeight: 700 }}>
            {filter === 'active' ? '🎉 All quests completed!' : filter === 'completed' ? 'No completed quests yet.' : 'No quests yet.'}
            {isParent && filter !== 'completed' ? ' Add one!' : ''}
          </div>
        )}
      </div>

      {/* Add quest modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>⚔️ New Quest</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {QUEST_EMOJIS.map(e => (
                  <button key={e} type="button" onClick={() => setNewQuest(p => ({ ...p, emoji: e }))} style={{
                    fontSize: 18, width: 40, height: 40, borderRadius: 8,
                    border: `2px solid ${newQuest.emoji === e ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'var(--bg-secondary)', cursor: 'pointer'
                  }}>{e}</button>
                ))}
              </div>
              <input className="input" placeholder="Quest title" value={newQuest.title}
                onChange={e => setNewQuest(p => ({ ...p, title: e.target.value }))} autoFocus />
              <textarea className="input" placeholder="Description (optional)" value={newQuest.description}
                onChange={e => setNewQuest(p => ({ ...p, description: e.target.value }))}
                rows={2} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>Difficulty</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {DIFFICULTIES.map(d => (
                    <button key={d.value} type="button" onClick={() => setNewQuest(p => ({ ...p, difficulty: d.value, stars: d.stars }))} style={{
                      padding: '8px 4px', borderRadius: 8, border: `2px solid ${newQuest.difficulty === d.value ? d.color : 'var(--border)'}`,
                      background: newQuest.difficulty === d.value ? d.color + '22' : 'var(--bg-secondary)',
                      cursor: 'pointer', fontSize: 11, fontWeight: 900, color: d.color
                    }}>
                      {d.label}<br /><span style={{ fontSize: 10, color: 'var(--warning)' }}>⭐{d.stars}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Assign to</label>
                  <select className="input" value={newQuest.memberId} onChange={e => setNewQuest(p => ({ ...p, memberId: e.target.value }))}>
                    <option value="">Everyone</option>
                    {(members as any[]).map((m: any) => (
                      <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Deadline</label>
                  <input type="date" className="input" value={newQuest.deadline}
                    onChange={e => setNewQuest(p => ({ ...p, deadline: e.target.value }))} />
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }}
                  disabled={!newQuest.title.trim() || createQuest.isPending}
                  onClick={() => { createQuest.mutate(newQuest); setShowAdd(false); }}>
                  {createQuest.isPending ? 'Adding...' : '⚔️ Create Quest'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}