import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { familySocket } from '../lib/socket';

// Subscribe to the shared authenticated socket; do not open a second connection.
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => familySocket.subscribe((msg: { type?: string }) => {
    if (typeof msg?.type !== 'string') return;
    if (msg.type.startsWith('chore:') || msg.type.startsWith('chores:')) qc.invalidateQueries({ queryKey: ['chores'] });
    if (msg.type.startsWith('event:') || msg.type.startsWith('events:')) qc.invalidateQueries({ queryKey: ['events'] });
    if (msg.type.startsWith('message:')) qc.invalidateQueries({ queryKey: ['messages'] });
  }), [qc]);
}
