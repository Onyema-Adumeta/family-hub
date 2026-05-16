import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

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
  return useMutation({ mutationFn: (data: any) => api.post('/chores', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['chores'] }) });
}
export function useUpdateChore() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/chores/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['chores', 'members'] }) });
}
export function useDeleteChore() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/chores/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['chores'] }) });
}

// ── Meals ─────────────────────────────────────────────────────
export function useMeals(week?: string) {
  return useQuery({ queryKey: ['meals', week], queryFn: () => api.get('/meals', { params: { week } }).then(r => r.data) });
}
export function useUpdateMeal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/meals/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['meals'] }) });
}
export function useCreateMeal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => api.post('/meals', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['meals'] }) });
}
export function useDeleteMeal() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/meals/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['meals'] }) });
}

// ── Events ─────────────────────────────────────────────────────
export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => api.get('/events').then(r => r.data) });
}
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => api.post('/events', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }) });
}
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/events/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }) });
}

// ── Rewards ───────────────────────────────────────────────────
export function useRewards() {
  return useQuery({ queryKey: ['rewards'], queryFn: () => api.get('/rewards').then(r => r.data) });
}
export function useRedemptions() {
  return useQuery({ queryKey: ['redemptions'], queryFn: () => api.get('/rewards/redemptions').then(r => r.data) });
}
export function useCreateReward() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => api.post('/rewards', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards'] }) });
}
export function useDeleteReward() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/rewards/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['rewards'] }) });
}
export function useRedeemReward() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (rewardId: string) => api.post(`/rewards/redeem/${rewardId}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['redemptions', 'members'] }) });
}

// ── Chat ──────────────────────────────────────────────────────
export function useMessages() {
  return useQuery({ queryKey: ['messages'], queryFn: () => api.get('/chat').then(r => r.data), refetchInterval: 5000 });
}
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => api.post('/chat', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['messages'] }) });
}

// ── Notifications ─────────────────────────────────────────────
export function useNotifications() {
  return useQuery({ queryKey: ['notifications'], queryFn: () => api.get('/notifications').then(r => r.data), refetchInterval: 30000 });
}
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.patch(`/notifications/${id}/read`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}
export function useMarkAllRead() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: () => api.patch('/notifications/read-all').then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['notifications'] }) });
}

// ── Quests ────────────────────────────────────────────────────
export function useQuests() {
  return useQuery({ queryKey: ['quests'], queryFn: () => api.get('/quests').then(r => r.data) });
}
export function useCreateQuest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (data: any) => api.post('/quests', data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }) });
}
export function useUpdateQuest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/quests/${id}`, data).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }) });
}
export function useDeleteQuest() {
  const qc = useQueryClient();
  return useMutation({ mutationFn: (id: string) => api.delete(`/quests/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }) });
}

// ── Report ────────────────────────────────────────────────────
export function useWeeklyReport() {
  return useQuery({ queryKey: ['report'], queryFn: () => api.get('/report/weekly').then(r => r.data), staleTime: 5 * 60_000 });
}

// ── Add these to the bottom of src/hooks/useApi.ts ────────────────────────

// useCompleteQuest — called by QuestsPage
export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/quests/${id}/complete`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests', 'members'] }),
  });
}

// useChat — alias for useMessages, called by ChatPage
export function useChat() {
  return useQuery({
    queryKey: ['messages'],
    queryFn: () => api.get('/chat').then(r => r.data),
    refetchInterval: 5000,
  });
}