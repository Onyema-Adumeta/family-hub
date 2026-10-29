import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { familySocket } from '../lib/socket';
import { useCelebrations } from '../store/celebrations';
import { useAuthStore } from '../store/auth';

// Subscribe to the shared authenticated socket; do not open a second connection.
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => familySocket.subscribe((msg: { type?: string }) => {
    if (typeof msg?.type !== 'string') return;
    if (msg.type.startsWith('chore:') || msg.type.startsWith('chores:')) qc.invalidateQueries({ queryKey: ['chores'] });
    if (msg.type.startsWith('event:') || msg.type.startsWith('events:')) qc.invalidateQueries({ queryKey: ['events'] });
    if (msg.type.startsWith('message:')) qc.invalidateQueries({ queryKey: ['messages'] });
    if (msg.type.startsWith('chore:') || msg.type.startsWith('goal:') || msg.type === 'celebration') {
      ['briefing', 'goal', 'approvals', 'members', 'fairness', 'recommendations'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));
    }
    // Celebrate on this screen when it's about me (my own device shows it from the API reply already).
    if (msg.type === 'celebration') {
      const me = useAuthStore.getState().member?.id;
      const mine = ((msg as any).celebrations || []).filter((c: any) => c.memberId === me);
      if (mine.length) useCelebrations.getState().push(mine);
    }
  }), [qc]);
}
