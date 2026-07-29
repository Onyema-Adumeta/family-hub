import { useState, useEffect } from 'react';
import { api } from '../lib/api';

const EMOJIS = ['🍕','🎈','🚀','🐶','🌵','⚽','🎧','🍩'];

function shuffledDeck() {
  const pairs = [...EMOJIS, ...EMOJIS].map((emoji, i) => ({ id: i, emoji, matched: false }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export default function MemoryMatch() {
  const [deck, setDeck] = useState(shuffledDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);
  const [saving, setSaving] = useState(false);

  const allMatched = deck.every(c => c.matched);

  useEffect(() => {
    if (allMatched && !done) {
      setDone(true);
      const score = Math.max(1000 - moves * 20, 50);
      setSaving(true);
      api.post('/games/score', { gameType: 'memory', score })
        .catch(e => console.error('score save failed', e))
        .finally(() => setSaving(false));
    }
  }, [allMatched]);

  function handleFlip(id: number) {
    if (flipped.length === 2 || flipped.includes(id) || deck[id].matched) return;
    const next = [...flipped, id];
    setFlipped(next);
    if (next.length === 2) {
      setMoves(m => m + 1);
      const [a, b] = next;
      if (deck[a].emoji === deck[b].emoji) {
        setTimeout(() => {
          setDeck(d => d.map(c => (c.id === a || c.id === b ? { ...c, matched: true } : c)));
          setFlipped([]);
        }, 400);
      } else {
        setTimeout(() => setFlipped([]), 800);
      }
    }
  }

  function reset() {
    setDeck(shuffledDeck());
    setFlipped([]);
    setMoves(0);
    setDone(false);
  }

  return (
    <div style={{ padding: '16px', maxWidth: 480, margin: '0 auto' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontWeight: 700 }}>Moves: {moves}</span>
        <button onClick={reset} style={{ padding: '6px 14px', borderRadius: 12, fontWeight: 700, background: 'rgba(255,255,255,0.08)', border: 'none', color: 'inherit', cursor: 'pointer' }}>
          Restart
        </button>
      </div>

      {done && (
        <div style={{ textAlign: 'center', marginBottom: 16, fontWeight: 800 }}>
          🎉 Solved in {moves} moves! {saving ? 'Saving...' : 'Score saved.'}
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10 }}>
        {deck.map(card => {
          const isFlipped = flipped.includes(card.id) || card.matched;
          return (
            <button
              key={card.id}
              onClick={() => handleFlip(card.id)}
              style={{
                aspectRatio: '1', borderRadius: 14, fontSize: 26, border: 'none', cursor: 'pointer',
                background: card.matched ? 'rgba(99,102,241,0.25)' : isFlipped ? 'rgba(255,255,255,0.12)' : 'rgba(255,255,255,0.04)',
                transition: 'background 0.2s',
              }}
            >
              {isFlipped ? card.emoji : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}