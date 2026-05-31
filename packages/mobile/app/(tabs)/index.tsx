import { ScrollView, View, Text, StyleSheet, TouchableOpacity, RefreshControl } from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { router } from 'expo-router';

export default function HomeScreen() {
  const { member, family, logout } = useAuthStore();

  const { data: chores = [], refetch: refetchChores, isRefetching } = useQuery({
    queryKey: ['chores'], queryFn: () => api.get('/chores').then(r => r.data)
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data)
  });
  const { data: events = [] } = useQuery({
    queryKey: ['events'], queryFn: () => api.get('/events').then(r => r.data)
  });

  const pending  = (chores as any[]).filter(c => !c.done);
  const done     = (chores as any[]).filter(c => c.done);
  const upcoming = (events as any[]).filter(e => new Date(e.date) >= new Date()).slice(0, 3);

  // ── Upcoming birthdays ──────────────────────────────────────────────────────
  const upcomingBirthdays = (members as any[])
    .filter(m => m.birthday)
    .map(m => {
      const bday  = new Date(m.birthday);
      const today = new Date();
      const next  = new Date(today.getFullYear(), bday.getMonth(), bday.getDate());
      if (next < today) next.setFullYear(today.getFullYear() + 1);
      const daysUntil = Math.ceil((next.getTime() - new Date().setHours(0,0,0,0)) / 86400000);
      const age = next.getFullYear() - bday.getFullYear();
      return { ...m, daysUntil, age, nextBirthday: next };
    })
    .sort((a, b) => a.daysUntil - b.daysUntil)
    .slice(0, 4);
  // ───────────────────────────────────────────────────────────────────────────

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetchChores} tintColor="#6366F1" />}>

      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Hey {member?.emoji} {member?.name}!</Text>
          <Text style={styles.subtitle}>{family?.name}</Text>
        </View>
        <View style={styles.starBadge}>
          <Text style={styles.starText}>⭐ {member?.stars}</Text>
        </View>
      </View>

      {/* Stats */}
      <View style={styles.statsRow}>
        <View style={[styles.statCard, { borderColor: 'rgba(245,158,11,0.3)' }]}>
          <Text style={[styles.statValue, { color: '#F59E0B' }]}>⭐ {member?.stars || 0}</Text>
          <Text style={styles.statLabel}>Stars</Text>
        </View>
        <View style={[styles.statCard, { borderColor: 'rgba(74,222,128,0.3)' }]}>
          <Text style={[styles.statValue, { color: '#4ADE80' }]}>✅ {done.length}</Text>
          <Text style={styles.statLabel}>Done</Text>
        </View>
        <View style={[styles.statCard, { borderColor: 'rgba(244,114,182,0.3)' }]}>
          <Text style={[styles.statValue, { color: '#F472B6' }]}>⏳ {pending.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* ── Upcoming Birthdays ── */}
      {upcomingBirthdays.length > 0 && (
        <View style={[styles.card, { borderColor: 'rgba(244,114,182,0.3)', backgroundColor: 'rgba(244,114,182,0.06)' }]}>
          <Text style={styles.cardTitle}>🎂 Upcoming Birthdays</Text>
          {upcomingBirthdays.map(m => {
            const isToday = m.daysUntil === 0;
            const isSoon  = m.daysUntil <= 7 && m.daysUntil > 0;
            const badgeColor = isToday ? '#4ADE80' : isSoon ? '#F472B6' : '#FBBF24';
            const badgeText  = isToday ? '🎉 Today!' : `${m.daysUntil}d`;
            const dateStr = m.nextBirthday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            return (
              <View key={m.id} style={styles.birthdayRow}>
                <View style={[styles.avatar, { backgroundColor: m.color || '#6366F1' }]}>
                  <Text style={{ fontSize: 16 }}>{m.emoji || '🎂'}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.memberName}>{m.name}</Text>
                  <Text style={{ fontSize: 11, color: 'rgba(240,240,245,0.4)', fontWeight: '600' }}>
                    {dateStr}{m.age > 0 ? ` · Turning ${m.age}` : ''}
                  </Text>
                </View>
                <View style={[styles.badge, { borderColor: badgeColor + '66', backgroundColor: badgeColor + '22' }]}>
                  <Text style={{ color: badgeColor, fontWeight: '800', fontSize: 11 }}>{badgeText}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Leaderboard */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🏆 Family Leaderboard</Text>
        {(members as any[]).sort((a, b) => b.stars - a.stars).map((m: any, i: number) => (
          <View key={m.id} style={styles.memberRow}>
            <Text style={styles.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</Text>
            <View style={[styles.avatar, { backgroundColor: m.color }]}><Text style={{ fontSize: 16 }}>{m.emoji}</Text></View>
            <Text style={styles.memberName}>{m.name}</Text>
            <Text style={styles.memberStars}>⭐ {m.stars}</Text>
          </View>
        ))}
      </View>

      {/* Pending chores */}
      {pending.length > 0 && (
        <View style={styles.card}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <Text style={styles.cardTitle}>📋 Today's chores</Text>
            <TouchableOpacity onPress={() => router.push('/chores')}><Text style={{ color: '#6366F1', fontWeight: '800', fontSize: 12 }}>View all →</Text></TouchableOpacity>
          </View>
          {pending.slice(0, 4).map((c: any) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 }}>
              <Text style={{ fontSize: 16 }}>{c.emoji}</Text>
              <Text style={{ flex: 1, color: '#f0f0f5', fontWeight: '700', fontSize: 13 }}>{c.title}</Text>
              <Text style={{ color: '#F59E0B', fontWeight: '800', fontSize: 11 }}>⭐{c.stars}</Text>
            </View>
          ))}
        </View>
      )}

      {/* Upcoming events */}
      {upcoming.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📅 Upcoming</Text>
          {upcoming.map((ev: any) => (
            <View key={ev.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' }}>
              <Text>{ev.emoji}</Text>
              <Text style={{ flex: 1, color: '#f0f0f5', fontWeight: '700', fontSize: 13 }}>{ev.title}</Text>
              <Text style={{ color: 'rgba(240,240,245,0.4)', fontSize: 11, fontWeight: '700' }}>{new Date(ev.date).toLocaleDateString('en', { month: 'short', day: 'numeric' })}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container:   { flex: 1, backgroundColor: '#0f0f13' },
  content:     { padding: 16, paddingBottom: 32 },
  header:      { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  greeting:    { fontSize: 20, fontWeight: '900', color: '#f0f0f5' },
  subtitle:    { fontSize: 12, color: 'rgba(240,240,245,0.4)', fontWeight: '700', marginTop: 2 },
  starBadge:   { backgroundColor: 'rgba(245,158,11,0.15)', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)' },
  starText:    { color: '#F59E0B', fontWeight: '900', fontSize: 14 },
  statsRow:    { flexDirection: 'row', gap: 8, marginBottom: 12 },
  statCard:    { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderRadius: 12, padding: 12, alignItems: 'center' },
  statValue:   { fontSize: 18, fontWeight: '900' },
  statLabel:   { fontSize: 10, color: 'rgba(240,240,245,0.4)', fontWeight: '700', marginTop: 2 },
  card:        { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 12 },
  cardTitle:   { fontSize: 14, fontWeight: '800', color: '#f0f0f5', marginBottom: 10 },
  memberRow:   { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  birthdayRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rank:        { fontSize: 16, minWidth: 28 },
  avatar:      { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberName:  { flex: 1, color: '#f0f0f5', fontWeight: '800', fontSize: 13 },
  memberStars: { color: '#F59E0B', fontWeight: '900', fontSize: 13 },
  badge:       { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 20, borderWidth: 1 },
});