import { useState } from 'react';
import { ScrollView, View, Text, TouchableOpacity, Alert, ActivityIndicator, RefreshControl } from 'react-native';
import { router } from 'expo-router';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { ask, choose } from '../store/prompt';
import { C, ui } from '../lib/theme';

// Kept simple on purpose: Intl currency formatting is patchy on some Android phones.
const money = (cents: number, currency = 'CAD') => `${currency === 'EUR' ? '€' : currency === 'GBP' ? '£' : '$'}${(cents / 100).toFixed(2)}`;
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)}h${m % 60 ? ` ${m % 60}m` : ''}` : `${m} min`);
const JARS = [
  { key: 'spend', label: 'Spend', icon: '🛍️' },
  { key: 'save', label: 'Save', icon: '🐷' },
  { key: 'give', label: 'Give', icon: '💝' },
] as const;
const JAR_CHOICES = JARS.map(j => ({ label: `${j.icon} ${j.label}`, value: j.key }));

/**
 * Stars to real value. Kids turn stars into screen time or allowance; parents
 * set the rates and record when screen time is used or money is paid out.
 * It's a record only — the parent hands over the real thing.
 */
export default function BankScreen() {
  const member = useAuthStore(s => s.member);
  const isParent = member?.role === 'parent';
  const qc = useQueryClient();
  const { data, isLoading, refetch, isRefetching } = useQuery({ queryKey: ['bank'], queryFn: () => api.get('/bank').then(r => r.data) });
  const [busy, setBusy] = useState(false);

  async function call(fn: () => Promise<any>, ok?: string) {
    setBusy(true);
    try {
      await fn();
      ['bank', 'members', 'briefing'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      if (ok) Alert.alert('Done', ok);
    } catch (e: any) { Alert.alert('Could not save', e.response?.data?.error || 'Something went wrong'); }
    finally { setBusy(false); }
  }

  if (isLoading) return <View style={[ui.screen, { justifyContent: 'center' }]}><ActivityIndicator color={C.primary} /></View>;
  if (!data) return <View style={[ui.screen, ui.content]}><Text style={ui.text}>The star bank could not load.</Text></View>;
  const s = data.settings;

  async function editRates() {
    const screen = await ask({ title: '📺 Screen time', message: 'Minutes of screen time per star. Leave empty to turn it off.', defaultValue: s.screenMinutesPerStar != null ? String(s.screenMinutesPerStar) : '5', numeric: true, okLabel: 'Next' });
    if (screen === null) return;
    const cents = await ask({ title: '💵 Allowance', message: `Cents per star. Leave empty to turn it off. Example: 10 means 1⭐ = ${money(10, s.currency)}.`, defaultValue: s.centsPerStar != null ? String(s.centsPerStar) : '10', numeric: true, okLabel: 'Save rates' });
    if (cents === null) return;
    await call(() => api.put('/bank/settings', { screenMinutesPerStar: screen.trim() || null, centsPerStar: cents.trim() || null }), 'Bank rates saved.');
  }

  async function convert(kind: 'screen' | 'money', kid: any) {
    const n = await ask({ title: kind === 'screen' ? 'Stars to screen time' : 'Stars to allowance', message: `How many stars? ${kid.name} has ${kid.stars}⭐.`, numeric: true, okLabel: 'Convert' });
    if (!n) return;
    let bucket: string | undefined;
    if (kind === 'money') {
      const b = await choose('Which jar?', JAR_CHOICES);
      if (!b) return;
      bucket = b;
    }
    call(() => api.post('/bank/convert', { kind, stars: Number(n), bucket, ...(isParent ? { memberId: kid.id } : {}) }));
  }

  async function use(kind: 'screen' | 'money', kid: any, bucket?: string) {
    const n = await ask({ title: kind === 'screen' ? 'Screen time used' : 'Money paid out', message: kind === 'screen' ? `Minutes ${kid.name} used` : `Amount paid to ${kid.name} from ${bucket} (e.g. 2.50)`, numeric: true, okLabel: 'Record' });
    if (!n) return;
    const amount = kind === 'screen' ? Number(n) : Math.round(Number(n) * 100);
    call(() => api.post('/bank/use', { memberId: kid.id, kind, amount, bucket }));
  }

  async function move(kid: any) {
    const from = await choose('Move from which jar?', JAR_CHOICES);
    if (!from) return;
    const to = await choose('Move to which jar?', JAR_CHOICES.filter(j => j.value !== from));
    if (!to) return;
    const amt = await ask({ title: 'How much?', message: 'For example 1.00', numeric: true, okLabel: 'Move' });
    if (!amt) return;
    call(() => api.post('/bank/move', { memberId: isParent ? kid.id : undefined, from, to, amount: Math.round(Number(amt) * 100) }));
  }

  return (
    <ScrollView style={ui.screen} contentContainerStyle={ui.content}
      refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor={C.primary} />}>
      <TouchableOpacity onPress={() => router.back()}><Text style={ui.back}>‹ Back</Text></TouchableOpacity>
      <Text style={ui.h1}>🏦 Star bank</Text>

      {!s.screenEnabled && !s.moneyEnabled ? (
        <View style={ui.card}>
          <Text style={[ui.text, { lineHeight: 20 }]}>
            {isParent
              ? 'Let kids turn stars into screen time or allowance. You set the rates and hand over the real thing — FamilyHub just keeps track.'
              : "The star bank isn't switched on yet. Ask a parent to set it up!"}
          </Text>
          {isParent && <TouchableOpacity style={[ui.btn, { marginTop: 12 }]} onPress={editRates} disabled={busy}><Text style={ui.btnText}>Set up the bank</Text></TouchableOpacity>}
        </View>
      ) : (
        <>
          <View style={[ui.row, { justifyContent: 'space-between', marginBottom: 10 }]}>
            <Text style={ui.muted}>
              {s.screenEnabled ? `1⭐ = ${s.screenMinutesPerStar} min` : ''}{s.screenEnabled && s.moneyEnabled ? '  ·  ' : ''}{s.moneyEnabled ? `1⭐ = ${money(s.centsPerStar, s.currency)}` : ''}
            </Text>
            {isParent && <TouchableOpacity style={ui.ghost} onPress={editRates} disabled={busy}><Text style={ui.ghostText}>Rates</Text></TouchableOpacity>}
          </View>

          {(data.members as any[]).map(k => (
            <View key={k.id} style={ui.card}>
              <Text style={[ui.text, { fontWeight: '900', fontSize: 16, marginBottom: 10 }]}>{k.emoji} {k.name} <Text style={ui.muted}>· {k.stars}⭐ to spend</Text></Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {s.screenEnabled && (
                  <View style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: 'rgba(96,165,250,0.1)', borderRadius: 12, padding: 10 }}>
                    <Text style={ui.muted}>📺 Screen time</Text>
                    <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{mins(k.screenMinutes)}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      <TouchableOpacity style={ui.ghost} disabled={busy} onPress={() => convert('screen', k)}><Text style={[ui.ghostText, { fontSize: 11 }]}>+ Add stars</Text></TouchableOpacity>
                      {isParent && k.screenMinutes > 0 && <TouchableOpacity style={ui.ghost} disabled={busy} onPress={() => use('screen', k)}><Text style={[ui.ghostText, { fontSize: 11 }]}>Used</Text></TouchableOpacity>}
                    </View>
                  </View>
                )}
                {s.moneyEnabled && JARS.map(j => (
                  <View key={j.key} style={{ flexBasis: '47%', flexGrow: 1, backgroundColor: 'rgba(74,222,128,0.1)', borderRadius: 12, padding: 10 }}>
                    <Text style={ui.muted}>{j.icon} {j.label}</Text>
                    <Text style={{ color: C.text, fontSize: 20, fontWeight: '900' }}>{money(k.money?.[j.key] || 0, s.currency)}</Text>
                    <View style={{ flexDirection: 'row', gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
                      {j.key === 'spend' && <TouchableOpacity style={ui.ghost} disabled={busy} onPress={() => convert('money', k)}><Text style={[ui.ghostText, { fontSize: 11 }]}>+ Add stars</Text></TouchableOpacity>}
                      {isParent && (k.money?.[j.key] || 0) > 0 && <TouchableOpacity style={ui.ghost} disabled={busy} onPress={() => use('money', k, j.key)}><Text style={[ui.ghostText, { fontSize: 11 }]}>Paid out</Text></TouchableOpacity>}
                    </View>
                  </View>
                ))}
              </View>
              {s.moneyEnabled && (
                <TouchableOpacity style={[ui.ghost, { marginTop: 8, alignSelf: 'flex-start' }]} disabled={busy} onPress={() => move(k)}>
                  <Text style={[ui.ghostText, { fontSize: 11 }]}>Move between jars</Text>
                </TouchableOpacity>
              )}
            </View>
          ))}
          <Text style={[ui.muted, { fontSize: 11 }]}>FamilyHub keeps the record; a parent gives the real screen time or money.</Text>
        </>
      )}
    </ScrollView>
  );
}
