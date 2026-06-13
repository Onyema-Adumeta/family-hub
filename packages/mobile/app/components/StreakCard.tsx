import { View, Text, StyleSheet } from 'react-native';
import { useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

export default function StreakCard() {
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();

  const me = (members as any[]).find((m: any) => m.id === member?.id) || member;
  const myStreak = me?.streakDays || 0;
  const active = myStreak > 0;

  const ranked = [...(members as any[])]
    .filter((m: any) => typeof m.streakDays === 'number')
    .sort((a: any, b: any) => (b.streakDays || 0) - (a.streakDays || 0));

  return (
    <View style={s.card}>
      {/* My streak header */}
      <View style={[s.header, active ? s.headerActive : s.headerIdle]}>
        <Text style={[s.bigFlame, !active && s.dim]}>🔥</Text>
        <View>
          <Text style={[s.bigNum, { color: active ? '#F97316' : 'rgba(240,240,245,0.4)' }]}>{myStreak}</Text>
          <Text style={s.subLabel}>
            day streak{active ? ' — keep it going!' : ' — complete a chore on time'}
          </Text>
        </View>
      </View>

      {/* Family leaderboard */}
      <View style={{ paddingVertical: 6 }}>
        <Text style={s.sectionLabel}>🏆 FAMILY STREAKS</Text>
        {ranked.length === 0 ? (
          <Text style={s.empty}>No streaks yet</Text>
        ) : ranked.map((m: any, i: number) => {
          const isMe = m.id === me?.id;
          const lit = (m.streakDays || 0) > 0;
          return (
            <View key={m.id} style={[s.row, isMe && s.rowMe]}>
              <Text style={[s.rank, { color: i === 0 && lit ? '#F97316' : 'rgba(240,240,245,0.4)' }]}>{i + 1}</Text>
              <Text style={s.emoji}>{m.emoji}</Text>
              <Text style={[s.name, { color: isMe ? '#A78BFA' : '#f0f0f5' }]} numberOfLines={1}>
                {m.name}{isMe ? ' (you)' : ''}
              </Text>
              <View style={s.streakVal}>
                <Text style={[s.smallFlame, !lit && s.dim]}>🔥</Text>
                <Text style={[s.streakNum, { color: lit ? '#F97316' : 'rgba(240,240,245,0.4)' }]}>{m.streakDays || 0}</Text>
              </View>
            </View>
          );
        })}
      </View>
    </View>
  );
}

const s = StyleSheet.create({
  card: { borderRadius: 20, overflow: 'hidden', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 16, padding: 18, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  headerActive: { backgroundColor: 'rgba(249,115,22,0.12)' },
  headerIdle: { backgroundColor: 'rgba(255,255,255,0.04)' },
  bigFlame: { fontSize: 40 },
  bigNum: { fontSize: 30, fontWeight: '900', lineHeight: 32 },
  subLabel: { fontSize: 12, fontWeight: '700', color: 'rgba(240,240,245,0.5)', marginTop: 4 },
  dim: { opacity: 0.35 },
  sectionLabel: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, fontSize: 11, fontWeight: '900', letterSpacing: 0.6, color: 'rgba(240,240,245,0.5)' },
  empty: { paddingHorizontal: 20, paddingVertical: 12, fontSize: 13, color: 'rgba(240,240,245,0.5)' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 20, paddingVertical: 9 },
  rowMe: { backgroundColor: 'rgba(99,102,241,0.08)' },
  rank: { width: 20, fontSize: 12, fontWeight: '900', textAlign: 'center' },
  emoji: { fontSize: 20 },
  name: { flex: 1, fontSize: 14, fontWeight: '700' },
  streakVal: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  smallFlame: { fontSize: 14 },
  streakNum: { fontSize: 14, fontWeight: '900' },
});