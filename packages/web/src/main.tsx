import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import './index.css';
import { familySocket } from './lib/socket';
import { useAuthStore } from './store/auth';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 0 } }
});

// Connect socket when token exists on app load
const token = useAuthStore.getState().token;
if (token) familySocket.connect();

// Reconnect when auth state changes
useAuthStore.subscribe((state) => {
  if (state.token) familySocket.connect();
  else familySocket.disconnect();
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>
);
