import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Alert, SafeAreaView } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

export default function RewardsScreen() {
  const { member } = useAuthStore();
  const qc = useQueryClient();
  const isParent = member?.role === 'parent';
  const [tab, setTab] = useState<'shop' | 'pending' | 'history'>('shop');

  const { data: rewards = [] }     = useQuery({ queryKey: ['rewards'],     queryFn: () => api.get('/rewards').then(r => r.data) });
  const { data: members = [] }     = useQuery({ queryKey: ['members'],     queryFn: () => api.get('/members').then(r => r.data) });
  const { data: redemptions = [] } = useQuery({ queryKey: ['redemptions'], queryFn: () => api.get('/rewards/redemptions').then(r => r.data) });

  const redeem = useMutation({
    mutationFn: (rewardId: string) => api.post(`/rewards/redeem/${rewardId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['members'] });
      qc.invalidateQueries({ queryKey: ['redemptions'] });
      Alert.alert('🎉 Requested!', 'Waiting for parent approval.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Failed to redeem'),
  });

  const approve = useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.patch(`/rewards/redemptions/${id}`, { approved }).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['redemptions'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      Alert.alert(vars.approved ? '✅ Approved!' : '❌ Rejected', vars.approved ? 'Stars have been deducted.' : 'Redemption rejected.');
    },
    onError: (e: any) => Alert.alert('Error', e.response?.data?.error || 'Failed'),
  });

  const myMember   = (members as any[]).find((m: any) => m.id === member?.id);
  const myStars    = myMember?.stars ?? member?.stars ?? 0;
  const myStreak   = myMember?.streakDays ?? 0;
  const allRedemptions = redemptions as any[];
  const pending    = allRedemptions.filter((r: any) => !r.approved && r.status !== 'rejected');
  const history    = allRedemptions.filter((r: any) => r.approved || r.status === 'rejected');

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        <Text style={s.title}>🏆 Rewards</Text>

        {/* My stats */}
        <View style={s.statsRow}>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#f59e0b' }]}>⭐ {myStars}</Text>
            <Text style={s.statLabel}>Your Stars</Text>
          </View>
          <View style={s.statCard}>
            <Text style={[s.statValue, { color: '#fb923c' }]}>🔥 {myStreak}</Text>
            <Text style={s.statLabel}>Day Streak</Text>
          </View>
        </View>

        {/* Leaderboard */}
        <View style={s.card}>
          <Text style={s.cardTitle}>🏆 Rankings</Text>
          {(members as any[]).sort((a: any, b: any) => b.stars - a.stars).map((m: any, i: number) => (
            <View key={m.id} style={s.memberRow}>
              <Text style={s.rank}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</Text>
              <View style={[s.avatar, { backgroundColor: m.color }]}>
                <Text style={{ fontSize: 15 }}>{m.emoji}</Text>
              </View>
              <Text style={s.memberName}>{m.name}</Text>
              <Text style={s.memberStars}>⭐ {m.stars}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {[
            { key: 'shop',    label: '🛒 Shop' },
            { key: 'pending', label: `⏳ Pending${pending.length > 0 ? ` (${pending.length})` : ''}` },
            { key: 'history', label: '📜 History' },
          ].map(t => (
            <TouchableOpacity key={t.key} onPress={() => setTab(t.key as any)}
              style={[s.tabBtn, tab === t.key && s.tabBtnActive]}>
              <Text style={[s.tabText, tab === t.key && s.tabTextActive]}>{t.label}</Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Shop tab */}
        {tab === 'shop' && (rewards as any[]).map((r: any) => {
          const canAfford = myStars >= r.cost;
          return (
            <View key={r.id} style={[s.rewardCard, !canAfford && { opacity: 0.55 }]}>
              <Text style={{ fontSize: 32, marginBottom: 6 }}>{r.emoji}</Text>
              <Text style={s.rewardName}>{r.name}</Text>
              {r.description && <Text style={s.rewardDesc}>{r.description}</Text>}
              <Text style={s.rewardCost}>⭐ {r.cost}</Text>
              <TouchableOpacity
                style={[s.redeemBtn, !canAfford && s.redeemBtnLocked]}
                disabled={!canAfford || redeem.isPending}
                onPress={() => Alert.alert(`Redeem ${r.name}?`, `Spend ⭐${r.cost} — needs parent approval`, [
                  { text: 'Cancel' },
                  { text: 'Request!', onPress: () => redeem.mutate(r.id) }
                ])}>
                <Text style={s.redeemBtnText}>{canAfford ? '🛒 Request' : `🔒 Need ${r.cost - myStars} more ⭐`}</Text>
              </TouchableOpacity>
            </View>
          );
        })}

        {tab === 'shop' && (rewards as any[]).length === 0 && (
          <Text style={s.emptyText}>No rewards yet. Ask a parent to add some!</Text>
        )}

        {/* Pending tab */}
        {tab === 'pending' && pending.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>✅ No pending redemptions</Text>
          </View>
        )}
        {tab === 'pending' && pending.map((r: any) => {
          const requester = (members as any[]).find((m: any) => m.id === r.memberId);
          return (
            <View key={r.id} style={s.pendingCard}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <Text style={{ fontSize: 28 }}>{r.reward?.emoji || '🎁'}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={s.rewardName}>{r.reward?.name}</Text>
                  <Text style={s.rewardDesc}>{requester?.emoji} {requester?.name} · ⭐{r.reward?.cost}</Text>
                </View>
              </View>
              {isParent ? (
                <View style={{ flexDirection: 'row', gap: 8 }}>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: 'rgba(74,222,128,0.15)', borderWidth: 1.5, borderColor: '#4ADE80' }]}
                    onPress={() => approve.mutate({ id: r.id, approved: true })}>
                    <Text style={{ color: '#4ADE80', fontWeight: '800', fontSize: 13 }}>✅ Approve</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.actionBtn, { backgroundColor: 'rgba(248,113,113,0.15)', borderWidth: 1.5, borderColor: '#F87171' }]}
                    onPress={() => approve.mutate({ id: r.id, approved: false })}>
                    <Text style={{ color: '#F87171', fontWeight: '800', fontSize: 13 }}>❌ Reject</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <Text style={{ textAlign: 'center', color: '#f59e0b', fontWeight: '700', fontSize: 12 }}>
                  ⏳ Waiting for parent approval
                </Text>
              )}
            </View>
          );
        })}

        {/* History tab */}
        {tab === 'history' && history.length === 0 && (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>No history yet</Text>
          </View>
        )}
        {tab === 'history' && history.map((r: any) => {
          const requester = (members as any[]).find((m: any) => m.id === r.memberId);
          return (
            <View key={r.id} style={s.historyCard}>
              <Text style={{ fontSize: 22 }}>{r.reward?.emoji || '🎁'}</Text>
              <View style={{ flex: 1, marginLeft: 10 }}>
                <Text style={s.rewardName}>{r.reward?.name}</Text>
                <Text style={s.rewardDesc}>{requester?.emoji} {requester?.name} · {new Date(r.createdAt).toLocaleDateString()}</Text>
              </View>
              <View style={{ backgroundColor: r.approved ? 'rgba(74,222,128,0.15)' : 'rgba(248,113,113,0.15)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 3 }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: r.approved ? '#4ADE80' : '#F87171' }}>
                  {r.approved ? '✅ Approved' : '❌ Rejected'}
                </Text>
              </View>
            </View>
          );
        })}

      </ScrollView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f13' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5', marginBottom: 14 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 24, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(240,240,245,0.35)', marginTop: 2 },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 14, marginBottom: 14 },
  cardTitle: { fontSize: 14, fontWeight: '800', color: '#f0f0f5', marginBottom: 10 },
  memberRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rank: { fontSize: 16, minWidth: 28 },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  memberName: { flex: 1, color: '#f0f0f5', fontWeight: '800', fontSize: 13 },
  memberStars: { color: '#F59E0B', fontWeight: '900', fontSize: 13 },
  tabRow: { flexDirection: 'row', gap: 6, marginBottom: 14 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  tabBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tabText: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.5)' },
  tabTextActive: { color: '#fff' },
  rewardCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 14, padding: 16, marginBottom: 10, alignItems: 'center' },
  rewardName: { fontSize: 15, fontWeight: '900', color: '#f0f0f5', marginBottom: 4 },
  rewardDesc: { fontSize: 12, color: 'rgba(240,240,245,0.4)', fontWeight: '600', marginBottom: 6, textAlign: 'center' },
  rewardCost: { fontSize: 20, fontWeight: '900', color: '#F59E0B', marginBottom: 10 },
  redeemBtn: { backgroundColor: '#6366F1', paddingHorizontal: 20, paddingVertical: 10, borderRadius: 10 },
  redeemBtnLocked: { backgroundColor: 'rgba(255,255,255,0.06)' },
  redeemBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  pendingCard: { backgroundColor: 'rgba(251,191,36,0.06)', borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.3)', borderRadius: 14, padding: 14, marginBottom: 10 },
  historyCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 12, padding: 12, marginBottom: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyText: { color: 'rgba(240,240,245,0.35)', fontWeight: '700', textAlign: 'center' },
});