import { Link } from 'react-router-dom';

// ⬇️ PASTE YOUR GOOGLE FORM LINK HERE
const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/e/1FAIpQLSeePX_Ioutjs-p3OF7xeQbAinZN9SveM4ekjjo2TQlv7ll6sg/viewform';

const FEATURES = [
  { icon: '✅', title: 'Chores & Tasks', body: 'Assign, track, and complete household tasks with deadlines, priorities, and star rewards.' },
  { icon: '🍽️', title: 'Meal Planning', body: 'Weekly meal planner with grocery integration. Plan dinners and vote on meals together.' },
  { icon: '📅', title: 'Family Calendar', body: 'Shared calendar for birthdays, appointments, and school events — with Google sync.' },
  { icon: '🏆', title: 'Rewards & Stars', body: 'Kids earn stars for chores and quests, redeemed for rewards parents define.' },
  { icon: '💬', title: 'Family Chat', body: 'Real-time private messaging for your family — separate, safe, always in context.' },
  { icon: '🛒', title: 'Grocery & Lists', body: 'Shared grocery lists, wishlists, and needs — categorised and check-off ready.' },
  { icon: '⚔️', title: 'Quests & Challenges', body: 'Multi-step adventure tasks that make big jobs fun and earn bonus badges.' },
  { icon: '🤖', title: 'AI Insights', body: 'Built-in AI generates family reports, suggests groceries, and surfaces trends.' },
];

const GAMIFICATION = ['⭐ Stars', '🔥 Streaks', '🎖️ Badges', '📊 Leaderboard', '🎁 Rewards', '💚 Family Pulse'];

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#0F0B1A', color: '#F0F0F5', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
      {/* Nav */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', maxWidth: 1100, margin: '0 auto' }}>
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>👨‍👩‍👧 FamilyHub</div>
        <Link to="/login" style={{ color: '#A78BFA', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Family Log In →</Link>
      </header>

      {/* Hero */}
      <section style={{ textAlign: 'center', padding: '60px 24px 50px', maxWidth: 760, margin: '0 auto' }}>
        <div style={{ display: 'inline-block', background: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 999, marginBottom: 24 }}>
          One app. Your whole family. Together.
        </div>
        <h1 style={{ fontSize: 'clamp(34px, 6vw, 56px)', fontWeight: 800, lineHeight: 1.1, margin: '0 0 20px' }}>
          The whole family,<br />in one place.
        </h1>
        <p style={{ fontSize: 18, lineHeight: 1.6, color: 'rgba(240,240,245,0.7)', margin: '0 0 32px' }}>
          FamilyHub replaces scattered apps, group chats, and sticky notes with one intelligent hub — chores, meals, schedules, rewards, chat, and more. Built for real families.
        </p>
        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer"
            style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 14, boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}>
            Request Access
          </a>
          <Link to="/login"
            style={{ background: 'rgba(255,255,255,0.06)', color: '#F0F0F5', textDecoration: 'none', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}>
            Family Log In
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 60px' }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Eight pillars of family life</h2>
        <p style={{ textAlign: 'center', color: 'rgba(240,240,245,0.6)', marginBottom: 40 }}>Everything your household needs, designed to reduce friction and increase joy.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
          {FEATURES.map(f => (
            <div key={f.title} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24 }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
              <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.title}</div>
              <div style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(240,240,245,0.65)' }}>{f.body}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Gamification strip */}
      <section style={{ background: 'rgba(139,92,246,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '50px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Chores that feel like a game</h2>
        <p style={{ color: 'rgba(240,240,245,0.65)', maxWidth: 600, margin: '0 auto 28px', lineHeight: 1.6 }}>
          A deep gamification layer keeps kids motivated and gives parents visibility — turning routine tasks into a positive loop the whole family enjoys.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 700, margin: '0 auto' }}>
          {GAMIFICATION.map(g => (
            <span key={g} style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999, padding: '10px 18px', fontSize: 15, fontWeight: 600 }}>{g}</span>
          ))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 16 }}>Want FamilyHub for your family?</h2>
        <p style={{ color: 'rgba(240,240,245,0.65)', marginBottom: 28, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.6 }}>
          FamilyHub is invite-only for now. Tell me a little about your family and I'll set you up.
        </p>
        <a href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 17, padding: '16px 40px', borderRadius: 14, boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}>
          Request Access
        </a>
      </section>

      {/* Footer */}
      <footer style={{ textAlign: 'center', padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,240,245,0.4)', fontSize: 13 }}>
        FamilyHub — Built with love, for families.
      </footer>
    </div>
  );
}