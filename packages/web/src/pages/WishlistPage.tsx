import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

function avatarSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return (import.meta.env.VITE_API_URL || '') + url;
}

export default function WishlistPage() {
  const { member, isParent } = useAuthStore();
  const qc = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string>(member?.id || '');
  useEffect(() => { if (!selectedMemberId && member?.id) setSelectedMemberId(member.id); }, [member?.id]);
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: members = [] } = useQuery({
    queryKey: ['members'],
    queryFn: () => api.get('/members').then(r => r.data),
  });

  const { data: wishlist = [] } = useQuery({
    queryKey: ['wishlist', selectedMemberId],
    queryFn: () => selectedMemberId
      ? api.get(`/wishlist/${selectedMemberId}`).then(r => r.data)
      : [],
    enabled: !!selectedMemberId,
  });

  const memberList = members as any[];
  // Everyone sees everyone's wishlist
  const visibleMembers = memberList;
  const selectedMember = memberList.find((m: any) => m.id === selectedMemberId);

  async function handleAdd() {
    if (!title.trim() || !selectedMemberId) return;
    setSaving(true);
    try {
      await api.post(`/wishlist/${selectedMemberId}`, {
        title: title.trim(),
        url: url.trim() || null,
        price: price ? parseFloat(price) : null,
      });
      qc.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
      setTitle(''); setUrl(''); setPrice(''); setAdding(false);
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to add item');
    } finally {
      setSaving(false);
    }
  }

  async function handleClaim(id: string) {
    setClaimingId(id);
    try {
      await api.patch(`/wishlist/${id}/claim`, {});
      qc.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
    } catch { alert('Failed to claim item'); }
    finally { setClaimingId(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this wish?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/wishlist/${id}`);
      qc.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
    } catch { alert('Failed to delete'); }
    finally { setDeletingId(null); }
  }

  const items = wishlist as any[];
  const isViewingOwnList = selectedMemberId === member?.id;
  const unclaimed = items.filter((i: any) => !i.claimed);
  // Hide claimed items from the owner so gifts stay a surprise
  const claimed = isViewingOwnList ? [] : items.filter((i: any) => i.claimed);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.07)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
  };
  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 13, background: color, color: '#fff',
  });

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Wishlists</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        See what everyone wants &mdash; claim gifts secretly!
      </p>

      {/* Member tabs — everyone sees all members */}
      {visibleMembers.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {visibleMembers.map((m: any) => {
            const isSelected = selectedMemberId === m.id;
            return (
              <button key={m.id} onClick={() => setSelectedMemberId(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: isSelected ? (m.color || '#7C3AED') + '30' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isSelected ? (m.color || '#7C3AED') : 'transparent'}`,
                color: 'var(--text)',
              }}>
                {avatarSrc(m.avatarUrl)
                  ? <img src={avatarSrc(m.avatarUrl)!} style={{ width: 24, height: 24, borderRadius: '50%', objectFit: 'cover' }} alt={m.name} />
                  : <div style={{ width: 24, height: 24, borderRadius: '50%', background: m.color || '#7C3AED', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, color: '#fff', fontWeight: 800 }}>{m.name?.[0]}</div>
                }
                {m.name}
                {m.id === member?.id && <span style={{ fontSize: 10, opacity: 0.6 }}>(you)</span>}
              </button>
            );
          })}
        </div>
      )}

      {/* Add wish — only for your own list */}
      {selectedMemberId === member?.id && !adding && (
        <button onClick={() => setAdding(true)} style={{ ...btnStyle('#7C3AED'), marginBottom: 16, width: '100%' }}>
          + Add a Wish
        </button>
      )}

      {/* Add wish form */}
      {adding && (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <input style={inputStyle} placeholder="What do you wish for? *" value={title} onChange={e => setTitle(e.target.value)} />
          <input style={inputStyle} placeholder="Link (optional)" value={url} onChange={e => setUrl(e.target.value)} />
          <input style={inputStyle} placeholder="Price (optional)" type="number" value={price} onChange={e => setPrice(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleAdd} disabled={saving || !title.trim()} style={btnStyle('#7C3AED')}>
              {saving ? 'Saving...' : 'Save Wish'}
            </button>
            <button onClick={() => setAdding(false)} style={btnStyle('#555')}>Cancel</button>
          </div>
        </div>
      )}

      {/* Empty state */}
      {unclaimed.length === 0 && claimed.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
          {isViewingOwnList ? 'No wishes yet — add something!' : `${selectedMember?.name || 'This person'} hasn't added any wishes yet`}
        </div>
      )}

      {/* Unclaimed wishes */}
      {unclaimed.map((item: any) => (
        <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 10, display: 'flex', alignItems: 'flex-start', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
            {item.price && <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 2 }}>${item.price.toFixed(2)}</div>}
            {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#60A5FA', marginTop: 2, display: 'block', wordBreak: 'break-all' }}>{item.url}</a>}
          </div>
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            {/* Anyone can claim items on someone else's list */}
            {!isViewingOwnList && (
              <button onClick={() => handleClaim(item.id)} disabled={claimingId === item.id} style={btnStyle('#10B981')}>
                {claimingId === item.id ? '...' : 'Claim'}
              </button>
            )}
            {/* Only the owner or a parent can delete */}
            {(isParent || isViewingOwnList) && (
              <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} style={btnStyle('#EF4444')}>
                {deletingId === item.id ? '...' : 'x'}
              </button>
            )}
          </div>
        </div>
      ))}

      {/* Claimed section — hidden from the list owner */}
      {claimed.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
            Already claimed
          </div>
          {claimed.map((item: any) => (
            <div key={item.id} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 14, marginBottom: 10, opacity: 0.7 }}>
              <div style={{ fontWeight: 700, fontSize: 15, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{item.title}</div>
              {isParent && item.claimedBy && (
                <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>
                  Claimed by {memberList.find((m: any) => m.id === item.claimedBy)?.name || 'someone'}
                </div>
              )}
              {!isParent && (
                <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>Someone's already on it! Shhh...</div>
              )}
            </div>
          ))}
        </>
      )}
    </div>
  );
}