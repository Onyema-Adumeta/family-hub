import { useState, useEffect } from 'react';

interface GroceryItem {
  id: string;
  name: string;
  qty: string;
  category: string;
  checked: boolean;
}

const CATS = ['🥦 Produce','🥩 Meat','🥛 Dairy','🥫 Pantry','🍞 Bakery','🧴 Household','❄️ Frozen','🍬 Snacks','Other'];

const STORAGE_KEY = 'family-hub-grocery';

function load(): GroceryItem[] {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; }
}

export default function GroceryPage() {
  const [items, setItems] = useState<GroceryItem[]>(load);
  const [name, setName] = useState('');
  const [qty, setQty] = useState('1');
  const [cat, setCat] = useState(CATS[0]);

  useEffect(() => { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)); }, [items]);

  function add() {
    if (!name.trim()) return;
    setItems(prev => [...prev, { id: Date.now().toString(), name: name.trim(), qty, category: cat, checked: false }]);
    setName(''); setQty('1');
  }

  function toggle(id: string) {
    setItems(prev => prev.map(i => i.id === id ? { ...i, checked: !i.checked } : i));
  }

  function remove(id: string) { setItems(prev => prev.filter(i => i.id !== id)); }
  function clearDone() { setItems(prev => prev.filter(i => !i.checked)); }

  const grouped = CATS.map(c => ({ cat: c, items: items.filter(i => i.category === c && !i.checked) })).filter(g => g.items.length > 0);
  const done = items.filter(i => i.checked);
  const total = items.length;
  const checked = done.length;

  return (
    <div style={{ maxWidth: 640, padding: '0 0 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>🛒 Grocery List</h1>
        {checked > 0 && (
          <button onClick={clearDone} style={{ fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1.5px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}>
            Clear {checked} done
          </button>
        )}
      </div>

      {/* Progress */}
      {total > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'rgba(240,240,245,0.6)' }}>
            <span>{checked} of {total} items</span>
            <span>{Math.round(checked/total*100)}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 99 }}>
            <div style={{ height: '100%', width: ``%, background: 'linear-gradient(90deg,#6366F1,#A78BFA)', borderRadius: 99, transition: 'width 0.3s' }} />
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
        <input value={qty} onChange={e => setQty(e.target.value)} placeholder="Qty"
          style={{ width: 56, padding: '10px 10px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.1)', background: 'rgba(255,255,255,0.05)', color: 'inherit', fontSize: 14, fontWeight: 700 }}
        />
        <select value={cat} onChange={e => setCat(e.target.value)}
          style={{ padding: '10px 10px', borderRadius: 10, border: '1.5px solid rgba(255,255,255,0.1)', background: '#1a1a2e', color: 'inherit', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
          {CATS.map(c => <option key={c} value={c}>{c}</option>)}
        </select>
        <button onClick={add} className="btn btn-primary" style={{ whiteSpace: 'nowrap' }}>+ Add</button>
      </div>

      {/* Items by category */}
      {grouped.length === 0 && done.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'rgba(240,240,245,0.35)', fontSize: 14, fontWeight: 700 }}>
          🛒 Your list is empty — add items above!
        </div>
      )}

      {grouped.map(({ cat: c, items: catItems }) => (
        <div key={c} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(240,240,245,0.4)', letterSpacing: 0.8, marginBottom: 8 }}>{c.toUpperCase()}</div>
          {catItems.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px', background: 'rgba(255,255,255,0.04)', borderRadius: 10, marginBottom: 6, border: '1.5px solid rgba(255,255,255,0.07)' }}>
              <div onClick={() => toggle(item.id)} style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid rgba(255,255,255,0.2)', background: 'transparent', cursor: 'pointer', flexShrink: 0 }} />
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700 }}>{item.name}</span>
              {item.qty !== '1' && <span style={{ fontSize: 12, fontWeight: 800, color: 'rgba(240,240,245,0.4)', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 20 }}>x{item.qty}</span>}
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,240,245,0.3)', fontSize: 16, padding: '0 2px', lineHeight: 1 }}>×</button>
            </div>
          ))}
        </div>
      ))}

      {/* Done items */}
      {done.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(240,240,245,0.3)', letterSpacing: 0.8, marginBottom: 8 }}>✓ IN CART</div>
          {done.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(74,222,128,0.04)', borderRadius: 10, marginBottom: 5, border: '1.5px solid rgba(74,222,128,0.1)', opacity: 0.7 }}>
              <div onClick={() => toggle(item.id)} style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid #4ADE80', background: '#4ADE80', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 11, fontWeight: 900 }}>✓</div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, textDecoration: 'line-through', color: 'rgba(240,240,245,0.4)' }}>{item.name}</span>
              <button onClick={() => remove(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'rgba(240,240,245,0.2)', fontSize: 16, padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


