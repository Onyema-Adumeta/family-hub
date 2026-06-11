import React, { useState } from 'react';
import {
  View, Text, ScrollView, TextInput, TouchableOpacity,
  StyleSheet, Alert, ActivityIndicator, Platform,
} from 'react-native';
import DateTimePicker from '@react-native-community/datetimepicker';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

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
      <Text style={styles.heading}>⚙️ Settings</Text>

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

      {/* ── Account section ── */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>👤 Account</Text>
        <View style={styles.memberRow}>
          <Text style={styles.memberEmoji}>{member?.emoji || '👤'}</Text>
          <View style={{ flex: 1 }}>
            <Text style={styles.memberName}>{member?.name}</Text>
            <Text style={styles.memberBday}>{member?.role}</Text>
          </View>
        </View>
      </View>

      {/* ── Logout ── */}
      <TouchableOpacity style={styles.logoutBtn} onPress={logout}>
        <Text style={styles.logoutText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  content: { padding: 20, paddingBottom: 60 },
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
