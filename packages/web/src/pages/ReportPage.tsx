import { useState } from 'react';
import { useMembers } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { useQuery } from '@tanstack/react-query';
import api from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}

function useReport() {
  return useQuery({
    queryKey: ['report'],
    queryFn: () => api.get('/report').then(r => r.data),
    staleTime: 5 * 60 * 1000,
  });
}

// ── Ring Chart ────────────────────────────────────────────────────────────────
function RingChart({ pct, size = 100, stroke = 10, color = '#7C6FF7', label }: {
  pct: number; size?: number; stroke?: number; color?: string; label?: string;
}) {
  const r   = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  return (
    <div style={{ position: 'relative', width: size, height: size, flexShrink: 0 }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={stroke} />
        <circle
          cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 0.8s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <div style={{ fontSize: size * 0.22, fontWeight: 900, color: '#fff' }}>{pct}%</div>
        {label && <div style={{ fontSize: size * 0.1, color: 'rgba(255,255,255,0.5)', fontWeight: 700, marginTop: 1 }}>{label}</div>}
      </div>
    </div>
  );
}

// ── Stat Pill ─────────────────────────────────────────────────────────────────
function StatPill({ icon, value, label, color }: { icon: string; value: string | number; label: string; color: string }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      padding: '14px 10px', borderRadius: 16, flex: 1, minWidth: 70,
      background: `${color}18`, border: `1.5px solid ${color}33`,
    }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 22, fontWeight: 900, color: '#fff', lineHeight: 1 }}>{value}</span>
      <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: 0.8, textAlign: 'center' }}>{label}</span>
    </div>
  );
}

