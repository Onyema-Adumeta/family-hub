import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, Modal,
  TextInput, StyleSheet, SafeAreaView,
} from 'react-native';
import { useQuests, useCreateQuest, useDeleteQuest, useCompleteQuest, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const QUEST_EMOJIS = ['🗡️','🏆','🧩','🚀','🌟','🦁','🐉','🧙','⚔️','🛡️','🎯','🔮'];
const DIFFICULTIES = [
  { label: 'Easy',   value: 'easy',   stars: 5,  color: '#10b981' },
  { label: 'Medium', value: 'medium', stars: 10, color: '#f59e0b' },
  { label: 'Hard',   value: 'hard',   stars: 20, color: '#ef4444' },
  { label: 'Epic',   value: 'epic',   stars: 50, color: '#8b5cf6' },
];

export default function QuestsScreen() {
  const { member } = useAuthStore();
  const { data: quests = [] } = useQuests();
  const { data: members = [] } = useMembers();
  const createQuest = useCreateQuest();
  const deleteQuest = useDeleteQuest();
  const completeQuest = useCompleteQuest();
  const isParent = member?.role === 'parent';

  const [tab, setTab] = useState<'active'|'done'>('active');
  const [showAdd, setShowAdd] = useState(false);
  const [newQuest, setNewQuest] = useState({ emoji: '🗡️', title: '', description: '', difficulty: 'easy', stars: 5, memberId: '' });

  const filtered = (quests as any[]).filter((q: any) => tab === 'active' ? !q.completedAt : !!q.completedAt);
  const diff = (d: string) => DIFFICULTIES.find(x => x.value === d) || DIFFICULTIES[0];

  const handleCreate = () => {
    if (!newQuest.title.trim()) return;
    createQuest.mutate(newQuest);
    setShowAdd(false);
    setNewQuest({ emoji: '🗡️', title: '', description: '', difficulty: 'easy', stars: 5, memberId: '' });
  };

  return (
    <SafeAreaView style={s.safe}>
      <ScrollView style={s.scroll} contentContainerStyle={s.content}>

        {/* Header */}
        <View style={s.header}>
          <Text style={s.title}>⚔️ Quests</Text>
          {isParent && (
            <TouchableOpacity style={s.addBtn} onPress={() => setShowAdd(true)}>
              <Text style={s.addBtnText}>+ Quest</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Stats */}
        <View style={s.statsRow}>
          {[
            { label: 'Active', value: (quests as any[]).filter((q: any) => !q.completedAt).length, color: '#6366f1' },
            { label: 'Done', value: (quests as any[]).filter((q: any) => !!q.completedAt).length, color: '#10b981' },
            { label: 'Stars', value: (quests as any[]).filter((q: any) => !!q.completedAt).reduce((a: number, q: any) => a + (q.stars || 0), 0), color: '#f59e0b' },
          ].map(stat => (
            <View key={stat.label} style={s.statCard}>
              <Text style={[s.statValue, { color: stat.color }]}>{stat.value}</Text>
              <Text style={s.statLabel}>{stat.label}</Text>
            </View>
          ))}
        </View>

        {/* Tabs */}
        <View style={s.tabRow}>
          {(['active','done'] as const).map(t => (
            <TouchableOpacity key={t} onPress={() => setTab(t)}
              style={[s.tabBtn, tab === t && s.tabBtnActive]}>
              <Text style={[s.tabText, tab === t && s.tabTextActive]}>
                {t === 'active' ? '⚔️ Active' : '✅ Completed'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Quest cards */}
        {filtered.length === 0 ? (
          <View style={s.emptyCard}>
            <Text style={s.emptyText}>
              {tab === 'active' ? '🎉 All done!' : 'No completed quests yet.'}
            </Text>
          </View>
        ) : filtered.map((q: any) => {
          const d = diff(q.difficulty);
          const done = !!q.completedAt;
          return (
            <View key={q.id} style={[s.card, done && { opacity: 0.65 }]}>
              <View style={s.cardTop}>
                <Text style={{ fontSize: 32 }}>{q.emoji}</Text>
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={[s.questTitle, done && { textDecorationLine: 'line-through' }]} numberOfLines={1}>{q.title}</Text>
                  {q.description ? <Text style={s.questDesc} numberOfLines={2}>{q.description}</Text> : null}
                </View>
                {done && <Text style={{ fontSize: 20 }}>✅</Text>}
              </View>
              <View style={s.chips}>
                <View style={[s.chip, { backgroundColor: d.color + '22' }]}>
                  <Text style={[s.chipText, { color: d.color }]}>{d.label}</Text>
                </View>
                <View style={[s.chip, { backgroundColor: 'rgba(245,158,11,0.12)' }]}>
                  <Text style={[s.chipText, { color: '#f59e0b' }]}>⭐ {q.stars}</Text>
                </View>
                {q.member && (
                  <View style={[s.chip, { backgroundColor: 'rgba(255,255,255,0.07)' }]}>
                    <Text style={[s.chipText, { color: 'rgba(240,240,245,0.6)' }]}>{q.member.emoji} {q.member.name}</Text>
                  </View>
                )}
              </View>
              {!done && (
                <View style={s.cardActions}>
                  <TouchableOpacity style={[s.actionBtn, s.actionBtnPrimary]}
                    onPress={() => completeQuest.mutate(q.id)} disabled={completeQuest.isPending}>
                    <Text style={s.actionBtnPrimaryText}>✅ Complete</Text>
                  </TouchableOpacity>
                  {isParent && (
                    <TouchableOpacity style={s.actionBtnIcon} onPress={() => deleteQuest.mutate(q.id)}>
                      <Text style={{ fontSize: 18 }}>🗑</Text>
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          );
        })}
      </ScrollView>

      {/* Add modal */}
      <Modal visible={showAdd} transparent animationType="slide" onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <ScrollView style={s.modal} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
            <Text style={s.modalTitle}>⚔️ New Quest</Text>

            {/* Emoji picker */}
            <View style={s.emojiRow}>
              {QUEST_EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setNewQuest(p => ({ ...p, emoji: e }))}
                  style={[s.emojiBtn, newQuest.emoji === e && s.emojiBtnActive]}>
                  <Text style={{ fontSize: 20 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TextInput style={s.input} placeholder="Quest title" placeholderTextColor="rgba(240,240,245,0.35)"
              value={newQuest.title} onChangeText={t => setNewQuest(p => ({ ...p, title: t }))} autoFocus />
            <TextInput style={[s.input, { minHeight: 60 }]} placeholder="Description (optional)"
              placeholderTextColor="rgba(240,240,245,0.35)" value={newQuest.description}
              onChangeText={t => setNewQuest(p => ({ ...p, description: t }))} multiline />

            <Text style={s.label}>Difficulty</Text>
            <View style={s.diffRow}>
              {DIFFICULTIES.map(d => (
                <TouchableOpacity key={d.value} onPress={() => setNewQuest(p => ({ ...p, difficulty: d.value, stars: d.stars }))}
                  style={[s.diffBtn, { borderColor: newQuest.difficulty === d.value ? d.color : 'rgba(255,255,255,0.08)', backgroundColor: newQuest.difficulty === d.value ? d.color + '22' : 'rgba(255,255,255,0.04)' }]}>
                  <Text style={[s.diffLabel, { color: d.color }]}>{d.label}</Text>
                  <Text style={s.diffStars}>⭐{d.stars}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <View style={s.modalBtns}>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnGhost]} onPress={() => setShowAdd(false)}>
                <Text style={s.modalBtnGhostText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.modalBtn, s.modalBtnPrimary]} onPress={handleCreate} disabled={!newQuest.title.trim()}>
                <Text style={s.modalBtnPrimaryText}>Create Quest</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: '#0f0f13' },
  scroll: { flex: 1 },
  content: { padding: 16, paddingBottom: 40 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5' },
  addBtn: { backgroundColor: '#6366f1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 20 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  statCard: { flex: 1, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 14, alignItems: 'center' },
  statValue: { fontSize: 22, fontWeight: '900' },
  statLabel: { fontSize: 10, fontWeight: '800', color: 'rgba(240,240,245,0.35)', marginTop: 2 },
  tabRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  tabBtn: { flex: 1, paddingVertical: 8, borderRadius: 20, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  tabBtnActive: { backgroundColor: '#6366f1', borderColor: '#6366f1' },
  tabText: { fontSize: 12, fontWeight: '800', color: 'rgba(240,240,245,0.6)' },
  tabTextActive: { color: '#fff' },
  emptyCard: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, padding: 32, alignItems: 'center' },
  emptyText: { color: 'rgba(240,240,245,0.35)', fontWeight: '700' },
  card: { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  cardTop: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 10 },
  questTitle: { fontWeight: '900', fontSize: 15, color: '#f0f0f5' },
  questDesc: { fontSize: 12, color: 'rgba(240,240,245,0.5)', fontWeight: '600', marginTop: 3 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  chip: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 10 },
  chipText: { fontSize: 10, fontWeight: '900' },
  cardActions: { flexDirection: 'row', gap: 8 },
  actionBtn: { flex: 1, paddingVertical: 10, borderRadius: 10, alignItems: 'center' },
  actionBtnPrimary: { backgroundColor: '#6366f1' },
  actionBtnPrimaryText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  actionBtnIcon: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center' },
  // Modal
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  modal: { backgroundColor: '#1a1a24', borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, maxHeight: '92%' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#f0f0f5', marginBottom: 16 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: 'transparent' },
  emojiBtnActive: { borderColor: '#6366f1' },
  input: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 15, fontWeight: '600', marginBottom: 12 },
  label: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.5)', marginBottom: 8 },
  diffRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  diffBtn: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', borderWidth: 2 },
  diffLabel: { fontSize: 12, fontWeight: '900' },
  diffStars: { fontSize: 10, color: '#f59e0b', marginTop: 2, fontWeight: '700' },
  modalBtns: { flexDirection: 'row', gap: 10 },
  modalBtn: { flex: 1, paddingVertical: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnGhost: { backgroundColor: 'rgba(255,255,255,0.07)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  modalBtnGhostText: { color: '#f0f0f5', fontWeight: '800' },
  modalBtnPrimary: { backgroundColor: '#6366f1' },
  modalBtnPrimaryText: { color: '#fff', fontWeight: '800' },
});