import { useState } from 'react';
import { useRewards, useRedemptions, useCreateReward, useDeleteReward, useRedeemReward, useApproveRedemption, useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const REWARD_EMOJIS = ['🎮','🍕','🎬','🛍️','🎡','🏖️','🎁','⭐','🏆','🎯','🎪','🎭','🎨','🍦','🎵'];

const BADGE_META: Record<string, { icon: string; label: string; color: string }> = {
  first_chore: { icon: '🌟', label: 'First Chore',  color: '#FBBF24' },
  streak_7:    { icon: '🔥', label: '7-Day Streak', color: '#FB923C' },
  streak_30:   { icon: '💎', label: '30-Day Streak', color: '#60A5FA' },
  star_50:     { icon: '⭐', label: '50 Stars',      color: '#4ADE80' },
  star_100:    { icon: '🌠', label: '100 Stars',     color: '#A78BFA' },
};

export default function RewardsPage() {
  const { member } = useAuthStore();
  const { data: rewards = [], isLoading } = useRewards();
  const { data: redemptions = [] }        = useRedemptions();
  const { data: members = [] }            = useMembers();
  const createReward    = useCreateReward();
  const deleteReward    = useDeleteReward();
  const redeemReward    = useRedeemReward();
  const approveRedemption = useApproveRedemption();

  const [tab, setTab]     = useState<'rewards' | 'pending' | 'history'>('rewards');
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm]   = useState({ title: '', emoji: '🎁', starCost: 10, description: '' });

  const isParent = member?.role === 'parent';
  const allRewards    = rewards     as any[];
  const allRedemptions = redemptions as any[];
  const pending  = allRedemptions.filter(r => r.status === 'pending');
  const history  = allRedemptions.filter(r => r.status !== 'pending');

  const myMember = (members as any[]).find(m => m.id === member?.id);
  const myStars  = myMember?.stars ?? 0;
  const myStreak = myMember?.streakDays ?? 0;
  const myBadges: string[] = myMember?.badges ?? [];

  const handleAdd = async () => {
    if (!form.title.trim()) return;
    try {
      await createReward.mutateAsync(form);
      setForm({ title: '', emoji: '🎁', starCost: 10, description: '' });
      setShowAdd(false);
    } catch (e) { console.error(e); }
  };

  const statusColor: Record<string, string> = {
    pending:  '#FBBF24',
    approved: '#4ADE80',
    rejected: '#F87171',
  };

  return (
    <div style={{ padding: '16px 16px 80px' }}>

      {/* Header + star balance */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 12 }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 800, margin: 0 }}>🏆 Rewards</h1>
          <p style={{ fontSize: 12, color: 'var(--text-muted)', margin: '2px 0 0' }}>
            Earn stars, redeem rewards
          </p>
        </div>
        {isParent && (
          <button onClick={() => setShowAdd(true)} style={{
            padding: '9px 16px', background: 'var(--primary)',
            border: 'none', borderRadius: 10, color: '#fff',
            fontWeight: 700, fontSize: 13, cursor: 'pointer',
          }}>+ Add Reward</button>
        )}
      </div>

      {/* My stats card */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(99,102,241,0.15), rgba(244,114,182,0.08))',
        border: '1px solid rgba(99,102,241,0.3)',
        borderRadius: 16, padding: '16px', marginBottom: 16,
      }}>
        <div style={{ display: 'flex', gap: 20, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Stars */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#FBBF24' }}>⭐ {myStars}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Stars</div>
          </div>
          {/* Streak */}
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color: '#FB923C' }}>🔥 {myStreak}</div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>Day Streak</div>
          </div>
          {/* Badges */}
          {myBadges.length > 0 && (
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 6 }}>MY BADGES</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {myBadges.map(b => {
                  const m = BADGE_META[b] || { icon: '🏅', label: b, color: '#94A3B8' };
                  return (
                    <div key={b} style={{
                      display: 'flex', alignItems: 'center', gap: 5,
                      background: `${m.color}22`, border: `1px solid ${m.color}44`,
                      borderRadius: 20, padding: '4px 10px',
                      fontSize: 12, fontWeight: 700, color: m.color,
                    }}>
                      <span>{m.icon}</span><span>{m.label}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {myBadges.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
              Complete chores to earn badges! 🎯
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {[
          { key: 'rewards',  label: '🎁 Rewards' },
          { key: 'pending',  label: `⏳ Pending${pending.length > 0 ? ` (${pending.length})` : ''}` },
          { key: 'history',  label: '📜 History' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key as any)} style={{
            padding: '7px 14px', borderRadius: 20,
            background: tab === t.key ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
            border: tab === t.key ? 'none' : '1px solid rgba(255,255,255,0.1)',
            color: tab === t.key ? '#fff' : 'var(--text-muted)',
            fontSize: 12, fontWeight: tab === t.key ? 700 : 500, cursor: 'pointer',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── REWARDS tab ── */}
      {tab === 'rewards' && (
        isLoading ? (
          <div style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>Loading...</div>
        ) : allRewards.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>🎁</div>
            <div style={{ marginBottom: 12 }}>No rewards yet</div>
            {isParent && (
              <button onClick={() => setShowAdd(true)} style={{
                padding: '10px 20px', background: 'var(--primary)', border: 'none',
                borderRadius: 10, color: '#fff', fontWeight: 700, fontSize: 14, cursor: 'pointer',
              }}>+ Create first reward</button>
            )}
          </div>
        ) : allRewards.map((reward: any) => {
          const canAfford = myStars >= reward.starCost;
          return (
            <div key={reward.id} style={{
              background: 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${canAfford ? 'rgba(99,102,241,0.3)' : 'rgba(255,255,255,0.08)'}`,
              borderRadius: 14, padding: '14px', marginBottom: 10,
              display: 'flex', alignItems: 'center', gap: 12,
            }}>
              <span style={{ fontSize: 30, flexShrink: 0 }}>{reward.emoji || '🎁'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 700, fontSize: 15 }}>{reward.title}</div>
                {reward.description && (
                  <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>{reward.description}</div>
                )}
                <div style={{
                  fontSize: 13, fontWeight: 700, color: '#FBBF24', marginTop: 4,
                }}>⭐ {reward.starCost} stars</div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flexShrink: 0 }}>
                <button
                  onClick={() => redeemReward.mutate(reward.id)}
                  disabled={!canAfford || redeemReward.isPending}
                  style={{
                    padding: '8px 14px', borderRadius: 10,
                    background: canAfford ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                    border: 'none', color: canAfford ? '#fff' : 'var(--text-muted)',
                    fontWeight: 700, fontSize: 12, cursor: canAfford ? 'pointer' : 'not-allowed',
                  }}
                >{canAfford ? 'Redeem' : `Need ${reward.starCost - myStars} more`}</button>
                {isParent && (
                  <button onClick={() => { if (confirm('Delete this reward?')) deleteReward.mutate(reward.id); }}
                    style={{
                      padding: '4px 10px', borderRadius: 8, fontSize: 11,
                      background: 'rgba(248,113,113,0.1)', border: '1px solid rgba(248,113,113,0.2)',
                      color: '#F87171', cursor: 'pointer',
                    }}>Delete</button>
                )}
              </div>
            </div>
          );
        })
      )}

      {/* ── PENDING tab ── */}
      {tab === 'pending' && (
        pending.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>✅</div>
            No pending redemptions
          </div>
        ) : pending.map((r: any) => {
          const requester = (members as any[]).find(m => m.id === r.memberId || m.id === r.member?.id);
          return (
            <div key={r.id} style={{
              background: 'rgba(251,191,36,0.06)',
              border: '1.5px solid rgba(251,191,36,0.3)',
              borderRadius: 14, padding: '14px', marginBottom: 10,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                <span style={{ fontSize: 26 }}>{r.reward?.emoji || '🎁'}</span>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 14 }}>{r.reward?.title}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                    Requested by {requester?.emoji} {requester?.name || 'Unknown'}
                  </div>
                </div>
                <div style={{ fontWeight: 700, color: '#FBBF24', fontSize: 13 }}>⭐ {r.reward?.starCost}</div>
              </div>
              {isParent && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    onClick={() => approveRedemption.mutate({ id: r.id, approved: true })}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      background: 'rgba(74,222,128,0.15)', border: '1.5px solid #4ADE80',
                      color: '#4ADE80', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>✅ Approve</button>
                  <button
                    onClick={() => approveRedemption.mutate({ id: r.id, approved: false })}
                    style={{
                      flex: 1, padding: '9px', borderRadius: 10,
                      background: 'rgba(248,113,113,0.15)', border: '1.5px solid #F87171',
                      color: '#F87171', fontWeight: 700, fontSize: 13, cursor: 'pointer',
                    }}>❌ Reject</button>
                </div>
              )}
              {!isParent && (
                <div style={{
                  fontSize: 12, color: '#FBBF24', textAlign: 'center', fontWeight: 600,
                }}>⏳ Waiting for parent approval</div>
              )}
            </div>
          );
        })
      )}

      {/* ── HISTORY tab ── */}
      {tab === 'history' && (
        history.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: 40, marginBottom: 10 }}>📜</div>
            No redemption history yet
          </div>
        ) : history.map((r: any) => {
          const requester = (members as any[]).find(m => m.id === r.memberId || m.id === r.member?.id);
          return (
            <div key={r.id} style={{
              background: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.08)',
              borderRadius: 12, padding: '12px 14px', marginBottom: 8,
              display: 'flex', alignItems: 'center', gap: 10,
            }}>
              <span style={{ fontSize: 22 }}>{r.reward?.emoji || '🎁'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: 14 }}>{r.reward?.title}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                  {requester?.emoji} {requester?.name} · {new Date(r.createdAt).toLocaleDateString()}
                </div>
              </div>
              <span style={{
                fontSize: 11, fontWeight: 700,
                color: statusColor[r.status] || '#94A3B8',
                background: `${statusColor[r.status] || '#94A3B8'}22`,
                borderRadius: 6, padding: '3px 8px',
                textTransform: 'capitalize',
              }}>{r.status}</span>
            </div>
          );
        })
      )}

      {/* ── ADD REWARD MODAL ── */}
      {showAdd && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)',
          display: 'flex', alignItems: 'flex-end', zIndex: 1000,
        }} onClick={e => e.target === e.currentTarget && setShowAdd(false)}>
          <div style={{
            width: '100%', maxWidth: 480, margin: '0 auto',
            background: 'var(--surface)', borderRadius: '20px 20px 0 0',
            padding: '24px 20px 40px',
          }}>
            <h2 style={{ margin: '0 0 16px', fontSize: 18, fontWeight: 800 }}>+ New Reward</h2>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 14 }}>
              {REWARD_EMOJIS.map(e => (
                <button key={e} onClick={() => setForm(f => ({ ...f, emoji: e }))} style={{
                  width: 38, height: 38, borderRadius: 8, fontSize: 20,
                  background: form.emoji === e ? 'var(--primary)' : 'rgba(255,255,255,0.06)',
                  border: form.emoji === e ? '2px solid var(--primary)' : '1px solid rgba(255,255,255,0.1)',
                  cursor: 'pointer',
                }}>{e}</button>
              ))}
            </div>

            <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Reward name..." className="input"
              style={{ width: '100%', marginBottom: 12 }} autoFocus />

            <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              placeholder="Description (optional)..." className="input"
              style={{ width: '100%', marginBottom: 12 }} />

            <div style={{ marginBottom: 20 }}>
              <label style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 6, display: 'block' }}>
                ⭐ Star cost: {form.starCost}
              </label>
              <input type="range" min={1} max={100} value={form.starCost}
                onChange={e => setForm(f => ({ ...f, starCost: Number(e.target.value) }))}
                style={{ width: '100%' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-muted)' }}>
                <span>1 ⭐ (tiny)</span><span>50 ⭐ (big)</span><span>100 ⭐ (epic)</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <button className="btn" style={{ flex: 1 }} onClick={() => setShowAdd(false)}>Cancel</button>
              <button className="btn btn-primary" style={{ flex: 2 }}
                onClick={handleAdd} disabled={!form.title.trim() || createReward.isPending}>
                {createReward.isPending ? 'Creating...' : '+ Create Reward'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}