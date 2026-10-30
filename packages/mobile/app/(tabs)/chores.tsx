import { useState } from 'react';
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, TextInput, Modal, Alert, RefreshControl } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useUpdateChore, useReviewChore } from '../hooks/useApi';
import ApprovalQueue from '../components/ApprovalQueue';

const CHORE_EMOJIS = ['🧹','🍽️','🛏️','🐶','🌿','🧺','🚿','🗑️','🪣','🧽','📚','🛒'];

export default function ChoresScreen() {
  const { member } = useAuthStore();
  const isParent = member?.role === 'parent';
  const qc = useQueryClient();

  const { data: chores = [], isRefetching, refetch } = useQuery({
    queryKey: ['chores'], queryFn: () => api.get('/chores').then(r => r.data)
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data)
  });

  const updateChore = useUpdateChore();
  const review = useReviewChore();
  const createChore = useMutation({
    mutationFn: (data: any) => api.post('/chores', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chores'] }); qc.invalidateQueries({ queryKey: ['briefing'] }); setShowAdd(false); resetForm(); },
    onError: (e: any) => Alert.alert('Could not add chore', e.response?.data?.error || 'Please try again'),
  });
  const nextTurn = useMutation({
    mutationFn: (id: string) => api.post(`/chores/${id}/rotate`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['chores'] }),
    onError: (e: any) => Alert.alert('Could not change turn', e.response?.data?.error || 'Please try again'),
  });

  const [filter, setFilter] = useState<'pending'|'done'|'all'>('pending');
  const [showAdd, setShowAdd] = useState(false);
  const [proofChoreId, setProofChoreId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const blank = { title: '', emoji: '🧹', assigneeIds: [] as string[], rotate: false, frequency: 'daily', stars: 5, proofRequired: false };
  const [newChore, setNewChore] = useState(blank);

  function resetForm() { setNewChore(blank); }
  function toggleAssignee(id: string) {
    setNewChore(p => {
      const ids = p.assigneeIds.includes(id) ? p.assigneeIds.filter(x => x !== id) : [...p.assigneeIds, id];
      return { ...p, assigneeIds: ids, rotate: ids.length >= 2 ? p.rotate : false };
    });
  }

  const filtered = (chores as any[]).filter(c =>
    filter === 'all' ? true : filter === 'pending' ? c.status !== 'done' : c.status === 'done'
  );

  function handleComplete(chore: any) {
    if (chore.status === 'review') {
      if (isParent) {
        Alert.alert(`Check "${chore.title}"`, 'Approve the photo and send the stars?', [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Approve ✓', onPress: () => review.mutate({ id: chore.id, approve: true }) },
        ]);
      } else {
        Alert.alert('Waiting for a parent', 'A parent will check your photo soon.');
      }
      return;
    }
    // Kids send a photo for chores that need proof; a parent then approves it.
    if (chore.status !== 'done' && chore.proofRequired && !isParent) {
      setProofChoreId(chore.id);
      return;
    }
    updateChore.mutate({ id: chore.id, data: { status: chore.status === 'done' ? 'pending' : 'done' } });
  }

  async function pickProof(useCamera: boolean) {
    const perm = useCamera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { Alert.alert('Permission needed', useCamera ? 'Allow camera access to take a proof photo.' : 'Allow photo access to choose a proof photo.'); return; }
    const result = useCamera
      ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 })
      : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 });

    if (result.canceled || !proofChoreId) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';

    const form = new FormData();
    form.append('file', { uri: asset.uri, name: isVideo ? 'proof.mp4' : 'proof.jpg', type: isVideo ? 'video/mp4' : 'image/jpeg' } as any);
    setUploading(true);
    try {
      const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      updateChore.mutate({ id: proofChoreId, data: { status: 'done', proofUrl: data.url, proofType: data.type } });
      setProofChoreId(null);
    } catch { Alert.alert('Upload failed', 'Try again'); }
    finally { setUploading(false); }
  }

  const kidsAndParents = members as any[];

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>✅ Chores</Text>
        {isParent && (
          <TouchableOpacity style={styles.addBtn} onPress={() => setShowAdd(true)}>
            <Text style={styles.addBtnText}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Filter */}
      <View style={styles.filterRow}>
        {(['pending','done','all'] as const).map(f => (
          <TouchableOpacity key={f} onPress={() => setFilter(f)} style={[styles.filterBtn, filter === f && styles.filterBtnActive]}>
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'pending' ? '⏳ To do' : f === 'done' ? '✅ Done' : '📋 All'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#6366F1" />}>
        <View style={{ marginHorizontal: 16 }}><ApprovalQueue /></View>
        {filtered.length === 0 ? (
          <Text style={styles.empty}>{filter === 'pending' ? '🎉 All caught up!' : 'No chores here.'}</Text>
        ) : filtered.map((chore: any) => {
          const people: any[] = chore.assignees?.length ? chore.assignees : (chore.assignedTo ? [chore.assignedTo] : []);
          const inReview = chore.status === 'review';
          const isDone = chore.status === 'done';
          return (
            <View key={chore.id}>
              <View style={[styles.chore, isDone && styles.choreDone, inReview && styles.choreReview]}>
                <TouchableOpacity onPress={() => handleComplete(chore)} disabled={updateChore.isPending}
                  accessibilityRole="checkbox" accessibilityState={{ checked: isDone }} accessibilityLabel={chore.title}
                  style={[styles.checkbox, isDone && styles.checkboxDone, inReview && styles.checkboxReview]}>
                  {isDone && <Text style={{ color: '#fff', fontSize: 12 }}>✓</Text>}
                  {inReview && <Text style={{ fontSize: 11 }}>⏳</Text>}
                </TouchableOpacity>
                <Text style={{ fontSize: 20 }}>{chore.emoji}</Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.choreTitle, isDone && styles.choreTitleDone]}>{chore.title}</Text>
                  <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
                    {people.map(p => <Text key={p.id} style={styles.choreDetail}>{p.emoji} {p.name}</Text>)}
                    <Text style={styles.choreDetail}>{chore.frequency}</Text>
                    {chore.rotate && <Text style={[styles.choreDetail, { color: '#38BDF8' }]}>🔄 takes turns</Text>}
                    {chore.proofRequired && <Text style={[styles.choreDetail, { color: '#F472B6' }]}>📸 proof</Text>}
                  </View>
                  {inReview && <Text style={[styles.choreDetail, { color: '#FBBF24', marginTop: 2 }]}>Waiting for a parent to check</Text>}
                  {!inReview && !isDone && chore.reviewNote ? <Text style={[styles.choreDetail, { color: '#FB923C', marginTop: 2 }]}>Sent back: {chore.reviewNote}</Text> : null}
                </View>
                <View style={{ alignItems: 'flex-end', gap: 4 }}>
                  <Text style={styles.stars}>⭐{chore.stars}</Text>
                  {isParent && chore.rotate && !isDone && (
                    <TouchableOpacity onPress={() => nextTurn.mutate(chore.id)} disabled={nextTurn.isPending} accessibilityLabel={`Next person's turn for ${chore.title}`}>
                      <Text style={{ color: '#38BDF8', fontSize: 11, fontWeight: '800' }}>Next turn ›</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              {/* Proof request */}
              {proofChoreId === chore.id && (
                <View style={styles.proofBox}>
                  <Text style={styles.proofTitle}>{uploading ? 'Uploading…' : '📸 Add a photo — a parent will check it'}</Text>
                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    <TouchableOpacity style={[styles.proofBtn, { flex: 1 }]} disabled={uploading} onPress={() => pickProof(true)}>
                      <Text style={styles.proofBtnText}>📷 Camera</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[styles.proofBtn, { flex: 1 }]} disabled={uploading} onPress={() => pickProof(false)}>
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

      {/* Add chore modal (parents) */}
      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.modal}>
            <Text style={styles.modalTitle}>➕ New Chore</Text>

            <ScrollView style={{ maxHeight: 460 }}>
              <View style={styles.emojiRow}>
                {CHORE_EMOJIS.map(e => (
                  <TouchableOpacity key={e} onPress={() => setNewChore(p => ({ ...p, emoji: e }))} style={[styles.emojiBtn, newChore.emoji === e && styles.emojiBtnActive]}>
                    <Text style={{ fontSize: 18 }}>{e}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <TextInput style={styles.input} placeholder="Chore name" placeholderTextColor="#666" value={newChore.title} onChangeText={v => setNewChore(p => ({ ...p, title: v }))} />

              <Text style={styles.label}>Who does it?</Text>
              <View style={{ flexDirection: 'row', gap: 6, flexWrap: 'wrap' }}>
                {kidsAndParents.map(m => {
                  const on = newChore.assigneeIds.includes(m.id);
                  return (
                    <TouchableOpacity key={m.id} onPress={() => toggleAssignee(m.id)} style={[styles.chip, on && styles.chipActive]}
                      accessibilityRole="checkbox" accessibilityState={{ checked: on }}>
                      <Text style={[styles.chipText, on && { color: '#fff' }]}>{m.emoji} {m.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              {newChore.assigneeIds.length >= 2 && (
                <TouchableOpacity onPress={() => setNewChore(p => ({ ...p, rotate: !p.rotate }))} style={[styles.proofToggle, newChore.rotate && styles.rotateToggleActive]}
                  accessibilityRole="switch" accessibilityState={{ checked: newChore.rotate }}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: newChore.rotate ? '#38BDF8' : 'rgba(240,240,245,0.5)' }}>
                    🔄 Take turns {newChore.rotate ? '— one person at a time, swapping each week' : '(off: everyone does it)'}
                  </Text>
                </TouchableOpacity>
              )}

              <Text style={styles.label}>Frequency</Text>
              <View style={{ flexDirection: 'row', gap: 4 }}>
                {['daily','weekly','once'].map(f => (
                  <TouchableOpacity key={f} onPress={() => setNewChore(p => ({ ...p, frequency: f }))} style={[styles.chip, newChore.frequency === f && styles.chipActive]}>
                    <Text style={[styles.chipText, newChore.frequency === f && { color: '#fff' }]}>{f}</Text>
                  </TouchableOpacity>
                ))}
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
                  📸 Kids send a photo for you to approve
                </Text>
              </TouchableOpacity>
            </ScrollView>

            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[styles.modalBtn, { backgroundColor: 'rgba(255,255,255,0.08)' }]} onPress={() => { setShowAdd(false); resetForm(); }}>
                <Text style={{ color: '#f0f0f5', fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.modalBtn, styles.modalBtnPrimary, { flex: 2, opacity: !newChore.title.trim() || createChore.isPending ? 0.5 : 1 }]} disabled={!newChore.title.trim() || createChore.isPending}
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
  choreReview: { borderColor: 'rgba(251,191,36,0.4)' },
  checkboxReview: { borderColor: '#FBBF24' },
  rotateToggleActive: { borderColor: 'rgba(56,189,248,0.4)', backgroundColor: 'rgba(56,189,248,0.06)' },
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
