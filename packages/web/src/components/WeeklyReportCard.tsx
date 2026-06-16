import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';

// Compact weekly report card for the dashboard.
// Pulls from GET /api/report and shows the highest-signal stats,
// with a link through to the full report page.
export default function WeeklyReportCard() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['report'],
    queryFn: () => api.get('/report').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });

  const wrap: React.CSSProperties = {
    background: 'linear-gradient(135deg, rgba(99,102,241,0.10), rgba(244,114,182,0.05))',
    border: '1px solid rgba(99,102,241,0.25)',
    borderRadius: 16, padding: 16, marginBottom: 16,
  };

  if (isLoading) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>📊 Weekly Report</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Crunching this week's numbers…</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div style={wrap}>
        <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--text-muted)' }}>📊 Weekly Report</div>
        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 8 }}>Couldn't load the report right now.</div>
      </div>
    );
  }

  const fam = data.family || {};
  const top = data.topMember;
  const streak = data.streakLeader;
  const summary = data.ai?.summary;

  const stat = (emoji: string, value: React.ReactNode, label: string, color: string) => (
    <div style={{ flex: 1, textAlign: 'center' }}>
      <div style={{ fontSize: 20, marginBottom: 2 }}>{emoji}</div>
      <div style={{ fontSize: 20, fontWeight: 900, color }}>{value}</div>
      <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700 }}>{label}</div>
    </div>
  );

  return (
    <div style={wrap}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
        <div style={{ fontSize: 13, fontWeight: 800 }}>📊 This Week</div>
        <Link to="/report" style={{ fontSize: 12, fontWeight: 700, color: '#A78BFA', textDecoration: 'none' }}>
          View full report →
        </Link>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {stat('✅', `${fam.familyPct ?? 0}%`, 'Chores done', '#10B981')}
        {stat('⭐', fam.totalStarsWeek ?? 0, 'Stars earned', '#F59E0B')}
        {stat('🍽️', `${fam.mealsPlanned ?? 0}/7`, 'Meals planned', '#6366F1')}
      </div>

      {(top || streak) && (
        <div style={{ display: 'flex', gap: 8, marginBottom: summary ? 12 : 0, flexWrap: 'wrap' }}>
          {top && top.starsEarned > 0 && (
            <div style={{ flex: 1, minWidth: 130, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: '#F59E0B', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>🏆 Top this week</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{top.emoji} {top.name} · {top.starsEarned}⭐</div>
            </div>
          )}
          {streak && (streak.streakDays || 0) > 0 && (
            <div style={{ flex: 1, minWidth: 130, background: 'rgba(244,114,182,0.10)', border: '1px solid rgba(244,114,182,0.3)', borderRadius: 10, padding: '8px 10px' }}>
              <div style={{ fontSize: 10, color: '#F472B6', fontWeight: 800, textTransform: 'uppercase', letterSpacing: 0.5 }}>🔥 Longest streak</div>
              <div style={{ fontSize: 13, fontWeight: 700, marginTop: 2 }}>{streak.emoji} {streak.name} · {streak.streakDays}d</div>
            </div>
          )}
        </div>
      )}

      {summary && (
        <div style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--text)', opacity: 0.9, borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10 }}>
          {summary}
        </div>
      )}
    </div>
  );
}