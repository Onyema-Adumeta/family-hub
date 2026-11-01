// First-run checklist for parents: the few steps that make Kinroost useful.
// Each step ticks itself off from the family's real data; hides when all done or dismissed.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useChores, useEvents, useMeals, useMembers, useRewards } from '../hooks/useApi';

const HIDDEN_KEY = (familyId?: string) => `kinroost.setupHidden.${familyId || ''}`;
function readHidden(familyId?: string) {
  try { return localStorage.getItem(HIDDEN_KEY(familyId)) === '1'; } catch { return false; }
}

export default function SetupChecklist({ week }: { week: string }) {
  const { member, family } = useAuthStore();
  const navigate = useNavigate();
  const [hidden, setHidden] = useState(() => readHidden(family?.id));
  const { data: members = [], isLoading: l1 } = useMembers();
  const { data: chores = [], isLoading: l2 } = useChores();
  const { data: rewards = [], isLoading: l3 } = useRewards();
  const { data: events = [], isLoading: l4 } = useEvents();
  const { data: meals = [], isLoading: l5 } = useMeals(week);

  if (member?.role !== 'parent' || hidden || l1 || l2 || l3 || l4 || l5) return null;

  const notifications = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const steps = [
    { done: (members as any[]).length > 1, label: 'Invite your family', hint: 'Share your family code so everyone can join.', path: '/settings' },
    { done: (chores as any[]).length > 0, label: 'Add the first chore', hint: 'Pick one small daily job to start.', path: '/chores' },
    { done: (rewards as any[]).length > 0, label: 'Set up a reward', hint: 'Something worth saving stars for.', path: '/rewards' },
    { done: (events as any[]).length > 0, label: 'Put something on the calendar', hint: 'Practice, appointments, a birthday.', path: '/schedule' },
    { done: (meals as any[]).length > 0, label: 'Plan one dinner', hint: 'Just tonight is fine.', path: '/meals' },
    { done: notifications, label: 'Turn on notifications', hint: 'So you hear when a chore needs checking.', path: '/settings' },
  ];
  const doneCount = steps.filter(s => s.done).length;
  if (doneCount === steps.length) return null;

  function hide() {
    try { localStorage.setItem(HIDDEN_KEY(family?.id), '1'); } catch { /* fine: hides until reload */ }
    setHidden(true);
  }

  return (
    <section aria-label="Getting started" style={{ background: 'linear-gradient(135deg,var(--bg-card),rgba(124,111,247,.10))', border: '1px solid var(--border)', borderRadius: 14, padding: 20, marginBottom: 18 }}>
      <div className="calm-section-heading">
        <div>
          <p className="calm-eyebrow">GETTING STARTED</p>
          <h2 style={{ margin: '4px 0' }}>Set up your family · {doneCount} of {steps.length} done</h2>
        </div>
        <button className="btn btn-ghost" onClick={hide} aria-label="Hide the getting started checklist">Hide</button>
      </div>
      <div className="progress-bar" style={{ margin: '10px 0 14px' }} role="progressbar" aria-valuenow={doneCount} aria-valuemin={0} aria-valuemax={steps.length}>
        <div className="progress-fill" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <div style={{ display: 'grid', gap: 8 }}>
        {steps.map(s => (
          <button key={s.label} className="calm-task" onClick={() => navigate(s.path)} disabled={s.done}
            style={{ width: '100%', textAlign: 'left', opacity: s.done ? 0.6 : 1, cursor: s.done ? 'default' : 'pointer' }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span aria-hidden="true" style={{ display: 'inline-grid', placeItems: 'center', width: 26, height: 26, borderRadius: 13, flexShrink: 0, fontSize: 14,
                background: s.done ? 'var(--success, #4ADE80)' : 'transparent', border: s.done ? 'none' : '2px solid var(--border)', color: '#fff' }}>{s.done ? '✓' : ''}</span>
              <span>
                <strong style={{ textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}</strong>
                {!s.done && <small>{s.hint}</small>}
              </span>
            </span>
            {!s.done && <span aria-hidden="true">→</span>}
          </button>
        ))}
      </div>
    </section>
  );
}
