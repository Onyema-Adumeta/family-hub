import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒'];

export default function ChoresScreen() {
  const { member } = useAuthStore();
  const qc = useQueryClient();

  const { data: chores = [], isRefetching, refetch } = useQuery({
    queryKey: ['chores'], queryFn: () => api.get('/chores').then(r => r.data)
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data)
  });

  const updateChore = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/chores/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chores', 'members'] })
  });
  const createChore = useMutation({
    mutationFn: (data: any) => api.post('/chores', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chores'] }); setShowAdd(false); resetForm(); }
  });

  const [filter, setFilter] = useState<'pending'|'done'|'all'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [proofChoreId, setProofChoreId] = useState<string | null>(null);
  const [newChore, setNewChore] = useState({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false });

  function resetForm() { setNewChore({ title: '', emoji: '🧹', assignedToId: '', frequency: 'daily', stars: 5, proofRequired: false }); }

  const filtered = (chores as any[]).filter(c =>
    filter === 'all' ? true : filter === 'pending' ? !c.done : c.done
  );

  async function handleComplete(chore: any) {
    if (chore.proofRequired && !chore.proofUrl) {
      setProofChoreId(chore.id);
      return;
    }
    updateChore.mutate({ id: chore.id, data: { done: !chore.done } });
  }

  async function pickProof(useCamera: boolean) {
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 });

    if (result.canceled || !proofChoreId) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';

    // Upload the file
    const form = new FormData();
    form.append('file', { uri: asset.uri, name: isVideo ? 'proof.mp4' : 'proof.jpg', type: isVideo ? 'video/mp4' : 'image/jpeg' } as any);
    try {
      const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateChore.mutate({ id: proofChoreId, data: { done: true, proofUrl: data.url, proofType: data.type } });
      setProofChoreId(null);
    } catch { Alert.alert('Upload failed', 'Try again'); }
  }

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>✅ Chores</Text>
        <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {(['pending','done','all'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'pending' ? '⏳ Pending' : f === 'done' ? '✅ Done' : '📋 All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{filter === 'pending' ? '🎉 All caught up!' : 'No chores here.'}</Text>
        ) : filtered.map((chore: any) => {
          const assignee = (members as any[]).find(m => m.id === chore.assignedToId);
          return (
            <View key={chore.id}>
              <View style={[styles.chore, chore.done && styles.choreDone]}>
                <TouchableOpacity onPress={() => handleComplete(chore)} style={[styles.checkbox, chore.done && styles.checkboxDone]}>
                  {chore.done && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                </TouchableOpacity>
                <Text style={{ fontSize: 20 }}>{chore.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.choreTitle, chore.done && styles.choreTitleDone]}>{chore.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {assignee && <Text style={styles.choreDetail}>{assignee.emoji} {assignee.name}</Text>}
                    <Text style={styles.choreDetail}>{chore.frequency}</Text>
                    {chore.proofRequired && <Text style={[styles.choreDetail, { color: '#F472B6' }]}>📸 proof</Text>}
                  </View>
                </View>
                <Text style={styles.stars}>⭐{chore.stars}</Text>
              </View>

              {/* Proof request */}
              {proofChoreId === chore.id && (
                <View style={styles.proofBox}>
                  <Text style={styles.proofTitle}>📸 Submit proof to mark done</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.proofBtn, { flex: 1 }]} onPress={() => pickProof(true)}>
                      <Text style={styles.proofBtnText}>📷 Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.proofBtn, { flex: 1 }]} onPress={() => pickProof(false)}>
                      <Text style={styles.proofBtnText}>🖼 Gallery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={styles.proofBtn} onPress={() => setProofChoreId(null)}>
                      <Text style={styles.proofBtnText}>✕</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          );
        })}
        <View style={{ height: 32 }} />
      </ScrollView>

      {/* Add chore modal */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>➕ New Chore</Text>

            <ScrollView style={{ maxHeight: 420 }}>
              <View style={styles.emojiRow}>
                {CHORE_EMOJIS.map(e => (
                  <TouchableOpacity key={e} onPress={() => setNewChore(p => ({ ...p, emoji: e }))} style={[styles.emojiBtn, newChore.emoji === e && styles.emojiBtnActive]}>
                    <Text style={{ fontSize: 18 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="Chore name" placeholderTextColor="#666" value={newChore.title} onChangeText={v => setNewChore(p => ({ ...p, title: v }))} />

              <View style={{ flexDirection: 'row', gap: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.label}>Frequency</Text>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    {['daily','weekly','once'].map(f => (
                      <TouchableOpacity key={f} onPress={() => setNewChore(p => ({ ...p, frequency: f }))} style={[styles.chip, newChore.frequency === f && styles.chipActive]}>
                        <Text style={[styles.chipText, newChore.frequency === f && { color: '#fff' }]}>{f}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              </View>

              <Text style={styles.label}>⭐ Stars: {newChore.stars}</Text>
              <View style={{ flexDirection: 'row', gap: 6 }}>
                {[1,3,5,10,15,20].map(v => (
                  <TouchableOpacity key={v} onPress={() => setNewChore(p => ({ ...p, stars: v }))} style={[styles.chip, newChore.stars === v && styles.chipActive]}>
                    <Text style={[styles.chipText, newChore.stars === v && { color: '#fff' }]}>{v}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TouchableOpacity onPress={() => setNewChore(p => ({ ...p, proofRequired: !p.proofRequired }))} style={[styles.proofToggle, newChore.proofRequired && styles.proofToggleActive]}>
                <Text style={{ fontSize: 13, fontWeight: '800', color: newChore.proofRequired ? '#F472B6' : 'rgba(240,240,245,0.5)' }}>
                  📸 Require photo/video proof
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]} onPress={() => { setShowAdd(false); resetForm(); }}>
                <Text style={{ color: '#f0f0f5', fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, { flex: 2 }]} disabled={!newChore.title.trim() || createChore.isPending}
                onPress={() => createChore.mutate(newChore)}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>{createChore.isPending ? 'Adding...' : '+ Add Chore'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: 16, paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5' },
  addBtn: { backgroundColor: '#6366F1', paddingHorizontal: 14, paddingVertical: 8, borderRadius: 8 },
  addBtnText: { color: '#fff', fontWeight: '800', fontSize: 13 },
  filterRow: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  filterBtn: { flex: 1, paddingVertical: 7, borderRadius: 8, alignItems: 'center' },
  filterBtnActive: { backgroundColor: '#6366F1' },
  filterText: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.5)' },
  filterTextActive: { color: '#fff' },
  chore: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 16, marginBottom: 8, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  choreDone: { opacity: 0.55 },
  checkbox: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  checkboxDone: { backgroundColor: '#4ADE80', borderColor: '#4ADE80' },
  choreTitle: { color: '#f0f0f5', fontWeight: '800', fontSize: 14 },
  choreTitleDone: { textDecorationLine: 'line-through', color: 'rgba(240,240,245,0.4)' },
  choreDetail: { fontSize: 11, color: 'rgba(240,240,245,0.4)', fontWeight: '700' },
  stars: { color: '#F59E0B', fontWeight: '900', fontSize: 12 },
  proofBox: { marginHorizontal: 16, marginTop: -4, marginBottom: 8, padding: 12, backgroundColor: 'rgba(244,114,182,0.06)', borderRadius: 12, borderWidth: 1.5, borderColor: 'rgba(244,114,182,0.2)' },
  proofTitle: { color: '#F472B6', fontWeight: '800', fontSize: 13, marginBottom: 8 },
  proofBtn: { padding: 8, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 8, alignItems: 'center' },
  proofBtnText: { color: '#f0f0f5', fontWeight: '800', fontSize: 12 },
  empty: { textAlign: 'center', padding: 40, color: 'rgba(240,240,245,0.3)', fontWeight: '700', fontSize: 14 },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modal: { backgroundColor: '#1a1a24', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#f0f0f5', marginBottom: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 14, fontWeight: '600', marginBottom: 10 },
  label: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.5)', marginBottom: 6, marginTop: 6 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  emojiBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { borderColor: '#6366F1' },
  chip: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 11, fontWeight: '800', color: 'rgba(240,240,245,0.5)' },
  proofToggle: { padding: 12, borderRadius: 10, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', marginTop: 8 },
  proofToggleActive: { borderColor: 'rgba(244,114,182,0.4)', backgroundColor: 'rgba(244,114,182,0.06)' },
  modalBtn: { flex: 1, padding: 13, borderRadius: 10, alignItems: 'center' },
  modalBtnPrimary: { backgroundColor: '#6366F1' },
});
