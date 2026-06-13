import { useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

export default function StreakCard() {
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();

  const me = (members as any[]).find((m: any) => m.id === member?.id) || member;
  const myStreak = me?.streakDays || 0;
  const active = myStreak > 0;

  const ranked = [...(members as any[])]
    .filter((m: any) => typeof m.streakDays === 'number')
    .sort((a: any, b: any) => (b.streakDays || 0) - (a.streakDays || 0));

  return (
    <div style={{ borderRadius: 20, overflow: 'hidden', border: '1.5px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
      {/* My streak header */}
      <div style={{
        padding: '18px 20px', display: 'flex', alignItems: 'center', gap: 16,
        background: active
          ? 'linear-gradient(135deg, rgba(249,115,22,0.18), rgba(239,68,68,0.10))'
          : 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        <div style={{ fontSize: 42, lineHeight: 1, filter: active ? 'none' : 'grayscale(1) opacity(0.4)' }}>🔥</div>
        <div>
          <div style={{ fontSize: 30, fontWeight: 900, color: active ? '#F97316' : 'var(--text-muted)', lineHeight: 1 }}>
            {myStreak}
          </div>
          <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-muted)', marginTop: 4 }}>
            {myStreak === 1 ? 'day streak' : 'day streak'}{active ? ' — keep it going!' : ' — complete a chore on time to start'}
          </div>
        </div>
      </div>

      {/* Family leaderboard */}
      <div style={{ padding: '6px 0' }}>
        <div style={{ padding: '8px 20px 4px', fontSize: 11, fontWeight: 900, letterSpacing: '0.06em', color: 'var(--text-muted)' }}>
          🏆 FAMILY STREAKS
        </div>
        {ranked.length === 0 ? (
          <div style={{ padding: '12px 20px', fontSize: 13, color: 'var(--text-muted)' }}>No streaks yet</div>
        ) : ranked.map((m: any, i: number) => {
          const isMe = m.id === me?.id;
          const lit = (m.streakDays || 0) > 0;
          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '9px 20px',
              background: isMe ? 'rgba(99,102,241,0.08)' : 'transparent',
            }}>
              <div style={{ width: 20, fontSize: 12, fontWeight: 900, color: i === 0 && lit ? '#F97316' : 'var(--text-muted)', textAlign: 'center' }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 20 }}>{m.emoji}</div>
              <div style={{ flex: 1, fontSize: 14, fontWeight: 700, color: isMe ? '#A78BFA' : 'var(--text)' }}>
                {m.name}{isMe ? ' (you)' : ''}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 14, fontWeight: 900, color: lit ? '#F97316' : 'var(--text-muted)' }}>
                <span style={{ filter: lit ? 'none' : 'grayscale(1) opacity(0.4)' }}>🔥</span>
                {m.streakDays || 0}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}