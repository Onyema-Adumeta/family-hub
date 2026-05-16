import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Member, Family } from '@family-hub/shared';

interface AuthState {
  token: string | null;
  member: Member | null;
  family: Family | null;
  setAuth: (token: string, member: Member, family: Family) => void;
  setMember: (member: Member) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      member: null,
      family: null,
      setAuth: (token, member, family) => set({ token, member, family }),
      setMember: (member) => set({ member }),
      logout: () => set({ token: null, member: null, family: null }),
    }),
    { name: 'family-hub-auth' }
  )
);
