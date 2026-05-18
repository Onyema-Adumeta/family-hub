import { useState } from 'react';
import { useGrocery, useCreateGroceryItem, useUpdateGroceryItem, useDeleteGroceryItem } from '../hooks/useApi';

const GROCERY_CATS  = ['Produce','Dairy','Meat & Fish','Bakery','Frozen','Pantry','Drinks','Snacks','Household','Personal Care','Other'];
const NEEDS_CATS    = ['Clothing','Shoes','School Supplies','Electronics','Toiletries','Medicine','Baby & Kids','Sports','Home & Garden','Other'];

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

function groupBy<T>(arr: T[], key: (item: T) => string): Record<string, T[]> {
  return arr.reduce((acc, item) => {
    const k = key(item);
    if (!acc[k]) acc[k] = [];
    acc[k].push(item);
    return acc;
  }, {} as Record<string, T[]>);
}

export default function GroceryPage() {
  const { data: items = [], isLoading } = useGrocery();
  const createItem  = useCreateGroceryItem();
  const updateItem  = useUpdateGroceryItem();
  const deleteItem  = useDeleteGroceryItem();

  const [listType, setListType] = useState<'grocery' | 'needs'>('grocery');
  const [showAdd, setShowAdd]   = useState(false);
  const [shoppingMode, setShoppingMode] = useState(false);

  const [name, setName]         = useState('');
  const [qty, setQty]           = useState('1');
  const [cat, setCat]           = useState('');
  const [priority, setPriority] = useState('normal');
  const [notes, setNotes]       = useState('');

  const CATS = listType === 'grocery' ? GROCERY_CATS : NEEDS_CATS;

  // Items for the current tab only
  const all      = (items as any[]).filter(i => (i.listType || 'grocery') === listType);
  const unchecked = all.filter(i => !i.checked);
  const checked   = all.filter(i => i.checked);
  const pct = all.length ? Math.round((checked.length / all.length) * 100) : 0;

  const urgentItems = unchecked.filter(i => (i.priority || 'normal') === 'urgent');

  const grouped = groupBy(unchecked, i => i.category || 'Other');
  const sortedGroups = Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b));

  const add = async () => {
    if (!name.trim()) return;
    try {
      await createItem.mutateAsync({
        name: name.trim(),
        quantity: qty,
        category: cat || (listType === 'grocery' ? 'Other' : 'Other'),
        priority,
        notes: notes.trim() || undefined,
        listType,   // <-- this is the key field that routes to correct tab
      });
      setName(''); setQty('1'); setCat(''); setPriority('normal'); setNotes('');
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  const toggle = async (item: any) => {
    await updateItem.mutateAsync({ id: item.id, data: { checked: !item.checked } });
  };

  const clearDone = async () => {
    for (const item of checked) {
      await deleteItem.mutateAsync(item.id);
    }
  };

  const ItemRow = ({ item }: { item: any }) => {
    const pcfg = PRIORITY_CONFIG[item.priority || 'normal'];
    return (
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        background: item.checked ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.09)',
        borderRadius: 12,
        padding: shoppingMode ? '16px 14px' : '11px 14px',
        marginBottom: 6,
        transition: 'all 0.15s',
      }}>
        {/* Checkbox */}
        <div
          onClick={() => toggle(item)}
          style={{
            width: shoppingMode ? 28 : 22,
            height: shoppingMode ? 28 : 22,
            borderRadius: 6,
            border: `2px solid ${item.checked ? '#4ADE80' : 'rgba(255,255,255,0.2)'}`,
            background: item.checked ? '#4ADE80' : 'transparent',
            flexShrink: 0, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            transition: 'all 0.15s',
          }}
        >
          {item.checked && <span style={{ fontSize: 14, color: '#000', fontWeight: 900 }}>✓</span>}
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontWeight: 600, fontSize: shoppingMode ? 16 : 14,
            color: item.checked ? '#94A3B8' : 'var(--text)',
            textDecoration: item.checked ? 'line-through' : 'none',
            whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
          }}>
            {item.name}
            {item.quantity && item.quantity !== '1' && (
              <span style={{ color: 'var(--text-muted)', fontWeight: 400, marginLeft: 6 }}>×{item.quantity}</span>
            )}
          </div>
          {item.notes && !item.checked && (
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{item.notes}</div>
          )}
        </div>

        {/* Priority badge */}
        {!item.checked && item.priority && item.priority !== 'normal' && (
          <span style={{
            fontSize: 11, fontWeight: 700,
            color: pcfg.color, background: pcfg.bg,
            borderRadius: 6, padding: '2px 7px', flexShrink: 0,
          }}>{pcfg.label.split(' ')[0]}</span>
        )}

        {/* Delete */}
        <button
          onClick={() => deleteItem.mutate(item.id)}
          style={{
            width: 26, height: 26, borderRadius: 8,
            background: 'rgba(248,113,113,0.1)',
            border: '1px solid rgba(248,113,113,0.2)',
            color: '#F87171', fontSize: 14, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0,
          }}
        >×</button>
      </div>
    );
  };

  return (
    <div style={{ padding: '16px 16px 80px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>Family Lists</h1>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            onClick={() => setShoppingMode(m => !m)}
            style={{
              padding: '8px 14px',
              background: shoppingMode ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.07)',
              border: `1px solid ${shoppingMode ? '#6366F1' : 'rgba(255,255,255,0.12)'}`,
              borderRadius: 10, color: shoppingMode ? '#818CF8' : 'var(--text)',
              fontSize: 13, cursor: 'pointer',
            }}
          >{shoppingMode ? '🛍️ Shopping' : '🛍️ Shop'}</button>
          <button
            onClick={() => setShowAdd(true)}
            style={{
              padding: '8px 16px',
              background: 'var(--primary)', border: 'none',
              borderRadius: 10, color: '#fff', fontWeight: 700,
              fontSize: 14, cursor: 'pointer',
            }}
          >+ Add</button>
        </div>
      </div>

      {/* ── TAB BAR ── */}
      <div style={{
        display: 'flex',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: 14, padding: 4,
        marginBottom: 16,
        border: '1px solid rgba(255,255,255,0.08)',
      }}>
        {LIST_TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setListType(tab.key as any)}
            style={{
              flex: 1, padding: '10px 0',
              background: listType === tab.key ? 'var(--primary)' : 'transparent',
              border: 'none', borderRadius: 10,
              color: listType === tab.key ? '#fff' : 'var(--text-muted)',
              fontWeight: listType === tab.key ? 700 : 500,
              fontSize: 14, cursor: 'pointer',
              transition: 'all 0.15s',
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
            }}
          >
            <span>{tab.icon}</span> {tab.label}
            {/* Count badge */}
            {(() => {
              const tabItems = (items as any[]).filter(i => (i.listType || 'grocery') === tab.key);
              const uncheckedCount = tabItems.filter(i => !i.checked).length;
              return uncheckedCount > 0 ? (
                <span style={{
                  background: listType === tab.key ? 'rgba(255,255,255,0.25)' : 'rgba(255,255,255,0.1)',
                  borderRadius: 10, padding: '1px 6px',
                  fontSize: 11, fontWeight: 700,
                }}>{uncheckedCount}</span>
              ) : null;
            })()}
          </button>
        ))}
      </div>

      {/* Progress bar */}
      {all.length > 0 && (
        <div style={{
          background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '12px 16px', marginBottom: 16,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
            <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
              {checked.length} of {all.length} items got
            </span>
            <span style={{ fontWeight: 700, color: pct === 100 ? '#4ADE80' : 'var(--text)' }}>{pct}%</span>
          </div>
          <div style={{ height: 6, background: 'rgba(255,255,255,0.1)', borderRadius: 3, overflow: 'hidden' }}>
            <div style={{
              height: '100%', width: `${pct}%`,
              background: pct === 100 ? '#4ADE80' : 'var(--primary)',
              borderRadius: 3, transition: 'width 0.4s ease',
            }} />
          </div>
        </div>
      )}

      {/* Urgent banner */}
      {urgentItems.length > 0 && (
        <div style={{
          background: 'rgba(248,113,113,0.1)',
          border: '1px solid rgba(248,113,113,0.3)',
          borderRadius: 12, padding: '10px 14px', marginBottom: 12,
        }}>
          <span style={{ fontSize: 13, color: '#F87171', fontWeight: 700 }}>
            🔴 {urgentItems.length} urgent item{urgentItems.length > 1 ? 's' : ''} — {urgentItems.map(i => i.name).join(', ')}
          </span>
        </div>
      )}

      {/* Clear done button */}
      {checked.length > 0 && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 10 }}>
          <button
            onClick={clearDone}
            style={{
              padding: '7px 14px', borderRadius: 10,
              background: 'rgba(248,113,113,0.15)',
              border: '1px solid rgba(248,113,113,0.3)',
              color: '#F87171', fontSize: 13, fontWeight: 700, cursor: 'pointer',
            }}
          >Clear {checked.length} done</button>
        </div>
      )}

      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <>
          {/* Ungrouped items by category */}
          {sortedGroups.map(([category, catItems]) => (
            <div key={category} style={{ marginBottom: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <span style={{
                  fontSize: 11, fontWeight: 800, color: 'var(--text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                }}>{category}</span>
                <span style={{
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 10, padding: '1px 7px',
                  fontSize: 11, fontWeight: 700, color: 'var(--text-muted)',
                }}>{catItems.length}</span>
              </div>
              {catItems.map(item => <ItemRow key={item.id} item={item} />)}
            </div>
          ))}

          {/* Got It section */}
          {checked.length > 0 && (
            <div style={{ marginTop: 8 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <span style={{ color: '#4ADE80', fontSize: 13, fontWeight: 800 }}>✓ GOT IT</span>
              </div>
              {checked.map(item => <ItemRow key={item.id} item={item} />)}
            </div>
          )}

          {all.length === 0 && (
            <div style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: 40, marginBottom: 10 }}>
                {listType === 'grocery' ? '🛒' : '🧢'}
              </div>
              <div style={{ color: 'var(--text-muted)', fontSize: 14 }}>
                {listType === 'grocery' ? 'No groceries yet' : 'No other needs yet'}
              </div>
              <button
                onClick={() => setShowAdd(true)}
                style={{
                  marginTop: 14, padding: '10px 20px',
                  background: 'var(--primary)', border: 'none',
                  borderRadius: 10, color: '#fff', fontWeight: 700,
                  fontSize: 14, cursor: 'pointer',
                }}
              >+ Add first item</button>
            </div>
          )}
        </>
      )}

      {/* ── ADD MODAL ── */}
      {showAdd && (
        <div
          style={{
            position: 'fixed', inset: 0,
            background: 'rgba(0,0,0,0.7)',
            display: 'flex', alignItems: 'flex-end',
            zIndex: 1000,
          }}
          onClick={e => e.target === e.currentTarget && setShowAdd(false)}
        >
          <div style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px',
          }}>
            <h2 style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800 }}>
              + Add to {listType === 'grocery' ? 'Groceries' : 'Other Needs'}
            </h2>
            {/* Tab switcher in modal */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {LIST_TABS.map(t => (
                <button
                  key={t.key}
                  onClick={() => { setListType(t.key as any); setCat(''); }}
                  style={{
                    padding: '5px 12px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    background: listType === t.key ? 'var(--primary)' : 'rgba(255,255,255,0.07)',
                    border: 'none',
                    color: listType === t.key ? '#fff' : 'var(--text-muted)',
                    fontWeight: listType === t.key ? 700 : 500,
                  }}
                >{t.icon} {t.label}</button>
              ))}
            </div>

            {/* Name + Qty */}
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <input
                value={name} onChange={e => setName(e.target.value)}
                placeholder={listType === 'grocery' ? 'Item name (e.g. Milk)' : 'Item name (e.g. Blue Jeans)'}
                className="input" style={{ flex: 3 }}
                autoFocus
                onKeyDown={e => e.key === 'Enter' && add()}
              />
              <input
                value={qty} onChange={e => setQty(e.target.value)}
                placeholder="Qty"
                className="input" style={{ flex: 1 }}
              />
            </div>

            {/* Category */}
            <select
              value={cat} onChange={e => setCat(e.target.value)}
              className="input" style={{ width: '100%', marginBottom: 12 }}
            >
              <option value="">Pick category...</option>
              {CATS.map(c => <option key={c} value={c}>{c}</option>)}
            </select>

            {/* Priority */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 12, flexWrap: 'wrap' }}>
              {Object.entries(PRIORITY_CONFIG).map(([key, cfg]) => (
                <button
                  key={key}
                  onClick={() => setPriority(key)}
                  style={{
                    padding: '5px 11px', borderRadius: 8, fontSize: 12, cursor: 'pointer',
                    background: priority === key ? cfg.bg : 'rgba(255,255,255,0.04)',
                    color: priority === key ? cfg.color : 'var(--text-muted)',
                    border: `1.5px solid ${priority === key ? cfg.color + '44' : 'var(--border)'}`,
                    fontWeight: priority === key ? 700 : 500,
                  }}
                >{cfg.label}</button>
              ))}
            </div>

            {/* Notes */}
            <input
              value={notes} onChange={e => setNotes(e.target.value)}
              placeholder={listType === 'grocery' ? 'Notes — brand, size...' : 'Notes — colour, size, where to buy...'}
              className="input" style={{ width: '100%', marginBottom: 20, fontSize: 13 }}
            />

            {/* Actions */}
            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button
                className="btn btn-primary" style={{ flex: 2 }}
                onClick={add}
                disabled={!name.trim() || createItem.isPending}
              >{createItem.isPending ? 'Adding...' : `+ Add to ${listType === 'grocery' ? 'Groceries' : 'Other Needs'}`}</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}