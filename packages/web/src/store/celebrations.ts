import { create } from 'zustand';

export type Celebration = {
  memberId: string;
  name: string;
  badges: { code: string; label: string; icon: string }[];
  levelUp: { level: number; title: string } | null;
};

type State = { queue: Celebration[]; push: (c: Celebration[] | undefined) => void; shift: () => void };

/** Badges and level-ups waiting to be shown on screen. */
export const useCelebrations = create<State>((set) => ({
  queue: [],
  push: (c) => { if (c?.length) set(s => ({ queue: [...s.queue, ...c.filter(x => !s.queue.some(q => q.memberId === x.memberId && JSON.stringify(q) === JSON.stringify(x)))] })); },
  shift: () => set(s => ({ queue: s.queue.slice(1) })),
}));
