import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

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