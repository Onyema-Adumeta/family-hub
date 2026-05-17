import { useState } from 'react';
import { useGrocery, useCreateGroceryItem, useUpdateGroceryItem, useDeleteGroceryItem } from '../hooks/useApi';

const CATS = ['Produce','Dairy','Meat','Bakery','Frozen','Pantry','Drinks','Snacks','Household','Other'];

export default function GroceryPage() {
  const { data: items = [], isLoading } = useGrocery();
  const createItem = useCreateGroceryItem();
  const updateItem = useUpdateGroceryItem();
  const deleteItem = useDeleteGroceryItem();

  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [cat, setCat] = useState('General');

  const all = items as any[];
  const unchecked = all.filter(i => !i.checked);
  const checked = all.filter(i => i.checked);
  const pct = all.length ? Math.round((checked.length / all.length) * 100) : 0;

  function add() {
    if (!name.trim()) return;
    createItem.mutate({ name: name.trim(), qty, category: cat });
    setName(''); setQty('1');
  }

  function toggle(item: any) {
    updateItem.mutate({ id: item.id, data: { checked: !item.checked } });
  }

  function remove(id: string) {
    deleteItem.mutate(id);
  }

  function clearDone() {
    checked.forEach(i => deleteItem.mutate(i.id));
  }

  // Group unchecked by category
  const grouped: Record<string, any[]> = {};
  unchecked.forEach(i => {
    const c = i.category || 'General';
    if (!grouped[c]) grouped[c] = [];
    grouped[c].push(i);
  });

  if (isLoading) return <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}><div className="spinner" /></div>;

  return (
    <div style={{ maxWidth: 640, padding: '0 0 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>🛒 Grocery List</h1>
        {checked.length > 0 && (
          <button onClick={clearDone} style={{ fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1.5px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}>
            Clear {checked.length} done
          </button>
        )}
      </div>

      {/* Progress bar */}
      {all.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'rgba(240,240,245,0.6)' }}>
            <span>{checked.length} of {all.length} items</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: 'linear-gradient(90deg,#6366F1,#A78BFA)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
        </div>
      )}

      {/* Add item */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24, flexWrap: 'wrap' }}>
        <input
          value={name} onChange={e => setName(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && add()}
          placeholder="Item name..." className="input"
          style={{ flex: '1 1 160px', minWidth: 0 }}
        />
        <input
          type="number" min="1" value={qty} onChange={e => setQty(e.target.value)}
          className="input" style={{ width: 60 }}
        />
        <select value={cat} onChange={e => setCat(e.target.value)} className="input" style={{ fontSize: 13 }}>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={add} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }} disabled={createItem.isPending}>
          {createItem.isPending ? '...' : '+ Add'}
        </button>
      </div>

      {/* Empty state */}
      {all.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'rgba(240,240,245,0.35)', fontSize: 14, fontWeight: 700 }}>
          🛒 Your list is empty — add items above!
        </div>
      )}

      {/* Unchecked grouped by category */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(240,240,245,0.4)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>{category}</div>
          {catItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 6, border: '1.5px solid rgba(255,255,255,0.07)' }}>
              <div onClick={() => toggle(item)} style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{item.name}</span>
              {item.qty && item.qty !== '1' && <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(240,240,245,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 20 }}>x{item.qty}</span>}
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,240,245,0.3)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      ))}

      {/* Checked items */}
      {checked.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(74,222,128,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6 }}>✓ Done</div>
          {checked.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(74,222,128,0.04)', borderRadius: 10, marginBottom: 5, border: '1.5px solid rgba(74,222,128,0.1)', opacity: 0.7 }}>
              <div onClick={() => toggle(item)} style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid #4ADE80', background: '#4ADE80', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 11, fontWeight: 900 }}>✓</div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, textDecoration: 'line-through', color: 'rgba(240,240,245,0.4)' }}>{item.name}</span>
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,240,245,0.2)', fontSize: 16, padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
