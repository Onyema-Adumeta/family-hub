import { useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TextInput, TouchableOpacity, FlatList, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

const QUICK = ['🍕 Pizza tonight?', '⭐ Great job!', '🏠 Heading home', '❓ Anyone home?'];

export default function ChatScreen() {
  const { member } = useAuthStore();
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);

  const { data: messages = [] } = useQuery({ queryKey: ['messages'], queryFn: () => api.get('/chat').then(r => r.data), refetchInterval: 5000 });
  const { data: members = [] } = useQuery({ queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data) });

  const sendMsg = useMutation({
    mutationFn: (data: any) => api.post('/chat', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['messages'] }); setText(''); }
  });

  const [text, setText] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if ((messages as any[]).length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  function getMember(id: string) { return (members as any[]).find(m => m.id === id); }

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7 });
    if (result.canceled) return;
    const asset = result.assets[0];
    const isVideo = asset.type === 'video';
    setUploading(true);
    const form = new FormData();
    form.append('file', { uri: asset.uri, name: isVideo ? 'media.mp4' : 'media.jpg', type: isVideo ? 'video/mp4' : 'image/jpeg' } as any);
    try {
      const { data } = await api.post('/upload', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      sendMsg.mutate({ mediaUrl: data.url, mediaType: data.type });
    } catch { Alert.alert('Upload failed'); }
    finally { setUploading(false); }
  }

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Text style={s.title}>💬 Family Chat</Text>

      <FlatList
        ref={listRef}
        data={messages as any[]}
        keyExtractor={item => item.id}
        contentContainerStyle={{ padding: 12, paddingBottom: 8 }}
        onContentSizeChange={() => listRef.current?.scrollToEnd()}
        renderItem={({ item: msg }) => {
          const sender = getMember(msg.memberId);
          const isMe = msg.memberId === member?.id;
          return (
            <View style={[s.msgRow, isMe && s.msgRowMe]}>
              {!isMe && <View style={[s.avatar, { backgroundColor: sender?.color || '#6366F1' }]}><Text>{sender?.emoji}</Text></View>}
              <View style={{ maxWidth: '72%' }}>
                {!isMe && <Text style={s.senderName}>{sender?.name}</Text>}
                <View style={[s.bubble, isMe && s.bubbleMe]}>
                  {msg.text && <Text style={[s.msgText, isMe && { color: '#fff' }]}>{msg.text}</Text>}
                  {msg.mediaUrl && <Text style={[s.msgText, isMe && { color: '#fff' }]}>📎 {msg.mediaType === 'video' ? '🎥 Video' : '🖼 Photo'}</Text>}
                </View>
                <Text style={[s.time, isMe && { textAlign: 'right' }]}>{new Date(msg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
            </View>
          );
        }}
      />

      {/* Quick chips */}
      <View style={{ paddingHorizontal: 12 }}>
        <FlatList
          horizontal showsHorizontalScrollIndicator={false}
          data={QUICK} keyExtractor={i => i}
          contentContainerStyle={{ gap: 6, paddingBottom: 6 }}
          renderItem={({ item }) => (
            <TouchableOpacity style={s.quickChip} onPress={() => sendMsg.mutate({ text: item })}>
              <Text style={s.quickChipText}>{item}</Text>
            </TouchableOpacity>
          )}
        />
      </View>

      {/* Input */}
      <View style={s.inputRow}>
        <TouchableOpacity style={s.attachBtn} onPress={pickMedia} disabled={uploading}>
          <Text style={{ fontSize: 18 }}>{uploading ? '⏳' : '📎'}</Text>
        </TouchableOpacity>
        <TextInput
          style={s.input} placeholder="Say something..." placeholderTextColor="#666"
          value={text} onChangeText={setText}
          returnKeyType="send" onSubmitEditing={() => { if (text.trim()) sendMsg.mutate({ text }); }}
        />
        <TouchableOpacity style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]} disabled={!text.trim()} onPress={() => sendMsg.mutate({ text })}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5', padding: 16, paddingTop: 56, paddingBottom: 8 },
  msgRow: { flexDirection: 'row', gap: 6, marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe: { justifyContent: 'flex-end' },
  avatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  senderName: { fontSize: 10, fontWeight: '800', color: 'rgba(240,240,245,0.4)', marginBottom: 3, paddingLeft: 4 },
  bubble: { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 10, borderTopLeftRadius: 4 },
  bubbleMe: { backgroundColor: '#6366F1', borderTopLeftRadius: 14, borderTopRightRadius: 4 },
  msgText: { color: '#f0f0f5', fontSize: 13, fontWeight: '600' },
  time: { fontSize: 10, color: 'rgba(240,240,245,0.3)', fontWeight: '600', marginTop: 2, paddingLeft: 4 },
  quickChip: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  quickChipText: { fontSize: 11, fontWeight: '700', color: 'rgba(240,240,245,0.6)' },
  inputRow: { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  attachBtn: { width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input: { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, color: '#f0f0f5', fontSize: 14 },
  sendBtn: { backgroundColor: '#6366F1', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled: { opacity: 0.4 },
});
