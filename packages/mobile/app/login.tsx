import { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router, Link } from 'expo-router';
import { api } from './lib/api';
import { useAuthStore } from './store/auth';
import { openWeb } from './lib/theme';

export default function LoginScreen() {
  const [familyCode, setFamilyCode] = useState('');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [email, setEmail] = useState('');
  const [mode, setMode] = useState<'code' | 'email'>('code');
  const [loading, setLoading] = useState(false);
  const { setAuth } = useAuthStore();

  async function handleLogin() {
    const ready = mode === 'email' ? email.trim() && password : familyCode && name && password;
    if (!ready) { Alert.alert('Missing fields', 'Please fill all fields'); return; }
    setLoading(true);
    try {
      const body = mode === 'email'
        ? { email: email.trim(), password }
        : { familyCode: familyCode.toUpperCase(), name, password };
      const { data } = await api.post('/auth/login', body);
      if (data.passwordCreated) Alert.alert('Password saved', 'Your password is now set. Use it every time you sign in.');
      if (data.passwordTooShort) Alert.alert('Please choose a longer password', 'Parent accounts now need at least 8 characters. Your current password still works — change it in Settings.');
      await setAuth(data.token, data.member, data.family);
      router.replace('/(tabs)');
    } catch (err: any) {
      Alert.alert('Login failed', err.response?.data?.error || 'Check your details');
    } finally { setLoading(false); }
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <Text style={styles.logo}>Kinroost</Text>
        <Text style={styles.subtitle}>Welcome back! 👋</Text>

        <View style={styles.form}>
          <View style={styles.tabs}>
            {(['code', 'email'] as const).map(m => (
              <TouchableOpacity key={m} style={[styles.tab, mode === m && styles.tabActive]} onPress={() => setMode(m)} accessibilityRole="tab" accessibilityState={{ selected: mode === m }}>
                <Text style={[styles.tabText, mode === m && { color: '#fff' }]}>{m === 'code' ? 'Family code + name' : 'Email (parents)'}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {mode === 'code' ? (
            <>
              <Text style={styles.label}>Family Code</Text>
              <TextInput style={styles.input} placeholder="FAM-XXXXXX" placeholderTextColor="#666" value={familyCode} onChangeText={setFamilyCode} autoCapitalize="characters" />

              <Text style={styles.label}>Your Name</Text>
              <TextInput style={styles.input} placeholder="Alex" placeholderTextColor="#666" value={name} onChangeText={setName} />
            </>
          ) : (
            <>
              <Text style={styles.label}>Email</Text>
              <TextInput style={styles.input} placeholder="you@example.com" placeholderTextColor="#666" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" />
            </>
          )}

          <Text style={styles.label}>{mode === 'code' ? 'Password or PIN' : 'Password'}</Text>
          <TextInput style={styles.input} placeholder="••••••" placeholderTextColor="#666" secureTextEntry value={password} onChangeText={setPassword} />

          <TouchableOpacity style={[styles.btn, loading && styles.btnDisabled]} onPress={handleLogin} disabled={loading}>
            <Text style={styles.btnText}>{loading ? 'Signing in...' : 'Sign in →'}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openWeb('/forgot-password')} style={{ alignItems: 'center', padding: 8 }}>
            <Text style={{ color: 'rgba(240,240,245,0.6)', fontWeight: '700', fontSize: 13 }}>Forgot password? (parents)</Text>
          </TouchableOpacity>
          <Text style={{ color: 'rgba(240,240,245,0.4)', fontSize: 11, textAlign: 'center' }}>Kids: first time, type the PIN you want. Forgot it? Ask a parent to tap “Let them choose a new PIN”.</Text>
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
  tabs: { flexDirection: 'row', backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 10, padding: 4, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', marginBottom: 6 },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  tabActive: { backgroundColor: '#6366F1' },
  tabText: { fontSize: 12, fontWeight: '800', color: 'rgba(240,240,245,0.5)' },
  label: { fontSize: 12, fontWeight: '800', color: 'rgba(240,240,245,0.6)', marginBottom: 4, marginTop: 4 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 14, fontWeight: '600' },
  btn: { backgroundColor: '#6366F1', borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 8 },
  btnDisabled: { opacity: 0.5 },
  btnText: { color: '#fff', fontSize: 15, fontWeight: '800' },
  links: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 8, marginTop: 24 },
  link: { color: '#6366F1', fontWeight: '800', fontSize: 13 },
  dot: { color: 'rgba(240,240,245,0.3)', fontSize: 13 },
});
