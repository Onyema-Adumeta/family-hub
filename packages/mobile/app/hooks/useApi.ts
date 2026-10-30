import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { api } from '../lib/api';
import { useCelebrations } from '../store/celebrations';

// Members
export function useMembers() {
  return useQuery({ queryKey: ['members'], queryFn: () => api.get('/members').then(r => r.data) });
}

// Events
export function useEvents() {
  return useQuery({ queryKey: ['events'], queryFn: () => api.get('/events').then(r => r.data) });
}
export function useCreateEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/events', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}
export function useDeleteEvent() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.delete(`/events/${id}`).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['events'] }),
  });
}

// Quests
export function useQuests() {
  return useQuery({ queryKey: ['quests'], queryFn: () => api.get('/quests').then(r => r.data) });
}
export function useCreateQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: any) => api.post('/quests', data).then(r => r.data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
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
    onSuccess: () => qc.invalidateQueries({ queryKey: ['quests'] }),
  });
}
export function useCompleteQuest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => api.post(`/quests/${id}/complete`).then(r => r.data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['quests'] });
      qc.invalidateQueries({ queryKey: ['members'] });
    },
  });
}
// ── Engagement: briefing, goal, approvals, Weekly Wins ───────────────────────

const refreshAfterStars = (qc: ReturnType<typeof useQueryClient>) =>
  ['chores', 'members', 'briefing', 'goal', 'approvals', 'bank'].forEach(k => qc.invalidateQueries({ queryKey: [k] }));

export function useBriefing() {
  return useQuery({ queryKey: ['briefing'], queryFn: () => api.get('/insights/briefing').then(r => r.data), refetchInterval: 60_000 });
}
export function useFamilyGoal() {
  return useQuery({ queryKey: ['goal'], queryFn: () => api.get('/goals').then(r => r.data) });
}
export function useApprovals(enabled: boolean) {
  return useQuery({ queryKey: ['approvals'], queryFn: () => api.get('/chores/awaiting-approval').then(r => r.data), enabled });
}
export function useWins(week?: string) {
  return useQuery({ queryKey: ['wins', week || 'current'], queryFn: () => api.get('/insights/wins', { params: week ? { week } : {} }).then(r => r.data) });
}
export function useFamilySettings() {
  return useQuery({ queryKey: ['family-settings'], queryFn: () => api.get('/family').then(r => r.data) });
}

/** Update a chore (kids: status and proof only). Shows level-ups and badges it earns. */
export function useUpdateChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => api.patch(`/chores/${id}`, data).then(r => r.data),
    onSuccess: (data: any) => {
      refreshAfterStars(qc);
      if (data?.status === 'review') Alert.alert('Sent to a parent 📸', 'They will check your photo and send your stars.');
      useCelebrations.getState().push(data?.celebrations);
    },
    onError: (e: any) => Alert.alert('Could not update chore', e?.response?.data?.error || 'Please try again'),
  });
}

/** Parents approve a photo-proof chore (stars are paid) or send it back with a note. */
export function useReviewChore() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, approve, note }: { id: string; approve: boolean; note?: string }) =>
      api.post(`/chores/${id}/${approve ? 'approve' : 'reject'}`, approve ? {} : { note }).then(r => r.data),
    onSuccess: (data: any) => { refreshAfterStars(qc); useCelebrations.getState().push(data?.celebrations); },
    onError: (e: any) => Alert.alert('Could not save', e?.response?.data?.error || 'Please try again'),
  });
}
