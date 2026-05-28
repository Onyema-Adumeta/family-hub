import { useEffect, useState } from 'react';
import { api } from '../lib/api';

interface Rule {
  id: string;
  label: string;
  minStars: number;
  consequenceNote?: string;
  outcomes: { passed: boolean; starsEarned: number; weekStart: string }[];
}

interface MyRulesData {
  rules: Rule[];
  starsThisWeek: number;
  weekStart: string;
}

export default function WeeklyGoalWidget() {
  const [data, setData] = useState<MyRulesData | null>(null);

  useEffect(() => {
    api.get('/rules/my')
      .then(r => setData(r.data))
      .catch(() => {}); // silently skip if no rules
  }, []);

  if (!data || data.rules.length === 0) return null;

  return (
    <div style={{ marginBottom: 20 }}>
      {data.rules.map(rule => {
        const pct = Math.min(100, Math.round((data.starsThisWeek / rule.minStars) * 100));
        const remaining = Math.max(0, rule.minStars - data.starsThisWeek);
        const passed = data.starsThisWeek >= rule.minStars;
        const lastOutcome = rule.outcomes[0];

        return (
          <div key={rule.id} style={{
            padding: '16px',
            borderRadius: 18,
            background: passed
              ? 'linear-gradient(135deg,rgba(74,222,128,0.15),rgba(16,185,129,0.08))'
              : 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))',
            border: `1.5px solid ${passed ? 'rgba(74,222,128,0.35)' : 'rgba(251,191,36,0.35)'}`,
            boxShadow: passed
              ? '0 4px 20px rgba(74,222,128,0.1)'
              : '0 4px 20px rgba(251,191,36,0.1)',
          }}>
            {/* Header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 3 }}>
                  📋 WEEKLY GOAL
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{rule.label}</div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{
                  fontSize: 28, fontWeight: 900,
                  color: passed ? '#4ADE80' : '#FBBF24',
                  lineHeight: 1,
                }}>
                  {data.starsThisWeek}<span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/{rule.minStars}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>⭐ this week</div>
              </div>
            </div>

            {/* Progress bar */}
            <div style={{
              height: 10, borderRadius: 99,
              background: 'rgba(255,255,255,0.08)',
              overflow: 'hidden', marginBottom: 10,
            }}>
              <div style={{
                height: '100%',
                width: `${pct}%`,
                borderRadius: 99,
                background: passed
                  ? 'linear-gradient(90deg,#4ADE80,#10B981)'
                  : 'linear-gradient(90deg,#FBBF24,#F59E0B)',
                transition: 'width 0.6s ease',
              }} />
            </div>

            {/* Status message */}
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              {passed
                ? '🎉 Goal achieved! Great work this week.'
                : remaining === 0
                  ? '🎉 Just hit your goal!'
                  : `⭐ ${remaining} more star${remaining === 1 ? '' : 's'} needed by Sunday`
              }
            </div>

            {/* Consequence reminder if not passed and week in progress */}
            {!passed && rule.consequenceNote && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 11, color: '#F87171', fontWeight: 600,
              }}>
                ⚠️ {rule.consequenceNote}
              </div>
            )}

            {/* Last week result */}
            {lastOutcome && lastOutcome.weekStart !== data.weekStart && (
              <div style={{
                marginTop: 8, fontSize: 11, color: 'var(--text-muted)',
                padding: '6px 10px', borderRadius: 8, background: 'rgba(255,255,255,0.04)',
              }}>
                Last week: {lastOutcome.starsEarned} ⭐ — {lastOutcome.passed ? '✅ Passed' : '❌ Missed'}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}