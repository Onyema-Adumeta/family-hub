import { useEffect, useState } from 'react';
import { useWins } from '../hooks/useApi';
import Recommendations from '../components/Recommendations';
import FairnessMeter from '../components/FairnessMeter';

function shift(day: string, weeks: number) {
  const [y, m, d] = day.split('-').map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + weeks * 7));
  return t.toISOString().slice(0, 10);
}
function label(start: string, end: string) {
  const f = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}

/** Weekly Wins: the week's report, told as a celebration. */
export default function WinsPage() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const { data, isLoading, isError } = useWins(week);
  const [revealed, setRevealed] = useState(0);
  useEffect(() => {
    setRevealed(0);
    if (!data) return;
    const t = setInterval(() => setRevealed(r => (r >= data.awards.length ? r : r + 1)), 700);
    return () => clearInterval(t);
  }, [data]);

  if (isLoading) return <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>;
  if (isError || !data) return <p role="alert" style={{ padding: 24 }}>Weekly Wins could not load.</p>;
  const kids = (data.members as any[]).filter(m => m.stars > 0 || m.role === 'child').sort((a, b) => b.stars - a.stars);

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', padding: '8px 0 48px' }}>
      <style>{`@keyframes wins-in{from{opacity:0;transform:translateY(16px) scale(.96)}to{opacity:1;transform:none}}@media (prefers-reduced-motion: reduce){.wins-card{animation:none!important}}`}</style>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <button className="btn btn-ghost" aria-label="Previous week" onClick={() => setWeek(shift(data.weekStart, -1))}>←</button>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.15em', color: '#FBBF24' }}>WEEKLY WINS</div>
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{label(data.weekStart, data.weekEnd)}{data.isCurrentWeek ? ' · so far' : ''}</div>
        </div>
        <button className="btn btn-ghost" aria-label="Next week" disabled={data.isCurrentWeek} onClick={() => setWeek(shift(data.weekStart, 1))}>→</button>
      </div>

      <section style={{ textAlign: 'center', margin: '24px 0' }}>
        <div style={{ fontSize: 64 }}>🏆</div>
        <div style={{ fontSize: 'clamp(40px,10vw,64px)', fontWeight: 900, background: 'linear-gradient(135deg,#F59E0B,#F472B6,#A78BFA)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          {data.family.stars} ⭐
        </div>
        <div style={{ fontWeight: 700 }}>earned together · {data.family.chores} chores done</div>
        {data.family.changePct !== null && (
          <div style={{ marginTop: 6, color: data.family.changePct >= 0 ? '#4ADE80' : '#F59E0B', fontWeight: 700 }}>
            {data.family.changePct >= 0 ? '▲' : '▼'} {Math.abs(data.family.changePct)}% vs last week
          </div>
        )}
      </section>

      <section aria-label="Awards" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 12, marginBottom: 24 }}>
        {(data.awards as any[]).slice(0, revealed).map(a => (
          <div key={a.title} className="wins-card" style={{ animation: 'wins-in .5s ease-out', background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.3)', borderRadius: 16, padding: 16, textAlign: 'center' }}>
            <div style={{ fontSize: 40 }}>{a.icon}</div>
            <div style={{ fontSize: 12, fontWeight: 800, color: '#FBBF24', letterSpacing: '0.08em' }}>{a.title.toUpperCase()}</div>
            <div style={{ fontSize: 22, fontWeight: 900, margin: '4px 0' }}>{a.name}</div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>{a.detail}</div>
          </div>
        ))}
        {!data.awards.length && <p className="calm-muted" style={{ textAlign: 'center', gridColumn: '1/-1' }}>No awards yet this week — the first chore wins one!</p>}
      </section>

      <section aria-label="Everyone's week" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 16, padding: 16, marginBottom: 18 }}>
        {kids.map(m => (
          <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 0', borderBottom: '1px solid var(--border)' }}>
            <div style={{ width: 40, height: 40, borderRadius: '50%', background: m.color, display: 'grid', placeItems: 'center', fontSize: 20 }}>{m.emoji}</div>
            <div style={{ flex: 1 }}>
              <strong>{m.name}</strong>
              <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Level {m.level} · {m.levelTitle}{m.streakDays > 1 ? ` · 🔥 ${m.streakDays}` : ''}{m.achievements.length ? ` · ${m.achievements.join(' ')}` : ''}</div>
            </div>
            <div style={{ textAlign: 'right' }}><div style={{ fontWeight: 900, color: '#FBBF24' }}>{m.stars} ⭐</div><div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.chores} chores</div></div>
          </div>
        ))}
      </section>

      <FairnessMeter />
      <section aria-label="Highlights" style={{ background: 'linear-gradient(135deg,rgba(74,222,128,0.08),rgba(96,165,250,0.08))', border: '1px solid var(--border)', borderRadius: 16, padding: 16 }}>
        <h2 style={{ fontSize: 16, margin: '0 0 8px' }}>✨ Highlights</h2>
        <ul style={{ margin: 0, paddingLeft: 20, lineHeight: 1.7 }}>{(data.highlights as string[]).map(h => <li key={h}>{h}</li>)}</ul>
      </section>
      <div style={{ marginTop: 18 }}><Recommendations limit={3} title="💡 Next week, try…" /></div>
    </div>
  );
}
