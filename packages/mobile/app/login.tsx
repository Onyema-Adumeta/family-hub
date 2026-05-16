import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, Link } from 'expo-router';
import { api } from './lib/api';
import { useAuthStore } from './store/auth';

export default function LoginScreen() {
  const [familyCode, setFamilyCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleLogin() {
    if (!familyCode || !name || !password) { Alert.alert('Missing fields', 'Please fill all fields'); return; }
    setLoading(true);
    try {
      const { data } = await api.post('/auth/login', { familyCode: familyCode.toUpperCase(), name, password });
      await setAuth(data.token, data.member, data.family);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login failed', err.response?.data?.error || 'Check your details');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Family Hub</Text>
        <Text style={styles.subtitle}>Welcome back! 👋</Text>

        <View style={styles.form}>
          <Text style={styles.label}>Family Code</Text>
          <TextInput style={styles.input} placeholder="FAM-XXXX" placeholderTextColor="#666" value={familyCode} onChangeText={setFamilyCode} autoCapitalize="characters" />

          <Text style={styles.label}>Your Name</Text>
          <TextInput style={styles.input} placeholder="Alex" placeholderTextColor="#666" value={name} onChangeText={setName} />

          <Text style={styles.label}>Password</Text>
          <TextInput style={styles.input} placeholder="••••••" placeholderTextColor="#666" secureTextEntry value={password} onChangeText={setPassword} />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign in →'}</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.links}>
          <Link href="/register"><Text style={styles.link}>Create family</Text></Link>
          <Text style={styles.dot}>·</Text>
          <Link href="/join"><Text style={[styles.link, { color: '#F472B6' }]}>Join with code</Text></Link>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: 24 },
  logo: { fontSize: 36, fontWeight: '900', color: '#A78BFA', textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 14, color: 'rgba(240,240,245,0.5)', textAlign: 'center', fontWeight: '700', marginBottom: 32 },
  form: { gap: 8 },
  label: { fontSize: 12, fontWeight: '800', color: 'rgba(240,240,245,0.6)', marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 14, fontWeight: '600' },
  btn: { backgroundColor: '#6366F1', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  link: { color: '#6366F1', fontWeight: '800', fontSize: 13 },
  dot: { color: 'rgba(240,240,245,0.3)', fontSize: 13 },
});
