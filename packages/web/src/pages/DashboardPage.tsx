import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useChores, useMembers, useMeals, useEvents, useMessages } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(d.setDate(diff)).toISOString().split('T')[0];
}
const TODAY_DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
const TODAY_STR = new Date().toISOString().split('T')[0];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, gradient, shadow }: {
  icon: string; label: string; value: string | number; gradient: string; shadow: string;
}) {
  return (
    <div style={{
      padding: '18px 14px',
      borderRadius: 20,
      background: gradient,
      boxShadow: shadow,
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      position: 'relative',
      overflow: 'hidden',
    }}>
      <div style={{
        position: 'absolute', top: -14, right: -14,
        width: 64, height: 64, borderRadius: '50%',
        background: 'rgba(255,255,255,0.12)',
      }} />
      <div style={{ fontSize: 26, lineHeight: 1 }}>{icon}</div>
      <div style={{ fontSize: 32, fontWeight: 900, color: '#fff', lineHeight: 1, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 10, fontWeight: 800, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: 1 }}>{label}</div>
    </div>
  );
}

// ─── Section Title ────────────────────────────────────────────────────────────
function SectionTitle({ icon, title, action, onAction }: {
  icon: string; title: string; action?: string; onAction?: () => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14 }}>
      <h2 style={{ fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-primary)' }}>
        <span>{icon}</span> {title}
      </h2>
      {action && (
        <button onClick={onAction} style={{
          fontSize: 12, fontWeight: 700, color: '#fff',
          background: 'rgba(124,111,247,0.25)', border: '1px solid rgba(124,111,247,0.4)',
          borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
        }}>
          {action} →
        </button>
      )}
    </div>
  );
}

