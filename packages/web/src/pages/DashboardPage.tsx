import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useChores, useMembers, useMeals, useEvents, useMessages } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { api } from '../lib/api';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function avatarSrc(url?: string | null) {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE}${url}`;
}
function getWeekStart() {
  const d = new Date();
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1);
  const mon = new Date(d.getFullYear(), d.getMonth(), d.getDate() - day + (day === 0 ? -6 : 1));
  return mon.toISOString().split('T')[0];
}

/** Safely parse any date string (ISO, YYYY-MM-DD, etc.) to a local Date */
function parseDate(raw: string | null | undefined): Date | null {
  if (!raw) return null;
  // Take only the date part — strips time & timezone noise
  const datePart = raw.split('T')[0].split(' ')[0];
  const [y, m, d] = datePart.split('-').map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d);
}

/** Format a date string safely for display */
function fmtDate(raw: string | null | undefined, opts: Intl.DateTimeFormatOptions): string {
  const d = parseDate(raw);
  if (!d) return '';
  return d.toLocaleDateString('en-US', opts);
}

const TODAY_DAY = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'][new Date().getDay()];
const TODAY_STR = new Date().toISOString().split('T')[0];

// ─── Stat Card ────────────────────────────────────────────────────────────────
function StatCard({ icon, label, value, gradient, shadow, onClick }: {
  icon: string; label: string; value: string | number; gradient: string; shadow: string; onClick?: () => void;
}) {
  return (
    <div onClick={onClick} style={{
      padding: '18px 14px', borderRadius: 20, background: gradient, boxShadow: shadow,
      display: 'flex', flexDirection: 'column', gap: 4,
      position: 'relative', overflow: 'hidden',
      cursor: onClick ? 'pointer' : 'default',
      transition: 'transform 0.15s ease',
    }}
    onMouseEnter={e => { if (onClick) (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(0)'; }}
    >
      <div style={{ position: 'absolute', top: -14, right: -14, width: 64, height: 64, borderRadius: '50%', background: 'rgba(255,255,255,0.12)' }} />
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
      <h2 style={{ fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7, color: 'var(--text-primary)', margin: 0 }}>
        <span>{icon}</span> {title}
      </h2>
      {action && (
        <button onClick={onAction} style={{
          fontSize: 12, fontWeight: 700, color: '#fff',
          background: 'rgba(124,111,247,0.25)', border: '1px solid rgba(124,111,247,0.4)',
          borderRadius: 20, padding: '4px 12px', cursor: 'pointer',
        }}>{action} →</button>
      )}
    </div>
  );
}

function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div style={{ textAlign: 'center', padding: '20px 0', color: 'var(--text-muted)', fontSize: 13, fontWeight: 600 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{icon}</div>{text}
    </div>
  );
}

// ─── Progress Ring ────────────────────────────────────────────────────────────
function ProgressRing({ done, total }: { done: number; total: number }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  const r = 28, circ = 2 * Math.PI * r;
  const offset = circ - (pct / 100) * circ;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <svg width={70} height={70} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={35} cy={35} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={7} />
        <circle cx={35} cy={35} r={r} fill="none" stroke="#4ADE80" strokeWidth={7}
          strokeDasharray={circ} strokeDashoffset={offset}
          style={{ transition: 'stroke-dashoffset 0.5s ease' }} strokeLinecap="round" />
        <text x={35} y={39} textAnchor="middle" fill="#fff" fontSize={14} fontWeight={900}
          style={{ transform: 'rotate(90deg)', transformOrigin: '35px 35px' }}>{pct}%</text>
      </svg>
      <div>
        <div style={{ fontSize: 13, fontWeight: 800, color: '#4ADE80' }}>{done}/{total} done</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>today's chores</div>
      </div>
    </div>
  );
}

// ─── Quick Action ─────────────────────────────────────────────────────────────
function QuickAction({ icon, label, color, onClick }: {
  icon: string; label: string; color: string; onClick: () => void;
}) {
  return (
    <button onClick={onClick} style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6,
      padding: '14px 10px', borderRadius: 16, cursor: 'pointer', flex: 1,
      background: `${color}15`, border: `1.5px solid ${color}35`,
      transition: 'transform 0.15s ease, background 0.15s ease',
    }}
    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}25`; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)'; }}
    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = `${color}15`; (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(0)'; }}
    >
      <span style={{ fontSize: 24 }}>{icon}</span>
      <span style={{ fontSize: 11, fontWeight: 800, color, textAlign: 'center', lineHeight: 1.2 }}>{label}</span>
    </button>
  );
}

