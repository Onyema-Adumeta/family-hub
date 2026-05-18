import { useState } from 'react';
import { useGrocery, useCreateGroceryItem, useUpdateGroceryItem, useDeleteGroceryItem } from '../hooks/useApi';

const GROCERY_CATS = ['Produce', 'Dairy', 'Meat & Fish', 'Bakery', 'Frozen', 'Pantry', 'Drinks', 'Snacks', 'Household', 'Personal Care', 'Other'];
const NEEDS_CATS   = ['Clothing', 'Shoes', 'School Supplies', 'Electronics', 'Toiletries', 'Medicine', 'Baby & Kids', 'Sports', 'Home & Garden', 'Other'];

const PRIORITY_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: '🔴 Urgent', color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  high:   { label: '🟠 High',   color: '#FB923C', bg: 'rgba(251,146,60,0.12)'  },
  normal: { label: '🟡 Normal', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)'  },
  low:    { label: '⚪ Low',    color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
};

const LIST_TABS = [
  { key: 'grocery', icon: '🛒', label: 'Groceries' },
  { key: 'needs',   icon: '🧢', label: 'Other Needs' },
];

export default function GroceryPage() {
  const { data: items = [], isLoading } = useGrocery();
  const createItem = useCreateGroceryItem();
  const updateItem = useUpdateGroceryItem();
  const deleteItem = useDeleteGroceryItem();

  const [listType, setListType] = useState<'grocery' | 'needs'>('grocery');
  const [showAdd, setShowAdd] = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);

  const [name, setName]       = useState('');
  const [qty, setQty]         = useState('1');
  const [cat, setCat]         = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes]     = useState('');

  const CATS = listType === 'grocery' ? GROCERY_CATS : NEEDS_CATS;

  const all = (items as any[]).filter(i => (i.listType || 'grocery') === listType);
  const unchecked = all.filter(i => !i.checked);
  const checked   = all.filter(i => i.checked);
  const pct = all.length ? Math.round((checked.length / all.length) * 100) : 0;

  const urgentCount = unchecked.filter(i => i.priority === 'urgent').length;

  function add() {
    if (!name.trim()) return;
    createItem.mutate({
      name: name.trim(),
      qty,
      category: cat || CATS[0],
      listType,
      priority,
      notes: notes.trim() || null,
    });
    setName(''); setQty('1'); setPriority('normal'); setNotes(''); setShowAdd(false);
  }

  function toggle(item: any) {
    updateItem.mutate({ id: item.id, data: { checked: !item.checked } });
  }

  function clearDone() {
    checked.forEach(i => deleteItem.mutate(i.id));
  }

  // Group unchecked by category, urgent items float to top within each group
  const grouped: Record<string, any[]> = {};
  [...unchecked]
    .sort((a, b) => {
      const order = { urgent: 0, high: 1, normal: 2, low: 3 };
      return (order[a.priority as keyof typeof order] ?? 2) - (order[b.priority as keyof typeof order] ?? 2);
    })
    .forEach(i => {
      const c = i.category || 'General';
      if (!grouped[c]) grouped[c] = [];
      grouped[c].push(i);
    });

  if (isLoading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
      <div className="spinner" />
    </div>
  );

  return (
    <div style={{ maxWidth: 680, padding: '0 0 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>
          {listType === 'grocery' ? '🛒' : '🧢'} Family Lists
        </h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShoppingMode(s => !s)}
            style={{
              fontSize: 12, fontWeight: 800, padding: '6px 12px', borderRadius: 8, cursor: 'pointer',
              background: shoppingMode ? 'rgba(74,222,128,0.15)' : 'rgba(255,255,255,0.06)',
              color: shoppingMode ? '#4ADE80' : 'var(--text-secondary)',
              border: `1.5px solid ${shoppingMode ? 'rgba(74,222,128,0.3)' : 'var(--border)'}`,
            }}
          >
            {shoppingMode ? '✓ Shopping' : '🛍️ Shop'}
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="btn btn-primary"
            style={{ fontSize: 12, padding: '6px 14px' }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* List type tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: 'var(--bg-secondary)', padding: 4, borderRadius: 12, border: '1.5px solid var(--border)' }}>
        {LIST_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => { setListType(tab.key as any); setCat(''); }}
            style={{
              flex: 1, padding: '10px 8px', borderRadius: 8, fontWeight: 800, fontSize: 13,
              cursor: 'pointer', border: 'none', transition: 'all 0.15s',
              background: listType === tab.key ? 'var(--primary)' : 'transparent',
              color: listType === tab.key ? '#fff' : 'var(--text-secondary)',
            }}
          >
            {tab.icon} {tab.label}
            {tab.key === listType && all.length > 0 && (
              <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({unchecked.length})</span>
            )}
          </button>
        ))}
      </div>

      {/* Urgent banner */}
      {urgentCount > 0 && (
        <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.1)', border: '1.5px solid rgba(248,113,113,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: 18 }}>🔴</span>
          <span style={{ fontSize: 13, fontWeight: 800, color: '#F87171' }}>
            {urgentCount} urgent item{urgentCount > 1 ? 's' : ''} need{urgentCount === 1 ? 's' : ''} attention
          </span>
        </div>
      )}

      {/* Progress bar */}
      {all.length > 0 && (
        <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,255,255,0.04)', borderRadius: 12, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, fontWeight: 800, marginBottom: 8, color: 'var(--text-muted)' }}>
            <span>{checked.length} of {all.length} items got</span>
            <span>{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${pct}%`, background: pct === 100 ? 'linear-gradient(90deg,#4ADE80,#22C55E)' : 'linear-gradient(90deg,#6366F1,#A78BFA)', borderRadius: 3, transition: 'width 0.4s ease' }} />
          </div>
          {pct === 100 && (
            <div style={{ textAlign: 'center', marginTop: 8, fontSize: 13, fontWeight: 800, color: '#4ADE80' }}>🎉 All done!</div>
          )}
        </div>
      )}

      {/* Clear done button */}
      {checked.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
          <button onClick={clearDone} style={{ fontSize: 12, fontWeight: 800, padding: '5px 12px', borderRadius: 8, background: 'rgba(248,113,113,0.1)', color: '#F87171', border: '1.5px solid rgba(248,113,113,0.2)', cursor: 'pointer' }}>
            Clear {checked.length} done
          </button>
        </div>
      )}

      {/* Empty state */}
      {all.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-muted)', fontSize: 14, fontWeight: 700 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{listType === 'grocery' ? '🛒' : '🧢'}</div>
          <div>{listType === 'grocery' ? 'Your grocery list is empty!' : 'No other needs listed yet!'}</div>
          <div style={{ fontSize: 12, marginTop: 6, opacity: 0.6 }}>Tap + Add to get started</div>
        </div>
      )}

      {/* Grouped unchecked items */}
      {Object.entries(grouped).map(([category, catItems]) => (
        <div key={category} style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
            <span>{category}</span>
            <span style={{ background: 'rgba(255,255,255,0.08)', borderRadius: 10, padding: '1px 7px', fontSize: 10 }}>{catItems.length}</span>
          </div>
          {catItems.map(item => {
            const pCfg = PRIORITY_CONFIG[item.priority || 'normal'];
            return (
              <div
                key={item.id}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: shoppingMode ? '14px 14px' : '11px 14px',
                  background: item.priority === 'urgent' ? 'rgba(248,113,113,0.06)' : 'rgba(255,255,255,0.04)',
                  borderRadius: 10, marginBottom: 6,
                  border: `1.5px solid ${item.priority === 'urgent' ? 'rgba(248,113,113,0.2)' : 'rgba(255,255,255,0.07)'}`,
                  transition: 'all 0.15s',
                }}
              >
                {/* Checkbox */}
                <div
                  onClick={() => toggle(item)}
                  style={{
                    width: shoppingMode ? 26 : 20, height: shoppingMode ? 26 : 20,
                    borderRadius: 6, border: '2px solid rgba(255,255,255,0.2)',
                    background: 'transparent', cursor: 'pointer', flexShrink: 0,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transition: 'all 0.15s',
                  }}
                />

                {/* Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 800, fontSize: shoppingMode ? 15 : 14 }}>{item.name}</div>
                  {item.notes && (
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.notes}</div>
                  )}
                </div>

                {/* Qty */}
                {item.qty && item.qty !== '1' && (
                  <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', background: 'rgba(255,255,255,0.06)', padding: '2px 7px', borderRadius: 20, flexShrink: 0 }}>
                    ×{item.qty}
                  </span>
                )}

                {/* Priority badge */}
                {item.priority && item.priority !== 'normal' && (
                  <span style={{ fontSize: 10, fontWeight: 900, padding: '2px 7px', borderRadius: 20, background: pCfg.bg, color: pCfg.color, flexShrink: 0 }}>
                    {pCfg.label}
                  </span>
                )}

                {/* Delete */}
                {!shoppingMode && (
                  <button onClick={() => deleteItem.mutate(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 2px', lineHeight: 1, flexShrink: 0 }}>×</button>
                )}
              </div>
            );
          })}
        </div>
      ))}

      {/* Checked / done items */}
      {checked.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, fontWeight: 900, color: 'rgba(74,222,128,0.5)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>✓ Got it</div>
          {checked.map(item => (
            <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', background: 'rgba(74,222,128,0.04)', borderRadius: 10, marginBottom: 5, border: '1.5px solid rgba(74,222,128,0.1)', opacity: 0.6 }}>
              <div onClick={() => toggle(item)} style={{ width: 20, height: 20, borderRadius: 6, border: '2px solid #4ADE80', background: '#4ADE80', cursor: 'pointer', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#000', fontSize: 11, fontWeight: 900 }}>✓</div>
              <span style={{ flex: 1, fontSize: 14, fontWeight: 700, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{item.name}</span>
              {item.qty && item.qty !== '1' && <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>×{item.qty}</span>}
              <button onClick={() => deleteItem.mutate(item.id)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: 16, padding: '0 2px' }}>×</button>
            </div>
          ))}
        </div>
      )}

      {/* Add item modal */}
      {showAdd && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100, padding: 16 }}>
          <div className="card" style={{ width: '100%', maxWidth: 520, borderRadius: 20, paddingBottom: 24 }}>

            {/* Modal header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h2 style={{ fontWeight: 900, fontSize: 18 }}>
                {listType === 'grocery' ? '🛒 Add Grocery' : '🧢 Add Need'}
              </h2>
              <button onClick={() => setShowAdd(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: 22 }}>×</button>
            </div>

            {/* List type toggle inside modal */}
            <div style={{ display: 'flex', gap: 4, marginBottom: 16, background: 'var(--bg-secondary)', padding: 4, borderRadius: 10, border: '1.5px solid var(--border)' }}>
              {LIST_TABS.map(tab => (
                <button key={tab.key} onClick={() => { setListType(tab.key as any); setCat(''); }} style={{ flex: 1, padding: '7px', borderRadius: 7, fontWeight: 800, fontSize: 12, cursor: 'pointer', border: 'none', background: listType === tab.key ? 'var(--primary)' : 'transparent', color: listType === tab.key ? '#fff' : 'var(--text-secondary)' }}>
                  {tab.icon} {tab.label}
                </button>
              ))}
            </div>

            {/* Item name */}
            <input
              value={name} onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && add()}
              placeholder={listType === 'grocery' ? 'e.g. Milk, Apples, Bread...' : 'e.g. Running shoes, School bag...'}
              className="input" style={{ width: '100%', marginBottom: 12, fontSize: 15 }}
              autoFocus
            />

            {/* Qty + Category row */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 80 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>Qty</label>
                <input type="number" min="1" value={qty} onChange={e => setQty(e.target.value)} className="input" style={{ width: '100%' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, flex: 1 }}>
                <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)' }}>Category</label>
                <select value={cat || CATS[0]} onChange={e => setCat(e.target.value)} className="input" style={{ width: '100%', fontSize: 13 }}>
                  {CATS.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Priority */}
            <div style={{ marginBottom: 12 }}>
              <label style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>Priority</label>
              <div style={{ display: 'flex', gap: 6 }}>
                {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                  <button key={key} onClick={() => setPriority(key)} style={{
                    flex: 1, padding: '7px 4px', borderRadius: 8, fontWeight: 800, fontSize: 11, cursor: 'pointer',
                    background: priority === key ? cfg.bg : 'rgba(255,255,255,0.04)',
                    color: priority === key ? cfg.color : 'var(--text-muted)',
                    border: `1.5px solid ${priority === key ? cfg.color + '44' : 'var(--border)'}`,
                  }}>{cfg.label}</button>
                ))}
              </div>
            </div>

            {/* Notes */}
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="Notes (optional) — size, brand, colour..."
              className="input" style={{ width: '100%', marginBottom: 20, fontSize: 13 }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                className="btn btn-primary" style={{ flex: 2 }}
                onClick={add}
                disabled={!name.trim() || createItem.isPending}
              >
                {createItem.isPending ? 'Adding...' : `+ Add to ${listType === 'grocery' ? 'Groceries' : 'Other Needs'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}