import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useNotifications, useMembers } from '../hooks/useApi';
import { useRealtime } from '../hooks/useRealtime';
import { QuickActionFAB } from './QuickActionFAB';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';
function avatarSrc(url?: string | null) { if (!url) return null; return url.startsWith('http') ? url : `${API_BASE}${url}`; }
function getLevel(stars: number) {
  if (stars < 50)  return { level: 1, title: 'Rookie',   next: 50 };
  if (stars < 150) return { level: 2, title: 'Helper',   next: 150 };
  if (stars < 300) return { level: 3, title: 'Champion', next: 300 };
  if (stars < 500) return { level: 4, title: 'Hero',     next: 500 };
  return             { level: 5, title: 'Legend',         next: 1000 };
}

const NAV_PRIMARY   = [
  { path:'/',         icon:'🏠', label:'Home'     },
  { path:'/chat',     icon:'💬', label:'Chat'     },
  { path:'/schedule', icon:'📅', label:'Schedule' },
  { path:'/chores',   icon:'✅', label:'Chores'   },
];
const NAV_SECONDARY = [
  { path:'/meals',    icon:'🍽️', label:'Meals'    },
  { path:'/grocery',  icon:'🛒', label:'Grocery'  },
  { path:'/rewards',  icon:'⭐', label:'Rewards'  },
];
const NAV_ADVANCED  = [
  { path:'/report',   icon:'📊', label:'Insights' },
  { path:'/quests',   icon:'🗯️', label:'Quests'   },
  { path:'/trivia',   icon:'🧠', label:'Trivia'   },
  { path:'/wishlist', icon:'🎁', label:'Wishlist' },
  { path:'/settings', icon:'⚙️', label:'Settings'  },
];
const BOTTOM_NAV = [
  { path:'/',         icon:'🏠', label:'Home'     },
  { path:'/chores',   icon:'✅', label:'Chores'   },
  { path:'/chat',     icon:'💬', label:'Chat'     },
  { path:'/meals',    icon:'🍽️', label:'Meals'    },
  { path:'/schedule', icon:'📅', label:'Schedule' },
  { path:'/trivia',   icon:'🧠', label:'Trivia'   },
];

function NavSection({ label, items, highlight, onNav }: { label: string; items: typeof NAV_PRIMARY; highlight?: string[]; onNav?: () => void }) {
  const location = useLocation();
  return (
    <div style={{ marginBottom: 4 }}>
      <div style={{
        fontSize: 9, fontWeight: 900, color: 'var(--text-muted)',
        textTransform: 'uppercase', letterSpacing: 1.2,
        padding: '10px 10px 4px',
      }}>{label}</div>
      {items.map(({ path, icon, label: lbl }) => {
        const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        return (
          <NavLink
            key={path}
            to={path}
            onClick={onNav}
            style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              borderRadius: 10, margin: '1px 0', fontWeight: 800, fontSize: 14,
              color: isActive ? '#fff' : 'var(--text-secondary)',
              background: isActive ? 'var(--primary)' : 'transparent',
              transition: 'all 0.15s', textDecoration: 'none',
              boxShadow: isActive ? '0 4px 12px rgba(124,111,247,0.3)' : 'none',
              position: 'relative',
            }}
          >
            <span style={{ fontSize: 17 }}>{icon}</span>
            <span style={{ flex: 1 }}>{lbl}</span>
            {highlight?.includes(path) && !isActive && (
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', flexShrink: 0 }} />
            )}
          </NavLink>
        );
      })}
    </div>
  );
}

