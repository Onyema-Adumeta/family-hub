import { useState } from 'react';
import { useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';
import { useQuery, useQueryClient } from '@tanstack/react-query';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

export default function WishlistPage() {
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();
  const queryClient = useQueryClient();
  const isParent = member?.role === 'parent';

  const [selectedMemberId, setSelectedMemberId] = useState<string>(member?.id || '');
  const [adding, setAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: wishlist = [], isLoading } = useQuery({
    queryKey: ['wishlist', selectedMemberId],
    queryFn: () => selectedMemberId ? api.get(`/wishlist/${selectedMemberId}`).then(r => r.data) : [],
    enabled: !!selectedMemberId,
  });

  const memberList = members as any[];
  const selectedMember = memberList.find(m => m.id === selectedMemberId);
  // Kids can only see their own wishlist; parents can see anyone's
  const visibleMembers = isParent ? memberList : memberList.filter(m => m.id === member?.id);

  async function handleAdd() {
    if (!title.trim() || !selectedMemberId) return;
    setSaving(true);
    try {
      await api.post(`/wishlist/${selectedMemberId}`, {
        title: title.trim(),
        url: url.trim() || null,
        price: price ? parseFloat(price) : null,
      });
      queryClient.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
      setTitle(''); setUrl(''); setPrice(''); setAdding(false);
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to add item'); }
    finally { setSaving(false); }
  }

  async function handleClaim(id: string) {
    setClaimingId(id);
    try {
      await api.patch(`/wishlist/${id}/claim`, {});
      queryClient.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
    } catch (e: any) { alert('Failed to claim item'); }
    finally { setClaimingId(null); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Remove this wish?')) return;
    setDeletingId(id);
    try {
      await api.delete(`/wishlist/${id}`);
      queryClient.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
    } catch (e: any) { alert('Failed to delete item'); }
    finally { setDeletingId(null); }
  }

  const items = wishlist as any[];
  const unclaimed = items.filter(i => !i.claimed);
  const claimed   = items.filter(i => i.claimed);

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>🎁 Wishlists</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        {isParent ? 'See what everyone wants — claim items secretly!' : 'Add things you\'d love to receive 🌟'}
      </p>

      {/* Member selector */}
      {visibleMembers.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {visibleMembers.map(m => {
            const src = avatarSrc(m.avatarUrl);
            const isSelected = selectedMemberId === m.id;
            return (
              <button key={m.id} onClick={() => setSelectedMemberId(m.id)} style={{
                display: 'flex', alignItems: 'center', gap: 8, padding: '8px 14px',
                borderRadius: 20, cursor: 'pointer', fontWeight: 700, fontSize: 13,
                background: isSelected ? m.color + '30' : 'rgba(255,255,255,0.05)',
                border: `2px solid ${isSelected ? m.color : 'rgba(255,255,255,0.1)'}`,
                color: 'var(--text)',
              }}>
                <div style={{
                  width: 24, height: 24, borderRadius: '50%', background: m.color,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, overflow: 'hidden', flexShrink: 0,
                }}>
                  {src ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji}
                </div>
                {m.name}
              </button>
            );
          })}
        </div>
      )}

      {/* Add item button / form */}
      {(selectedMemberId === member?.id || isParent) && (
        <>
          {!adding ? (
            <button onClick={() => setAdding(true)} style={{
              width: '100%', padding: '12px', borderRadius: 14, marginBottom: 16,
              background: 'rgba(124,111,247,0.1)', border: '1.5px dashed rgba(124,111,247,0.4)',
              color: '#A78BFA', fontWeight: 700, fontSize: 14, cursor: 'pointer',
            }}>
              + Add a wish{selectedMemberId !== member?.id && selectedMember ? ` for ${selectedMember.name}` : ''}
            </button>
          ) : (
            <div style={{
              padding: '16px', borderRadius: 16, marginBottom: 16,
              background: 'rgba(124,111,247,0.08)', border: '1.5px solid rgba(124,111,247,0.3)',
            }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: '#A78BFA', marginBottom: 12 }}>✨ New Wish</div>
              <input
                value={title} onChange={e => setTitle(e.target.value)}
                placeholder="What do you wish for? 🌟"
                className="input" style={{ width: '100%', marginBottom: 8 }}
                autoFocus onKeyDown={e => e.key === 'Enter' && handleAdd()}
              />
              <input
                value={url} onChange={e => setUrl(e.target.value)}
                placeholder="Link (optional)"
                className="input" style={{ width: '100%', marginBottom: 8 }}
              />
              <input
                value={price} onChange={e => setPrice(e.target.value)}
                placeholder="Price (optional)"
                type="number" min="0" step="0.01"
                className="input" style={{ width: '100%', marginBottom: 12 }}
              />
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={() => { setAdding(false); setTitle(''); setUrl(''); setPrice(''); }} style={{
                  flex: 1, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 700,
                  background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
                  color: 'var(--text)', cursor: 'pointer',
                }}>Cancel</button>
                <button onClick={handleAdd} disabled={!title.trim() || saving} style={{
                  flex: 2, padding: '10px', borderRadius: 10, fontSize: 13, fontWeight: 800,
                  background: 'var(--primary)', border: 'none', color: '#fff', cursor: 'pointer',
                  opacity: (!title.trim() || saving) ? 0.5 : 1,
                }}>{saving ? 'Adding...' : '🌟 Add Wish'}</button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Wishlist items */}
      {isLoading ? (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
      ) : items.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>🌟</div>
          <div style={{ fontWeight: 700, fontSize: 14 }}>No wishes yet!</div>
          <div style={{ fontSize: 12, marginTop: 4 }}>Add something you'd love to receive.</div>
        </div>
      ) : (
        <>
          {/* Unclaimed */}
          {unclaimed.length > 0 && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8 }}>
                🎁 WISHES ({unclaimed.length})
              </div>
              {unclaimed.map(item => (
                <div key={item.id} style={{
                  padding: '14px', borderRadius: 14, marginBottom: 8,
                  background: 'rgba(255,255,255,0.04)', border: '1.5px solid rgba(255,255,255,0.08)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 22, flexShrink: 0 }}>🌟</span>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 800, fontSize: 14 }}>{item.title}</div>
                      {item.price && (
                        <div style={{ fontSize: 12, color: '#4ADE80', fontWeight: 700, marginTop: 2 }}>
                          💰 ${parseFloat(item.price).toFixed(2)}
                        </div>
                      )}
                      {item.url && (
                        <a href={item.url} target="_blank" rel="noopener noreferrer" style={{
                          fontSize: 11, color: '#60A5FA', marginTop: 2, display: 'block',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                        }}>🔗 {item.url}</a>
                      )}
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                      {/* Parents can claim; kids see a lock */}
                      {isParent && selectedMemberId !== member?.id ? (
                        <button onClick={() => handleClaim(item.id)} disabled={claimingId === item.id} style={{
                          padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700,
                          background: 'rgba(74,222,128,0.12)', border: '1px solid rgba(74,222,128,0.3)',
                          color: '#4ADE80', cursor: 'pointer', opacity: claimingId === item.id ? 0.5 : 1,
                        }}>{claimingId === item.id ? '...' : '🎁 Claim'}</button>
                      ) : isParent || selectedMemberId === member?.id ? (
                        <span style={{ fontSize: 11, color: 'var(--text-muted)', padding: '6px 8px' }}>unclaimed</span>
                      ) : null}
                      {(isParent || selectedMemberId === member?.id) && (
                        <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} style={{
                          width: 28, height: 28, borderRadius: 8, fontSize: 14,
                          background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.25)',
                          color: '#F87171', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        }}>{deletingId === item.id ? '...' : '×'}</button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </>
          )}

          {/* Claimed — only parents see who claimed what */}
          {claimed.length > 0 && isParent && (
            <>
              <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 8, marginTop: 16 }}>
                ✅ CLAIMED ({claimed.length})
              </div>
              {claimed.map(item => {
                const claimedByMember = memberList.find(m => m.id === item.claimedBy);
                return (
                  <div key={item.id} style={{
                    padding: '14px', borderRadius: 14, marginBottom: 8, opacity: 0.6,
                    background: 'rgba(74,222,128,0.05)', border: '1.5px solid rgba(74,222,128,0.2)',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span style={{ fontSize: 22 }}>✅</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 14, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{item.title}</div>
                        {claimedByMember && (
                          <div style={{ fontSize: 11, color: '#4ADE80', marginTop: 2, fontWeight: 700 }}>
                            Claimed by {claimedByMember.emoji} {claimedByMember.name}
                          </div>
                        )}
                      </div>
                      {item.price && <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>${parseFloat(item.price).toFixed(2)}</div>}
                    </div>
                  </div>
                );
              })}
            </>
          )}

          {/* Kids see a teaser for claimed items without spoiling who claimed */}
          {claimed.length > 0 && !isParent && selectedMemberId === member?.id && (
            <div style={{
              padding: '12px 16px', borderRadius: 14, marginTop: 8,
              background: 'rgba(124,111,247,0.08)', border: '1.5px solid rgba(124,111,247,0.2)',
              textAlign: 'center',
            }}>
              <div style={{ fontSize: 20, marginBottom: 4 }}>🎉</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#A78BFA' }}>
                {claimed.length} wish{claimed.length !== 1 ? 'es' : ''} might be coming your way...
              </div>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>Someone's already on it! 🤫</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}