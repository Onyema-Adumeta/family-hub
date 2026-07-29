// packages/web/src/pages/GamesPage.tsx
import { useState } from 'react';
import TriviaPage from './TriviaPage';
import MemoryMatch from '../games/MemoryMatch';

type GameKey = 'menu' | 'trivia' | 'memory';

const GAMES: { key: GameKey; label: string; emoji: string; desc: string }[] = [
  { key: 'trivia', label: 'Family Trivia', emoji: '🎮', desc: '10 AI questions · live leaderboard' },
  { key: 'memory', label: 'Memory Match', emoji: '🧠', desc: 'Pass-and-play · fewest moves wins' },
];

export default function GamesPage() {
  const [active, setActive] = useState<GameKey>('menu');

  if (active === 'trivia') return (
    <div>
      <BackBar onBack={() => setActive('menu')} title="Trivia" />
      <TriviaPage />
    </div>
  );

  if (active === 'memory') return (
    <div>
      <BackBar onBack={() => setActive('menu')} title="Memory Match" />
      <MemoryMatch />
    </div>
  );

  return (
    <div style={{ padding: '24px 16px 80px' }}>
      <div style={{ textAlign: 'center', marginBottom: 28 }}>
        <div style={{ fontSize: 56, marginBottom: 8 }}>🕹️</div>
        <h1 style={{ fontSize: 24, fontWeight: 900, margin: '0 0 4px' }}>Family Games</h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)', fontWeight: 600 }}>Pick something to play together</p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12, maxWidth: 480, margin: '0 auto' }}>
        {GAMES.map(g => (
          <button
            key={g.key}
            onClick={() => setActive(g.key)}
            style={{
              display: 'flex', alignItems: 'center', gap: 14, padding: '18px 20px', borderRadius: 18,
              background: 'rgba(255,255,255,0.03)', border: '1.5px solid rgba(255,255,255,0.08)',
              cursor: 'pointer', textAlign: 'left', color: 'var(--text)'
            }}
          >
            <span style={{ fontSize: 32 }}>{g.emoji}</span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>{g.label}</div>
              <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{g.desc}</div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

function BackBar({ onBack, title }: { onBack: () => void; title: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '16px 16px 0' }}>
      <button onClick={onBack} style={{ padding: '8px 14px', borderRadius: 20, fontSize: 12, fontWeight: 700, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)', color: 'var(--text-muted)', cursor: 'pointer' }}>
        ← Games
      </button>
      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)' }}>{title}</span>
    </div>
  );
}