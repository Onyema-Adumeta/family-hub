import { create } from 'zustand';
import * as SecureStore from 'expo-secure-store';
import type { Member, Family } from '@family-hub/shared';

interface AuthState {
  token: string | null;
  member: Member | null;
  family: Family | null;
  setAuth: (token: string, member: Member, family: Family) => void;
  logout: () => void;
  loadFromStorage: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set) => ({
  token: null,
  member: null,
  family: null,

  setAuth: async (token, member, family) => {
    await SecureStore.setItemAsync('token', token);
    await SecureStore.setItemAsync('member', JSON.stringify(member));
    await SecureStore.setItemAsync('family', JSON.stringify(family));
    set({ token, member, family });
  },

  logout: async () => {
    await SecureStore.deleteItemAsync('token');
    await SecureStore.deleteItemAsync('member');
    await SecureStore.deleteItemAsync('family');
    set({ token: null, member: null, family: null });
  },

  loadFromStorage: async () => {
    try {
      const token = await SecureStore.getItemAsync('token');
      const memberStr = await SecureStore.getItemAsync('member');
      const familyStr = await SecureStore.getItemAsync('family');
      if (token && memberStr && familyStr) {
        set({ token, member: JSON.parse(memberStr), family: JSON.parse(familyStr) });
      }
    } catch { /* ignore */ }
  }
}));
