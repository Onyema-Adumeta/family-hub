import { useState, useEffect, useRef } from 'react';
import {
  View, Text, StyleSheet, TextInput, TouchableOpacity,
  FlatList, Alert, KeyboardAvoidingView, Platform, Image
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import * as ImagePicker from 'expo-image-picker';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { useSocket } from '../hooks/useSocket';
import { familySocket } from '../lib/socket';

const QUICK = ['🍕 Pizza tonight?', '⭐ Great job!', '🏠 Heading home', '❓ Anyone home?'];

export default function ChatScreen() {
  const { member } = useAuthStore();
  const qc = useQueryClient();
  const listRef = useRef<FlatList>(null);
  const typingTimer = useRef<any>(null);
  const isParent = member?.role === 'parent';

  const { data: messages = [] } = useQuery({
    queryKey: ['messages'],
    queryFn: () => api.get('/chat').then(r => r.data),
  });
  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then(r => r.data),
  });

  const sendMsg = useMutation({
    mutationFn: (data: any) => api.post('/chat', data).then(r => r.data),
    onSuccess: () => { setText(''); },
  });

  const [text, setText]               = useState('');
  const [uploading, setUploading]     = useState(false);
  const [typingUsers, setTypingUsers] = useState<Record<string, { name: string; emoji: string; ts: number }>>({});
  const [pinnedMsg, setPinnedMsg]     = useState<any | null>(null);
  const [showPinned, setShowPinned]   = useState(false);

  useEffect(() => {
    if ((messages as any[]).length > 0) {
      setTimeout(() => listRef.current?.scrollToEnd({ animated: true }), 100);
    }
  }, [messages]);

  // Find pinned message
  useEffect(() => {
    const pinned = (messages as any[]).filter((m: any) => m.pinned);
    setPinnedMsg(pinned.length > 0 ? pinned[pinned.length - 1] : null);
  }, [messages]);

  // Real-time WebSocket
  useSocket((msg) => {
    if (msg.type === 'message:new') {
      qc.setQueryData(['messages'], (old: any[]) => {
        const existing = (old || []).find((m: any) => m.id === msg.message.id);
        if (existing) return old;
        return [...(old || []), msg.message];
      });
      setTypingUsers(prev => {
        const next = { ...prev };
        delete next[msg.message.memberId];
        return next;
      });
    }
    if (msg.type === 'chat:typing' && msg.memberId !== member?.id) {
      setTypingUsers(prev => ({
        ...prev,
        [msg.memberId]: { name: msg.memberName, emoji: msg.memberEmoji, ts: Date.now() }
      }));
      setTimeout(() => {
        setTypingUsers(prev => {
          const next = { ...prev };
          if (next[msg.memberId] && Date.now() - next[msg.memberId].ts >= 2900) {
            delete next[msg.memberId];
          }
          return next;
        });
      }, 3000);
    }
    if (msg.type === 'message:pinned') {
      qc.setQueryData(['messages'], (old: any[]) =>
        (old || []).map((m: any) => m.id === msg.messageId ? { ...m, pinned: true } : m)
      );
    }
    if (msg.type === 'message:deleted') {
      qc.setQueryData(['messages'], (old: any[]) =>
        (old || []).filter((m: any) => m.id !== msg.messageId)
      );
    }
  });

  function handleTyping(val: string) {
    setText(val);
    clearTimeout(typingTimer.current);
    if (val.trim()) {
      familySocket.send({
        type: 'chat:typing',
        memberId: member?.id,
        memberName: member?.name,
        memberEmoji: member?.emoji,
      });
    }
  }

  function getMember(id: string) {
    return (members as any[]).find((m: any) => m.id === id);
  }

  async function handlePin(msgId: string) {
    try {
      await api.patch(`/chat/${msgId}/pin`);
      qc.setQueryData(['messages'], (old: any[]) =>
        (old || []).map((m: any) => m.id === msgId ? { ...m, pinned: true } : m)
      );
      familySocket.send({ type: 'message:pinned', messageId: msgId });
    } catch { Alert.alert('Failed to pin message'); }
  }

  async function handleDelete(msgId: string) {
    Alert.alert('Delete message?', '', [
      { text: 'Cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          try {
            await api.delete(`/chat/${msgId}`);
            qc.setQueryData(['messages'], (old: any[]) =>
              (old || []).filter((m: any) => m.id !== msgId)
            );
            familySocket.send({ type: 'message:deleted', messageId: msgId });
          } catch { Alert.alert('Failed to delete'); }
        }
      }
    ]);
  }

  async function pickMedia() {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All, quality: 0.7
    });
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

  const typingList = Object.values(typingUsers);

  return (
    <KeyboardAvoidingView style={s.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>

      {/* Header */}
      <View style={s.header}>
        <Text style={s.title}>💬 Family Chat</Text>
        {pinnedMsg && (
          <TouchableOpacity onPress={() => setShowPinned(v => !v)} style={[s.pinnedBtn, showPinned && s.pinnedBtnActive]}>
            <Text style={{ fontSize: 12, fontWeight: '800', color: showPinned ? '#FBBF24' : 'rgba(240,240,245,0.5)' }}>📌 Pinned</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Pinned banner */}
      {pinnedMsg && showPinned && (
        <View style={s.pinnedBanner}>
          <Text style={{ fontSize: 14 }}>📌</Text>
          <View style={{ flex: 1, marginLeft: 8 }}>
            <Text style={{ fontSize: 10, fontWeight: '800', color: '#FBBF24', marginBottom: 2 }}>PINNED MESSAGE</Text>
            <Text style={{ fontSize: 13, color: '#f0f0f5', fontWeight: '600' }} numberOfLines={1}>
              {pinnedMsg.text || '📎 Media'}
            </Text>
          </View>
        </View>
      )}

      {/* Messages */}
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
              {!isMe && (
                <View style={[s.avatar, { backgroundColor: sender?.color || '#6366F1' }]}>
                  <Text>{sender?.emoji}</Text>
                </View>
              )}
              <View style={{ maxWidth: '72%' }}>
                {!isMe && <Text style={s.senderName}>{sender?.name}</Text>}
                <TouchableOpacity
                  onLongPress={() => {
                    const opts: any[] = [];
                    if (!msg.pinned && isParent) opts.push({ text: '📌 Pin', onPress: () => handlePin(msg.id) });
                    if (isMe || isParent) opts.push({ text: '🗑 Delete', style: 'destructive', onPress: () => handleDelete(msg.id) });
                    opts.push({ text: 'Cancel', style: 'cancel' });
                    if (opts.length > 1) Alert.alert('Message', undefined, opts);
                  }}
                >
                  <View style={[s.bubble, isMe && s.bubbleMe, msg.pinned && s.bubblePinned]}>
                    {msg.pinned && <Text style={{ fontSize: 10, marginBottom: 2 }}>📌</Text>}
                    {msg.text && <Text style={[s.msgText, isMe && { color: '#fff' }]}>{msg.text}</Text>}
                    {msg.mediaUrl && msg.mediaType === 'image' && (
                      <Image source={{ uri: msg.mediaUrl }} style={{ width: 200, height: 150, borderRadius: 8, marginTop: msg.text ? 6 : 0 }} resizeMode="cover" />
                    )}
                    {msg.mediaUrl && msg.mediaType === 'video' && (
                      <Text style={[s.msgText, isMe && { color: '#fff' }]}>🎥 Video</Text>
                    )}
                  </View>
                </TouchableOpacity>
                <Text style={[s.time, isMe && { textAlign: 'right' }]}>
                  {new Date(msg.createdAt).toLocaleTimeString('en', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </View>
            </View>
          );
        }}
        ListFooterComponent={
          typingList.length > 0 ? (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, paddingLeft: 4, marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', gap: 3, alignItems: 'center' }}>
                {[0, 1, 2].map(i => (
                  <View key={i} style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: 'rgba(240,240,245,0.3)' }} />
                ))}
              </View>
              <Text style={{ fontSize: 12, color: 'rgba(240,240,245,0.4)', fontWeight: '600' }}>
                {typingList.map(t => `${t.emoji} ${t.name}`).join(', ')} {typingList.length === 1 ? 'is' : 'are'} typing...
              </Text>
            </View>
          ) : null
        }
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
          value={text} onChangeText={handleTyping}
          returnKeyType="send"
          onSubmitEditing={() => { if (text.trim()) { sendMsg.mutate({ text }); setText(''); } }}
        />
        <TouchableOpacity
          style={[s.sendBtn, !text.trim() && s.sendBtnDisabled]}
          disabled={!text.trim()}
          onPress={() => { sendMsg.mutate({ text }); setText(''); }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 13 }}>Send</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: '#0f0f13' },
  header:         { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingTop: 56, paddingBottom: 8 },
  title:          { fontSize: 22, fontWeight: '900', color: '#f0f0f5' },
  pinnedBtn:      { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  pinnedBtnActive:{ backgroundColor: 'rgba(251,191,36,0.1)', borderColor: 'rgba(251,191,36,0.4)' },
  pinnedBanner:   { flexDirection: 'row', alignItems: 'center', marginHorizontal: 12, marginBottom: 8, padding: 10, borderRadius: 12, backgroundColor: 'rgba(251,191,36,0.08)', borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.3)' },
  msgRow:         { flexDirection: 'row', gap: 6, marginBottom: 10, alignItems: 'flex-end' },
  msgRowMe:       { justifyContent: 'flex-end' },
  avatar:         { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  senderName:     { fontSize: 10, fontWeight: '800', color: 'rgba(240,240,245,0.4)', marginBottom: 3, paddingLeft: 4 },
  bubble:         { backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 14, padding: 10, borderTopLeftRadius: 4 },
  bubbleMe:       { backgroundColor: '#6366F1', borderTopLeftRadius: 14, borderTopRightRadius: 4 },
  bubblePinned:   { borderWidth: 1.5, borderColor: 'rgba(251,191,36,0.4)' },
  msgText:        { color: '#f0f0f5', fontSize: 13, fontWeight: '600' },
  time:           { fontSize: 10, color: 'rgba(240,240,245,0.3)', fontWeight: '600', marginTop: 2, paddingLeft: 4 },
  quickChip:      { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  quickChipText:  { fontSize: 11, fontWeight: '700', color: 'rgba(240,240,245,0.6)' },
  inputRow:       { flexDirection: 'row', gap: 8, padding: 12, borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.08)' },
  attachBtn:      { width: 42, height: 42, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  input:          { flex: 1, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: 10, padding: 10, color: '#f0f0f5', fontSize: 14 },
  sendBtn:        { backgroundColor: '#6366F1', paddingHorizontal: 14, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  sendBtnDisabled:{ opacity: 0.4 },
});