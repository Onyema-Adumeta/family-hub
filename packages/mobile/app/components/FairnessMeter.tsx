import { View, Text } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { api } from '../lib/api';
import { C, ui } from '../lib/theme';

const STATUS = {
  balanced: { label: 'Fair', color: '#4ADE80', note: 'Work is shared evenly.' },
  uneven: { label: 'A bit uneven', color: '#FBBF24', note: 'One kid is carrying more.' },
  unfair: { label: 'Unbalanced', color: '#F87171', note: 'One kid is doing most of the work.' },
} as const;

/** How evenly chore work is shared between the kids (last 14 days). */
export default function FairnessMeter() {
  const { data } = useQuery({ queryKey: ['fairness'], queryFn: () => api.get('/insights/fairness').then(r => r.data) });
  if (!data?.applicable) return null;
  const st = STATUS[data.status as keyof typeof STATUS] || STATUS.balanced;
  return (
    <View style={ui.card} accessibilityLabel={`Fairness ${st.label}, ${data.kids.map((k: any) => `${k.name} ${k.sharePct}%`).join(', ')}`}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={ui.cardTitle}>⚖️ Fairness meter</Text>
        <Text style={{ color: st.color, fontWeight: '900' }}>{st.label} · {data.score}/100</Text>
      </View>
      <Text style={[ui.muted, { marginBottom: 10 }]}>{st.note} Last {data.days} days.</Text>
      <View style={{ flexDirection: 'row', height: 20, borderRadius: 99, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.06)' }}>
        {data.kids.map((k: any) => <View key={k.id} style={{ width: `${k.sharePct}%`, backgroundColor: k.color, minWidth: k.sharePct ? 4 : 0 }} />)}
      </View>
      <View style={{ marginTop: 10, gap: 4 }}>
        {data.kids.map((k: any) => (
          <View key={k.id} style={ui.row}>
            <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: k.color }} />
            <Text style={[ui.text, { fontSize: 13 }]}>{k.emoji} {k.name} <Text style={{ fontWeight: '900' }}>{k.sharePct}%</Text></Text>
            <Text style={ui.muted}>({k.choresDone} done, {k.openChores} to do)</Text>
          </View>
        ))}
      </View>
      {data.suggestions?.length > 0 && (
        <Text style={[ui.text, { fontSize: 13, marginTop: 10, color: C.muted }]}>
          Try making these take turns: {data.suggestions.map((s: any) => `${s.emoji} ${s.title}`).join(', ')}
        </Text>
      )}
    </View>
  );
}
