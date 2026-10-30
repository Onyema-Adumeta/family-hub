import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform, Switch, Share,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { router } from 'expo-router';
import StreakCard from '../components/StreakCard';
import LevelCard from '../components/LevelCard';
import { useFamilySettings } from '../hooks/useApi';
import { ask } from '../store/prompt';
import { openWeb } from '../lib/theme';

function Action({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.editBtn} onPress={onPress} accessibilityRole="button">
      <Text style={styles.editBtnText}>{label}</Text>
    </TouchableOpacity>
  );
}

export default function SettingsPage() {
  const { member, setMember, logout } = useAuthStore();
  const qc = useQueryClient();

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then(r => r.data),
  });

  // Birthday editing state per member id
  const [bdayEdits, setBdayEdits] = useState<Record<string, Date | null>>({});
  const [showPicker, setShowPicker] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const isParent = member?.role === 'parent';

  const { data: settings } = useFamilySettings();
  const { family, token, setAuth } = useAuthStore();
  const fail = (e: any, fallback: string) => Alert.alert('Something went wrong', e?.response?.data?.error || fallback);

  async function changeEmail() {
    const email = await ask({ title: member?.email ? 'Change email' : 'Add email', placeholder: 'you@example.com', defaultValue: member?.email || '', okLabel: 'Next' });
    if (!email?.trim()) return;
    const currentPassword = await ask({ title: 'Your current password', message: 'To keep your account safe.', secure: true, okLabel: 'Save email' });
    if (currentPassword === null) return;
    try {
      const { data } = await api.put(`/members/${member!.id}/email`, { email: email.trim(), currentPassword });
      await setMember({ ...member!, ...data.member });
      Alert.alert(data.emailSent ? 'Check your inbox' : 'Email saved', data.emailSent ? `We sent a confirmation link to ${email.trim()}.` : 'We could not send the confirmation email right now. Try "Resend confirmation" later.');
    } catch (e) { fail(e, 'Could not change email'); }
  }

  async function resendConfirm() {
    try {
      const { data } = await api.post('/auth/resend-verification');
      Alert.alert(data.alreadyVerified ? 'Already confirmed' : 'Sent', data.alreadyVerified ? 'Your email is already confirmed.' : 'Check your inbox for the confirmation link.');
    } catch (e) { fail(e, 'Could not send email'); }
  }

  async function changeMyPassword() {
    const word = isParent ? 'password' : 'PIN';
    const currentPassword = await ask({ title: `Current ${word}`, secure: true, okLabel: 'Next' });
    if (currentPassword === null) return;
    const password = await ask({ title: `New ${word}`, message: isParent ? 'At least 4 characters — longer is safer.' : 'At least 4 numbers.', secure: true, numeric: !isParent, okLabel: 'Save' });
    if (!password) return;
    try {
      const { data } = await api.put(`/members/${member!.id}/password`, { currentPassword, password });
      // Other devices are signed out; this one gets a fresh sign-in.
      if (data.token && member && family) await setAuth(data.token, member, family);
      Alert.alert('Saved', `Your ${word} has been changed. Other devices will need to sign in again.`);
    } catch (e) { fail(e, `Could not change ${word}`); }
  }

  async function resetPin(m: any) {
    const password = await ask({ title: `New PIN for ${m.name}`, message: 'At least 4 characters. They will be signed out on their devices.', numeric: m.role !== 'parent', secure: true, okLabel: 'Save' });
    if (!password) return;
    try { await api.put(`/members/${m.id}/password`, { password }); Alert.alert('Saved', `${m.name} can sign in with the new PIN.`); }
    catch (e) { fail(e, 'Could not change PIN'); }
  }

  function signOutMember(m: any) {
    Alert.alert(`Sign ${m.name} out?`, 'They will be signed out on every device and need to sign in again.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out', style: 'destructive', onPress: async () => {
        try { await api.post(`/members/${m.id}/sign-out`); Alert.alert('Done', `${m.name} has been signed out.`); } catch (e) { fail(e, 'Could not sign out'); }
      } },
    ]);
  }

  function rotateCode() {
    Alert.alert('Make a new family code?', 'The old code stops working for joining and signing in. Everyone already signed in stays signed in.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Make new code', onPress: async () => {
        try {
          const { data } = await api.post('/auth/rotate-code');
          if (token && member) await setAuth(token, member, { ...family!, ...data.family });
          Alert.alert('New code', `Your family code is now ${data.family.inviteCode}.`);
        } catch (e) { fail(e, 'Could not change the code'); }
      } },
    ]);
  }

  async function setAi(enabled: boolean) {
    try { await api.put('/family/ai-consent', { enabled }); qc.invalidateQueries({ queryKey: ['family-settings'] }); }
    catch (e) { fail(e, 'Could not save'); }
  }

  function signOutEverywhere() {
    Alert.alert('Sign out on all devices?', 'You will be signed out here and on every other phone or computer.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign out everywhere', style: 'destructive', onPress: async () => {
        try { await api.post('/auth/sign-out-everywhere'); } catch { /* signing out anyway */ }
        logout();
      } },
    ]);
  }

  // Members that can be edited: parents see all, kids see only themselves
  const editableMembers = isParent
    ? members
    : members.filter((m: any) => m.id === member?.id);

  async function saveBirthday(memberId: string) {
    const val = bdayEdits[memberId];
    setSaving(memberId);
    try {
      const birthday = val ? val.toISOString().split('T')[0] : null;
      const updated = await api.patch(`/members/${memberId}`, { birthday });
      if (memberId === member?.id) setMember({ ...member, ...updated.data });
      qc.invalidateQueries({ queryKey: ['members'] });
      Alert.alert('Saved', 'Birthday updated!');
    } catch (e: any) {
      Alert.alert('Error', e.response?.data?.error || 'Failed to save');
    } finally {
      setSaving(null);
    }
  }

  function getBdayDisplay(m: any) {
    const edited = bdayEdits[m.id];
    if (edited !== undefined) return edited;
    return m.birthday ? new Date(m.birthday) : null;
  }

  function formatDate(d: Date | null) {
    if (!d) return 'Not set';
    return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });
  }

  return (
  <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <TouchableOpacity onPress={() => router.back()}><Text style={{ color: '#6366F1', fontWeight: '800', fontSize: 14, marginBottom: 10 }}>‹ Back</Text></TouchableOpacity>
      <Text style={styles.heading}>⚙️ Settings</Text>
      <LevelCard member={(members as any[]).find((m: any) => m.id === member?.id) || member} />
      <StreakCard />

      {/* ── Birthdays section ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🎂 Birthdays</Text>
        <Text style={styles.cardSub}>
          Set birthdays so the dashboard shows upcoming celebrations.
        </Text>

        {editableMembers.map((m: any) => {
          const currentDate = getBdayDisplay(m);
          const isMe = m.id === member?.id;

          return (
            <View key={m.id} style={styles.memberRow}>
              <View style={styles.memberInfo}>
                <Text style={styles.memberEmoji}>{m.emoji || '👤'}</Text>
                <View>
                  <Text style={styles.memberName}>
                    {m.name}{isMe ? ' (you)' : ''}
                  </Text>
                  <Text style={styles.memberBday}>{formatDate(currentDate)}</Text>
                </View>
              </View>

              <TouchableOpacity
                style={styles.editBtn}
                onPress={() => setShowPicker(m.id)}
              >
                <Text style={styles.editBtnText}>
                  {currentDate ? 'Change' : 'Set'}
                </Text>
              </TouchableOpacity>

              {showPicker === m.id && (
                <DateTimePicker
                  value={currentDate || new Date(2000, 0, 1)}
                  mode="date"
                  display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                  maximumDate={new Date()}
                  onChange={(_, date) => {
                    setShowPicker(Platform.OS === 'ios' ? m.id : null);
                    if (date) setBdayEdits(prev => ({ ...prev, [m.id]: date }));
                  }}
                />
              )}

              {bdayEdits[m.id] !== undefined && (
                <TouchableOpacity
                  style={[styles.saveBtn, saving === m.id && styles.saveBtnDisabled]}
                  onPress={() => saveBirthday(m.id)}
                  disabled={saving === m.id}
                >
                  {saving === m.id
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Text style={styles.saveBtnText}>Save</Text>
                  }
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </View>

      {/* ── Account ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 Your account</Text>
        <View style={styles.memberRow}>
          <Text style={styles.memberEmoji}>{member?.emoji || '👤'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{member?.name}</Text>
            <Text style={styles.memberBday}>{member?.role === 'parent' ? 'Parent' : 'Kid'}</Text>
          </View>
        </View>
        {isParent && (
          <View style={styles.memberRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>{member?.email || 'No email yet'}</Text>
              <Text style={[styles.memberBday, { color: member?.email ? (member?.emailVerifiedAt ? '#4ADE80' : '#FBBF24') : 'rgba(240,240,245,0.5)' }]}>
                {member?.email ? (member?.emailVerifiedAt ? '✓ Confirmed — you can sign in and reset your password with it' : 'Not confirmed yet — check your inbox') : 'Add one so you can reset a forgotten password'}
              </Text>
            </View>
          </View>
        )}
        <View style={styles.actions}>
          {isParent && <Action label={member?.email ? 'Change email' : 'Add email'} onPress={changeEmail} />}
          {isParent && member?.email && !member?.emailVerifiedAt && <Action label="Resend confirmation" onPress={resendConfirm} />}
          <Action label={isParent ? 'Change password' : 'Change PIN'} onPress={changeMyPassword} />
        </View>
      </View>

      {/* ── Family (parents) ── */}
      {isParent && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🏠 Family</Text>
          <Text style={styles.cardSub}>Family code: <Text style={{ color: '#F0F0F5', fontWeight: '900', letterSpacing: 1 }}>{family?.inviteCode}</Text> — kids use it with their name and PIN to sign in.</Text>
          <View style={styles.actions}>
            <Action label="Share code" onPress={() => Share.share({ message: `Join our family on FamilyHub with code ${family?.inviteCode}` })} />
            <Action label="Make a new code" onPress={rotateCode} />
          </View>

          <View style={[styles.memberRow, { marginTop: 10 }]}>
            <View style={{ flex: 1 }}>
              <Text style={styles.memberName}>✨ AI features</Text>
              <Text style={styles.memberBday}>
                {!settings?.aiConfigured ? 'Not available on this server yet.' : 'Flyer reading, trivia and the weekly coach. Names and birthdays are never sent — only labels like “Child 1”.'}
              </Text>
            </View>
            <Switch value={!!settings?.aiEnabled} disabled={!settings?.aiConfigured} onValueChange={setAi} />
          </View>
        </View>
      )}

      {/* ── Kids and other members (parents) ── */}
      {isParent && (members as any[]).some((m: any) => m.id !== member?.id) && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔑 PINs and devices</Text>
          <Text style={styles.cardSub}>Set a new PIN if someone forgets theirs, or sign them out everywhere if a phone is lost.</Text>
          {(members as any[]).filter((m: any) => m.id !== member?.id).map((m: any) => (
            <View key={m.id} style={styles.memberRow}>
              <Text style={styles.memberEmoji}>{m.emoji || '👤'}</Text>
              <Text style={[styles.memberName, { flex: 1 }]}>{m.name}</Text>
              <TouchableOpacity style={styles.editBtn} onPress={() => resetPin(m)}><Text style={styles.editBtnText}>New PIN</Text></TouchableOpacity>
              <TouchableOpacity style={styles.editBtn} onPress={() => signOutMember(m)}><Text style={styles.editBtnText}>Sign out</Text></TouchableOpacity>
            </View>
          ))}
        </View>
      )}

      {/* ── Privacy and data ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🔒 Privacy</Text>
        <View style={styles.actions}>
          <Action label="Privacy Policy ↗" onPress={() => openWeb('/privacy')} />
          <Action label="Terms ↗" onPress={() => openWeb('/terms')} />
          {isParent && <Action label="Download or delete data ↗" onPress={() => openWeb('/settings')} />}
        </View>
        {isParent && <Text style={[styles.cardSub, { marginTop: 8, marginBottom: 0 }]}>Downloading your family’s data and deleting the family are done on the website, where you confirm with your password.</Text>}
      </View>

      {/* ── Sign out ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ padding: 14, alignItems: 'center' }} onPress={signOutEverywhere}>
        <Text style={{ color: 'rgba(240,240,245,0.5)', fontWeight: '700', fontSize: 13 }}>Sign out on all my devices</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  content: { padding: 20, paddingTop: 56, paddingBottom: 60 },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  heading: { fontSize: 26, fontWeight: '900', color: '#F0F0F5', marginBottom: 20 },

  card: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  cardTitle: { fontSize: 16, fontWeight: '800', color: '#F0F0F5', marginBottom: 4 },
  cardSub: { fontSize: 12, color: 'rgba(240,240,245,0.5)', marginBottom: 14 },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', flexWrap: 'wrap',
    gap: 10, paddingVertical: 10,
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  memberInfo: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  memberEmoji: { fontSize: 28 },
  memberName: { fontSize: 14, fontWeight: '700', color: '#F0F0F5' },
  memberBday: { fontSize: 12, color: 'rgba(240,240,245,0.5)', marginTop: 2 },

  editBtn: {
    backgroundColor: 'rgba(99,102,241,0.2)',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6,
    borderWidth: 1, borderColor: 'rgba(99,102,241,0.4)',
  },
  editBtnText: { color: '#818CF8', fontWeight: '700', fontSize: 13 },

  saveBtn: {
    backgroundColor: '#6366F1',
    borderRadius: 10, paddingHorizontal: 14, paddingVertical: 6,
  },
  saveBtnDisabled: { opacity: 0.5 },
  saveBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  logoutBtn: {
    backgroundColor: 'rgba(239,68,68,0.15)',
    borderRadius: 14, padding: 16, alignItems: 'center',
    borderWidth: 1, borderColor: 'rgba(239,68,68,0.3)',
    marginTop: 8,
  },
  logoutText: { color: '#F87171', fontWeight: '800', fontSize: 15 },
});
