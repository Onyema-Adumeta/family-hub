import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { familySocket } from '../lib/socket';
import { useCelebrations } from '../store/celebrations';
import { useAuthStore } from '../store/auth';

/** Keeps screens fresh when someone else in the family changes something. */
export function useRealtime() {
  const qc = useQueryClient();
  useEffect(() => {
    const off = familySocket.subscribe((msg: { type?: string; celebrations?: any[] }) => {
      if (typeof msg?.type !== 'string') return;
      const t = msg.type;
      const refresh = (...keys: string[]) => keys.forEach(k => qc.invalidateQueries({ queryKey: [k] }));
      if (t.startsWith('chore:') || t.startsWith('chores:')) refresh('chores');
      if (t.startsWith('event:') || t.startsWith('events:')) refresh('events', 'briefing');
      if (t.startsWith('bank:')) refresh('bank', 'members');
      if (t.startsWith('reward:') || t.startsWith('redemption:')) refresh('rewards', 'briefing');
      if (t.startsWith('grocery:')) refresh('grocery');
      if (t.startsWith('chore:') || t.startsWith('goal:') || t === 'celebration') {
        refresh('briefing', 'goal', 'approvals', 'members', 'fairness', 'recommendations');
      }
      // My own badges from someone else's action (e.g. a parent approving my photo).
      if (t === 'celebration') {
        const me = useAuthStore.getState().member?.id;
        const mine = (msg.celebrations || []).filter((c: any) => c.memberId === me);
        if (mine.length) useCelebrations.getState().push(mine);
      }
    });
    return () => { off(); };
  }, [qc]);
}
