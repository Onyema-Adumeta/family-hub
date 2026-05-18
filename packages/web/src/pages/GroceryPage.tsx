import { useState } from 'react';
import { useGrocery, useCreateGroceryItem, useUpdateGroceryItem, useDeleteGroceryItem } from '../hooks/useApi';

const GROCERY_CATS = ['Produce','Dairy','Meat & Fish','Bakery','Frozen','Pantry','Drinks','Snacks','Household','Personal Care','Other'];
const NEEDS_CATS   = ['Clothing','Shoes','School Supplies','Electronics','Toiletries','Medicine','Baby & Kids','Sports','Home & Garden','Other'];

const PRIORITY: Record<string, { label: string; color: string; bg: string }> = {
  urgent: { label: '🔴 Urgent', color: '#F87171', bg: 'rgba(248,113,113,0.12)' },
  high:   { label: '🟠 High',   color: '#FB923C', bg: 'rgba(251,146,60,0.12)'  },
  normal: { label: '🟡 Normal', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)'  },
  low:    { label: '⚪ Low',    color: '#94A3B8', bg: 'rgba(148,163,184,0.10)' },
};

type ListType = 'grocery' | 'needs';

export default function GroceryPage() {
  const { data: allItems = [], isLoading } = useGrocery();
  const createItem = useCreateGroceryItem();
  const updateItem = useUpdateGroceryItem();
  const deleteItem = useDeleteGroceryItem();

  const [listType, setListType] = useState<ListType>('grocery');
  const [showAdd, setShowAdd]   = useState(false);

  const [name, setName]         = useState('');
  const [qty, setQty]           = useState('1');
  const [cat, setCat]           = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes]       = useState('');

  const CATS = listType === 'grocery' ? GROCERY_CATS : NEEDS_CATS;

  // Filter by current tab — items with no listType default to 'grocery'
  const items     = (allItems as any[]).filter(i => (i.listType || 'grocery') === listType);
  const unchecked = items.filter(i => !i.checked);
  const checked   = items.filter(i =>  i.checked);
  const pct       = items.length ? Math.round((checked.length / items.length) * 100) : 0;

  const groups: Record<string, any[]> = {};
  for (const item of unchecked) {
    const k = item.category || 'Other';
    if (!groups[k]) groups[k] = [];
    groups[k].push(item);
  }
  const sortedGroups = Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  const urgent = unchecked.filter(i => i.priority === 'urgent');

  const groceryCount = (allItems as any[]).filter(i => (i.listType || 'grocery') === 'grocery' && !i.checked).length;
  const needsCount   = (allItems as any[]).filter(i => i.listType === 'needs' && !i.checked).length;

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createItem.mutateAsync({
        name:     name.trim(),
        qty,
        category: cat || CATS[CATS.length - 1],
        listType,       // ← always matches the current tab
        priority,
        notes:    notes.trim() || null,
      });
      setName(''); setQty('1'); setCat(''); setPriority('normal'); setNotes('');
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  const toggle = (item: any) =>
    updateItem.mutate({ id: item.id, data: { checked: !item.checked } });

  const clearChecked = async () => {
    for (const item of checked) await deleteItem.mutateAsync(item.id);
  };

  const ItemRow = ({ item }: { item: any }) => {
    const p = PRIORITY[item.priority || 'normal'];
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: item.checked ? 'rgba(255,255,255,0.02)' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 12, padding: '11px 14px', marginBottom: 6,
      }}>
        <div onClick={() => toggle(item)} style={{
          width: 24, height: 24, borderRadius: 6, flexShrink: 0, cursor: 'pointer',
          border: `2px solid ${item.checked ? '#4ADE80' : 'rgba(255,255,255,0.2)'}`,
          background: item.checked ? '#4ADE80' : 'transparent',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          transition: 'all 0.15s',
        }}>
          {item.checked && <span style={{ fontSize: 13, color: '#000', fontWeight: 900 }}>✓</span>}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: 14,
            color: item.checked ? '#64748B' : 'var(--text)',
            textDecoration: item.checked ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.name}
            {item.qty && item.qty !== '1' && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>×{item.qty}</span>
            )}
          </div>
          {item.notes && !item.checked && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.notes}</div>
          )}
        </div>

        {!item.checked && item.priority && item.priority !== 'normal' && (
          <span style={{
            fontSize: 11, fontWeight: 700, flexShrink: 0,
            color: p.color, background: p.bg, borderRadius: 6, padding: '2px 7px',
          }}>{item.priority === 'urgent' ? '🔴' : item.priority === 'high' ? '🟠' : '⚪'}</span>
        )}

        <button onClick={() => deleteItem.mutate(item.id)} style={{
          width: 26, height: 26, borderRadius: 8, flexShrink: 0,
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
          color: '#F87171', fontSize: 15, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>×</button>
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 16px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Family Lists</h1>
        <button onClick={() => setShowAdd(true)} style={{
          padding: '9px 18px', background: 'var(--primary)',
          border: 'none', borderRadius: 10, color: '#fff',
          fontWeight: 700, fontSize: 14, cursor: 'pointer',
        }}>+ Add</button>
      </div>

      {/* TAB BAR */}
      <div style={{
        display: 'flex', background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 14, padding: 4, marginBottom: 16,
      }}>
        {([
          { key: 'grocery' as const, icon: '🛒', label: 'Groceries',   count: groceryCount },
          { key: 'needs'   as const, icon: '🧢', label: 'Other Needs', count: needsCount   },
        ]).map(tab => (
          <button key={tab.key} onClick={() => setListType(tab.key)} style={{
            flex: 1, padding: '10px 0',
            background: listType === tab.key ? 'var(--primary)' : 'transparent',
            border: 'none', borderRadius: 10,
            color: listType === tab.key ? '#fff' : 'var(--text-muted)',
            fontWeight: listType === tab.key ? 700 : 500,
            fontSize: 14, cursor: 'pointer', transition: 'all 0.15s',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          }}>
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
            {tab.count > 0 && (
              <span style={{
                background: listType === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700,
              }}>{tab.count}</span>
            )}
          </button>
        ))}
      </div>

      {/* Progress */}
      {items.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 12,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{checked.length} of {items.length} got</span>
            <span style={{ fontWeight: 700, color: pct === 100 ? '#4ADE80' : 'var(--text)' }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct === 100 ? '#4ADE80' : 'var(--primary)',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {urgent.length > 0 && (
        <div style={{
          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: '#F87171', fontWeight: 700 }}>
            🔴 Urgent: {urgent.map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      {checked.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button onClick={clearChecked} style={{
            padding: '7px 14px', borderRadius: 10,
            background: 'rgba(248,113,113,0.12)', border: '1px solid rgba(248,113,113,0.3)',
            color: '#F87171', fontSize: 13, fontWeight: 700, cursor: 'pointer',
          }}>Clear {checked.length} done</button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {sortedGroups.map(([category, catItems]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>{category}</span>
                <span style={{
                  background: 'rgba(255,255,255,0.07)', borderRadius: 10,
                  padding: '1px 7px', fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                }}>{catItems.length}</span>
              </div>
              {catItems.map(item => <ItemRow key={item.id} item={item} />)}
            </div>
          ))}

          {checked.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#4ADE80', marginBottom: 8, letterSpacing: '0.08em' }}>
                ✓ GOT IT
              </div>
              {checked.map(item => <ItemRow key={item.id} item={item} />)}
            </div>
          )}

          {items.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>{listType === 'grocery' ? '🛒' : '🧢'}</div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14, marginBottom: 16 }}>
                {listType === 'grocery' ? 'No groceries yet' : 'No other needs yet'}
              </div>
              <button onClick={() => setShowAdd(true)} style={{
                padding: '10px 20px', background: 'var(--primary)',
                border: 'none', borderRadius: 10, color: '#fff',
                fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>+ Add first item</button>
            </div>
          )}
        </>
      )}

      {/* ADD MODAL */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px', maxHeight: '90vh', overflowY: 'auto',
          }}>
            <h2 style={{ margin: '0 0 4px', fontSize: 18, fontWeight: 800 }}>
              + Add to {listType === 'grocery' ? '🛒 Groceries' : '🧢 Other Needs'}
            </h2>

            <div style={{ display: 'flex', gap: 6, marginBottom: 16, marginTop: 10 }}>
              {(['grocery', 'needs'] as const).map(t => (
                <button key={t} onClick={() => { setListType(t); setCat(''); }} style={{
                  padding: '5px 14px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: listType === t ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                  border: 'none', color: listType === t ? '#fff' : 'var(--text-muted)',
                  fontWeight: listType === t ? 700 : 500,
                }}>{t === 'grocery' ? '🛒 Groceries' : '🧢 Other Needs'}</button>
              ))}
            </div>

            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input value={name} onChange={e => setName(e.target.value)}
                placeholder={listType === 'grocery' ? 'e.g. Milk, Eggs...' : 'e.g. Blue Jeans...'}
                className="input" style={{ flex: 3 }}
                autoFocus onKeyDown={e => e.key === 'Enter' && add()} />
              <input value={qty} onChange={e => setQty(e.target.value)}
                placeholder="Qty" className="input" style={{ flex: 1 }} />
            </div>

            <select value={cat} onChange={e => setCat(e.target.value)}
              className="input" style={{ width: '100%', marginBottom: 12 }}>
              <option value="">Pick category...</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {Object.entries(PRIORITY).map(([key, cfg]) => (
                <button key={key} onClick={() => setPriority(key)} style={{
                  padding: '5px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                  background: priority === key ? cfg.bg : 'rgba(255,255,255,0.04)',
                  color: priority === key ? cfg.color : 'var(--text-muted)',
                  border: `1.5px solid ${priority === key ? cfg.color + '55' : 'rgba(255,255,255,0.1)'}`,
                  fontWeight: priority === key ? 700 : 500,
                }}>{cfg.label}</button>
              ))}
            </div>

            <input value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={listType === 'grocery' ? 'Notes — brand, size...' : 'Notes — colour, size, store...'}
              className="input" style={{ width: '100%', marginBottom: 20 }} />

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }}
                onClick={add} disabled={!name.trim() || createItem.isPending}>
                {createItem.isPending ? 'Adding...' : `+ Add to ${listType === 'grocery' ? 'Groceries' : 'Other Needs'}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}