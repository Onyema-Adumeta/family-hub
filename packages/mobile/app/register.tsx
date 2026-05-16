import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, Link } from 'expo-router';
import { api } from './lib/api';
import { useAuthStore } from './store/auth';

const EMOJIS = ['👨','👩','🧑','👦','👧','🧒','🦊','🐱','🐶','🐼'];
const COLORS = ['#6366F1','#F472B6','#4ADE80','#F59E0B','#38BDF8','#FB923C'];

export default function RegisterScreen() {
  const [familyName, setFamilyName] = useState('');
  const [name, setName] = useState('');
  const [emoji, setEmoji] = useState('👨');
  const [color, setColor] = useState('#6366F1');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleRegister() {
    if (!familyName || !name || !password) { Alert.alert('Missing fields'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/register', { familyName, name, emoji, color, password });
      await setAuth(data.token, data.member, data.family);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Error', err.response?.data?.error || 'Registration failed');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Create Family</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Family Name</Text>
          <TextInput style={styles.input} placeholder="The Smiths" placeholderTextColor="#666" value={familyName} onChangeText={setFamilyName} />

          <Text style={styles.label}>Your Name</Text>
          <TextInput style={styles.input} placeholder="Alex" placeholderTextColor="#666" value={name} onChangeText={setName} />

          <Text style={styles.label}>Your Emoji</Text>
          <View style={styles.emojiRow}>
            {EMOJIS.map(e => (
              <TouchableOpacity key={e} onPress={() => setEmoji(e)} style={[styles.emojiBtn, emoji === e && styles.emojiBtnActive]}>
                <Text style={{ fontSize: 20 }}>{e}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={styles.label}>Your Color</Text>
          <View style={styles.colorRow}>
            {COLORS.map(c => (
              <TouchableOpacity key={c} onPress={() => setColor(c)} style={[styles.colorDot, { backgroundColor: c }, color === c && styles.colorDotActive]} />
            ))}
          </View>

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="••••••" placeholderTextColor="#666" secureTextEntry value={password} onChangeText={setPassword} />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleRegister} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Creating...' : '🏠 Create Family'}</Text>
          </TouchableOpacity>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 20 }}>
          <Link href="/login"><Text style={{ color: '#6366F1', fontWeight: '800', fontSize: 13 }}>Already have a family? Sign in</Text></Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 28, fontWeight: '900', color: '#A78BFA', textAlign: 'center', marginBottom: 24 },
  form: { gap: 8 },
  label: { fontSize: 12, fontWeight: '800', color: 'rgba(240,240,245,0.6)', marginTop: 4, marginBottom: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 14 },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  emojiBtn: { width: 44, height: 44, borderRadius: 10, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { borderColor: '#6366F1' },
  colorRow: { flexDirection: 'row', gap: 8 },
  colorDot: { width: 32, height: 32, borderRadius: 16, borderWidth: 3, borderColor: 'transparent' },
  colorDotActive: { borderColor: '#fff' },
  btn: { backgroundColor: '#6366F1', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
});
