import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyGoal } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

/** The family's shared star goal, with a progress bar. Parents can start one. */
export default function GoalBar({ big = false }: { big?: boolean }) {
  const { data } = useFamilyGoal();
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const qc = useQueryClient();
  const [form, setForm] = useState<{ title: string; reward: string; targetStars: string } | null>(null);
  const goal = data?.active;

  async function save() {
    if (!form) return;
    try {
      await api.post('/goals', { title: form.title, reward: form.reward, targetStars: Number(form.targetStars), emoji: '🎯' });
      setForm(null);
      qc.invalidateQueries({ queryKey: ['goal'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
    } catch (e: any) { alert(e.response?.data?.error || 'Could not save goal'); }
  }

  if (!goal && !isParent) return null;
  return (
    <section aria-label="Family goal" style={{
      background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
      padding: big ? '20px 24px' : '16px 18px', marginBottom: 18,
    }}>
      {goal ? (
        <>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
            <div style={{ fontWeight: 800, fontSize: big ? 24 : 16 }}>{goal.emoji} {goal.title}</div>
            <div style={{ fontWeight: 800, fontSize: big ? 20 : 14, color: '#FBBF24' }}>{goal.progress} / {goal.targetStars} ⭐</div>
          </div>
          <div role="progressbar" aria-valuemin={0} aria-valuemax={goal.targetStars} aria-valuenow={goal.progress}
            style={{ height: big ? 22 : 12, borderRadius: 999, background: 'rgba(255,255,255,0.08)', marginTop: 10, overflow: 'hidden' }}>
            <div style={{ width: `${goal.pct}%`, height: '100%', borderRadius: 999, background: 'linear-gradient(90deg,#F59E0B,#F472B6,#A78BFA)', transition: 'width .8s ease' }} />
          </div>
          <div style={{ fontSize: big ? 16 : 12, color: 'var(--text-muted)', marginTop: 8 }}>
            {goal.reachedAt ? `🎉 Reached together!${goal.reward ? ` ${goal.reward}` : ''}` : `${goal.remaining} stars to go${goal.reward ? ` — then: ${goal.reward}` : ''}. Every chore by anyone counts!`}
          </div>
          {isParent && !big && <button className="btn btn-ghost" style={{ fontSize: 12, marginTop: 8 }} onClick={() => setForm({ title: '', reward: '', targetStars: '200' })}>{goal.reachedAt ? 'Start a new goal' : 'Change goal'}</button>}
        </>
      ) : !form && (
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <div><strong>🎯 Family goal</strong><div className="calm-muted" style={{ fontSize: 13 }}>Pick something to earn together — every star from every chore counts toward it.</div></div>
          <button className="btn btn-primary" onClick={() => setForm({ title: '', reward: '', targetStars: '200' })}>Set a goal</button>
        </div>
      )}
      {form && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: goal ? 12 : 0 }}>
          <input className="input" placeholder="Goal name, e.g. Movie night" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} />
          <input className="input" placeholder="Reward (optional), e.g. Pizza and a movie" value={form.reward} onChange={e => setForm({ ...form, reward: e.target.value })} />
          <input className="input" type="number" min={1} placeholder="Stars needed" value={form.targetStars} onChange={e => setForm({ ...form, targetStars: e.target.value })} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn btn-primary" onClick={save} disabled={!form.title.trim()}>Start goal</button>
            <button className="btn btn-ghost" onClick={() => setForm(null)}>Cancel</button>
          </div>
        </div>
      )}
    </section>
  );
}