// ── Section Card ──────────────────────────────────────────────────────────────
function Card({ children, style = {} }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-secondary)',
      border: '1.5px solid rgba(255,255,255,0.07)',
      borderRadius: 20, padding: '18px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 style={{ fontSize: 14, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7, marginBottom: 14, color: 'var(--text-primary)' }}>
      <span>{icon}</span> {title}
    </h2>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function Skeleton({ h = 20, w = '100%', radius = 8 }: { h?: number; w?: string | number; radius?: number }) {
  return (
    <div style={{
      height: h, width: w, borderRadius: radius,
      background: 'linear-gradient(90deg,rgba(255,255,255,0.05) 25%,rgba(255,255,255,0.1) 50%,rgba(255,255,255,0.05) 75%)',
      backgroundSize: '200% 100%',
      animation: 'shimmer 1.5s infinite',
    }} />
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const { member } = useAuthStore();
  const { data: members = [] } = useMembers();
  const { data: report, isLoading, error, refetch } = useReport();
  const [expandedTip, setExpandedTip] = useState<number | null>(null);

  const allMembers = members as any[];

  const weekLabel = (() => {
    if (!report?.week) return 'This Week';
    const start = new Date(report.week.start);
    const end   = new Date(report.week.end);
    return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} – ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  })();

  return (
    <div style={{ width: '100%', maxWidth: 900, paddingBottom: 90 }} className="animate-fadeIn">
      <style>{`
        @keyframes shimmer { 0%{background-position:200% 0} 100%{background-position:-200% 0} }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.6} }
      `}</style>

      {/* ── Header ── */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 24, fontWeight: 900, letterSpacing: -0.5 }}>📊 Weekly Report</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 3 }}>{weekLabel}</p>
          </div>
          <button
            onClick={() => refetch()}
            disabled={isLoading}
            style={{
              padding: '8px 16px', borderRadius: 20, border: 'none', cursor: 'pointer',
              background: 'rgba(124,111,247,0.2)', color: '#A78BFA', fontWeight: 800, fontSize: 12,
              opacity: isLoading ? 0.5 : 1,
            }}
          >
            {isLoading ? '⏳ Loading...' : '🔄 Refresh'}
          </button>
        </div>
      </div>

      {/* ── AI Summary Banner ── */}
      <div style={{
        marginBottom: 20,
        padding: '18px 20px',
        borderRadius: 20,
        background: 'linear-gradient(135deg,rgba(124,111,247,0.25),rgba(167,139,250,0.1))',
        border: '1.5px solid rgba(124,111,247,0.4)',
        boxShadow: '0 8px 32px rgba(124,111,247,0.15)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
          <span style={{ fontSize: 24 }}>🤖</span>
          <div>
            <div style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 1.2 }}>Claude AI Summary</div>
          </div>
          {isLoading && (
            <span style={{ marginLeft: 'auto', fontSize: 11, color: '#A78BFA', animation: 'pulse 1.5s infinite' }}>Generating insights...</span>
          )}
        </div>
        {isLoading
          ? <><Skeleton h={14} /><div style={{ marginTop: 6 }} /><Skeleton h={14} w="75%" /></>
          : <p style={{ fontSize: 14, fontWeight: 600, lineHeight: 1.6, color: 'var(--text-secondary)', margin: 0 }}>
              {report?.ai?.summary || 'No summary available yet.'}
            </p>
        }
      </div>

      {/* ── Family Stats Row ── */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {isLoading ? (
          [1,2,3,4].map(i => <div key={i} style={{ flex: 1, minWidth: 70 }}><Skeleton h={100} radius={16} /></div>)
        ) : (
          <>
            <StatPill icon="✅" value={`${report?.family?.familyPct ?? 0}%`}  label="Completion"    color="#10B981" />
            <StatPill icon="⭐" value={report?.family?.totalStarsWeek ?? 0}   label="Stars Earned"  color="#FBBF24" />
            <StatPill icon="🍽️" value={`${report?.family?.mealsPlanned ?? 0}/7`} label="Meals Planned" color="#F97316" />
            <StatPill icon="💬" value={report?.family?.messagesCount ?? 0}    label="Messages"      color="#7C6FF7" />
          </>
        )}
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: 14 }}>

        {/* Completion Ring */}
        <Card>
          <SectionTitle icon="🎯" title="Family Completion" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
            {isLoading
              ? <Skeleton h={100} w={100} radius={50} />
              : <RingChart pct={report?.family?.familyPct ?? 0} size={100} stroke={10} color="#10B981" label="done" />
            }
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7 }}>
                <div>📋 <strong>{report?.family?.doneChores ?? 0}</strong> of <strong>{report?.family?.totalChores ?? 0}</strong> chores done</div>
                <div>⭐ <strong>{report?.family?.totalStarsWeek ?? 0}</strong> stars earned this week</div>
                {report?.topMember && (
                  <div>🏆 <strong>{report.topMember.name}</strong> led the family</div>
                )}
              </div>
            </div>
          </div>
        </Card>

        {/* Member Leaderboard */}
        <Card>
          <SectionTitle icon="🏆" title="Star Leaderboard" />
          {isLoading
            ? [1,2,3].map(i => <div key={i} style={{ marginBottom: 8 }}><Skeleton h={48} radius={12} /></div>)
            : (report?.memberStats || [])
                .sort((a: any, b: any) => b.starsEarned - a.starsEarned)
                .map((m: any, i: number) => {
                  const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
                  const memberData = allMembers.find((am: any) => am.id === m.id);
                  const src = avatarSrc(memberData?.avatarUrl);
                  const isTop = i === 0;
                  return (
                    <div key={m.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12, marginBottom: 6,
                      background: isTop ? 'rgba(251,191,36,0.1)' : 'rgba(255,255,255,0.03)',
                      border: `1px solid ${isTop ? 'rgba(251,191,36,0.3)' : 'rgba(255,255,255,0.06)'}`,
                    }}>
                      <span style={{ fontSize: 18, width: 24, textAlign: 'center' }}>{medals[i] || '•'}</span>
                      <div style={{
                        width: 30, height: 30, borderRadius: '50%', overflow: 'hidden',
                        background: m.color || '#6366F1', display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 14, flexShrink: 0,
                      }}>
                        {src ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{m.name}{m.id === member?.id ? ' (you)' : ''}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                          {m.doneThisWeek} chores · {m.streakDays || 0}🔥
                        </div>
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 14, color: '#FBBF24' }}>+{m.starsEarned}⭐</div>
                    </div>
                  );
                })
          }
        </Card>

        {/* AI Tips */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <SectionTitle icon="💡" title="AI Parenting Tips" />
          {isLoading
            ? [1,2,3].map(i => <div key={i} style={{ marginBottom: 10 }}><Skeleton h={60} radius={14} /></div>)
            : (report?.ai?.tips || []).map((tip: string, i: number) => (
                <div
                  key={i}
                  onClick={() => setExpandedTip(expandedTip === i ? null : i)}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 12,
                    padding: '14px 16px', borderRadius: 14, marginBottom: 8, cursor: 'pointer',
                    background: expandedTip === i ? 'rgba(124,111,247,0.15)' : 'rgba(255,255,255,0.03)',
                    border: `1.5px solid ${expandedTip === i ? 'rgba(124,111,247,0.35)' : 'rgba(255,255,255,0.06)'}`,
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                    background: 'linear-gradient(135deg,#7C6FF7,#A78BFA)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 13, fontWeight: 900, color: '#fff',
                  }}>{i + 1}</div>
                  <p style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.6, margin: 0, color: 'var(--text-secondary)' }}>{tip}</p>
                </div>
              ))
          }
        </Card>

        {/* Per-member breakdown */}
        <Card style={{ gridColumn: '1 / -1' }}>
          <SectionTitle icon="👥" title="Member Breakdown" />
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 10 }}>
            {isLoading
              ? [1,2,3].map(i => <Skeleton key={i} h={120} radius={14} />)
              : (report?.memberStats || []).map((m: any) => {
                  const memberData = allMembers.find((am: any) => am.id === m.id);
                  const src = avatarSrc(memberData?.avatarUrl);
                  return (
                    <div key={m.id} style={{
                      padding: '14px', borderRadius: 14,
                      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                        <div style={{
                          width: 36, height: 36, borderRadius: '50%', overflow: 'hidden',
                          background: m.color || '#6366F1', display: 'flex', alignItems: 'center',
                          justifyContent: 'center', fontSize: 18, flexShrink: 0,
                        }}>
                          {src ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji}
                        </div>
                        <div>
                          <div style={{ fontWeight: 900, fontSize: 14 }}>{m.name}</div>
                          <div style={{ fontSize: 11, color: '#FBBF24', fontWeight: 700 }}>⭐ {m.stars} total</div>
                        </div>
                      </div>
                      {/* mini progress bar */}
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
                        <span>Completion</span><span>{m.completionPct}%</span>
                      </div>
                      <div style={{ height: 6, borderRadius: 4, background: 'rgba(255,255,255,0.08)', marginBottom: 8 }}>
                        <div style={{
                          height: '100%', borderRadius: 4, width: `${m.completionPct}%`,
                          background: m.completionPct >= 80 ? '#10B981' : m.completionPct >= 50 ? '#FBBF24' : '#F87171',
                          transition: 'width 0.8s ease',
                        }} />
                      </div>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10B981', fontWeight: 700 }}>
                          ✅ {m.doneThisWeek} done
                        </span>
                        {(m.streakDays || 0) > 0 && (
                          <span style={{ fontSize: 10, padding: '2px 8px', borderRadius: 20, background: 'rgba(249,115,22,0.15)', color: '#F97316', fontWeight: 700 }}>
                            🔥 {m.streakDays}d streak
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })
            }
          </div>
        </Card>

        {/* Recent completions */}
        {!isLoading && (report?.recentCompleted || []).length > 0 && (
          <Card style={{ gridColumn: '1 / -1' }}>
            <SectionTitle icon="⚡" title="Recent Completions" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {(report.recentCompleted || []).map((c: any) => {
                const who = allMembers.find((m: any) => m.id === c.completedById);
                return (
                  <div key={c.id} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '8px 14px', borderRadius: 20,
                    background: 'rgba(16,185,129,0.1)', border: '1px solid rgba(16,185,129,0.2)',
                    fontSize: 12, fontWeight: 600,
                  }}>
                    <span>{c.emoji || '✅'}</span>
                    <span style={{ color: 'var(--text-secondary)' }}>{c.title}</span>
                    {who && <span style={{ color: '#10B981' }}>· {who.name}</span>}
                  </div>
                );
              })}
            </div>
          </Card>
        )}

      </div>
    </div>
  );
}