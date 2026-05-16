import { useMemo } from 'react';
import { useMembers, useChores, useRedemptions, useQuests } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function StatCard({ emoji, label, value, sub, color }: { emoji: string; label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div className="card" style={{ textAlign: 'center', padding: '16px 12px' }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{emoji}</div>
      <div style={{ fontWeight: 900, fontSize: 22, color: color || 'var(--text-primary)' }}>{value}</div>
      <div style={{ fontSize: 11, fontWeight: 800, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--text-muted)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

export default function ReportPage() {
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();
  const { data: chores = [] } = useChores();
  const { data: redemptions = [] } = useRedemptions();
  const { data: quests = [] } = useQuests();
  const isParent = member?.role === 'parent';

  const now = new Date();
  const thisMonth = now.getMonth();
  const thisYear = now.getFullYear();

  const stats = useMemo(() => {
    const choresDoneThisMonth = (chores as any[]).filter((c: any) => {
      if (!c.completedAt) return false;
      const d = new Date(c.completedAt);
      return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
    });

    const totalStarsEarned = choresDoneThisMonth.reduce((acc: number, c: any) => acc + (c.stars || 0), 0);
    const totalStarsSpent = (redemptions as any[])
      .filter((r: any) => {
        const d = new Date(r.createdAt);
        return d.getMonth() === thisMonth && d.getFullYear() === thisYear;
      })
      .reduce((acc: number, r: any) => acc + (r.reward?.cost || 0), 0);

    const questsDone = (quests as any[]).filter((q: any) => !!q.completedAt).length;

    // Per-member stats
    const memberStats = (members as any[]).map((m: any) => {
      const mChores = choresDoneThisMonth.filter((c: any) => c.memberId === m.id);
      const mStars = mChores.reduce((acc: number, c: any) => acc + (c.stars || 0), 0);
      return { ...m, choresDone: mChores.length, starsEarned: mStars };
    }).sort((a: any, b: any) => b.starsEarned - a.starsEarned);

    // Chores by day of week (last 30 days)
    const dayCount = [0,0,0,0,0,0,0];
    const last30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    (chores as any[]).forEach((c: any) => {
      if (c.completedAt && new Date(c.completedAt) > last30) {
        dayCount[new Date(c.completedAt).getDay()]++;
      }
    });

    return { choresDoneThisMonth, totalStarsEarned, totalStarsSpent, questsDone, memberStats, dayCount };
  }, [chores, members, redemptions, quests, thisMonth, thisYear]);

  const maxDayCount = Math.max(...stats.dayCount, 1);
  const DAYS = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h1 style={{ fontSize: 22, fontWeight: 900 }}>📊 Report</h1>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)' }}>
          {MONTHS[thisMonth]} {thisYear}
        </div>
      </div>

      {/* Top stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 10, marginBottom: 20 }}>
        <StatCard emoji="✅" label="Chores This Month" value={stats.choresDoneThisMonth.length} color="var(--success)" />
        <StatCard emoji="⭐" label="Stars Earned" value={stats.totalStarsEarned} color="var(--warning)" />
        <StatCard emoji="🛒" label="Stars Spent" value={stats.totalStarsSpent} color="var(--primary)" />
        <StatCard emoji="🗡️" label="Quests Done" value={stats.questsDone} color="#8b5cf6" />
      </div>

      {/* Chore activity by day of week */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 14 }}>📅 Activity by Day (last 30 days)</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'flex-end', height: 80 }}>
          {DAYS.map((day, i) => (
            <div key={day} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <div style={{
                width: '100%', minWidth: 10,
                height: `${Math.max(4, (stats.dayCount[i] / maxDayCount) * 60)}px`,
                borderRadius: 4,
                background: stats.dayCount[i] > 0 ? 'var(--primary)' : 'var(--bg-tertiary)',
                transition: 'height 0.3s ease'
              }} />
              <div style={{ fontSize: 9, fontWeight: 800, color: 'var(--text-muted)' }}>{day.slice(0,1)}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Per-member breakdown */}
      {isParent && (
        <div className="card" style={{ marginBottom: 16 }}>
          <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>👨‍👩‍👧 Member Breakdown</div>
          {stats.memberStats.length === 0 ? (
            <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 13 }}>No data yet.</div>
          ) : stats.memberStats.map((m: any, i: number) => (
            <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: i < stats.memberStats.length - 1 ? 12 : 0 }}>
              <div style={{ flexShrink: 0 }}>
                {m.avatarUrl ? (
                  <img src={m.avatarUrl} style={{ width: 36, height: 36, borderRadius: '50%', objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 36, height: 36, borderRadius: '50%', background: m.color, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>
                    {m.emoji}
                  </div>
                )}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</span>
                  <span style={{ fontWeight: 900, fontSize: 12, color: 'var(--warning)', flexShrink: 0, marginLeft: 8 }}>⭐ {m.starsEarned}</span>
                </div>
                <div style={{ height: 6, borderRadius: 3, background: 'var(--bg-tertiary)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%', borderRadius: 3, background: m.color || 'var(--primary)',
                    width: `${stats.memberStats[0]?.starsEarned > 0 ? (m.starsEarned / stats.memberStats[0].starsEarned) * 100 : 0}%`,
                    transition: 'width 0.4s ease'
                  }} />
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, marginTop: 3 }}>
                  {m.choresDone} chore{m.choresDone !== 1 ? 's' : ''} completed
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Recent completions */}
      <div className="card">
        <div style={{ fontWeight: 900, fontSize: 14, marginBottom: 12 }}>🕐 Recent Completions</div>
        {(chores as any[]).filter((c: any) => c.completedAt).slice(0, 10).length === 0 ? (
          <div style={{ color: 'var(--text-muted)', fontWeight: 700, fontSize: 13 }}>No completed chores yet.</div>
        ) : (chores as any[])
          .filter((c: any) => c.completedAt)
          .sort((a: any, b: any) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
          .slice(0, 10)
          .map((c: any) => (
            <div key={c.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontSize: 18, flexShrink: 0 }}>{c.emoji}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.title}</div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>
                  {c.member?.emoji} {c.member?.name} · {new Date(c.completedAt).toLocaleDateString()}
                </div>
              </div>
              <span style={{ fontWeight: 900, fontSize: 12, color: 'var(--warning)', flexShrink: 0 }}>⭐{c.stars}</span>
            </div>
          ))}
      </div>
    </div>
  );
}