import { useState } from 'react';
import { useRewards, useRedemptions, useCreateReward, useDeleteReward, useRedeemReward, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const REWARD_EMOJIS = ['🎮','🍦','🎬','🎪','🛁','📱','🧸','🎠','🍕','🎁','🏖️','🎈'];

export default function RewardsPage() {
  const { member } = useAuthStore();
  const { data: rewards = [] } = useRewards();
  const { data: redemptions = [] } = useRedemptions();
  const { data: members = [] } = useMembers();
  const createReward = useCreateReward();
  const deleteReward = useDeleteReward();
  const redeemReward = useRedeemReward();

  const [showAdd, setShowAdd] = useState(false);
  const [tab, setTab] = useState<'shop'|'history'|'leaderboard'>('shop');
  const [newReward, setNewReward] = useState({ name: '', emoji: '🎮', cost: 20, description: '' });

  const isParent = member?.role === 'parent';

  return (
    <div style={{ maxWidth: 680 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>⭐ Rewards</h1>
        {isParent && <button onClick={() => setShowAdd(true)} className="btn btn-primary" style={{ fontSize: 13 }}>+ Add reward</button>}
      </div>

      {/* My stars */}
      <div className="card" style={{ marginBottom: 16, background: 'linear-gradient(135deg,rgba(245,158,11,0.1),rgba(251,146,60,0.05))', borderColor: 'rgba(245,158,11,0.3)', textAlign: 'center' }}>
        <div style={{ fontSize: 32, fontWeight: 900, color: 'var(--warning)' }}>⭐ {member?.stars || 0}</div>
        <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-secondary)', marginTop: 4 }}>Your stars</div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {(['shop','leaderboard','history'] as const).map(t => (
          <button key={t} onClick={() => setTab(t)} style={{
            padding: '7px 14px', borderRadius: 20, fontSize: 12, fontWeight: 800, cursor: 'pointer',
            background: tab === t ? 'var(--primary)' : 'var(--bg-secondary)',
            color: tab === t ? '#fff' : 'var(--text-secondary)',
            border: `1.5px solid ${tab === t ? 'var(--primary)' : 'var(--border)'}`
          }}>
            {t === 'shop' ? '🛒 Shop' : t === 'leaderboard' ? '🏆 Rankings' : '📜 History'}
          </button>
        ))}
      </div>

      {tab === 'shop' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px,1fr))', gap: 10 }}>
          {(rewards as any[]).map((r: any) => {
            const canAfford = (member?.stars || 0) >= r.cost;
            return (
              <div key={r.id} className="card" style={{ textAlign: 'center', opacity: canAfford ? 1 : 0.6 }}>
                <div style={{ fontSize: 36, marginBottom: 8 }}>{r.emoji}</div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{r.name}</div>
                {r.description && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4, fontWeight: 600 }}>{r.description}</div>}
                <div style={{ fontWeight: 900, color: 'var(--warning)', fontSize: 16, margin: '10px 0' }}>⭐ {r.cost}</div>
                <div style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                  <button onClick={() => { if (canAfford && confirm(`Spend ⭐${r.cost} on ${r.name}?`)) redeemReward.mutate(r.id); }}
                    className="btn btn-primary" style={{ flex: 1, fontSize: 12 }} disabled={!canAfford || redeemReward.isPending}>
                    {canAfford ? '🛒 Redeem' : '🔒 Need more'}
                  </button>
                  {isParent && (
                    <button onClick={() => { if (confirm('Delete reward?')) deleteReward.mutate(r.id); }} style={{ padding: '6px 8px', borderRadius: 8, background: 'var(--bg-tertiary)', border: '1.5px solid var(--border)', cursor: 'pointer', fontSize: 14 }}>🗑</button>
                  )}
                </div>
              </div>
            );
          })}
          {(rewards as any[]).length === 0 && (
            <div style={{ gridColumn: '1/-1', textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontWeight: 700 }}>
              No rewards yet. {isParent ? 'Add some!' : 'Ask a parent to add rewards!'}
            </div>
          )}
        </div>
      )}

      {tab === 'leaderboard' && (
        <div>
          {(members as any[]).sort((a, b) => b.stars - a.stars).map((m: any, i: number) => (
            <div key={m.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 20, minWidth: 28 }}>{i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i+1}`}</span>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>{m.emoji}</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700 }}>{m.role}</div>
              </div>
              <span style={{ fontWeight: 900, fontSize: 18, color: 'var(--warning)' }}>⭐ {m.stars}</span>
            </div>
          ))}
        </div>
      )}

      {tab === 'history' && (
        <div>
          {(redemptions as any[]).length === 0 ? (
            <div style={{ textAlign: 'center', padding: '30px 0', color: 'var(--text-muted)', fontWeight: 700 }}>No redemptions yet!</div>
          ) : (redemptions as any[]).map((r: any) => (
            <div key={r.id} className="card" style={{ marginBottom: 8, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 24 }}>{r.reward?.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{r.reward?.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-secondary)', fontWeight: 700 }}>{r.member?.emoji} {r.member?.name} · ⭐{r.reward?.cost}</div>
              </div>
              <span style={{ fontSize: 11, fontWeight: 800, color: r.approved ? 'var(--success)' : 'var(--warning)' }}>
                {r.approved ? '✅ Approved' : '⏳ Pending'}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="modal-overlay" onClick={() => setShowAdd(false)}>
          <div className="modal" onClick={e => e.stopPropagation()}>
            <div style={{ fontWeight: 900, fontSize: 16, marginBottom: 16 }}>➕ Add Reward</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {REWARD_EMOJIS.map(e => (
                  <button type="button" key={e} onClick={() => setNewReward(p => ({ ...p, emoji: e }))} style={{
                    fontSize: 18, width: 36, height: 36, borderRadius: 8, border: `2px solid ${newReward.emoji === e ? 'var(--primary)' : 'var(--border)'}`,
                    background: 'var(--bg-secondary)', cursor: 'pointer'
                  }}>{e}</button>
                ))}
              </div>
              <input className="input" placeholder="Reward name" value={newReward.name} onChange={e => setNewReward(p => ({ ...p, name: e.target.value }))} autoFocus />
              <div>
                <label style={{ display: 'block', fontSize: 11, fontWeight: 800, marginBottom: 4 }}>⭐ Star cost</label>
                <input type="number" className="input" min={1} value={newReward.cost} onChange={e => setNewReward(p => ({ ...p, cost: +e.target.value }))} />
              </div>
              <input className="input" placeholder="Description (optional)" value={newReward.description} onChange={e => setNewReward(p => ({ ...p, description: e.target.value }))} />
              <div className="flex gap-3">
                <button className="btn btn-ghost" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
                <button className="btn btn-primary" style={{ flex: 2 }} disabled={!newReward.name.trim() || createReward.isPending}
                  onClick={() => { createReward.mutate(newReward); setShowAdd(false); }}>
                  {createReward.isPending ? 'Adding...' : '+ Add Reward'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
