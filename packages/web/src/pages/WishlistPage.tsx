import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

function avatarSrc(url?: string | null) {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return (import.meta.env.VITE_API_URL || '') + url;
}

const STATUS_META: Record<string, { label: string; color: string; icon: string }> = {
  approved: { label: 'Approved', color: '#10B981', icon: '✅' },
  declined: { label: 'Declined', color: '#EF4444', icon: '❌' },
  deferred: { label: 'Maybe later', color: '#F59E0B', icon: '⏳' },
};

export default function WishlistPage() {
  const { member, isParent } = useAuthStore();
  const qc = useQueryClient();
  const [selectedMemberId, setSelectedMemberId] = useState<string>(member?.id || '');
  useEffect(() => { if (!selectedMemberId && member?.id) setSelectedMemberId(member.id); }, [member?.id]);
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [price, setPrice] = useState('');
  const [saving, setSaving] = useState(false);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  // Review modal (decline / defer)
  const [reviewItem, setReviewItem] = useState<any | null>(null);
  const [reviewMode, setReviewMode] = useState<'decline' | 'defer'>('decline');
  const [reason, setReason] = useState('');
  const [deferDate, setDeferDate] = useState('');

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
  const visibleMembers = memberList;
  const selectedMember = memberList.find((m: any) => m.id === selectedMemberId);

  function resetForm() {
    setTitle(''); setUrl(''); setPrice('');
    setAdding(false); setEditingId(null);
  }

  function startAdd() {
    resetForm();
    setAdding(true);
  }

  function startEdit(item: any) {
    setEditingId(item.id);
    setAdding(true);
    setTitle(item.title || '');
    setUrl(item.url || '');
    setPrice(item.price != null ? String(item.price) : '');
  }

  async function handleSave() {
    if (!title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        title: title.trim(),
        url: url.trim() || null,
        price: price ? parseFloat(price) : null,
      };
      if (editingId) {
        await api.patch(`/wishlist/${editingId}`, payload);
      } else {
        if (!selectedMemberId) return;
        await api.post(`/wishlist/${selectedMemberId}`, payload);
      }
      qc.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
      resetForm();
    } catch (e: any) {
      alert(e.response?.data?.error || 'Failed to save item');
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

  async function handleApprove(id: string) {
    setBusyId(id);
    try {
      await api.patch(`/wishlist/${id}/approve`, {});
      qc.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to approve'); }
    finally { setBusyId(null); }
  }

  function openReview(item: any, mode: 'decline' | 'defer') {
    setReviewItem(item);
    setReviewMode(mode);
    setReason(item.declineReason || '');
    setDeferDate(item.deferUntil ? new Date(item.deferUntil).toISOString().slice(0, 10) : '');
  }

  async function submitReview() {
    if (!reviewItem || !reason.trim()) return;
    setBusyId(reviewItem.id);
    try {
      if (reviewMode === 'decline') {
        await api.patch(`/wishlist/${reviewItem.id}/decline`, { reason: reason.trim() });
      } else {
        await api.patch(`/wishlist/${reviewItem.id}/defer`, {
          reason: reason.trim(),
          deferUntil: deferDate ? new Date(deferDate.replace(/-/g, '/')).toISOString() : null,
        });
      }
      qc.invalidateQueries({ queryKey: ['wishlist', selectedMemberId] });
      setReviewItem(null); setReason(''); setDeferDate('');
    } catch (e: any) { alert(e.response?.data?.error || 'Failed to save'); }
    finally { setBusyId(null); }
  }

  const items = wishlist as any[];
  const isViewingOwnList = selectedMemberId === member?.id;
  const unclaimed = items.filter((i: any) => !i.claimed);
  const claimed = isViewingOwnList ? [] : items.filter((i: any) => i.claimed);

  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.15)',
    background: 'rgba(255,255,255,0.07)', color: 'var(--text)', fontSize: 14, boxSizing: 'border-box',
  };
  const btnStyle = (color: string): React.CSSProperties => ({
    padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 13, background: color, color: '#fff',
  });
  const smBtn = (color: string): React.CSSProperties => ({
    padding: '6px 10px', borderRadius: 8, border: 'none', cursor: 'pointer',
    fontWeight: 700, fontSize: 12, background: color, color: '#fff', whiteSpace: 'nowrap',
  });

  // Owner of the currently viewed list can edit their own wishes; parents can edit any.
  const canEdit = isParent || isViewingOwnList;

  return (
    <div style={{ padding: '16px 16px 80px', maxWidth: 600, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 4px' }}>Wishlists</h1>
      <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '0 0 16px' }}>
        See what everyone wants &mdash; claim gifts secretly!
      </p>

      {visibleMembers.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
          {visibleMembers.map((m: any) => {
            const isSelected = selectedMemberId === m.id;
            return (
              <button key={m.id} onClick={() => { setSelectedMemberId(m.id); resetForm(); }} style={{
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

      {selectedMemberId === member?.id && !adding && (
        <button onClick={startAdd} style={{ ...btnStyle('#7C3AED'), marginBottom: 16, width: '100%' }}>
          + Add a Wish
        </button>
      )}

      {adding && (
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 16, marginBottom: 16, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ fontSize: 14, fontWeight: 800 }}>{editingId ? 'Edit wish' : 'New wish'}</div>
          <input style={inputStyle} placeholder="What do you wish for? *" value={title} onChange={e => setTitle(e.target.value)} />
          <input style={inputStyle} placeholder="Link (optional)" value={url} onChange={e => setUrl(e.target.value)} />
          <input style={inputStyle} placeholder="Price (optional)" type="number" value={price} onChange={e => setPrice(e.target.value)} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button onClick={handleSave} disabled={saving || !title.trim()} style={btnStyle('#7C3AED')}>
              {saving ? 'Saving...' : editingId ? 'Update Wish' : 'Save Wish'}
            </button>
            <button onClick={resetForm} style={btnStyle('#555')}>Cancel</button>
          </div>
        </div>
      )}

      {unclaimed.length === 0 && claimed.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)', fontSize: 14 }}>
          {isViewingOwnList ? 'No wishes yet — add something!' : `${selectedMember?.name || 'This person'} hasn't added any wishes yet`}
        </div>
      )}

      {unclaimed.map((item: any) => {
        const sm = STATUS_META[item.status];
        return (
          <div key={item.id} style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{item.title}</div>
                {item.price && <div style={{ fontSize: 12, color: '#F59E0B', marginTop: 2 }}>${item.price.toFixed(2)}</div>}
                {item.url && <a href={item.url} target="_blank" rel="noreferrer" style={{ fontSize: 11, color: '#60A5FA', marginTop: 2, display: 'block', wordBreak: 'break-all' }}>{item.url}</a>}
              </div>
              <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                {!isViewingOwnList && (
                  <button onClick={() => handleClaim(item.id)} disabled={claimingId === item.id} style={btnStyle('#10B981')}>
                    {claimingId === item.id ? '...' : 'Claim'}
                  </button>
                )}
                {canEdit && (
                  <button onClick={() => startEdit(item)} style={btnStyle('#6366F1')} title="Edit wish">
                    Edit
                  </button>
                )}
                {(isParent || isViewingOwnList) && (
                  <button onClick={() => handleDelete(item.id)} disabled={deletingId === item.id} style={btnStyle('#EF4444')}>
                    {deletingId === item.id ? '...' : 'x'}
                  </button>
                )}
              </div>
            </div>

            {/* Status banner — visible to everyone */}
            {sm && (
              <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: sm.color + '18', border: `1px solid ${sm.color}40` }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: sm.color }}>
                  {sm.icon} {sm.label}
                  {item.status === 'deferred' && item.deferUntil && ` until ${new Date(item.deferUntil).toLocaleDateString()}`}
                </div>
                {item.declineReason && (
                  <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3, opacity: 0.85 }}>{item.declineReason}</div>
                )}
              </div>
            )}

            {/* Parent review controls */}
            {isParent && (
              <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                <button onClick={() => handleApprove(item.id)} disabled={busyId === item.id} style={smBtn('#10B981')}>Approve</button>
                <button onClick={() => openReview(item, 'defer')} disabled={busyId === item.id} style={smBtn('#F59E0B')}>Maybe later</button>
                <button onClick={() => openReview(item, 'decline')} disabled={busyId === item.id} style={smBtn('#EF4444')}>Decline</button>
              </div>
            )}
          </div>
        );
      })}

      {claimed.length > 0 && (
        <>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', margin: '16px 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
            Already claimed
          </div>
          {claimed.map((item: any) => {
            const sm = STATUS_META[item.status];
            return (
            <div key={item.id} style={{ background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, padding: 14, marginBottom: 10 }}>
              <div style={{ fontWeight: 700, fontSize: 15, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{item.title}</div>
              {isParent && item.claimedBy && (
                <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>
                  Claimed by {memberList.find((m: any) => m.id === item.claimedBy)?.name || 'someone'}
                </div>
              )}
              {!isParent && (
                <div style={{ fontSize: 11, color: '#10B981', marginTop: 4 }}>Someone's already on it! Shhh...</div>
              )}
              {sm && (
                <div style={{ marginTop: 10, padding: '8px 10px', borderRadius: 8, background: sm.color + '18', border: `1px solid ${sm.color}40` }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: sm.color }}>
                    {sm.icon} {sm.label}
                    {item.status === 'deferred' && item.deferUntil && ` until ${new Date(item.deferUntil).toLocaleDateString()}`}
                  </div>
                  {item.declineReason && (
                    <div style={{ fontSize: 12, color: 'var(--text)', marginTop: 3, opacity: 0.85 }}>{item.declineReason}</div>
                  )}
                </div>
              )}
              {isParent && (
                <div style={{ display: 'flex', gap: 6, marginTop: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => handleApprove(item.id)} disabled={busyId === item.id} style={smBtn('#10B981')}>Approve</button>
                  <button onClick={() => openReview(item, 'defer')} disabled={busyId === item.id} style={smBtn('#F59E0B')}>Maybe later</button>
                  <button onClick={() => openReview(item, 'decline')} disabled={busyId === item.id} style={smBtn('#EF4444')}>Decline</button>
                </div>
              )}
            </div>
            );
          })}
        </>
      )}

      {/* Review modal */}
      {reviewItem && (
        <div onClick={() => setReviewItem(null)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 100 }}>
          <div onClick={e => e.stopPropagation()} style={{ background: '#1a1a24', borderRadius: 16, padding: 20, width: '100%', maxWidth: 420, border: '1px solid rgba(255,255,255,0.12)' }}>
            <div style={{ fontSize: 16, fontWeight: 800, marginBottom: 4 }}>
              {reviewMode === 'decline' ? 'Decline this wish' : 'Maybe later'}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 14 }}>{reviewItem.title}</div>
            <textarea
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={reviewMode === 'decline' ? 'Why not? (e.g. too expensive right now)' : 'Why wait? (e.g. saving this for your birthday)'}
              style={{ ...inputStyle, minHeight: 80, resize: 'vertical', fontFamily: 'inherit' }}
            />
            {reviewMode === 'defer' && (
              <div style={{ marginTop: 10 }}>
                <label style={{ fontSize: 12, color: 'var(--text-muted)', display: 'block', marginBottom: 4 }}>Revisit on (optional)</label>
                <input type="date" value={deferDate} onChange={e => setDeferDate(e.target.value)} style={inputStyle} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 16 }}>
              <button onClick={() => setReviewItem(null)} style={{ ...btnStyle('#444'), flex: 1 }}>Cancel</button>
              <button onClick={submitReview} disabled={!reason.trim() || busyId === reviewItem.id}
                style={{ ...btnStyle(reviewMode === 'decline' ? '#EF4444' : '#F59E0B'), flex: 2 }}>
                {busyId === reviewItem.id ? 'Saving...' : reviewMode === 'decline' ? 'Decline' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}