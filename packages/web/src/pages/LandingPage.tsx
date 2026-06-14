import { Link } from 'react-router-dom';
import { useEffect, useRef, useState } from 'react';

const GOOGLE_FORM_URL = 'https://docs.google.com/forms/d/175ebRK9gB1s3Srt4Ju9RjR_3LFKaDdRy4mdT_Jn6nYI/viewform';

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
const PARTICLES = ['⭐', '🏆', '✨', '🎯', '💫', '🌟', '⚡', '🎖️'];

function useReveal<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setShown(true); return; }
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) { setShown(true); io.disconnect(); }
    }, { threshold: 0.15 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return { ref, shown };
}

function CountUp({ to, suffix = '', duration = 1400 }: { to: number; suffix?: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement | null>(null);
  const [val, setVal] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setVal(to); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now: number) => {
        const p = Math.min(1, (now - start) / duration);
        const eased = 1 - Math.pow(1 - p, 3);
        setVal(Math.round(to * eased));
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(el);
    return () => io.disconnect();
  }, [to, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
}

function PhoneMockup() {
  const ref = useRef<HTMLDivElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const onMove = (e: MouseEvent) => {
      const r = el.getBoundingClientRect();
      const dx = (e.clientX - (r.left + r.width / 2)) / r.width;
      const dy = (e.clientY - (r.top + r.height / 2)) / r.height;
      el.style.transform = `rotateY(${dx * 9}deg) rotateX(${-dy * 9}deg)`;
    };
    const reset = () => { el.style.transform = 'rotateY(0) rotateX(0)'; };
    window.addEventListener('mousemove', onMove);
    el.addEventListener('mouseleave', reset);
    return () => { window.removeEventListener('mousemove', onMove); el.removeEventListener('mouseleave', reset); };
  }, []);
  return (
    <div className="fh-phone-wrap">
      <div className="fh-phone" ref={ref}>
        <div className="fh-phone-notch" />
        <div className="fh-phone-screen">
          <div className="fh-app-header">
            <div className="fh-app-avatar">D</div>
            <div>
              <div className="fh-app-hello">Hi, Davidson</div>
              <div className="fh-app-stars">⭐ 46 stars</div>
            </div>
          </div>
          <div className="fh-app-card fh-app-pulse">
            <span>✅ Take out trash</span><span className="fh-app-pill">+5</span>
          </div>
          <div className="fh-app-card">
            <span>📅 Soccer practice</span><span className="fh-app-time">4:00 PM</span>
          </div>
          <div className="fh-app-card fh-app-streak fh-app-pulse2">
            <span>🔥 7-day streak!</span><span>🎖️</span>
          </div>
          <div className="fh-app-bar"><span>🏡</span><span>✅</span><span>📅</span><span>🏆</span><span>💬</span></div>
        </div>
      </div>
    </div>
  );
}

function FeatureCard({ f, i }: { f: typeof FEATURES[number]; i: number }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="fh-card"
      style={{
        background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 18, padding: 24,
        opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(26px)',
        transition: 'opacity .6s ease, transform .6s cubic-bezier(.2,.7,.2,1)', transitionDelay: `${(i % 4) * 80}ms`,
      }}>
      <div className="fh-card-icon" style={{ fontSize: 32, marginBottom: 12 }}>{f.icon}</div>
      <div style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>{f.title}</div>
      <div style={{ fontSize: 14, lineHeight: 1.55, color: 'rgba(240,240,245,0.65)' }}>{f.body}</div>
    </div>
  );
}

function GamifyPill({ g, i }: { g: string; i: number }) {
  const { ref, shown } = useReveal<HTMLSpanElement>();
  return (
    <span ref={ref}
      style={{
        background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 999,
        padding: '10px 18px', fontSize: 15, fontWeight: 600,
        opacity: shown ? 1 : 0, transform: shown ? 'scale(1)' : 'scale(0.85)',
        transition: 'opacity .5s ease, transform .5s cubic-bezier(.2,.7,.2,1)', transitionDelay: `${i * 70}ms`,
      }}>{g}</span>
  );
}