// ─── Weather-style Family Mood Banner ────────────────────────────────────────
function FamilyPulseBanner({ members, chores }: { members: any[]; chores: any[] }) {
  const doneToday = chores.filter(c => c.status === 'done' && c.completedAt?.startsWith(TODAY_STR)).length;
  const total     = chores.length;
  const pct       = total === 0 ? 0 : Math.round((doneToday / total) * 100);
  const topStar   = [...members].sort((a, b) => (b.stars || 0) - (a.stars || 0))[0];

  const mood = pct >= 80 ? { emoji: '🔥', label: 'On fire!', color: '#F97316', bg: 'rgba(249,115,22,0.12)', border: 'rgba(249,115,22,0.3)' }
    : pct >= 50          ? { emoji: '💪', label: 'Good momentum', color: '#4ADE80', bg: 'rgba(74,222,128,0.10)', border: 'rgba(74,222,128,0.3)' }
    : pct > 0            ? { emoji: '⚡', label: 'Getting started', color: '#FBBF24', bg: 'rgba(251,191,36,0.10)', border: 'rgba(251,191,36,0.3)' }
    :                      { emoji: '😴', label: 'Nothing done yet', color: '#94A3B8', bg: 'rgba(148,163,184,0.08)', border: 'rgba(148,163,184,0.2)' };

  return (
    <div style={{
      marginBottom: 20, padding: '14px 18px', borderRadius: 18,
      background: mood.bg, border: `1.5px solid ${mood.border}`,
      display: 'flex', alignItems: 'center', gap: 14,
    }}>
      <span style={{ fontSize: 32 }}>{mood.emoji}</span>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 11, fontWeight: 900, color: mood.color, textTransform: 'uppercase', letterSpacing: 1.1, marginBottom: 2 }}>
          Family Pulse · Today
        </div>
        <div style={{ fontWeight: 800, fontSize: 15, color: 'var(--text-primary)' }}>{mood.label}</div>
        <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
          {doneToday} of {total} chores done · {pct}% complete
          {topStar ? `  ·  ⭐ ${topStar.name} leads with ${topStar.stars} stars` : ''}
        </div>
      </div>
    </div>
  );
}

// ─── Weekly Goal Widget ───────────────────────────────────────────────────────
interface MyRuleData {
  rules: {
    id: string; label: string; minStars: number; consequenceNote?: string;
    outcomes: { passed: boolean; starsEarned: number; weekStart: string }[];
  }[];
  starsThisWeek: number;
  weekStart: string;
}

