import { useEffect, useRef, useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, ActivityIndicator, Animated, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useWins } from '../hooks/useApi';
import FairnessMeter from '../components/FairnessMeter';
import Recommendations from '../components/Recommendations';
import { C, ui } from '../lib/theme';

function shift(day: string, weeks: number) {
  const [y, m, d] = day.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + weeks * 7)).toISOString().slice(0, 10);
}
function label(start: string, end: string) {
  const f = (s: string) => new Date(s + 'T12:00:00').toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${f(start)} – ${f(end)}`;
}

function Award({ a, index }: { a: any; index: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => { Animated.timing(v, { toValue: 1, duration: 450, delay: index * 500, useNativeDriver: true }).start(); }, []);
  return (
    <Animated.View style={[ui.card, { alignItems: 'center', borderColor: 'rgba(251,191,36,0.3)', opacity: v, transform: [{ translateY: v.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }]}>
      <Text style={{ fontSize: 40 }}>{a.icon}</Text>
      <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 11, letterSpacing: 1 }}>{String(a.title).toUpperCase()}</Text>
      <Text style={{ color: C.text, fontWeight: '900', fontSize: 22, marginVertical: 2 }}>{a.name}</Text>
      <Text style={ui.muted}>{a.detail}</Text>
    </Animated.View>
  );
}

/** Weekly Wins: the week's report, told as a celebration. */
export default function WinsScreen() {
  const [week, setWeek] = useState<string | undefined>(undefined);
  const { data, isLoading, isError, refetch, isRefetching } = useWins(week);

  if (isLoading) return <View style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator color={C.primary} /></View>;
  if (isError || !data) return <View style={[ui.screen, ui.content]}><Text style={ui.text}>Weekly Wins could not load. Pull down to try again.</Text></View>;
  const people = [...(data.members as any[])].filter(m => m.stars > 0 || m.role === 'child').sort((a, b) => b.stars - a.stars);

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />}>
      <TouchableOpacity onPress={() => router.back()}><Text style={ui.back}>‹ Back</Text></TouchableOpacity>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <TouchableOpacity style={ui.ghost} onPress={() => setWeek(shift(data.weekStart, -1))} accessibilityLabel="Previous week"><Text style={ui.ghostText}>←</Text></TouchableOpacity>
        <View style={{ alignItems: 'center' }}>
          <Text style={{ color: '#FBBF24', fontWeight: '900', fontSize: 12, letterSpacing: 2 }}>WEEKLY WINS</Text>
          <Text style={ui.muted}>{label(data.weekStart, data.weekEnd)}{data.isCurrentWeek ? ' · so far' : ''}</Text>
        </View>
        <TouchableOpacity style={[ui.ghost, { opacity: data.isCurrentWeek ? 0.3 : 1 }]} disabled={data.isCurrentWeek} onPress={() => setWeek(shift(data.weekStart, 1))} accessibilityLabel="Next week"><Text style={ui.ghostText}>→</Text></TouchableOpacity>
      </View>

      <View style={{ alignItems: 'center', marginVertical: 22 }}>
        <Text style={{ fontSize: 60 }}>🏆</Text>
        <Text style={{ fontSize: 48, fontWeight: '900', color: C.gold }}>{data.family.stars} ⭐</Text>
        <Text style={[ui.text, { fontWeight: '800' }]}>earned together · {data.family.chores} chores done</Text>
        {data.family.changePct !== null && (
          <Text style={{ marginTop: 6, fontWeight: '800', color: data.family.changePct >= 0 ? C.green : C.gold }}>
            {data.family.changePct >= 0 ? '▲' : '▼'} {Math.abs(data.family.changePct)}% vs last week
          </Text>
        )}
      </View>

      {(data.awards as any[]).map((a, i) => <Award key={`${data.weekStart}-${a.title}`} a={a} index={i} />)}
      {!data.awards.length && <Text style={[ui.muted, { textAlign: 'center', marginBottom: 12 }]}>No awards yet this week — the first chore wins one!</Text>}

      <View style={ui.card}>
        {people.map((m, i) => (
          <View key={m.id} style={[ui.row, { paddingVertical: 8, borderTopWidth: i ? 1 : 0, borderTopColor: C.border }]}>
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: m.color || C.primary, alignItems: 'center', justifyContent: 'center' }}><Text style={{ fontSize: 18 }}>{m.emoji}</Text></View>
            <View style={{ flex: 1 }}>
              <Text style={[ui.text, { fontWeight: '800' }]}>{m.name}</Text>
              <Text style={ui.muted}>Level {m.level} · {m.levelTitle}{m.streakDays > 1 ? ` · 🔥 ${m.streakDays}` : ''}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={{ color: '#FBBF24', fontWeight: '900' }}>{m.stars} ⭐</Text>
              <Text style={ui.muted}>{m.chores} chore{m.chores === 1 ? '' : 's'}</Text>
            </View>
          </View>
        ))}
      </View>

      <FairnessMeter />

      <View style={[ui.card, { backgroundColor: 'rgba(74,222,128,0.06)' }]}>
        <Text style={ui.cardTitle}>✨ Highlights</Text>
        {(data.highlights as string[]).map(h => <Text key={h} style={[ui.text, { lineHeight: 22 }]}>• {h}</Text>)}
      </View>
      <Recommendations limit={3} title="💡 Next week, try…" />
    </ScrollView>
  );
}