export default function Layout() {
  const { member, family, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifications = [] } = useNotifications();
  const { data: members = [] } = useMembers();
  useRealtime();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const freshMember = (members as any[]).find((m: any) => m.id === member?.id) || member;
  const stars  = freshMember?.stars || 0;
  const streak = freshMember?.streakDays || 0;
  const { level, title, next } = getLevel(stars);
  const levelPct = Math.min(100, Math.round((stars / next) * 100));
  const unread   = (notifications as any[]).filter((n: any) => !n.read).length;
  const avatarUrl = avatarSrc(member?.avatarUrl);

  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // ── MOBILE LAYOUT ──────────────────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

        <style>{`
          .drawer-backdrop {
            position: fixed; inset: 0; z-index: 200;
            background: rgba(0,0,0,0);
            pointer-events: none;
            transition: background 0.3s ease;
          }
          .drawer-backdrop.open {
            background: rgba(0,0,0,0.6);
            pointer-events: all;
          }
          .drawer-panel {
            position: fixed; top: 0; right: 0; bottom: 0;
            width: 280px; z-index: 201;
            background: var(--bg-secondary);
            border-left: 1.5px solid rgba(255,255,255,0.08);
            display: flex; flex-direction: column;
            transform: translateX(100%);
            transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
            box-shadow: -20px 0 60px rgba(0,0,0,0.5);
            will-change: transform;
          }
          .drawer-panel.open {
            transform: translateX(0);
          }
        `}</style>

        {/* Mobile top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)', flexShrink: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Family Hub</div>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{family?.name || 'My Family'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {unread > 0 && (
              <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent)' }} />
            )}
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                width: 38, height: 38, borderRadius: '50%', padding: 0,
                background: member?.color || 'var(--primary)',
                border: `2px solid ${member?.color || 'var(--primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, overflow: 'hidden', cursor: 'pointer',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>{member?.emoji || '👤'}</span>
              }
            </button>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '16px' }}>
          <Outlet />
        </main>

        {/* Bottom nav */}
        <nav style={{
          display: 'flex', borderTop: '1px solid var(--border)',
          background: 'rgba(255,255,255,0.02)', flexShrink: 0, zIndex: 50,
        }}>
          {BOTTOM_NAV.map(({ path, icon, label }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <NavLink
                key={path}
                to={path}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '8px 4px', textDecoration: 'none',
                  color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                  fontSize: 10, fontWeight: 800, gap: 2,
                  position: 'relative',
                }}
              >
                {path === '/chat' && unread > 0 && (
                  <span style={{
                    position: 'absolute', top: 6, right: '50%', transform: 'translateX(10px)',
                    width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)',
                  }} />
                )}
                <span style={{ fontSize: 20 }}>{icon}</span>
                <span>{label}</span>
              </NavLink>
            );
          })}
        </nav>

        <QuickActionFAB />

        {/* Drawer backdrop */}
        <div
          className={`drawer-backdrop${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Drawer panel */}
        <div className={`drawer-panel${sidebarOpen ? ' open' : ''}`}>
          {/* Drawer header */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Menu</div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{member?.name || 'You'}</div>
            </div>
            <button
              onClick={() => setSidebarOpen(false)}
              style={{
                width: 32, height: 32, borderRadius: '50%', border: 'none',
                background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)',
                fontSize: 18, cursor: 'pointer', display: 'flex',
                alignItems: 'center', justifyContent: 'center', lineHeight: 1,
              }}
            >
              ×
            </button>
          </div>

          {/* Member info */}
          <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
              <div style={{
                width: 40, height: 40, borderRadius: '50%',
                background: member?.color || 'var(--primary)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, overflow: 'hidden', flexShrink: 0,
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{member?.emoji || '👤'}</span>
                }
              </div>
              <div>
                <div style={{ fontWeight: 900, fontSize: 13 }}>{member?.name}</div>
                <div style={{ fontSize: 11, color: '#FBBF24', fontWeight: 800 }}>⭐ {stars} stars</div>
              </div>
            </div>
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
              <span>Lv.{level} {title}</span><span>{stars}/{next}</span>
            </div>
            <div className="progress-bar"><div className="progress-fill" style={{ width: `${levelPct}%` }} /></div>
          </div>

          {/* Nav sections */}
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            <NavSection label="Main"   items={NAV_PRIMARY}   highlight={unread > 0 ? ['/chat'] : []} onNav={() => setSidebarOpen(false)} />
            <NavSection label="Family" items={NAV_SECONDARY} onNav={() => setSidebarOpen(false)} />
            <NavSection label="More"   items={NAV_ADVANCED}  onNav={() => setSidebarOpen(false)} />
          </div>

          {/* Sign out */}
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                width: '100%', padding: '9px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1.5px solid rgba(248,113,113,0.25)',
                color: 'var(--danger)', fontSize: 13, fontWeight: 800,
              }}
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── DESKTOP LAYOUT ─────────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>
      <aside
        className={`sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: 220, display: 'flex', flexDirection: 'column',
          background: 'rgba(255,255,255,0.02)', borderRight: '1.5px solid var(--border)',
          height: '100vh', flexShrink: 0, overflowY: 'auto',
        }}
      >
        <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Family Hub</div>
          <div style={{ fontWeight: 900, fontSize: 15 }}>{family?.name || 'My Family'}</div>
        </div>

        <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
            <div
              className="avatar-ring"
              style={{
                width: 42, height: 42, borderRadius: '50%',
                background: member?.color || 'var(--primary)',
                border: `2.5px solid ${member?.color || 'var(--primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, overflow: 'hidden', flexShrink: 0,
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>{member?.emoji || '👤'}</span>
              }
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 900, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {member?.name || 'You'}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 1 }}>
                <span style={{ fontSize: 11, fontWeight: 800, color: '#FBBF24' }}>⭐ {stars}</span>
                {streak > 0 && <span style={{ fontSize: 11, fontWeight: 800, color: '#FB923C' }}>🔥 {streak}</span>}
              </div>
            </div>
          </div>
          <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 4, display: 'flex', justifyContent: 'space-between' }}>
            <span>Lv.{level} {title}</span><span>{stars}/{next}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width: `${levelPct}%` }} /></div>
          <div style={{ marginTop: 8, display: 'flex', gap: 5 }}>
            <span className="badge badge-primary" style={{ fontSize: 10 }}>
              {member?.role === 'parent' ? 'Parent' : 'Member'}
            </span>
            {streak >= 7 && <span className="badge badge-warning" style={{ fontSize: 10 }}>On fire!</span>}
          </div>
        </div>

        <nav style={{ flex: 1, padding: '8px 10px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          <NavSection label="Main"   items={NAV_PRIMARY}   highlight={unread > 0 ? ['/chat'] : []} />
          <NavSection label="Family" items={NAV_SECONDARY} />
          <NavSection label="More"   items={NAV_ADVANCED}  />
        </nav>

        <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)' }}>
          <button
            onClick={() => { logout(); navigate('/login'); }}
            style={{
              width: '100%', padding: '9px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1.5px solid rgba(248,113,113,0.25)',
              color: 'var(--danger)', fontSize: 13, fontWeight: 800,
            }}
          >
            Sign out
          </button>
        </div>
      </aside>

      <main style={{ flex: 1, minWidth: 0, overflowY: 'auto', padding: '28px 32px' }}>
        <Outlet />
      </main>
      <QuickActionFAB />
    </div>
  );
}