function WeeklyGoalWidget() {
  const [data, setData] = useState<MyRuleData | null>(null);

  useEffect(() => {
    api.get('/rules/my').then(r => setData(r.data)).catch(() => {});
  }, []);

  if (!data || data.rules.length === 0) return null;

  const dayOfWeek = new Date().getDay();
  const daysUntilFriday = dayOfWeek <= 5 ? 5 - dayOfWeek : 6;

  return (
    <div style={{ marginBottom: 20 }}>
      {data.rules.map(rule => {
        const pct = Math.min(100, Math.round((data.starsThisWeek / rule.minStars) * 100));
        const remaining = Math.max(0, rule.minStars - data.starsThisWeek);
        const passed = data.starsThisWeek >= rule.minStars;
        const lastOutcome = rule.outcomes[0];
        const isThisWeek = lastOutcome?.weekStart === data.weekStart;

        return (
          <div key={rule.id} style={{
            padding: '16px', borderRadius: 18,
            background: passed
              ? 'linear-gradient(135deg,rgba(74,222,128,0.15),rgba(16,185,129,0.08))'
              : 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.08))',
            border: `1.5px solid ${passed ? 'rgba(74,222,128,0.35)' : 'rgba(251,191,36,0.35)'}`,
            boxShadow: passed ? '0 4px 20px rgba(74,222,128,0.1)' : '0 4px 20px rgba(251,191,36,0.1)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
              <div>
                <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: '0.08em', color: 'var(--text-muted)', marginBottom: 3 }}>
                  📋 WEEKLY GOAL
                </div>
                <div style={{ fontWeight: 800, fontSize: 14 }}>{rule.label}</div>
                {daysUntilFriday > 0 && !passed && (
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                    ⏰ {daysUntilFriday} day{daysUntilFriday !== 1 ? 's' : ''} until Friday check
                  </div>
                )}
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: 28, fontWeight: 900, color: passed ? '#4ADE80' : '#FBBF24', lineHeight: 1 }}>
                  {data.starsThisWeek}
                  <span style={{ fontSize: 14, color: 'var(--text-muted)' }}>/{rule.minStars}</span>
                </div>
                <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 600 }}>⭐ this week</div>
              </div>
            </div>
            <div style={{ height: 10, borderRadius: 99, background: 'rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 10 }}>
              <div style={{
                height: '100%', width: `${pct}%`, borderRadius: 99,
                background: passed ? 'linear-gradient(90deg,#4ADE80,#10B981)' : 'linear-gradient(90deg,#FBBF24,#F59E0B)',
                transition: 'width 0.6s ease',
              }} />
            </div>
            <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-muted)' }}>
              {passed
                ? '🎉 Goal achieved! Enjoy your weekend.'
                : remaining === 0 ? '🎉 Just hit your goal!'
                : `⭐ ${remaining} more star${remaining !== 1 ? 's' : ''} needed by Friday 4pm`}
            </div>
            {!passed && rule.consequenceNote && (
              <div style={{
                marginTop: 8, padding: '8px 12px', borderRadius: 10,
                background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
                fontSize: 11, color: '#F87171', fontWeight: 600,
              }}>
                ⚠️ {rule.consequenceNote}
              </div>
            )}
            {lastOutcome && !isThisWeek && (
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

// ─── Upcoming Birthdays Widget ────────────────────────────────────────────────
function UpcomingBirthdays({ members }: { members: any[] }) {
  const todayMidnight = new Date();
  todayMidnight.setHours(0, 0, 0, 0);

  const withBirthdays = members
    .filter(m => m.birthday)
    .map(m => {
      const bday = parseDate(m.birthday);
      if (!bday) return null;
      const thisYear  = new Date(todayMidnight.getFullYear(), bday.getMonth(), bday.getDate());
      const nextYear  = new Date(todayMidnight.getFullYear() + 1, bday.getMonth(), bday.getDate());
      const next      = thisYear >= todayMidnight ? thisYear : nextYear;
      const daysUntil = Math.round((next.getTime() - todayMidnight.getTime()) / 86400000);
      const age       = next.getFullYear() - bday.getFullYear();
      return { ...m, daysUntil, age, nextBirthday: next };
    })
    .filter(Boolean)
    .sort((a: any, b: any) => a.daysUntil - b.daysUntil)
    .slice(0, 4);

  if (withBirthdays.length === 0) return null;

  const isToday     = (d: number) => d === 0;
  const isSoon      = (d: number) => d <= 7 && d > 0;
  const isThisMonth = (d: number) => d <= 30 && d > 7;

  return (
    <div style={{
      marginBottom: 20, padding: '16px', borderRadius: 20,
      background: 'linear-gradient(135deg,rgba(244,114,182,0.15),rgba(167,139,250,0.08))',
      border: '1.5px solid rgba(244,114,182,0.3)',
      boxShadow: '0 4px 20px rgba(244,114,182,0.1)',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <div style={{ fontSize: 15, fontWeight: 900, display: 'flex', alignItems: 'center', gap: 7 }}>
          🎂 Upcoming Birthdays
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {withBirthdays.map((m: any) => {
          const today = isToday(m.daysUntil);
          const soon  = isSoon(m.daysUntil);
          const src   = avatarSrc(m.avatarUrl);

          const badgeColor = today ? '#4ADE80' : soon ? '#F472B6' : isThisMonth(m.daysUntil) ? '#FBBF24' : '#94A3B8';
          const badgeBg    = today ? 'rgba(74,222,128,0.15)' : soon ? 'rgba(244,114,182,0.15)' : isThisMonth(m.daysUntil) ? 'rgba(251,191,36,0.15)' : 'rgba(148,163,184,0.1)';
          const badgeText  = today ? '🎉 Today!' : `${m.daysUntil}d away`;

          return (
            <div key={m.id} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '10px 12px', borderRadius: 14,
              background: today ? 'rgba(74,222,128,0.08)' : 'rgba(255,255,255,0.04)',
              border: `1.5px solid ${today ? 'rgba(74,222,128,0.3)' : 'rgba(244,114,182,0.15)'}`,
            }}>
              <div style={{
                width: 38, height: 38, borderRadius: '50%', background: m.color || '#6366F1',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, overflow: 'hidden', flexShrink: 0,
                border: `2px solid ${today ? '#4ADE80' : 'rgba(244,114,182,0.4)'}`,
              }}>
                {src ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji || '🎂'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 800, fontSize: 13 }}>{m.name}</div>
                <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {m.nextBirthday.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}
                  {m.age > 0 && ` · Turning ${m.age}`}
                </div>
              </div>
              <div style={{
                padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 800,
                color: badgeColor, background: badgeBg,
                border: `1px solid ${badgeColor}44`, flexShrink: 0,
              }}>
                {badgeText}
              </div>
            </div>
          );
        })}
      </div>
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
  const [tipIdx] = useState(() => Math.floor(Date.now() / 86400000) % 6);
  const tips = [
    'Try completing all daily chores for a streak bonus! 🔥',
    'Kids who help with chores are more confident at school. 📚',
    'Set a family goal this week — pick a reward together. 🎯',
    'Consistent routines reduce family stress significantly. 🧘',
    'Celebrate small wins — every completed chore counts! 🎉',
    'A tidy home starts with everyone doing their part. 🏠',
  ];

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

  const tonightMeal      = (meals as any[]).find(m => m.day === TODAY_DAY && m.slot === 'dinner');
  const tonightBreakfast = (meals as any[]).find(m => m.day === TODAY_DAY && m.slot === 'breakfast');

  // Safe event date extraction — always take the date part only
  const evDateStr = (ev: any): string => (ev.date || ev.startsAt || '').split('T')[0].split(' ')[0];

  const todayEvents    = (events as any[]).filter(e => evDateStr(e) === TODAY_STR);
  const upcomingEvents = (events as any[])
    .filter(e => evDateStr(e) > TODAY_STR)
    .sort((a, b) => evDateStr(a).localeCompare(evDateStr(b)))
    .slice(0, 2);

  const recentMsgs  = [...(messages as any[])].reverse().slice(0, 3);
  const leaderboard = [...allMembers].sort((a, b) => (b.stars || 0) - (a.stars || 0)).slice(0, 5);
  const overdue     = allChores.filter(c => c.status !== 'done' && c.dueDate && c.dueDate < TODAY_STR);
  const myChores    = allChores.filter(c => c.assignedToId === member?.id && c.status !== 'done');

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

  const isParent = member?.role === 'parent';

  return (
    <div style={{ width: '100%', maxWidth: 1100, paddingBottom: 90 }} className="animate-fadeIn">

      {/* ── Header ── */}
      <div style={{ marginBottom: 18, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, letterSpacing: -0.5, margin: 0 }}>
            {greeting}, {member?.name?.split(' ')[0] || 'Friend'} {member?.emoji || '👋'}
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4, marginBottom: 0 }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
        </div>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 20,
          background: 'linear-gradient(135deg,rgba(124,58,237,0.2),rgba(167,139,250,0.1))',
          border: '1.5px solid rgba(167,139,250,0.3)',
        }}>
          <span style={{ fontSize: 18 }}>⭐</span>
          <span style={{ fontSize: 20, fontWeight: 900, color: '#A78BFA' }}>{member?.stars || 0}</span>
        </div>
      </div>

      {/* ── Overdue Alert ── */}
      {overdue.length > 0 && (
        <div onClick={() => navigate('/chores')} style={{
          marginBottom: 16, padding: '12px 16px', borderRadius: 14,
          background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.35)',
          display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer',
        }}>
          <span style={{ fontSize: 22 }}>⚠️</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 800, fontSize: 13, color: '#F87171' }}>
              {overdue.length} overdue {overdue.length === 1 ? 'chore' : 'chores'}!
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
              {overdue.slice(0, 2).map((c: any) => c.title).join(', ')}{overdue.length > 2 ? ` +${overdue.length - 2} more` : ''}
            </div>
          </div>
          <span style={{ fontSize: 12, color: '#F87171', fontWeight: 700 }}>View →</span>
        </div>
      )}

      {/* ── Family Pulse ── */}
      <FamilyPulseBanner members={allMembers} chores={allChores} />

      {/* ── Weekly Goal Widget ── */}
      {!isParent && <WeeklyGoalWidget />}

      {/* ── Upcoming Birthdays ── */}
      <UpcomingBirthdays members={allMembers} />

      {/* ── AI Tip ── */}
      <div style={{
        marginBottom: 20, padding: '14px 16px', borderRadius: 18,
        background: 'linear-gradient(135deg,rgba(124,111,247,0.2),rgba(167,139,250,0.1))',
        border: '1.5px solid rgba(124,111,247,0.35)',
        display: 'flex', alignItems: 'center', gap: 14,
        boxShadow: '0 4px 20px rgba(124,111,247,0.15)',
      }}>
        <span style={{ fontSize: 24, flexShrink: 0 }}>🤖</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: '#A78BFA', textTransform: 'uppercase', letterSpacing: 1.2, marginBottom: 3 }}>Daily Tip</div>
          <div style={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{tips[tipIdx]}</div>
        </div>
        <button onClick={() => navigate('/report')} style={{
          fontSize: 12, fontWeight: 800, padding: '8px 16px', flexShrink: 0,
          background: 'linear-gradient(135deg,#7C6FF7,#A78BFA)',
          border: 'none', borderRadius: 20, color: '#fff', cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(124,111,247,0.4)',
        }}>Report →</button>
      </div>

      {/* ── Stats ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 10, marginBottom: 20 }}>
        <StatCard icon="⏱️" label="Pending"     value={pending.length}     gradient="linear-gradient(135deg,#F59E0B,#D97706)" shadow="0 8px 24px rgba(245,158,11,0.4)"  onClick={() => navigate('/chores')} />
        <StatCard icon="🔥" label="In Progress" value={inProg.length}      gradient="linear-gradient(135deg,#F97316,#EC4899)" shadow="0 8px 24px rgba(249,115,22,0.4)"  onClick={() => navigate('/chores')} />
        <StatCard icon="✅" label="Done Today"  value={doneToday.length}   gradient="linear-gradient(135deg,#10B981,#059669)" shadow="0 8px 24px rgba(16,185,129,0.4)"  onClick={() => navigate('/chores')} />
        <StatCard icon="📅" label="Events"      value={todayEvents.length} gradient="linear-gradient(135deg,#3B82F6,#6366F1)" shadow="0 8px 24px rgba(59,130,246,0.4)"  onClick={() => navigate('/schedule')} />
        <StatCard icon="👨‍👩‍👧" label="Members"   value={allMembers.length}  gradient="linear-gradient(135deg,#7C3AED,#A78BFA)" shadow="0 8px 24px rgba(124,58,237,0.4)" onClick={() => navigate('/settings')} />
      </div>

      {/* ── Quick Actions ── */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 800, color: 'var(--text-muted)', letterSpacing: '0.08em', marginBottom: 10 }}>⚡ QUICK ACTIONS</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <QuickAction icon="➕" label="Add Chore"   color="#F59E0B" onClick={() => navigate('/chores')} />
          <QuickAction icon="🍽️" label="Plan Meals"  color="#FB923C" onClick={() => navigate('/meals')} />
          <QuickAction icon="📅" label="Add Event"   color="#38BDF8" onClick={() => navigate('/schedule')} />
          <QuickAction icon="💬" label="Family Chat" color="#A78BFA" onClick={() => navigate('/chat')} />
          <QuickAction icon="🎁" label="Rewards"     color="#4ADE80" onClick={() => navigate('/rewards')} />
          {isParent && <QuickAction icon="📊" label="Report" color="#F472B6" onClick={() => navigate('/report')} />}
        </div>
      </div>

      {/* ── Main Grid ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: 14 }}>

        {/* Chores card */}
        <div className="card animate-fadeIn" style={{ borderRadius: 20, border: '1.5px solid rgba(255,255,255,0.08)' }}>
          <SectionTitle icon="✅" title="Today's Chores" action="View all" onAction={() => navigate('/chores')} />
          <div style={{ marginBottom: 14, padding: '12px 14px', borderRadius: 14, background: 'rgba(74,222,128,0.06)', border: '1px solid rgba(74,222,128,0.15)' }}>
            <ProgressRing done={doneToday.length} total={Math.max(doneToday.length + pending.length + inProg.length, 1)} />
          </div>
          {myChores.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: '#A78BFA', marginBottom: 6, letterSpacing: '0.06em' }}>ASSIGNED TO YOU</div>
              {myChores.slice(0, 2).map((c: any) => (
                <div key={c.id} onClick={() => navigate('/chores')} style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 12, cursor: 'pointer', marginBottom: 6,
                  background: 'rgba(124,111,247,0.1)', border: '1.5px solid rgba(124,111,247,0.25)',
                }}>
                  <span style={{ fontSize: 20 }}>{c.emoji || '📋'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 800, fontSize: 13 }}>{c.title}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 1 }}>⭐ {c.stars} stars</div>
                  </div>
                  <span style={{ fontSize: 18 }}>→</span>
                </div>
              ))}
            </div>
          )}
          {pending.length === 0 && inProg.length === 0
            ? <Empty icon="🎉" text="All caught up! Great work." />
            : <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {[...inProg, ...pending].filter(c => c.assignedToId !== member?.id).slice(0, 3).map((c: any) => {
                  const a = allMembers.find(m => m.id === c.assignedToId);
                  const isActive = c.status === 'in_progress';
                  return (
                    <div key={c.id} onClick={() => navigate('/chores')} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px',
                      borderRadius: 14, cursor: 'pointer',
                      background: isActive ? 'rgba(251,191,36,0.1)' : 'var(--bg-secondary)',
                      border: `1.5px solid ${isActive ? 'rgba(251,191,36,0.3)' : 'var(--border)'}`,
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
                      }}>{isActive ? 'Active' : 'Pending'}</span>
                    </div>
                  );
                })}
              </div>
          }
        </div>

        {/* Meals + Events */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{
            padding: '18px', borderRadius: 20,
            background: 'linear-gradient(135deg,rgba(251,146,60,0.18),rgba(239,68,68,0.08))',
            border: '1.5px solid rgba(251,146,60,0.25)',
          }}>
            <SectionTitle icon="🍽️" title="Today's Meals" action="Plan" onAction={() => navigate('/meals')} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { meal: tonightBreakfast, icon: '🌅', label: 'Breakfast' },
                { meal: tonightMeal,      icon: '🌙', label: 'Dinner'    },
              ].map(({ meal, icon, label }) => (
                <div key={label} style={{
                  display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                  borderRadius: 12, background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(251,146,60,0.15)',
                }}>
                  <span style={{ fontSize: 20 }}>{icon}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', fontWeight: 700, letterSpacing: '0.06em' }}>{label.toUpperCase()}</div>
                    {meal
                      ? <div style={{ fontWeight: 800, fontSize: 13, marginTop: 2 }}>{meal.emoji || '🍴'} {meal.name}</div>
                      : <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>Not planned</div>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div style={{
            padding: '18px', borderRadius: 20,
            background: 'linear-gradient(135deg,rgba(56,189,248,0.15),rgba(99,102,241,0.08))',
            border: '1.5px solid rgba(56,189,248,0.25)',
          }}>
            <SectionTitle icon="📅" title="Schedule" action="Calendar" onAction={() => navigate('/schedule')} />
            {todayEvents.length === 0 && upcomingEvents.length === 0
              ? <Empty icon="📭" text="Nothing scheduled." />
              : <>
                  {todayEvents.slice(0, 2).map((ev: any) => (
                    <div key={ev.id} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                      borderRadius: 12, background: 'rgba(56,189,248,0.1)', marginBottom: 6,
                      border: '1px solid rgba(56,189,248,0.2)',
                    }}>
                      <span style={{ fontSize: 20 }}>{ev.emoji || '📅'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 800, fontSize: 13 }}>{ev.title}</div>
                        <div style={{ fontSize: 11, color: '#38BDF8', marginTop: 2, fontWeight: 700 }}>
                          Today{ev.time ? ` · ${ev.time}` : ''}
                        </div>
                      </div>
                    </div>
                  ))}
                  {upcomingEvents.map((ev: any) => {
                    const evDate = parseDate(ev.date || ev.startsAt);
                    const label  = evDate
                      ? evDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
                      : 'Upcoming';
                    return (
                      <div key={ev.id} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
                        borderRadius: 12, background: 'rgba(255,255,255,0.05)', marginBottom: 6,
                        border: '1px solid rgba(56,189,248,0.1)',
                      }}>
                        <span style={{ fontSize: 20 }}>{ev.emoji || '📅'}</span>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 800, fontSize: 13 }}>{ev.title}</div>
                          <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>{label}</div>
                        </div>
                      </div>
                    );
                  })}
                </>
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
                const isMe  = m.id === member?.id;
                return (
                  <div key={m.id} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '11px 14px', borderRadius: 14, marginBottom: 7,
                    background: isTop ? 'linear-gradient(135deg,rgba(251,191,36,0.15),rgba(245,158,11,0.05))' : isMe ? 'rgba(124,111,247,0.08)' : 'var(--bg-secondary)',
                    border: `1.5px solid ${isTop ? 'rgba(251,191,36,0.35)' : isMe ? 'rgba(124,111,247,0.25)' : 'var(--border)'}`,
                    boxShadow: isTop ? '0 4px 16px rgba(251,191,36,0.12)' : 'none',
                  }}>
                    <span style={{ fontSize: 20, width: 26, textAlign: 'center' }}>{medals[i]}</span>
                    <div style={{
                      width: 34, height: 34, borderRadius: '50%', background: m.color,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 16, overflow: 'hidden', flexShrink: 0,
                      border: isTop ? '2px solid rgba(251,191,36,0.5)' : '2px solid rgba(255,255,255,0.1)',
                    }}>
                      {src ? <img src={src} alt={m.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : m.emoji}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 900, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {m.name}{isMe ? ' 👈' : ''}
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        ⭐ {m.stars || 0}{(m.streakDays || 0) > 0 ? `  🔥 ${m.streakDays}d` : ''}{(m.badges?.length || 0) > 0 ? `  🏅 ${m.badges.length}` : ''}
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
                    display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 12,
                    cursor: 'pointer', padding: '10px 12px', borderRadius: 14,
                    background: 'var(--bg-secondary)', border: '1px solid var(--border)',
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
                  display: 'flex', alignItems: 'center', gap: 8, padding: '9px 16px',
                  borderRadius: 20, background: `${a.color}12`, border: `1.5px solid ${a.color}33`,
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