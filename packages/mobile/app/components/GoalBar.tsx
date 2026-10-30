import { View, Text, TouchableOpacity, Alert } from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import { useFamilyGoal } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { ask } from '../store/prompt';
import { C, ui } from '../lib/theme';

/** The family's shared star goal. Every star from every chore counts. Parents can start one. */
export default function GoalBar() {
  const { data } = useFamilyGoal();
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const qc = useQueryClient();
  const goal = data?.active;

  async function startGoal() {
    const title = await ask({ title: '🎯 New family goal', message: 'What are you all working towards?', placeholder: 'Movie night' });
    if (!title?.trim()) return;
    const reward = await ask({ title: 'Reward (optional)', placeholder: 'Pizza and a movie', okLabel: 'Next' });
    if (reward === null) return;
    const target = await ask({ title: 'Stars needed', message: 'Stars from everyone add up.', defaultValue: '200', numeric: true, okLabel: 'Start goal' });
    if (!target) return;
    try {
      await api.post('/goals', { title: title.trim(), reward: reward.trim() || undefined, targetStars: Number(target), emoji: '🎯' });
      qc.invalidateQueries({ queryKey: ['goal'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
    } catch (e: any) { Alert.alert('Could not save goal', e.response?.data?.error || 'Please try again'); }
  }

  if (!goal && !isParent) return null;
  if (!goal) {
    return (
      <View style={ui.card}>
        <Text style={ui.cardTitle}>🎯 Family goal</Text>
        <Text style={ui.muted}>Pick something to earn together — every star from every chore counts toward it.</Text>
        <TouchableOpacity style={[ui.btn, { marginTop: 10 }]} onPress={startGoal}><Text style={ui.btnText}>Set a goal</Text></TouchableOpacity>
      </View>
    );
  }
  return (
    <View style={ui.card} accessibilityLabel={`Family goal ${goal.title}, ${goal.progress} of ${goal.targetStars} stars`}>
      <View style={[ui.row, { justifyContent: 'space-between' }]}>
        <Text style={{ color: C.text, fontWeight: '900', fontSize: 15, flex: 1 }}>{goal.emoji} {goal.title}</Text>
        <Text style={{ color: '#FBBF24', fontWeight: '900' }}>{goal.progress} / {goal.targetStars} ⭐</Text>
      </View>
      <View style={{ height: 12, borderRadius: 99, backgroundColor: 'rgba(255,255,255,0.08)', marginTop: 10, overflow: 'hidden' }}>
        <View style={{ width: `${goal.pct}%`, height: '100%', borderRadius: 99, backgroundColor: C.gold }} />
      </View>
      <Text style={[ui.muted, { marginTop: 6 }]}>
        {goal.reachedAt ? `🎉 Reached together!${goal.reward ? ` ${goal.reward}` : ''}` : `${goal.remaining} stars to go${goal.reward ? ` — then: ${goal.reward}` : ''}`}
      </Text>
      {isParent && (
        <TouchableOpacity onPress={startGoal} style={{ marginTop: 8 }}>
          <Text style={{ color: C.primary, fontWeight: '800', fontSize: 12 }}>{goal.reachedAt ? 'Start a new goal' : 'Change goal'}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}
