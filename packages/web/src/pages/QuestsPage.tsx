import { useState } from 'react';
import { useQuests, useCreateQuest, useDeleteQuest, useCompleteQuest, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { useQueryClient } from '@tanstack/react-query';

const QUEST_EMOJIS = ['🗡️','🏆','🧩','🚀','🌟','🦁','🐉','🧙','⚔️','🛡️','🎯','🔮'];
const DIFFICULTIES = [
  { label: 'Easy',   value: 'easy',   stars: 5,  color: '#10b981' },
  { label: 'Medium', value: 'medium', stars: 10, color: '#f59e0b' },
  { label: 'Hard',   value: 'hard',   stars: 20, color: '#ef4444' },
  { label: 'Epic',   value: 'epic',   stars: 50, color: '#8b5cf6' },
];

interface Stage { title: string; completedAt: string | null; }

function StageProgress({ stages, questId, canEdit, onUpdate }: {
  stages: Stage[]; questId: string; canEdit: boolean; onUpdate: (stages: Stage[]) => void;
}) {
  const completed = stages.filter(s => s.completedAt).length;
  const pct = stages.length ? Math.round((completed / stages.length) * 100) : 0;

  const toggle = async (idx: number) => {
    if (!canEdit) return;
    const updated = stages.map((s, i) =>
      i === idx ? { ...s, completedAt: s.completedAt ? null : new Date().toISOString() } : s
    );
    onUpdate(updated);
    await api.patch(`/quests/${questId}/stages`, { stages: updated });
  };

  if (!stages.length) return null;

  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
        <span style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)' }}>
          QUEST PROGRESS
        </span>
        <span style={{ fontSize: 10, fontWeight: 900, color: 'var(--primary)' }}>
          {completed}/{stages.length} stages
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 99, background: 'var(--bg-tertiary)', overflow: 'hidden', marginBottom: 8 }}>
        <div style={{
          height: '100%', borderRadius: 99, width: `${pct}%`,
          background: pct === 100 ? 'var(--success)' : 'linear-gradient(90deg, var(--primary), #8b5cf6)',
          transition: 'width 0.4s ease'
        }} />
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
        {stages.map((s, i) => (
          <div key={i} onClick={() => toggle(i)} style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '5px 8px', borderRadius: 8,
            background: s.completedAt ? 'rgba(16,185,129,0.08)' : 'var(--bg-secondary)',
            cursor: canEdit ? 'pointer' : 'default',
            border: `1px solid ${s.completedAt ? 'rgba(16,185,129,0.25)' : 'var(--border)'}`,
            transition: 'all 0.15s'
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: s.completedAt ? 'var(--success)' : 'var(--bg-tertiary)',
              border: `2px solid ${s.completedAt ? 'var(--success)' : 'var(--border)'}`,
              fontSize: 10, color: '#fff', fontWeight: 900
            }}>
              {s.completedAt ? '✓' : i + 1}
            </div>
            <span style={{
              fontSize: 12, fontWeight: 700,
              color: s.completedAt ? 'var(--success)' : 'var(--text-primary)',
              textDecoration: s.completedAt ? 'line-through' : 'none',
              flex: 1
            }}>
              {s.title}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuestsPage() {
  const { member } = useAuthStore();
  const { data: quests = [] } = useQuests();
  const { data: members = [] } = useMembers();
  const createQuest = useCreateQuest();
  const deleteQuest = useDeleteQuest();
  const completeQuest = useCompleteQuest();
  const queryClient = useQueryClient();

  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState<'active' | 'completed' | 'all'>('active');
  const [newStageInput, setNewStageInput] = useState('');
  const [newQuest, setNewQuest] = useState({
    emoji: '🗡️', title: '', description: '', difficulty: 'easy',
    stars: 5, memberId: '', deadline: '', stages: [] as Stage[]
  });

  const isParent = member?.role === 'parent';

  const filteredQuests = (quests as any[]).filter((q: any) => {
    if (filter === 'active') return !q.completedAt;
    if (filter === 'completed') return !!q.completedAt;
    return true;
  });

  const difficultyInfo = (d: string) => DIFFICULTIES.find(x => x.value === d) || DIFFICULTIES[0];

  const addStage = () => {
    const t = newStageInput.trim();
    if (!t) return;
    setNewQuest(p => ({ ...p, stages: [...p.stages, { title: t, completedAt: null }] }));
    setNewStageInput('');
  };

  const removeStage = (idx: number) => {
    setNewQuest(p => ({ ...p, stages: p.stages.filter((_, i) => i !== idx) }));
  };

  const handleStageUpdate = (questId: string, stages: Stage[]) => {
    queryClient.setQueryData(['quests'], (old: any[]) =>
      (old || []).map((q: any) => q.id === questId ? { ...q, stages } : q)
    );
  };

  const allStagesDone = (q: any) => {
    const stages: Stage[] = Array.isArray(q.stages) ? q.stages : [];
    return stages.length === 0 || stages.every(s => !!s.completedAt);
  };

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

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
        {[
          { label: 'Active',    value: (quests as any[]).filter((q: any) => !q.completedAt).length,  emoji: '⚔️', color: 'var(--primary)' },
          { label: 'Completed', value: (quests as any[]).filter((q: any) => !!q.completedAt).length, emoji: '✅', color: 'var(--success)' },
          { label: 'Stars Won', value: (quests as any[]).filter((q: any) => !!q.completedAt).reduce((acc: number, q: any) => acc + (q.stars || 0), 0), emoji: '⭐', color: 'var(--warning)' },
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
        {(['active', 'completed', 'all'] as const).map(f => (
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

      {/* Quest cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 12 }}>
        {filteredQuests.map((q: any) => {
          const diff = difficultyInfo(q.difficulty);
          const isCompleted = !!q.completedAt;
          const isAssignedToMe = !q.memberId || q.memberId === member?.id;
          const canEdit = isParent || isAssignedToMe;
          const stages: Stage[] = Array.isArray(q.stages) ? q.stages : [];
          const stagesComplete = allStagesDone(q);
          const completedStages = stages.filter(s => s.completedAt).length;

          return (
            <div key={q.id} className="card" style={{
              opacity: isCompleted ? 0.72 : 1,
              position: 'relative', overflow: 'hidden',
              borderTop: `3px solid ${diff.color}`,
            }}>
              {isCompleted && (
                <div style={{ position: 'absolute', top: 10, right: 10, fontSize: 18 }}>✅</div>
              )}

              {/* Header */}
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
                <div style={{
                  fontSize: 28, flexShrink: 0, width: 44, height: 44, borderRadius: 10,
                  background: diff.color + '18', display: 'flex', alignItems: 'center', justifyContent: 'center'
                }}>
                  {q.emoji}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{
                    fontWeight: 900, fontSize: 15, lineHeight: 1.2,
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap'
                  }}>
                    {q.title}
                  </div>
                  {q.description && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600, marginTop: 3, lineHeight: 1.3 }}>
                      {q.description}
                    </div>
                  )}
                </div>
              </div>

              {/* Badges */}
              <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', marginBottom: 10 }}>
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
                    📅 {new Date(q.deadline.replace(/-/g, '/')).toLocaleDateString()}
                  </span>
                )}
              </div>

              {/* Stages */}
              {stages.length > 0 && (
                <StageProgress
                  stages={stages}
                  questId={q.id}
                  canEdit={!isCompleted && canEdit}
                  onUpdate={(updated) => handleStageUpdate(q.id, updated)}
                />
              )}

              {/* Actions */}
              <div style={{ display: 'flex', gap: 6 }}>
                {!isCompleted && canEdit && (
                  <button
                    onClick={() => { if (confirm(`Complete quest "${q.title}" for ⭐${q.stars}?`)) completeQuest.mutate(q.id); }}
                    className="btn btn-primary"
                    style={{ flex: 1, fontSize: 12, minHeight: 38, opacity: stagesComplete ? 1 : 0.5 }}
                    disabled={completeQuest.isPending || !stagesComplete}
                    title={!stagesComplete ? `Complete all ${stages.length} stages first` : ''}
                  >
                    {stages.length > 0 && !stagesComplete
                      ? `🔒 ${completedStages}/${stages.length} stages`
                      : '✅ Complete Quest'}
                  </button>
                )}
                {isParent && (
                  <button
                    onClick={() => { if (confirm('Delete quest?')) deleteQuest.mutate(q.id); }}
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
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>⚔️ New Quest</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

              {/* Emoji picker */}
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

              {/* Difficulty */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>Difficulty</label>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6 }}>
                  {DIFFICULTIES.map(d => (
                    <button key={d.value} type="button"
                      onClick={() => setNewQuest(p => ({ ...p, difficulty: d.value, stars: d.stars }))} style={{
                        padding: '8px 4px', borderRadius: 8,
                        border: `2px solid ${newQuest.difficulty === d.value ? d.color : 'var(--border)'}`,
                        background: newQuest.difficulty === d.value ? d.color + '22' : 'var(--bg-secondary)',
                        cursor: 'pointer', fontSize: 11, fontWeight: 900, color: d.color
                      }}>
                      {d.label}<br /><span style={{ fontSize: 10, color: 'var(--warning)' }}>⭐{d.stars}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Stages builder */}
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 6 }}>
                  Quest Stages <span style={{ color: 'var(--text-muted)', fontWeight: 600 }}>(optional — makes it a multi-step quest)</span>
                </label>
                <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
                  <input className="input" placeholder="Add a stage..." value={newStageInput}
                    onChange={e => setNewStageInput(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addStage(); } }}
                    style={{ flex: 1, fontSize: 12 }} />
                  <button type="button" onClick={addStage} className="btn btn-primary" style={{ fontSize: 12, padding: '0 12px' }}>
                    Add
                  </button>
                </div>
                {newQuest.stages.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {newQuest.stages.map((s, i) => (
                      <div key={i} style={{
                        display: 'flex', alignItems: 'center', gap: 8,
                        padding: '6px 10px', borderRadius: 8,
                        background: 'var(--bg-secondary)', border: '1px solid var(--border)'
                      }}>
                        <span style={{ fontSize: 11, fontWeight: 800, color: 'var(--primary)', minWidth: 16 }}>{i + 1}</span>
                        <span style={{ flex: 1, fontSize: 12, fontWeight: 600 }}>{s.title}</span>
                        <button type="button" onClick={() => removeStage(i)}
                          style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 14, color: 'var(--text-muted)', padding: '0 2px' }}>
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Assign + deadline */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Assign to</label>
                  <select className="input" value={newQuest.memberId}
                    onChange={e => setNewQuest(p => ({ ...p, memberId: e.target.value }))}>
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
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => {
                  setShowAdd(false);
                  setNewQuest({ emoji: '🗡️', title: '', description: '', difficulty: 'easy', stars: 5, memberId: '', deadline: '', stages: [] });
                  setNewStageInput('');
                }}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }}
                  disabled={!newQuest.title.trim() || createQuest.isPending}
                  onClick={() => {
                    createQuest.mutate(newQuest);
                    setShowAdd(false);
                    setNewQuest({ emoji: '🗡️', title: '', description: '', difficulty: 'easy', stars: 5, memberId: '', deadline: '', stages: [] });
                    setNewStageInput('');
                  }}>
                  {createQuest.isPending ? 'Creating...' : '⚔️ Create Quest'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}