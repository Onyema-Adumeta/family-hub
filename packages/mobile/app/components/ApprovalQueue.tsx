import { View, Text, TouchableOpacity, Image, Linking } from 'react-native';
import { useApprovals, useReviewChore } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { ask } from '../store/prompt';
import { C, ui } from '../lib/theme';
import { mediaSrc } from '../lib/api';

/** Parents: chore photos waiting for a one-tap approve. */
export default function ApprovalQueue() {
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const { data = [] } = useApprovals(isParent);
  const review = useReviewChore();
  const list = data as any[];
  if (!isParent || !list.length) return null;

  async function sendBack(c: any) {
    const note = await ask({ title: `Send back "${c.title}"?`, message: 'What needs fixing? (optional)', placeholder: 'Please make the bed too', okLabel: 'Send back' });
    if (note === null) return;
    review.mutate({ id: c.id, approve: false, note: note.trim() || undefined });
  }

  return (
    <View style={[ui.card, { borderColor: 'rgba(251,191,36,0.35)' }]} accessibilityLabel="Chores to check">
      <Text style={ui.cardTitle}>📸 Chores to check ({list.length})</Text>
      {list.map(c => {
        const photo = c.photoUrl || c.proofUrl;
        const isImage = !!photo && c.proofType !== 'video';
        return (
          <View key={c.id} style={{ borderTopWidth: 1, borderTopColor: C.border, paddingVertical: 10 }}>
            <View style={ui.row}>
              <TouchableOpacity disabled={!photo} onPress={() => photo && Linking.openURL(mediaSrc(photo))} accessibilityLabel={`Open proof for ${c.title}`}>
                {isImage
                  ? <Image source={{ uri: mediaSrc(photo) }} style={{ width: 64, height: 64, borderRadius: 10 }} />
                  : <View style={{ width: 64, height: 64, borderRadius: 10, backgroundColor: 'rgba(255,255,255,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ fontSize: 26 }}>{photo ? '🎬' : c.emoji}</Text>
                    </View>}
              </TouchableOpacity>
              <View style={{ flex: 1 }}>
                <Text style={[ui.text, { fontWeight: '800' }]}>{c.emoji} {c.title}</Text>
                <Text style={ui.muted}>{c.submittedBy?.emoji} {c.submittedBy?.name || 'Someone'} · {c.stars}⭐</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 10 }}>
              <TouchableOpacity style={[ui.btn, { flex: 2, opacity: review.isPending ? 0.5 : 1 }]} disabled={review.isPending}
                onPress={() => review.mutate({ id: c.id, approve: true })} accessibilityLabel={`Approve ${c.title}`}>
                <Text style={ui.btnText}>✓ Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[ui.ghost, { flex: 1 }]} disabled={review.isPending} onPress={() => sendBack(c)}>
                <Text style={ui.ghostText}>Not yet</Text>
              </TouchableOpacity>
            </View>
          </View>
        );
      })}
    </View>
  );
}
