import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function RewardsScreen() {
  const { member } = useAuthStore();
  const qc = useQueryClient();

  const { data: rewards = [] } = useQuery({ queryKey: ['rewards'], queryFn: () => api.get('/rewards').then(r => r.data) });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data) });

  const redeem = useMutation({
    mutationFn: (rewardId: string) => api.post(`/rewards/redeem/${rewardId}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['members'] }); Alert.alert('🎉 Redeemed!', 'Ask a parent to approve it.'); }
  });

  return (
    <ScrollView style={s.container} contentContainerStyle={{ padding: 16, paddingBottom: 32 }}>
      <Text style={s.title}>⭐ Rewards</Text>

      {/* My stars */}
      <View style={s.starCard}>
        <Text style={s.starValue}>⭐ {member?.stars || 0}</Text>
        <Text style={s.starLabel}>Your stars</Text>
      </View>

      {/* Leaderboard */}
      <View style={s.card}>
        <Text style={s.cardTitle}>🏆 Rankings</Text>
        {(members as any[]).sort((a, b) => b.stars - a.stars).map((m: any, i: number) => (
          <View key={m.id} style={s.memberRow}>
            <Text style={s.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</Text>
            <View style={[s.avatar, { backgroundColor: m.color }]}><Text style={{ fontSize: 15 }}>{m.emoji}</Text></View>
            <Text style={s.memberName}>{m.name}</Text>
            <Text style={s.memberStars}>⭐ {m.stars}</Text>
          </View>
        ))}
      </View>

      {/* Shop */}
      <Text style={s.sectionTitle}>🛒 Shop</Text>
      {(rewards as any[]).map((r: any) => {
        const canAfford = (member?.stars || 0) >= r.cost;
        return (
          <View key={r.id} style={[s.rewardCard, !canAfford && s.rewardCardLocked]}>
            <Text style={{ fontSize: 32, marginBottom: 6 }}>{r.emoji}</Text>
            <Text style={s.rewardName}>{r.name}</Text>
            {r.description && <Text style={s.rewardDesc}>{r.description}</Text>}
            <Text style={s.rewardCost}>⭐ {r.cost}</Text>
            <TouchableOpacity
              style={[s.redeemBtn, !canAfford && s.redeemBtnLocked]}
              disabled={!canAfford || redeem.isPending}
              onPress={() => Alert.alert(`Redeem ${r.name}?`, `Spend ⭐${r.cost}`, [
                { text: 'Cancel' },
                { text: 'Redeem', onPress: () => redeem.mutate(r.id) }
              ])}
            >
              <Text style={s.redeemBtnText}>{canAfford ? '🛒 Redeem' : '🔒 Need more'}</Text>
            </TouchableOpacity>
          </View>
        );
      })}

      {(rewards as any[]).length === 0 && (
        <Text style={{ textAlign: 'center', color: 'rgba(240,240,245,0.3)', fontWeight: '700', fontSize: 13, padding: 24 }}>
          No rewards yet. Ask a parent to add some!
        </Text>
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5', marginTop: 40, marginBottom: 14 },
  starCard: { backgroundColor: 'rgba(245,158,11,0.08)', borderWidth: 1.5, borderColor: 'rgba(245,158,11,0.3)', borderRadius: 14, padding: 20, alignItems: 'center', marginBottom: 14 },
  starValue: { fontSize: 36, fontWeight: '900', color: '#F59E0B' },
  starLabel: { fontSize: 12, color: 'rgba(240,240,245,0.4)', fontWeight: '700', marginTop: 4 },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#f0f0f5', marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rank: { fontSize: 16, minWidth: 28 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1, color: '#f0f0f5', fontWeight: '800', fontSize: 13 },
  memberStars: { color: '#F59E0B', fontWeight: '900', fontSize: 13 },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: 'rgba(240,240,245,0.5)', marginBottom: 10, letterSpacing: 0.5 },
  rewardCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 10, alignItems: 'center' },
  rewardCardLocked: { opacity: 0.55 },
  rewardName: { fontSize: 15, fontWeight: '900', color: '#f0f0f5', marginBottom: 4 },
  rewardDesc: { fontSize: 12, color: 'rgba(240,240,245,0.4)', fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  rewardCost: { fontSize: 20, fontWeight: '900', color: '#F59E0B', marginBottom: 10 },
  redeemBtn: { backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  redeemBtnLocked: { backgroundColor: 'rgba(255,255,255,0.06)' },
  redeemBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
});
