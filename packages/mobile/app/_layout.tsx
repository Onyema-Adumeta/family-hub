import { useEffect } from 'react';
import { Stack, router } from 'expo-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { StatusBar } from 'expo-status-bar';
import { useAuthStore } from './store/auth';
import { api } from './lib/api';
import { familySocket } from './lib/socket';

// Boot WebSocket on app load
const token = useAuthStore.getState().token;
if (token) familySocket.connect();
useAuthStore.subscribe((state) => {
  if (state.token) familySocket.connect();
  else familySocket.disconnect();
});

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } }
});

export default function RootLayout() {
  const { token, loadFromStorage } = useAuthStore();

  useEffect(() => {
    // Restore the saved sign-in, then renew it (sign-ins last 14 days).
    loadFromStorage().then(async () => {
      const { token: saved, family, setAuth } = useAuthStore.getState();
      if (!saved || !family) return;
      try {
        const { data } = await api.post('/auth/refresh');
        if (data?.token && data?.member) await setAuth(data.token, data.member, family);
      } catch { /* offline, or signed out (the api interceptor logs out on 401) */ }
    });
  }, []);

  useEffect(() => {
    if (token === null) {
      router.replace('/login');
    } else if (token) {
      router.replace('/(tabs)');
    }
  }, [token]);

  return (
    <QueryClientProvider client={queryClient}>
      <StatusBar style="light" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: '#0f0f13' } }}>
        <Stack.Screen name="login" />
        <Stack.Screen name="register" />
        <Stack.Screen name="join" />
        <Stack.Screen name="(tabs)" />
      </Stack>
    </QueryClientProvider>
  );
}