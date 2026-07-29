import { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { api } from '../../lib/api';

const EMOJIS = ['🍕','🎈','🚀','🐶','🌵','⚽','🎧','🍩'];

function shuffledDeck() {
  const pairs = [...EMOJIS, ...EMOJIS].map((emoji, i) => ({ id: i, emoji, matched: false }));
  for (let i = pairs.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [pairs[i], pairs[j]] = [pairs[j], pairs[i]];
  }
  return pairs;
}

export default function MemoryScreen() {
  const [deck, setDeck] = useState(shuffledDeck());
  const [flipped, setFlipped] = useState<number[]>([]);
  const [moves, setMoves] = useState(0);
  const [done, setDone] = useState(false);

  const allMatched = deck.every(c => c.matched);

  useEffect(() => {
    if (allMatched && !done) {
      setDone(true);
      const score = Math.max(1000 - moves * 20, 50);
      api.post('/games/score', { gameType: 'memory', score }).catch(() => {});
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
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.moves}>Moves: {moves}</Text>
        <TouchableOpacity onPress={reset} style={styles.resetBtn}>
          <Text style={styles.resetText}>Restart</Text>
        </TouchableOpacity>
      </View>
      {done && <Text style={styles.win}>🎉 Solved in {moves} moves!</Text>}
      <View style={styles.grid}>
        {deck.map(card => {
          const isFlipped = flipped.includes(card.id) || card.matched;
          return (
            <TouchableOpacity
              key={card.id}
              onPress={() => handleFlip(card.id)}
              style={[styles.card, card.matched && styles.matched, isFlipped && styles.flipped]}
            >
              <Text style={styles.emoji}>{isFlipped ? card.emoji : ''}</Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13', padding: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 },
  moves: { color: '#fff', fontWeight: '700' },
  resetBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.08)' },
  resetText: { color: '#fff', fontWeight: '700' },
  win: { color: '#fff', fontWeight: '800', textAlign: 'center', marginBottom: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  card: { width: '22%', aspectRatio: 1, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  flipped: { backgroundColor: 'rgba(255,255,255,0.12)' },
  matched: { backgroundColor: 'rgba(99,102,241,0.25)' },
  emoji: { fontSize: 26 },
});