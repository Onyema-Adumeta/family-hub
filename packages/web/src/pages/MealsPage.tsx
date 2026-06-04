import { useState } from 'react';
import { useMeals, useCreateMeal, useDeleteMeal, useMembers } from '../hooks/useApi';
import { api } from '../lib/api';

const DAYS = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
const SLOTS = ['breakfast','lunch','dinner','snack'] as const;
const SLOT_EMOJI: Record<string, string> = { breakfast: '🌅', lunch: '☀️', dinner: '🌙', snack: '🍎' };
const MEAL_EMOJIS = ['🍕','🌮','🥘','🍝','🥩','🍣','🥗','🍜','🌯','🍔','🍛','🥞','🍗','🥑','🍱'];

const EMOJI_MAP: Record<string, string> = {
  pizza: '🍕', pasta: '🍝', taco: '🌮', burger: '🍔', salad: '🥗',
  soup: '🍜', sushi: '🍣', curry: '🍛', chicken: '🍗', steak: '🥩',
  rice: '🍱', wrap: '🌯', sandwich: '🥪', fish: '🐟', eggs: '🥚',
  pancake: '🥞', avocado: '🥑', bowl: '🥘',
};

function guessEmoji(name: string): string {
  const lower = name.toLowerCase();
  for (const [word, emoji] of Object.entries(EMOJI_MAP)) {
    if (lower.includes(word)) return emoji;
  }
  return '🍽️';
}

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
  const deleteMeal = useDeleteMeal();

  const [showAdd, setShowAdd] = useState(false);
  const [newMeal, setNewMeal] = useState({
    day: 'Monday',
    slot: 'dinner' as typeof SLOTS[number],
    name: '',
    emoji: '🍕',
    notes: '',
    assignedToId: '',
  });
  const [viewSlot, setViewSlot] = useState<string>('dinner');
  const [aiLoading, setAiLoading] = useState(false);

  // Build grid
  const mealGrid: Record<string, Record<string, any>> = {};
  DAYS.forEach(d => { mealGrid[d] = {}; });
  (meals as any[]).forEach((m: any) => { if (mealGrid[m.day]) mealGrid[m.day][m.slot] = m; });

  function handleAdd() {
    if (!newMeal.name.trim()) return;
    createMeal.mutate({ ...newMeal, week, assignedToId: newMeal.assignedToId || undefined });
    setNewMeal({ day: 'Monday', slot: 'dinner', name: '', emoji: '🍕', notes: '', assignedToId: '' });
    setShowAdd(false);
  }

  async function getAiSuggestions() {
    setAiLoading(true);
    try {
      const res = await api.post('/ai', {
        messages: [{
          role: 'user',
          content: `Suggest 7 family-friendly ${viewSlot} ideas, one for each day of the week. Format as a numbered list:\n1. Meal Name - short description\n...Keep it simple and kid-friendly.`
        }]
      });
      const text = res.data?.message || '';
      const lines = text.split('\n').filter((l: string) => /^\d+/.test(l.trim()));
      for (let i = 0; i < Math.min(lines.length, 7); i++) {
        const match = lines[i].match(/^\d+[\.\)]\s*\*{0,2}(.+?)\*{0,2}(?:\s*[-–:]\s*(.+))?$/);
        if (match) {
          const name = match[1].trim();
          await createMeal.mutateAsync({
            day: DAYS[i], slot: viewSlot, week,
            name, emoji: guessEmoji(name), notes: match[2]?.trim() || '',
          });
        }
      }
    } catch (e) {
      console.error('AI suggestions failed', e);
    }
    setAiLoading(false);
  }

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>;

  return (
    <div style={{ width: '100%' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 10 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>🍽️ Meals</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={getAiSuggestions} disabled={aiLoading} className="btn" style={{ fontSize: 12 }}>
            {aiLoading ? '✨ Generating...' : '✨ AI Suggest'}
          </button>
          <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize: 13 }}>+ Add meal</button>
        </div>
      </div>

      {/* Slot tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', padding: 4, borderRadius: 12, border: '1.5px solid var(--border)', maxWidth: 480 }}>
        {SLOTS.map(s => (
          <button key={s} onClick={() => setViewSlot(s)} style={{
            flex: 1, padding: '8px 4px', borderRadius: 8, fontWeight: 800, fontSize: 12, cursor: 'pointer',
            background: viewSlot === s ? 'var(--primary)' : 'transparent',
            color: viewSlot === s ? '#fff' : 'var(--text-secondary)', border: 'none',
          }}>
            {SLOT_EMOJI[s]} {s.charAt(0).toUpperCase() + s.slice(1)}
          </button>
        ))}
      </div>

      {/* Week grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        {DAYS.map(day => {
          const meal = mealGrid[day]?.[viewSlot];
          return (
            <div key={day} className="card" style={{ minHeight: 90, position: 'relative' }}>
              <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>{day}</div>
              {meal ? (
                <div>
                  <div style={{ fontSize: 28, marginBottom: 4 }}>{meal.emoji}</div>
                  <div style={{ fontWeight: 800, fontSize: 13 }}>{meal.name}</div>
                  {meal.notes && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{meal.notes}</div>}
                  <button
                    onClick={() => deleteMeal.mutate(meal.id)}
                    style={{ position: 'absolute', top: 8, right: 8, background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 14 }}
                  >×</button>
                </div>
              ) : (
                <button
                  onClick={() => { setNewMeal(p => ({ ...p, day, slot: viewSlot as any })); setShowAdd(true); }}
                  style={{ width: '100%', height: '100%', background: 'none', border: '1.5px dashed rgba(255,255,255,0.1)', borderRadius: 8, color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22, padding: '12px 0' }}
                >+</button>
              )}
            </div>
          );
        })}
      </div>

      {/* Add meal modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 440, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18 }}>🍽️ Add Meal</h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 20 }}>×</button>
            </div>

            {/* Emoji picker */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16 }}>
              {MEAL_EMOJIS.map(e => (
                <button key={e} onClick={() => setNewMeal(p => ({ ...p, emoji: e }))} style={{
                  width: 38, height: 38, borderRadius: 8, fontSize: 20, cursor: 'pointer',
                  background: newMeal.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  border: newMeal.emoji === e ? '2px solid var(--primary)' : '2px solid transparent',
                }}>{e}</button>
              ))}
            </div>

            {/* Day selector */}
            <select className="input" style={{ marginBottom: 12, width: '100%' }}
              value={newMeal.day} onChange={e => setNewMeal(p => ({ ...p, day: e.target.value }))}>
              {DAYS.map(d => <option key={d} value={d}>{d}</option>)}
            </select>

            {/* Slot selector */}
            <select className="input" style={{ marginBottom: 12, width: '100%' }}
              value={newMeal.slot} onChange={e => setNewMeal(p => ({ ...p, slot: e.target.value as any }))}>
              {SLOTS.map(s => <option key={s} value={s}>{SLOT_EMOJI[s]} {s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
            </select>

            {/* Meal name */}
            <input className="input" placeholder="Meal name e.g. Pasta Bolognese" style={{ marginBottom: 12, width: '100%' }}
              value={newMeal.name}
              onChange={e => {
                const name = e.target.value;
                setNewMeal(p => ({ ...p, name, emoji: guessEmoji(name) || p.emoji }));
              }} />

            {/* Notes */}
            <input className="input" placeholder="Notes (optional)" style={{ marginBottom: 12, width: '100%' }}
              value={newMeal.notes} onChange={e => setNewMeal(p => ({ ...p, notes: e.target.value }))} />

            {/* Who's cooking */}
            <select className="input" style={{ marginBottom: 20, width: '100%' }}
              value={newMeal.assignedToId} onChange={e => setNewMeal(p => ({ ...p, assignedToId: e.target.value }))}>
              <option value="">Anyone</option>
              {(members as any[]).map((m: any) => <option key={m.id} value={m.id}>{m.emoji} {m.name}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }} onClick={handleAdd} disabled={!newMeal.name.trim() || createMeal.isPending}>
                {createMeal.isPending ? 'Adding...' : '+ Add Meal'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}