import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

// ── Helper: simple toast without importing context (avoids circular deps) ────
function toast(msg: string, type: 'success' | 'error' | 'info' = 'success') {
  const el = document.createElement('div');
  const colors: Record<string, string> = {
    success: '#4ADE80', error: '#F87171', info: '#60A5FA',
  };
  Object.assign(el.style, {
    position: 'fixed', bottom: '80px', left: '50%',
    transform: 'translateX(-50%)',
    background: '#1E1E2E', border: `1.5px solid ${colors[type]}`,
    color: colors[type], borderRadius: '12px',
    padding: '10px 20px', fontWeight: '700', fontSize: '14px',
    zIndex: '9999', boxShadow: '0 4px 24px rgba(0,0,0,0.4)',
    transition: 'opacity 0.3s', whiteSpace: 'nowrap',
  });
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 2800);
}

// ── Members ────────────────────────────────────────────────────
export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data) });
}

// ── Chores ────────────────────────────────────────────────────
export function useChores() {
  return useQuery({ queryKey: ['chores'], queryFn: () => api.get('/chores').then(r => r.data) });
}
export function useCreateChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/chores', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chores'] }); toast('Chore added! 🧹'); },
    onError:   () => toast('Failed to add chore', 'error'),
  });
}
export function useUpdateChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/chores/${id}`, data).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['chores'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      if (vars.data?.status === 'done') toast('Chore done! ⭐ Stars earned!');
      else if (vars.data?.status === 'in_progress') toast('Chore started 🔥');
      else if (vars.data?.status === 'pending') toast('Chore reset ↩');
    },
    onError: () => toast('Failed to update chore', 'error'),
  });
}
export function useDeleteChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/chores/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['chores'] }); toast('Chore removed', 'info'); },
    onError:   () => toast('Failed to delete chore', 'error'),
  });
}

// ── Meals ─────────────────────────────────────────────────────
export function useMeals(week?: string) {
  return useQuery({ queryKey: ['meals', week], queryFn: () => api.get('/meals', { params: { week } }).then(r => r.data) });
}
export function useCreateMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/meals', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meals'] }); toast('Meal planned! 🍽️'); },
    onError:   () => toast('Failed to add meal', 'error'),
  });
}
export function useUpdateMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/meals/${id}`, data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meals'] }); toast('Meal updated! 🍽️'); },
    onError:   () => toast('Failed to update meal', 'error'),
  });
}
export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/meals/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['meals'] }); toast('Meal removed', 'info'); },
    onError:   () => toast('Failed to delete meal', 'error'),
  });
}

// ── Events ─────────────────────────────────────────────────────
export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => api.get('/events').then(r => r.data) });
}
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/events', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast('Event added! 📅'); },
    onError:   () => toast('Failed to add event', 'error'),
  });
}
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['events'] }); toast('Event removed', 'info'); },
    onError:   () => toast('Failed to delete event', 'error'),
  });
}

// ── Rewards ───────────────────────────────────────────────────
export function useRewards() {
  return useQuery({ queryKey: ['rewards'], queryFn: () => api.get('/rewards').then(r => r.data) });
}
export function useRedemptions() {
  return useQuery({
    queryKey: ['redemptions'],
    queryFn: () => api.get('/rewards/redemptions').then(r => r.data),
    refetchInterval: 15000, // poll for new redemptions
  });
}
export function useCreateReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/rewards', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rewards'] }); toast('Reward created! 🎁'); },
    onError:   () => toast('Failed to create reward', 'error'),
  });
}
export function useDeleteReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/rewards/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['rewards'] }); toast('Reward removed', 'info'); },
    onError:   () => toast('Failed to delete reward', 'error'),
  });
}
export function useRedeemReward() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (rewardId: string) => api.post(`/rewards/redeem/${rewardId}`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['redemptions'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      toast('Reward requested! ⏳ Waiting for parent approval');
    },
    onError: (e: any) => toast(e.response?.data?.error || 'Failed to redeem', 'error'),
  });
}
// NEW: parent approves/rejects a redemption
export function useApproveRedemption() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approved }: { id: string; approved: boolean }) =>
      api.patch(`/rewards/redemptions/${id}`, { approved }).then(r => r.data),
    onSuccess: (_, vars) => {
      qc.invalidateQueries({ queryKey: ['redemptions'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      toast(vars.approved ? '✅ Reward approved!' : '❌ Reward rejected', vars.approved ? 'success' : 'info');
    },
    onError: () => toast('Failed to update redemption', 'error'),
  });
}

// ── Chat ──────────────────────────────────────────────────────
export function useMessages() {
  return useQuery({ queryKey: ['messages'], queryFn: () => api.get('/chat').then(r => r.data), refetchInterval: 5000 });
}
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/chat', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }),
    onError:   () => toast('Failed to send message', 'error'),
  });
}
export function useChat() {
  return useQuery({ queryKey: ['messages'], queryFn: () => api.get('/chat').then(r => r.data), refetchInterval: 5000 });
}

// ── Notifications ─────────────────────────────────────────────
export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications').then(r => r.data), refetchInterval: 30000 });
}
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => api.patch('/notifications/read-all').then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }),
  });
}

// ── Quests ────────────────────────────────────────────────────
export function useQuests() {
  return useQuery({ queryKey: ['quests'], queryFn: () => api.get('/quests').then(r => r.data) });
}
export function useCreateQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/quests', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quests'] }); toast('Quest created! ⚔️'); },
    onError:   () => toast('Failed to create quest', 'error'),
  });
}
export function useUpdateQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/quests/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });
}
export function useDeleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/quests/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['quests'] }); toast('Quest removed', 'info'); },
    onError:   () => toast('Failed to delete quest', 'error'),
  });
}
export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/quests/${id}/complete`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quests'] });
      qc.invalidateQueries({ queryKey: ['members'] });
      toast('Quest complete! 🏆 Stars earned!');
    },
    onError: () => toast('Failed to complete quest', 'error'),
  });
}

// ── Report ────────────────────────────────────────────────────
export function useWeeklyReport() {
  return useQuery({ queryKey: ['report'], queryFn: () => api.get('/report/weekly').then(r => r.data), staleTime: 5 * 60_000 });
}

// ── Grocery ───────────────────────────────────────────────────
export function useGrocery() {
  return useQuery({ queryKey: ['grocery'], queryFn: () => api.get('/grocery').then(r => r.data) });
}
export function useCreateGroceryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/grocery', data).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grocery'] }); toast('Item added! 🛒'); },
    onError:   () => toast('Failed to add item', 'error'),
  });
}
export function useUpdateGroceryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/grocery/${id}`, data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['grocery'] }),
    onError:   () => toast('Failed to update item', 'error'),
  });
}
export function useDeleteGroceryItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/grocery/${id}`).then(r => r.data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['grocery'] }); toast('Item removed', 'info'); },
    onError:   () => toast('Failed to remove item', 'error'),
  });
}