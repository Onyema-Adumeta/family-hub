import { useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Modal, View, Text, TouchableOpacity, ScrollView } from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { C, ui, openWeb } from '../lib/theme';

function Tick({ on, label, onPress }: { on: boolean; label: string; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} accessibilityRole="checkbox" accessibilityState={{ checked: on }}
      style={{ flexDirection: 'row', gap: 10, marginTop: 12, alignItems: 'flex-start' }}>
      <View style={{ width: 22, height: 22, borderRadius: 6, borderWidth: 2, borderColor: on ? C.primary : 'rgba(255,255,255,0.3)', backgroundColor: on ? C.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginTop: 1 }}>
        {on && <Text style={{ color: '#fff', fontSize: 13, fontWeight: '900' }}>✓</Text>}
      </View>
      <Text style={[ui.text, { flex: 1, fontSize: 13, lineHeight: 19 }]}>{label}</Text>
    </TouchableOpacity>
  );
}

/**
 * Families created before the Terms/Privacy Policy existed (or before a new
 * version) need a parent to accept them. Parents see a blocking sheet; kids
 * see a banner asking them to fetch a parent.
 */
export default function ConsentGate() {
  const member = useAuthStore(s => s.member);
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ['family-settings'], queryFn: () => api.get('/family').then(r => r.data) });
  const [terms, setTerms] = useState(false);
  const [kids, setKids] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const insets = useSafeAreaInsets();

  if (!family?.needsConsent) return null;

  if (member?.role !== 'parent') {
    return (
      <View style={{ position: 'absolute', bottom: insets.bottom + 62, left: 12, right: 12, zIndex: 10, paddingVertical: 6, paddingHorizontal: 10, borderRadius: 10, backgroundColor: '#3b2a08', borderWidth: 1, borderColor: 'rgba(245,158,11,0.5)' }} accessibilityRole="alert">
        <Text style={[ui.text, { fontSize: 12 }]}>A parent needs to review FamilyHub's updated privacy policy. Ask them to open FamilyHub.</Text>
      </View>
    );
  }

  async function accept() {
    setSaving(true); setError('');
    try {
      await api.post('/family/consent', { acceptTerms: true, childDataConsent: true });
      qc.invalidateQueries({ queryKey: ['family-settings'] });
    } catch (e: any) { setError(e.response?.data?.error || 'Could not save'); }
    finally { setSaving(false); }
  }

  return (
    <Modal visible animationType="slide" transparent onRequestClose={() => { /* must answer */ }}>
      <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.8)', justifyContent: 'flex-end' }}>
        <ScrollView style={{ maxHeight: '90%' }} contentContainerStyle={{ backgroundColor: C.sheet, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 }}>
          <Text style={{ color: C.text, fontSize: 18, fontWeight: '900' }}>Please review our privacy policy</Text>
          <Text style={[ui.muted, { fontSize: 13, marginTop: 8, lineHeight: 19 }]}>
            FamilyHub now has a Privacy Policy and Terms of Service. Because your family includes children, we need a parent's agreement before continuing. New members can't join until a parent accepts.
          </Text>
          <View style={{ flexDirection: 'row', gap: 16, marginTop: 10 }}>
            <TouchableOpacity onPress={() => openWeb('/privacy')}><Text style={{ color: C.primary, fontWeight: '800' }}>Read the Privacy Policy ↗</Text></TouchableOpacity>
            <TouchableOpacity onPress={() => openWeb('/terms')}><Text style={{ color: C.primary, fontWeight: '800' }}>Terms ↗</Text></TouchableOpacity>
          </View>
          <Tick on={terms} onPress={() => setTerms(v => !v)} label="I agree to the Terms of Service and Privacy Policy." />
          <Tick on={kids} onPress={() => setKids(v => !v)}
            label="I am the parent or legal guardian of the children in this family, and I consent to FamilyHub collecting and using their information as described in the Privacy Policy." />
          {error ? <Text style={{ color: C.danger, marginTop: 10 }}>{error}</Text> : null}
          <TouchableOpacity style={[ui.btn, { marginTop: 18, opacity: !terms || !kids || saving ? 0.5 : 1 }]} disabled={!terms || !kids || saving} onPress={accept}>
            <Text style={ui.btnText}>{saving ? 'Saving…' : 'Agree and continue'}</Text>
          </TouchableOpacity>
        </ScrollView>
      </View>
    </Modal>
  );
}
