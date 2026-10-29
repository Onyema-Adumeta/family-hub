import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';

const STATUS = {
  balanced: { label: 'Fair', color: '#4ADE80', note: 'Work is shared evenly.' },
  uneven: { label: 'A bit uneven', color: '#FBBF24', note: 'One kid is carrying more.' },
  unfair: { label: 'Unbalanced', color: '#F87171', note: 'One kid is doing most of the work.' },
} as const;

/** How evenly chore work is shared between the kids (last 14 days). */
export default function FairnessMeter() {
  const navigate = useNavigate();
  const { data } = useQuery({ queryKey: ['fairness'], queryFn: () => api.get('/insights/fairness').then(r => r.data) });
  if (!data?.applicable) return null;
  const st = STATUS[data.status as keyof typeof STATUS];
  return (
    <section aria-label="Fairness meter" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: 16 }}>⚖️ Fairness meter</h2>
        <span style={{ fontWeight: 900, color: st.color }}>{st.label} · {data.score}/100</span>
      </div>
      <p className="calm-muted" style={{ margin: '4px 0 12px', fontSize: 13 }}>{st.note} Last {data.days} days: stars earned plus chores still to do.</p>
      <div role="img" aria-label={data.kids.map((k: any) => `${k.name} ${k.sharePct}%`).join(', ')} style={{ display: 'flex', height: 22, borderRadius: 999, overflow: 'hidden', background: 'rgba(255,255,255,0.06)' }}>
        {data.kids.map((k: any) => <div key={k.id} title={`${k.name}: ${k.sharePct}%`} style={{ width: `${k.sharePct}%`, background: k.color, minWidth: k.sharePct ? 4 : 0 }} />)}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginTop: 10, fontSize: 13 }}>
        {data.kids.map((k: any) => (
          <span key={k.id}><span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: 3, background: k.color, marginRight: 6 }} />{k.emoji} {k.name} <strong>{k.sharePct}%</strong> <span className="calm-muted">({k.choresDone} done, {k.openChores} to do)</span></span>
        ))}
      </div>
      {data.suggestions.length > 0 && (
        <div style={{ marginTop: 12, fontSize: 13 }}>
          Try making these take turns: {data.suggestions.map((s: any) => `${s.emoji} ${s.title}`).join(', ')}{' '}
          <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => navigate('/chores')}>Open chores</button>
        </div>
      )}
    </section>
  );
}
