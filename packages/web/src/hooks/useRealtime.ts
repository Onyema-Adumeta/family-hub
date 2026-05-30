import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';

export function useRealtime() {
  const token = useAuthStore(s => s.token);
  const qc = useQueryClient();
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;

    const wsUrl = import.meta.env.VITE_WS_URL || `${location.protocol === 'https:' ? 'wss' : 'ws'}://${location.host}`;
    const ws = new WebSocket(`${wsUrl}?token=${token}`);
    wsRef.current = ws;

    ws.onmessage = (e) => {
      try {
        const msg = JSON.parse(e.data);
        if (msg.type?.startsWith('chore:')) qc.invalidateQueries({ queryKey: ['chores'] });
        if (msg.type?.startsWith('event:')) qc.invalidateQueries({ queryKey: ['events'] });
        if (msg.type === 'message:new') qc.invalidateQueries({ queryKey: ['messages'] });
      } catch { /* ignore */ }
    };

    return () => ws.close();
  }, [token, qc]);

  return wsRef;
}