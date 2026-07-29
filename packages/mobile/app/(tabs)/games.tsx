import { View, Text, TouchableOpacity, StyleSheet, SafeAreaView } from 'react-native';
import { useRouter } from 'expo-router';

const GAMES = [
  { key: 'trivia', label: 'Family Trivia', emoji: '🎮', desc: '10 AI questions · live leaderboard' },
  { key: 'memory', label: 'Memory Match', emoji: '🧠', desc: 'Pass-and-play · fewest moves wins' },
];

export default function GamesScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.emoji}>🕹️</Text>
        <Text style={styles.title}>Family Games</Text>
        <Text style={styles.subtitle}>Pick something to play together</Text>
      </View>
      <View style={styles.list}>
        {GAMES.map(g => (
          <TouchableOpacity
            key={g.key}
            style={styles.card}
            onPress={() => router.push(`/${g.key}`)}
          >
            <Text style={styles.cardEmoji}>{g.emoji}</Text>
            <View style={{ flex: 1 }}>
              <Text style={styles.cardLabel}>{g.label}</Text>
              <Text style={styles.cardDesc}>{g.desc}</Text>
            </View>
          </TouchableOpacity>
        ))}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  header: { alignItems: 'center', paddingTop: 24, paddingBottom: 20 },
  emoji: { fontSize: 48, marginBottom: 8 },
  title: { fontSize: 22, fontWeight: '900', color: '#fff' },
  subtitle: { fontSize: 12, fontWeight: '600', color: 'rgba(240,240,245,0.5)', marginTop: 2 },
  list: { paddingHorizontal: 16, gap: 12 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 14, padding: 18, borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)',
  },
  cardEmoji: { fontSize: 32 },
  cardLabel: { fontSize: 15, fontWeight: '800', color: '#fff' },
  cardDesc: { fontSize: 12, color: 'rgba(240,240,245,0.5)', marginTop: 2 },
});