function Stat({ n, label, suffix }: { n: number; label: string; suffix?: string }) {
  const { ref, shown } = useReveal<HTMLDivElement>();
  return (
    <div ref={ref} className="fh-stat"
      style={{ opacity: shown ? 1 : 0, transform: shown ? 'translateY(0)' : 'translateY(20px)', transition: 'opacity .6s ease, transform .6s ease' }}>
      <div className="fh-stat-num"><CountUp to={n} suffix={suffix} /></div>
      <div className="fh-stat-label">{label}</div>
    </div>
  );
}

export default function LandingPage() {
  const words = ['The', 'whole', 'family,', 'in', 'one', 'place.'];
  return (
    <div style={{ minHeight: '100vh', background: '#0F0B1A', color: '#F0F0F5', fontFamily: 'system-ui, -apple-system, sans-serif', overflowX: 'hidden' }}>
      <style>{`
        @keyframes fhMesh{0%{transform:translate(0,0) scale(1)}33%{transform:translate(4%,-3%) scale(1.08)}66%{transform:translate(-3%,4%) scale(1.04)}100%{transform:translate(0,0) scale(1)}}
        @keyframes fhFloat{0%{transform:translateY(0) rotate(0);opacity:0}10%{opacity:.85}90%{opacity:.85}100%{transform:translateY(-120vh) rotate(220deg);opacity:0}}
        @keyframes fhRise{from{opacity:0;transform:translateY(22px)}to{opacity:1;transform:translateY(0)}}
        @keyframes fhBob{0%,100%{transform:translateY(0)}50%{transform:translateY(-14px)}}
        @keyframes fhGlow{0%,100%{transform:scale(1)}50%{transform:scale(1.04)}}
        .fh-rise{opacity:0;animation:fhRise .7s cubic-bezier(.2,.7,.2,1) forwards}
        .fh-word{display:inline-block;opacity:0;animation:fhRise .7s cubic-bezier(.2,.7,.2,1) forwards}
        .fh-card:hover .fh-card-icon{transform:scale(1.18) rotate(-4deg)}
        .fh-card-icon{transition:transform .25s ease}
        .fh-cta{transition:transform .2s ease, box-shadow .2s ease}
        .fh-cta:hover{transform:translateY(-2px);box-shadow:0 14px 34px rgba(139,92,246,.55)!important}
        .fh-phone-wrap{display:flex;justify-content:center;perspective:1000px;animation:fhBob 6s ease-in-out infinite}
        .fh-phone{width:240px;border-radius:36px;background:linear-gradient(160deg,#2a2150,#181030);padding:12px;box-shadow:0 40px 80px -20px rgba(0,0,0,.6),0 0 0 2px rgba(255,255,255,.05);transition:transform .25s ease;transform-style:preserve-3d}
        .fh-phone-notch{width:84px;height:20px;background:#0F0B1A;border-radius:0 0 13px 13px;margin:0 auto 8px}
        .fh-phone-screen{background:#13102b;border-radius:26px;padding:14px 12px;display:flex;flex-direction:column;gap:9px}
        .fh-app-header{display:flex;align-items:center;gap:10px;margin-bottom:2px}
        .fh-app-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#8B5CF6,#EC4899);display:flex;align-items:center;justify-content:center;font-weight:800}
        .fh-app-hello{font-size:14px;font-weight:700}
        .fh-app-stars{font-size:12px;color:#FBBF24}
        .fh-app-card{background:#241a4d;border-radius:13px;padding:11px 13px;display:flex;justify-content:space-between;align-items:center;font-size:12.5px;font-weight:600}
        .fh-app-pulse{animation:fhGlow 4s ease-in-out infinite}
        .fh-app-pulse2{animation:fhGlow 4s ease-in-out infinite 1.5s}
        .fh-app-streak{background:linear-gradient(135deg,rgba(251,191,36,.25),rgba(236,72,153,.2))}
        .fh-app-pill{background:#FBBF24;color:#3b2800;border-radius:8px;padding:2px 8px;font-weight:800}
        .fh-app-time{color:rgba(240,240,245,.6);font-size:12px}
        .fh-app-bar{margin-top:4px;display:flex;justify-content:space-around;background:#0F0B1A;border-radius:14px;padding:9px 0;font-size:17px}
        .fh-stat{text-align:center;background:rgba(255,255,255,.06);border-radius:18px;padding:24px 12px}
        .fh-stat-num{font-size:38px;font-weight:800;line-height:1;color:#fff}
        .fh-stat-label{margin-top:8px;font-size:13px;color:rgba(240,240,245,.7);font-weight:600}
        @media(max-width:860px){.fh-hero-grid{grid-template-columns:1fr!important;text-align:center}.fh-hero-copy{margin:0 auto}.fh-phone-wrap{margin-top:36px}}
        @media(prefers-reduced-motion:reduce){
          .fh-mesh,.fh-particle,.fh-phone-wrap,.fh-app-pulse,.fh-app-pulse2{animation:none!important}
          .fh-rise,.fh-word{animation:none!important;opacity:1!important}
        }
      `}</style>

      {/* Nav */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 24px', maxWidth: 1100, margin: '0 auto', position: 'relative', zIndex: 3 }}>
        <div style={{ fontWeight: 800, fontSize: 20, letterSpacing: 0.5 }}>👨‍👩‍👧 FamilyHub</div>
        <Link to="/login" style={{ color: '#A78BFA', textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>Family Log In →</Link>
      </header>

      {/* Hero — two columns: copy + phone */}
      <section style={{ position: 'relative', maxWidth: 1100, margin: '0 auto', padding: '40px 24px 50px' }}>
        <div className="fh-mesh" aria-hidden="true" style={{
          position: 'absolute', inset: '-40% -20% 0', zIndex: 0, pointerEvents: 'none',
          background: 'radial-gradient(40% 40% at 22% 30%, rgba(139,92,246,.5), transparent 60%), radial-gradient(38% 38% at 80% 25%, rgba(99,102,241,.45), transparent 60%), radial-gradient(45% 45% at 60% 85%, rgba(236,72,153,.3), transparent 60%)',
          filter: 'blur(40px)', animation: 'fhMesh 18s ease-in-out infinite',
        }} />
        <div aria-hidden="true" style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none', overflow: 'hidden' }}>
          {Array.from({ length: 14 }, (_, i) => (
            <span key={i} className="fh-particle" style={{
              position: 'absolute', bottom: -30, left: `${(i * 7.3) % 100}%`,
              fontSize: 14 + ((i * 5) % 16), animation: `fhFloat ${11 + ((i * 3) % 9)}s linear ${(i * 1.3) % 9}s infinite`,
            }}>{PARTICLES[i % PARTICLES.length]}</span>
          ))}
        </div>

        <div className="fh-hero-grid" style={{ position: 'relative', zIndex: 2, display: 'grid', gridTemplateColumns: '1.1fr .9fr', gap: 40, alignItems: 'center' }}>
          <div className="fh-hero-copy" style={{ maxWidth: 540 }}>
            <div className="fh-rise" style={{ display: 'inline-block', background: 'rgba(167,139,250,0.12)', color: '#A78BFA', fontSize: 13, fontWeight: 600, padding: '6px 14px', borderRadius: 999, marginBottom: 22, animationDelay: '.1s' }}>
              One app. Your whole family. Together.
            </div>
            <h1 style={{ fontSize: 'clamp(34px, 5.5vw, 56px)', fontWeight: 800, lineHeight: 1.08, margin: '0 0 20px' }}>
              {words.map((w, i) => (
                <span key={i} className="fh-word" style={{ animationDelay: `${0.2 + i * 0.1}s`, marginRight: 12 }}>{w}</span>
              ))}
            </h1>
            <p className="fh-rise" style={{ fontSize: 18, lineHeight: 1.6, color: 'rgba(240,240,245,0.72)', margin: '0 0 30px', animationDelay: '.85s' }}>
              FamilyHub replaces scattered apps, group chats, and sticky notes with one intelligent hub — chores, meals, schedules, rewards, chat, and more. Built for real families.
            </p>
            <div className="fh-rise" style={{ display: 'flex', gap: 14, flexWrap: 'wrap', animationDelay: '1s' }}>
              <a className="fh-cta" href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer"
                style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 14, boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}>
                Request Access
              </a>
              <Link to="/login"
                style={{ background: 'rgba(255,255,255,0.06)', color: '#F0F0F5', textDecoration: 'none', fontWeight: 700, fontSize: 16, padding: '14px 32px', borderRadius: 14, border: '1px solid rgba(255,255,255,0.12)' }}>
                Family Log In
              </Link>
            </div>
          </div>
          <PhoneMockup />
        </div>
      </section>

      {/* Stats band */}
      <section style={{ maxWidth: 900, margin: '0 auto', padding: '10px 24px 50px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 }}>
          <Stat n={8} label="Core features" />
          <Stat n={100} suffix="+" label="Stars to earn" />
          <Stat n={7} label="Day streaks" />
          <Stat n={3} label="Platforms" />
        </div>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth: 1000, margin: '0 auto', padding: '20px 24px 60px', position: 'relative', zIndex: 2 }}>
        <h2 style={{ textAlign: 'center', fontSize: 28, fontWeight: 800, marginBottom: 8 }}>Eight pillars of family life</h2>
        <p style={{ textAlign: 'center', color: 'rgba(240,240,245,0.6)', marginBottom: 40 }}>Everything your household needs, designed to reduce friction and increase joy.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 18 }}>
          {FEATURES.map((f, i) => (<FeatureCard key={f.title} f={f} i={i} />))}
        </div>
      </section>

      {/* Gamification strip */}
      <section style={{ background: 'rgba(139,92,246,0.06)', borderTop: '1px solid rgba(255,255,255,0.06)', borderBottom: '1px solid rgba(255,255,255,0.06)', padding: '50px 24px', textAlign: 'center' }}>
        <h2 style={{ fontSize: 26, fontWeight: 800, marginBottom: 12 }}>Chores that feel like a game</h2>
        <p style={{ color: 'rgba(240,240,245,0.65)', maxWidth: 600, margin: '0 auto 28px', lineHeight: 1.6 }}>
          A deep gamification layer keeps kids motivated and gives parents visibility — turning routine tasks into a positive loop the whole family enjoys.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap', maxWidth: 700, margin: '0 auto' }}>
          {GAMIFICATION.map((g, i) => (<GamifyPill key={g} g={g} i={i} />))}
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ textAlign: 'center', padding: '64px 24px' }}>
        <h2 style={{ fontSize: 30, fontWeight: 800, marginBottom: 16 }}>Want FamilyHub for your family?</h2>
        <p style={{ color: 'rgba(240,240,245,0.65)', marginBottom: 28, maxWidth: 480, margin: '0 auto 28px', lineHeight: 1.6 }}>
          FamilyHub is invite-only for now. Tell me a little about your family and I'll set you up.
        </p>
        <a className="fh-cta" href={GOOGLE_FORM_URL} target="_blank" rel="noopener noreferrer"
          style={{ background: 'linear-gradient(135deg, #8B5CF6, #6366F1)', color: '#fff', textDecoration: 'none', fontWeight: 700, fontSize: 17, padding: '16px 40px', borderRadius: 14, boxShadow: '0 8px 24px rgba(139,92,246,0.4)' }}>
          Request Access
        </a>
      </section>

      <footer style={{ textAlign: 'center', padding: '32px 24px', borderTop: '1px solid rgba(255,255,255,0.06)', color: 'rgba(240,240,245,0.4)', fontSize: 13 }}>
        FamilyHub — Built with love, for families.
      </footer>
    </div>
  );
}