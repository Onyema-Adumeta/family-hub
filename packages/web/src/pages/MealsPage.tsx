import { useState } from 'react';
import { useMeals, useCreateMeal, useUpdateMeal, useDeleteMeal, useMembers } from '../hooks/useApi';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SLOTS = ['breakfast','lunch','dinner','snack'] as const;
const SLOT_EMOJI = { breakfast: 'ðŸŒ…', lunch: 'â˜€ï¸', dinner: 'ðŸŒ™', snack: 'ðŸŽ' };
const MEAL_EMOJIS = ['ðŸ•','ðŸŒ®','ðŸ¥˜','ðŸ','ðŸ¥©','ðŸ£','ðŸ¥—','ðŸœ','ðŸŒ¯','ðŸ”','ðŸ›','ðŸ¥ž','ðŸ—','ðŸ¥‘','ðŸ±'];

function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(d.setDate(diff));
  return monday.toISOString().split('T')[0];
}

export default function MealsPage() {
  const week = getWeekStart();
  const { data: meals = [], isLoading } = useMeals(week);
  const { data: members = [] } = useMembers();
  const createMeal = useCreateMeal();
  const updateMeal = useUpdateMeal();
  const deleteMeal = useDeleteMeal();

  const [showAdd, setShowAdd] = useState(false);
  const [newMeal, setNewMeal] = useState({ day: 'Monday', slot: 'dinner' as const, name: '', emoji: 'ðŸ•', notes: '', assignedToId: '' });
  const [viewSlot, setViewSlot] = useState<string>('dinner');

  const mealGrid: Record<string, Record<string, any>> = {};
  DAYS.forEach(d => { mealGrid[d] = {}; });
  (meals as any[]).forEach(m => { if (mealGrid[m.day]) mealGrid[m.day][m.slot] = m; });

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>;

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>ðŸ½ï¸ Meals</h1>
        <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize: 13 }}>+ Add meal</button>
      </div>

      {/* Slot filter */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {SLOTS.map(s => (
          <button key={s} onClick={() => setViewSlot(s)} style={{
            padding: '6px 12px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: viewSlot === s ? 'var(--primary)' : 'var(--bg-secondary)',
            color: viewSlot === s ? '#fff' : 'var(--text-secondary)',
            border: `1.5px solid ${viewSlot === s ? 'var(--primary)' : 'var(--border)'}`
          }}>
            {SLOT_EMOJI[s]} {s}
          </button>
        ))}
      </div>

      {/* Day grid */}
      {DAYS.map(day => {
        const meal = mealGrid[day][viewSlot];
        const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }) === day;
        return (
          <div key={day} className="card" style={{ marginBottom: 8, borderColor: isToday ? 'rgba(99,102,241,0.4)' : 'var(--border)', background: isToday ? 'rgba(99,102,241,0.04)' : 'var(--bg-secondary)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={{ minWidth: 80 }}>
                <div style={{ fontWeight: 900, fontSize: 13 }}>{day}</div>
                {isToday && <div style={{ fontSize: 10, color: 'var(--primary)', fontWeight: 800 }}>TODAY</div>}
              </div>

              {meal ? (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 22 }}>{meal.emoji}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 800, fontSize: 14 }}>{meal.name}</div>
                    {meal.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 600 }}>{meal.notes}</div>}
                    {meal.assignedTo && <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>ðŸ‘¨â€ðŸ³ {meal.assignedTo.emoji} {meal.assignedTo.name}</div>}
                  </div>
                  <button onClick={() => { if (confirm('Remove meal?')) deleteMeal.mutate(meal.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 14 }}>âœ•</button>
                </div>
              ) : (
                <button onClick={() => { setNewMeal(p => ({ ...p, day, slot: viewSlot as any })); setShowAdd(true); }} style={{
                  flex: 1, padding: '8px', borderRadius: 8, border: '1.5px dashed var(--border)', background: 'transparent',
                  color: 'var(--text-muted)', fontSize: 12, fontWeight: 700, cursor: 'pointer', textAlign: 'left'
                }}>+ Add {viewSlot}</button>
              )}
            </div>
          </div>
        );
      })}

      {/* Add modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>âž• Add Meal</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {MEAL_EMOJIS.map(e => (
                  <button type="button" key={e} onClick={() => setNewMeal(p => ({ ...p, emoji: e }))} style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: 8, border: `2px solid ${newMeal.emoji === e ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'var(--bg-secondary)', cursor: 'pointer'
                  }}>{e}</button>
                ))}
              </div>

              <div className="grid-2">
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Day</label>
                  <select className="input" style={{ background: "#1E1A2E", color: "#EEEAF8" }} value={newMeal.day} onChange={e => setNewMeal(p => ({ ...p, day: e.target.value }))}>
                    {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Meal</label>
                  <select className="input" style={{ background: "#1E1A2E", color: "#EEEAF8" }} value={newMeal.slot} onChange={e => setNewMeal(p => ({ ...p, slot: e.target.value as any }))}>
                    {SLOTS.map(s => <option key={s} value={s}>{SLOT_EMOJI[s]} {s}</option>)}
                  </select>
                </div>
              </div>

              <input className="input" placeholder="Meal name e.g. Pasta Bolognese" value={newMeal.name} onChange={e => setNewMeal(p => ({ ...p, name: e.target.value }))} autoFocus />
              <input className="input" placeholder="Notes (optional)" value={newMeal.notes} onChange={e => setNewMeal(p => ({ ...p, notes: e.target.value }))} />

              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>Who's cooking?</label>
                <select className="input" style={{ background: "#1E1A2E", color: "#EEEAF8" }} value={newMeal.assignedToId} onChange={e => setNewMeal(p => ({ ...p, assignedToId: e.target.value }))}>
                  <option value="">Anyone</option>
                  {(members as any[]).map((m: any) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
                </select>
              </div>

              <div className="flex gap-3">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={!newMeal.name.trim() || createMeal.isPending}
                  onClick={() => { createMeal.mutate({ ...newMeal, week, assignedToId: newMeal.assignedToId || undefined }); setShowAdd(false); }}>
                  {createMeal.isPending ? 'Adding...' : '+ Add Meal'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

