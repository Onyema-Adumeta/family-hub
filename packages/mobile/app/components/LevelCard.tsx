import { View, Text } from 'react-native';
import { levelFor, BADGE_META } from '../lib/levels';
import { C, ui } from '../lib/theme';

/** Your level (from lifetime stars, so spending never drops it), progress to the next, and badges. */
export default function LevelCard({ member }: { member: any }) {
  if (!member) return null;
  const lifetime = member.lifetimeStars ?? member.stars ?? 0;
  const lvl = levelFor(lifetime);
  const badges: string[] = Array.isArray(member.badges) ? member.badges : [];
  return (
    <View style={ui.card} accessibilityLabel={`Level ${lvl.level}, ${lvl.title}`}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 16 }}>🚀 Level {lvl.level} · {lvl.title}</Text>
        <Text style={{ color: C.gold, fontWeight: '900' }}>{lifetime} ⭐</Text>
      </View>
      <View style={{ height: 10, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 10, overflow: 'hidden' }}
        accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: lvl.pct }}>
        <View style={{ width: `${lvl.pct}%`, height: '100%', borderRadius: 99, backgroundColor: C.pink }} />
      </View>
      <Text style={[ui.muted, { marginTop: 6 }]}>
        {lvl.next ? `${lvl.next - lifetime} more stars to Level ${lvl.level + 1}` : 'Top level — legendary!'}
      </Text>
      {badges.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 }}>
          {badges.map(b => {
            const m = BADGE_META[b] || { icon: '🏅', label: b, color: '#94A3B8' };
            return (
              <View key={b} style={{ flexDirection: 'row', gap: 4, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 99, backgroundColor: m.color + '22', borderWidth: 1, borderColor: m.color + '55' }}>
                <Text style={{ fontSize: 12 }}>{m.icon}</Text>
                <Text style={{ color: m.color, fontWeight: '800', fontSize: 11 }}>{m.label}</Text>
              </View>
            );
          })}
        </View>
      )}
    </View>
  );
}
