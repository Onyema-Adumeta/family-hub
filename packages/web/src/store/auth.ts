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
    (set, get) => ({
      token: null,
      member: null,
      family: null,
      setAuth: (token, member, family) => set({ token, member, family }),
      setMember: (member) => set({ member }),
      logout: () => {
        const token=get().token;
        // Stop the old account receiving pushes on a shared browser after sign-out.
        if('serviceWorker' in navigator) navigator.serviceWorker.getRegistration().then(async reg=>{
          const sub=await reg?.pushManager.getSubscription();
          if(!sub)return;
          await sub.unsubscribe();
          if(token) await fetch((import.meta.env.VITE_API_URL || '')+'/api/notifications/web-push/unsubscribe',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify({endpoint:sub.endpoint}),keepalive:true});
        }).catch(()=>{});
        set({ token: null, member: null, family: null });
      },
    }),
    { name: 'family-hub-auth' }
  )
);
