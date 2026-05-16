// Mobile Meals Screen
import { ScrollView, View, Text, StyleSheet, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { api } from '../lib/api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SLOTS = ['breakfast','lunch','dinner','snack'] as const;
const SLOT_EMOJI: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const MEAL_EMOJIS = ['🍕','🌮','🥘','🍝','🥩','🍣','🥗','🍜','🌯','🍔','🍛','🥞'];

function getWeekStart() {
  const d = new Date(); const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}

export default function MealsScreen() {
  const week = getWeekStart();
  const qc = useQueryClient();
  const { data: meals = [] } = useQuery({ queryKey: ['meals', week], queryFn: () => api.get('/meals', { params: { week } }).then(r => r.data) });
  const createMeal = useMutation({ mutationFn: (data: any) => api.post('/meals', data).then(r => r.data), onSuccess: () => { qc.invalidateQueries({ queryKey: ['meals'] }); setShowAdd(false); } });
  const deleteMeal = useMutation({ mutationFn: (id: string) => api.delete(`/meals/${id}`).then(r => r.data), onSuccess: () => qc.invalidateQueries({ queryKey: ['meals'] }) });

  const [slot, setSlot] = useState<string>('dinner');
  const [showAdd, setShowAdd] = useState(false);
  const [newMeal, setNewMeal] = useState({ day: 'Monday', slot: 'dinner', name: '', emoji: '🍕' });

  const mealGrid: Record<string, Record<string, any>> = {};
  DAYS.forEach(d => { mealGrid[d] = {}; });
  (meals as any[]).forEach((m: any) => { if (mealGrid[m.day]) mealGrid[m.day][m.slot] = m; });
  const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });

  return (
    <View style={s.container}>
      <Text style={s.title}>🍽️ Meals</Text>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ maxHeight: 44, marginBottom: 12 }}>
        <View style={{ flexDirection: 'row', gap: 6, paddingHorizontal: 16 }}>
          {SLOTS.map(sl => (
            <TouchableOpacity key={sl} onPress={() => setSlot(sl)} style={[s.chip, slot === sl && s.chipActive]}>
              <Text style={[s.chipText, slot === sl && { color: '#fff' }]}>{SLOT_EMOJI[sl]} {sl}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </ScrollView>

      <ScrollView contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 32 }}>
        {DAYS.map(day => {
          const meal = mealGrid[day][slot];
          const isToday = day === today;
          return (
            <View key={day} style={[s.dayCard, isToday && s.dayCardToday]}>
              <View style={{ minWidth: 72 }}>
                <Text style={s.dayName}>{day.slice(0,3)}</Text>
                {isToday && <Text style={{ fontSize: 9, color: '#6366F1', fontWeight: '800' }}>TODAY</Text>}
              </View>
              {meal ? (
                <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 20 }}>{meal.emoji}</Text>
                  <Text style={{ flex: 1, color: '#f0f0f5', fontWeight: '700', fontSize: 13 }}>{meal.name}</Text>
                  <TouchableOpacity onPress={() => { Alert.alert('Remove?', meal.name, [{ text: 'Cancel' }, { text: 'Remove', onPress: () => deleteMeal.mutate(meal.id) }]); }}>
                    <Text style={{ color: 'rgba(240,240,245,0.3)', fontSize: 16 }}>✕</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <TouchableOpacity style={s.addMealBtn} onPress={() => { setNewMeal(p => ({ ...p, day, slot })); setShowAdd(true); }}>
                  <Text style={{ color: 'rgba(240,240,245,0.3)', fontWeight: '700', fontSize: 12 }}>+ Add {slot}</Text>
                </TouchableOpacity>
              )}
            </View>
          );
        })}
      </ScrollView>

      <Modal visible={showAdd} animationType="slide" transparent onRequestClose={() => setShowAdd(false)}>
        <View style={s.modalOverlay}>
          <View style={s.modal}>
            <Text style={s.modalTitle}>➕ Add Meal</Text>
            <View style={s.emojiRow}>
              {MEAL_EMOJIS.map(e => (
                <TouchableOpacity key={e} onPress={() => setNewMeal(p => ({ ...p, emoji: e }))} style={[s.emojiBtn, newMeal.emoji === e && s.emojiBtnActive]}>
                  <Text style={{ fontSize: 18 }}>{e}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <TextInput style={s.input} placeholder="Meal name" placeholderTextColor="#666" value={newMeal.name} onChangeText={v => setNewMeal(p => ({ ...p, name: v }))} />
            <View style={{ flexDirection: 'row', gap: 8, marginTop: 12 }}>
              <TouchableOpacity style={[s.btn, { backgroundColor: 'rgba(255,255,255,0.08)', flex: 1 }]} onPress={() => setShowAdd(false)}>
                <Text style={{ color: '#f0f0f5', fontWeight: '800' }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.btn, { backgroundColor: '#6366F1', flex: 2 }]} disabled={!newMeal.name.trim()}
                onPress={() => createMeal.mutate({ ...newMeal, week })}>
                <Text style={{ color: '#fff', fontWeight: '800' }}>+ Add</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#0f0f13', paddingTop: 56 },
  title: { fontSize: 22, fontWeight: '900', color: '#f0f0f5', paddingHorizontal: 16, marginBottom: 14 },
  chip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 16, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)' },
  chipActive: { backgroundColor: '#6366F1', borderColor: '#6366F1' },
  chipText: { fontSize: 12, fontWeight: '800', color: 'rgba(240,240,245,0.5)' },
  dayCard: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 12, marginBottom: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)' },
  dayCardToday: { borderColor: 'rgba(99,102,241,0.4)' },
  dayName: { fontSize: 13, fontWeight: '900', color: '#f0f0f5' },
  addMealBtn: { flex: 1, padding: 8, borderRadius: 8, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.06)', borderStyle: 'dashed' },
  modalOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.7)' },
  modal: { backgroundColor: '#1a1a24', borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.1)' },
  modalTitle: { fontSize: 16, fontWeight: '900', color: '#f0f0f5', marginBottom: 14 },
  input: { backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: 12, color: '#f0f0f5', fontSize: 14, fontWeight: '600' },
  emojiRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  emojiBtn: { width: 38, height: 38, borderRadius: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.04)', alignItems: 'center', justifyContent: 'center' },
  emojiBtnActive: { borderColor: '#6366F1' },
  btn: { padding: 13, borderRadius: 10, alignItems: 'center' },
});
