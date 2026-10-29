import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useBriefing } from '../hooks/useApi';
import { useRealtime } from '../hooks/useRealtime';
import GoalBar from '../components/GoalBar';
import CelebrationOverlay from '../components/CelebrationOverlay';

/** Read-only, glanceable family board for a tablet on the wall or a TV. */
export default function HouseViewPage() {
  useRealtime();
  const { data } = useBriefing();
  const navigate = useNavigate();
  const [now, setNow] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), 15_000); return () => clearInterval(t); }, []);
  useEffect(() => {
    // Keep a wall tablet awake where the browser allows it.
    let lock: any;
    (navigator as any).wakeLock?.request?.('screen').then((l: any) => { lock = l; }).catch(() => {});
    return () => { lock?.release?.().catch?.(() => {}); };
  }, []);

  return (
    <div style={{ minHeight: '100vh', padding: 'clamp(16px,3vw,40px)', background: 'var(--bg)' }}>
      <CelebrationOverlay />
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 24 }}>
        <div>
          <div style={{ fontSize: 'clamp(40px,7vw,88px)', fontWeight: 900, lineHeight: 1 }}>{now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</div>
          <div style={{ fontSize: 'clamp(18px,2.5vw,28px)', color: 'var(--text-muted)', fontWeight: 700 }}>{now.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</div>
        </div>
        <div style={{ textAlign: 'right' }}>
          {data?.dinner && <div style={{ fontSize: 'clamp(16px,2vw,24px)', fontWeight: 700 }}>🍽️ Dinner: {data.dinner.emoji} {data.dinner.name}</div>}
          {data?.birthdays?.length > 0 && <div style={{ fontSize: 'clamp(16px,2vw,24px)', fontWeight: 800, color: '#F472B6' }}>🎂 Happy birthday {data.birthdays.join(' & ')}!</div>}
          <button className="btn btn-ghost" style={{ marginTop: 8, fontSize: 12, opacity: 0.6 }} onClick={() => navigate('/')}>Exit house view</button>
        </div>
      </header>

      <GoalBar big />

      {data?.events?.length > 0 && (
        <section style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
          {data.events.map((e: any) => (
            <div key={e.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14, padding: '12px 18px', fontSize: 'clamp(16px,1.8vw,22px)', fontWeight: 700 }}>
              {e.emoji} {e.time ? <span style={{ color: '#60A5FA' }}>{e.time}</span> : null} {e.title}
            </div>
          ))}
        </section>
      )}

      <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(240px,1fr))', gap: 16 }}>
        {(data?.people || []).map((p: any) => (
          <div key={p.id} style={{ background: 'var(--bg-card)', border: `2px solid ${p.color}55`, borderRadius: 20, padding: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{ width: 56, height: 56, borderRadius: '50%', background: p.color, display: 'grid', placeItems: 'center', fontSize: 30 }}>{p.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 24, fontWeight: 900 }}>{p.name}</div>
                <div style={{ fontSize: 14, color: 'var(--text-muted)', fontWeight: 700 }}>Lv {p.level} {p.levelTitle} · ⭐ {p.stars}{p.streakDays > 1 ? ` · 🔥 ${p.streakDays}` : ''}</div>
              </div>
            </div>
            {p.choresToday.length === 0
              ? <div style={{ fontSize: 18, color: '#4ADE80', fontWeight: 800 }}>✅ All done today!</div>
              : p.choresToday.map((c: any) => (
                  <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 18, padding: '6px 0', borderTop: '1px solid var(--border)', color: c.overdue ? '#F59E0B' : 'var(--text)' }}>
                    <span>{c.emoji} {c.title}</span><span style={{ color: '#FBBF24', fontWeight: 800 }}>{c.stars}⭐</span>
                  </div>
                ))}
            {p.waitingForParent > 0 && <div style={{ marginTop: 8, fontSize: 14, color: '#60A5FA' }}>📸 {p.waitingForParent} waiting for a parent</div>}
          </div>
        ))}
      </section>
    </div>
  );
}