// ─── Empty State ──────────────────────────────────────────────────────────────
function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>
      {text}
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const { member } = useAuthStore();
  const navigate = useNavigate();
  const { data: chores = [] }   = useChores();
  const { data: members = [] }  = useMembers();
  const { data: meals = [] }    = useMeals(getWeekStart());
  const { data: events = [] }   = useEvents();
  const { data: messages = [] } = useMessages();

  const [greeting, setGreeting] = useState('Good day');
  const [tip] = useState(() => {
    const tips = [
      'Try completing all daily chores for a streak bonus!',
      'Kids who help with chores are more confident at school.',
      'Set a family goal this week — pick a reward together.',
      'Consistent routines reduce family stress significantly.',
    ];
    return tips[Math.floor(Date.now() / 86400000) % tips.length];
  });

  useEffect(() => {
    const h = new Date().getHours();
    if (h < 12) setGreeting('Good morning');
    else if (h < 17) setGreeting('Good afternoon');
    else setGreeting('Good evening');
  }, []);

  const allChores  = chores as any[];
  const allMembers = members as any[];
  const pending    = allChores.filter(c => (c.status || 'pending') === 'pending');
  const inProg     = allChores.filter(c => c.status === 'in_progress');
  const doneToday  = allChores.filter(c => c.status === 'done' && c.completedAt?.startsWith(TODAY_STR));
  const tonightMeal = (meals as any[]).find(m => m.day === TODAY_DAY && m.slot === 'dinner');
  const todayEvents = (events as any[]).filter(e => (e.date || e.startsAt || '').startsWith(TODAY_STR));
  const recentMsgs  = [...(messages as any[])].reverse().slice(0, 3);
  const leaderboard = [...allMembers].sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 5);

  const activity: { icon: string; text: string; color: string }[] = [];
  allChores
    .filter(c => c.status === 'done' && c.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime())
    .slice(0, 3)
    .forEach(c => {
      const who = allMembers.find(m => m.id === c.completedById);
      activity.push({ icon: c.emoji || '✅', text: `${who?.name || 'Someone'} completed "${c.title}"`, color: '#4ADE80' });
    });
  recentMsgs.slice(0, 2).forEach(msg => {
    const who = allMembers.find(m => m.id === msg.memberId);
    activity.push({ icon: '💬', text: `${who?.name || 'Family'}: "${(msg.content || '').slice(0, 50)}"`, color: '#7C6FF7' });
  });

  return (
    <div style={{ width: '100%', maxWidth: 1100, paddingBottom: 90 }} className="animate-fadeIn">

      {/* ── Header ── */}
      <div style={{ marginBottom: 22 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5 }}>
          {greeting}, {member?.name?.split(' ')[0] || 'Friend'} {member?.emoji || '👋'}
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
          {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── AI Tip ── */}
      <div style={{
        marginBottom: 22,
        padding: '14px 16px',
        borderRadius: 18,
        background: 'linear-gradient(135deg,rgba(124,111,247,0.2),rgba(167,139,250,0.1))',
        border: '1.5px solid rgba(124,111,247,0.35)',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 4px 20px rgba(124,111,247,0.15)',
      }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 }}>AI Insight</div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{tip}</div>
        </div>
        <button
          onClick={() => navigate('/chat')}
          style={{
            fontSize: 12, fontWeight: 800, padding: '8px 16px', flexShrink: 0,
            background: 'linear-gradient(135deg,#7C6FF7,#A78BFA)',
            border: 'none', borderRadius: 20, color: '#fff', cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(124,111,247,0.4)',
          }}
        >
          Ask AI
        </button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 22 }}>
        <StatCard icon="⏱️" label="Pending"     value={pending.length}     gradient="linear-gradient(135deg,#F59E0B,#D97706)" shadow="0 8px 24px rgba(245,158,11,0.4)" />
        <StatCard icon="🔥" label="In Progress" value={inProg.length}      gradient="linear-gradient(135deg,#F97316,#EC4899)" shadow="0 8px 24px rgba(249,115,22,0.4)" />
        <StatCard icon="✅" label="Done Today"  value={doneToday.length}   gradient="linear-gradient(135deg,#10B981,#059669)" shadow="0 8px 24px rgba(16,185,129,0.4)" />
        <StatCard icon="📅" label="Events"      value={todayEvents.length} gradient="linear-gradient(135deg,#3B82F6,#6366F1)" shadow="0 8px 24px rgba(59,130,246,0.4)" />
        <StatCard icon="⭐" label="Your Stars"  value={member?.stars || 0} gradient="linear-gradient(135deg,#7C3AED,#A78BFA)" shadow="0 8px 24px rgba(124,58,237,0.4)" />
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>

        {/* Today's Chores */}
        <div className="card animate-fadeIn" style={{ borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <SectionTitle icon="✅" title="Today's Chores" action="View all" onAction={() => navigate('/chores')} />
          {pending.length === 0 && inProg.length === 0
            ? <Empty icon="🎉" text="All caught up! Great work." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...inProg, ...pending].slice(0, 4).map((c: any) => {
                  const a = allMembers.find(m => m.id === c.assignedToId);
                  const isActive = c.status === 'in_progress';
                  return (
                    <div key={c.id} onClick={() => navigate('/chores')} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '12px 14px', borderRadius: 14, cursor: 'pointer',
                      background: isActive ? 'rgba(251,191,36,0.1)' : 'var(--bg-secondary)',
                      border: `1.5px solid ${isActive ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
                      transition: 'transform 0.15s ease',
                    }}>
                      <span style={{ fontSize: 22 }}>{c.emoji || '📋'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{c.title}</div>
                        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{a?.name || 'Anyone'} · ⭐ {c.stars}</div>
                      </div>
                      <span style={{
                        fontSize: 10, fontWeight: 800, padding: '4px 10px', borderRadius: 20,
                        background: isActive ? 'rgba(251,191,36,0.2)' : 'rgba(255,255,255,0.06)',
                        color: isActive ? '#FBBF24' : 'var(--text-muted)',
                        border: `1px solid ${isActive ? 'rgba(251,191,36,0.3)' : 'transparent'}`,
                      }}>
                        {isActive ? 'Active' : 'Pending'}
                      </span>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Dinner + Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '18px', borderRadius: 20,
            background: 'linear-gradient(135deg,rgba(251,146,60,0.18),rgba(239,68,68,0.08))',
            border: '1.5px solid rgba(251,146,60,0.25)',
            boxShadow: '0 4px 20px rgba(251,146,60,0.1)',
          }}>
            <SectionTitle icon="🍽️" title="Tonight's Dinner" action="Plan" onAction={() => navigate('/meals')} />
            {tonightMeal
              ? <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
                  <span style={{ fontSize: 42 }}>{tonightMeal.emoji || '🍴'}</span>
                  <div style={{ fontWeight: 900, fontSize: 17 }}>{tonightMeal.name}</div>
                </div>
              : <Empty icon="🍳" text="No dinner planned yet." />
            }
          </div>

          <div style={{
            padding: '18px', borderRadius: 20,
            background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(99,102,241,0.08))',
            border: '1.5px solid rgba(56,189,248,0.25)',
            boxShadow: '0 4px 20px rgba(56,189,248,0.1)',
          }}>
            <SectionTitle icon="📅" title="Today's Events" action="Calendar" onAction={() => navigate('/schedule')} />
            {todayEvents.length === 0
              ? <Empty icon="📭" text="Nothing scheduled today." />
              : todayEvents.slice(0, 3).map((ev: any) => (
                  <div key={ev.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 12,
                    background: 'rgba(255,255,255,0.05)', marginBottom: 6,
                    border: '1px solid rgba(56,189,248,0.15)',
                  }}>
                    <span style={{ fontSize: 20 }}>{ev.emoji || '📅'}</span>
                    <div>
                      <div style={{ fontWeight: 800, fontSize: 13 }}>{ev.title}</div>
                      {ev.time && <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{ev.time}</div>}
                    </div>
                  </div>
                ))
            }
          </div>
        </div>

        {/* Leaderboard */}
        <div className="card animate-fadeIn" style={{ borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <SectionTitle icon="🏆" title="Leaderboard" action="Rewards" onAction={() => navigate('/rewards')} />
          {leaderboard.length === 0
            ? <Empty icon="👨‍👩‍👧" text="No members yet." />
            : leaderboard.map((m: any, i: number) => {
                const src = avatarSrc(m.avatarUrl);
                const medals = ['🥇','🥈','🥉','4️⃣','5️⃣'];
                const isTop = i === 0;
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 14, marginBottom: 7,
                    background: isTop ? 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.05))' : 'var(--bg-secondary)',
                    border: `1.5px solid ${isTop ? 'rgba(251,191,36,0.35)' : 'var(--border)'}`,
                    boxShadow: isTop ? '0 4px 16px rgba(251,191,36,0.12)' : 'none',
                  }}>
                    <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{medals[i]}</span>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%',
                      background: m.color, display: 'flex', alignItems: 'center',
                      justifyContent: 'center', fontSize: 16, overflow: 'hidden', flexShrink: 0,
                      border: isTop ? '2px solid rgba(251,191,36,0.5)' : '2px solid rgba(255,255,255,0.1)',
                    }}>
                      {src ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}{m.id === member?.id ? ' (you)' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        ⭐ {m.stars || 0}{(m.streakDays || 0) > 0 ? `  🔥 ${m.streakDays}` : ''}
                      </div>
                    </div>
                    {isTop && <span style={{ fontSize: 18 }}>👑</span>}
                  </div>
                );
              })
          }
        </div>

        {/* Recent Messages */}
        <div className="card animate-fadeIn" style={{ borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <SectionTitle icon="💬" title="Recent Messages" action="Open chat" onAction={() => navigate('/chat')} />
          {recentMsgs.length === 0
            ? <Empty icon="💭" text="No messages yet. Say hello!" />
            : recentMsgs.map((msg: any) => {
                const sender = allMembers.find(m => m.id === msg.memberId);
                const src = avatarSrc(sender?.avatarUrl);
                return (
                  <div key={msg.id} onClick={() => navigate('/chat')} style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10,
                    marginBottom: 12, cursor: 'pointer', padding: '10px 12px',
                    borderRadius: 14, background: 'var(--bg-secondary)',
                    border: '1px solid var(--border)',
                  }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: '50%',
                      background: sender?.color || 'var(--primary)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 14, flexShrink: 0, overflow: 'hidden',
                      border: '2px solid rgba(255,255,255,0.1)',
                    }}>
                      {src ? <img src={src} alt={sender?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : sender?.emoji || '👤'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, color: sender?.color || '#A78BFA', marginBottom: 3 }}>{sender?.name || 'Family'}</div>
                      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', lineHeight: 1.4 }}>{(msg.content || '').slice(0, 80)}</div>
                    </div>
                  </div>
                );
              })
          }
        </div>

        {/* Activity Feed */}
        {activity.length > 0 && (
          <div className="card animate-fadeIn" style={{ gridColumn: '1 / -1', borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.08)' }}>
            <SectionTitle icon="⚡" title="Family Activity" />
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {activity.map((a, i) => (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '9px 16px', borderRadius: 20,
                  background: `${a.color}12`,
                  border: `1.5px solid ${a.color}33`,
                  fontSize: 13, fontWeight: 600,
                }}>
                  <span style={{ fontSize: 16 }}>{a.icon}</span>
                  <span style={{ color: 'var(--text-secondary)' }}>{a.text}</span>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}