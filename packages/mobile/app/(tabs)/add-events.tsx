import { useState } from 'react';
import { ScrollView, View, Text, TextInput, TouchableOpacity, Image, Alert, KeyboardAvoidingView, Platform } from 'react-native';
import { router } from 'expo-router';
import * as ImagePicker from 'expo-image-picker';
import { useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useFamilySettings } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { C, ui } from '../lib/theme';

type Proposed = { title: string; date: string; time: string | null; endTime: string | null; location: string | null; notes: string | null; emoji: string; possibleDuplicate?: boolean; keep?: boolean };

// The server accepts up to 8 MB; base64 is about a third bigger than the photo.
const MAX_BASE64 = 7_000_000;

/** "Snap a flyer or paste an email" → check the events found → add them to the calendar. */
export default function AddEventsScreen() {
  const qc = useQueryClient();
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const { data: settings } = useFamilySettings();
  const [text, setText] = useState('');
  const [image, setImage] = useState<{ uri: string; mediaType: string; data: string } | null>(null);
  const [found, setFound] = useState<Proposed[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function pick(camera: boolean) {
    setError('');
    const perm = camera ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) { setError(camera ? 'Allow camera access to take a photo.' : 'Allow photo access to choose a photo.'); return; }
    const opts = { mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.5, base64: true };
    const r = camera ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
    if (r.canceled) return;
    const a = r.assets[0];
    if (!a.base64) { setError('Could not read that photo'); return; }
    if (a.base64.length > MAX_BASE64) { setError('That photo is too large. Try again a little further away, or paste the text instead.'); return; }
    // With quality below 1 the picker re-encodes the photo (iPhone HEIC becomes JPEG).
    const mediaType = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(a.mimeType || '') ? a.mimeType! : 'image/jpeg';
    setImage({ uri: a.uri, mediaType, data: a.base64 });
  }

  async function read() {
    setBusy(true); setError('');
    try {
      const body = image ? { image: { mediaType: image.mediaType, data: image.data }, text: text.trim() || undefined } : { text };
      const { data } = await api.post('/events/extract', body);
      setFound(data.events.map((e: Proposed) => ({ ...e, keep: !e.possibleDuplicate })));
    } catch (e: any) { setError(e.response?.data?.error || 'Something went wrong'); }
    finally { setBusy(false); }
  }

  async function add() {
    const chosen = (found || []).filter(e => e.keep);
    if (!chosen.length) return;
    const bad = chosen.find(e => !/^\d{4}-\d{2}-\d{2}$/.test(e.date) || (e.time && !/^\d{2}:\d{2}$/.test(e.time)));
    if (bad) { setError(`Check the date or time for "${bad.title}" (date like 2026-11-05, time like 16:30).`); return; }
    setBusy(true); setError('');
    try {
      await api.post('/events/batch', { events: chosen.map(({ keep, possibleDuplicate, ...e }) => e) });
      qc.invalidateQueries({ queryKey: ['events'] });
      qc.invalidateQueries({ queryKey: ['briefing'] });
      Alert.alert('Added', `${chosen.length} event${chosen.length > 1 ? 's' : ''} added to the calendar.`);
      router.back();
    } catch (e: any) { setError(e.response?.data?.error || 'Could not add events'); }
    finally { setBusy(false); }
  }

  const set = (i: number, patch: Partial<Proposed>) => setFound(list => list!.map((e, j) => (j === i ? { ...e, ...patch } : e)));
  const aiOff = settings && !settings.aiEnabled;

  return (
    <KeyboardAvoidingView style={ui.screen} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentContainerStyle={ui.content} keyboardShouldPersistTaps="handled">
        <TouchableOpacity onPress={() => (found ? setFound(null) : router.back())}><Text style={ui.back}>‹ Back</Text></TouchableOpacity>
        <Text style={ui.h1}>📸 Snap or paste</Text>

        {aiOff ? (
          <View style={ui.card}>
            <Text style={[ui.text, { lineHeight: 20 }]}>
              {isParent
                ? 'This uses Kinroost’s AI features, which are off for your family. You can turn them on in Settings.'
                : 'This uses AI features, which a parent needs to turn on first.'}
            </Text>
            {isParent && <TouchableOpacity style={[ui.btn, { marginTop: 12 }]} onPress={() => router.push('/settings')}><Text style={ui.btnText}>Open Settings</Text></TouchableOpacity>}
          </View>
        ) : !found ? (
          <>
            <Text style={[ui.muted, { fontSize: 13, marginBottom: 12, lineHeight: 19 }]}>Take a photo of a school flyer or schedule, or paste an email. You’ll check the dates before anything is added.</Text>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[ui.btn, { flex: 1 }]} onPress={() => pick(true)}><Text style={ui.btnText}>📷 Take photo</Text></TouchableOpacity>
              <TouchableOpacity style={[ui.ghost, { flex: 1 }]} onPress={() => pick(false)}><Text style={ui.ghostText}>🖼 Choose photo</Text></TouchableOpacity>
            </View>
            {image && (
              <View style={{ marginTop: 12 }}>
                <Image source={{ uri: image.uri }} style={{ width: '100%', height: 220, borderRadius: 12 }} resizeMode="contain" accessibilityLabel="Photo to read" />
                <TouchableOpacity onPress={() => setImage(null)} style={{ marginTop: 6 }}><Text style={{ color: C.danger, fontWeight: '800' }}>Remove photo</Text></TouchableOpacity>
              </View>
            )}
            <TextInput style={[ui.input, { marginTop: 12, minHeight: 110, textAlignVertical: 'top' }]} multiline placeholder="…or paste the email or message here" placeholderTextColor="#666" value={text} onChangeText={setText} />
            {error ? <Text style={{ color: C.danger, marginTop: 10 }}>{error}</Text> : null}
            <TouchableOpacity style={[ui.btn, { marginTop: 12, opacity: busy || (!image && !text.trim()) ? 0.5 : 1 }]} disabled={busy || (!image && !text.trim())} onPress={read}>
              <Text style={ui.btnText}>{busy ? 'Reading…' : 'Find the dates'}</Text>
            </TouchableOpacity>
            <Text style={[ui.muted, { fontSize: 11, marginTop: 10 }]}>The photo or text is sent to our AI provider to read the dates. Nothing is added until you confirm.</Text>
          </>
        ) : (
          <>
            <Text style={[ui.muted, { fontSize: 13, marginBottom: 10 }]}>
              {found.length ? `Found ${found.length}. Untick anything you don’t want, and fix any mistakes.` : 'No dated events found. Try a clearer photo, or paste the text.'}
            </Text>
            {found.map((e, i) => (
              <View key={i} style={[ui.card, { opacity: e.keep ? 1 : 0.55 }]}>
                <View style={ui.row}>
                  <TouchableOpacity onPress={() => set(i, { keep: !e.keep })} accessibilityRole="checkbox" accessibilityState={{ checked: !!e.keep }}
                    style={{ width: 24, height: 24, borderRadius: 6, borderWidth: 2, borderColor: e.keep ? C.primary : 'rgba(255,255,255,0.3)', backgroundColor: e.keep ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
                    {e.keep && <Text style={{ color: '#fff', fontWeight: '900' }}>✓</Text>}
                  </TouchableOpacity>
                  <Text style={{ fontSize: 20 }}>{e.emoji}</Text>
                  <TextInput style={[ui.input, { flex: 1, minWidth: 0, padding: 8 }]} value={e.title} onChangeText={v => set(i, { title: v })} accessibilityLabel="Title" />
                </View>
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <TextInput style={[ui.input, { flex: 3, minWidth: 0, padding: 8 }]} value={e.date} onChangeText={v => set(i, { date: v })} placeholder="2026-11-05" placeholderTextColor="#666" accessibilityLabel="Date" />
                  <TextInput style={[ui.input, { flex: 2, minWidth: 0, padding: 8 }]} value={e.time || ''} onChangeText={v => set(i, { time: v || null })} placeholder="16:30" placeholderTextColor="#666" accessibilityLabel="Time" />
                </View>
                {(e.location || e.notes) ? <Text style={[ui.muted, { marginTop: 6 }]}>{[e.location, e.notes].filter(Boolean).join(' · ')}</Text> : null}
                {e.possibleDuplicate && <Text style={{ color: C.gold, fontSize: 12, marginTop: 6 }}>Looks like it’s already on the calendar.</Text>}
              </View>
            ))}
            {error ? <Text style={{ color: C.danger, marginBottom: 10 }}>{error}</Text> : null}
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity style={[ui.ghost, { flex: 1 }]} onPress={() => setFound(null)}><Text style={ui.ghostText}>Back</Text></TouchableOpacity>
              <TouchableOpacity style={[ui.btn, { flex: 2, opacity: busy || !found.some(e => e.keep) ? 0.5 : 1 }]} disabled={busy || !found.some(e => e.keep)} onPress={add}>
                <Text style={ui.btnText}>{busy ? 'Adding…' : `Add ${found.filter(e => e.keep).length} to the calendar`}</Text>
              </TouchableOpacity>
            </View>
          </>
        )}
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
