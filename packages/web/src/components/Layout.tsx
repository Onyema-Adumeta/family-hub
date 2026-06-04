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

const NAV_PRIMARY   = [{ path:'/',         icon:'🏠', label:'Home'     },{ path:'/chat',     icon:'💬', label:'Chat'     },{ path:'/schedule', icon:'📅', label:'Schedule' },{ path:'/chores',   icon:'✅', label:'Chores'   }];
const NAV_SECONDARY = [{ path:'/meals',    icon:'🍽️', label:'Meals'    },{ path:'/grocery',  icon:'🛒', label:'Grocery'  },{ path:'/rewards',  icon:'⭐', label:'Rewards'  }];
const NAV_ADVANCED  = [{ path:'/report',   icon:'📊', label:'Insights' },{ path:'/quests',   icon:'🎯', label:'Quests'   },{ path:'/trivia',   icon:'🧠', label:'Trivia'   },{ path:'/wishlist', icon:'🎁', label:'Wishlist' },{ path:'/settings', icon:'⚙️', label:'Settings'  }];
const BOTTOM_NAV = [
  { path:'/',         icon:'🏠', label:'Home'    },
  { path:'/chores',   icon:'✅', label:'Chores'  },
  { path:'/chat',     icon:'💬', label:'Chat'    },
  { path:'/meals',    icon:'🍽️', label:'Meals'   },
  { path:'/trivia',   icon:'🧠', label:'Trivia'  },
  { path:'/schedule', icon:'📅', label:'More'    },
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

  // Close drawer on navigation
  useEffect(() => { setSidebarOpen(false); }, [location.pathname]);

  // Keyboard close
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setSidebarOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  // Lock body scroll when drawer open
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  // ── MOBILE LAYOUT ─────────────────────────────────────────────
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflow: 'hidden' }}>

        {/* Drawer transition styles */}
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
            {/* Avatar button opens drawer */}
            <button
              onClick={() => setSidebarOpen(true)}
              style={{
                width: 38, height: 38, borderRadius: '50%', padding: 0,
                background: member?.color || 'var(--primary)',
                border: `2.5px solid ${member?.color || 'var(--primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 18, overflow: 'hidden', cursor: 'pointer',
                flexShrink: 0,
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : <span>{member?.emoji || '👤'}</span>
              }
            </button>
          </div>
        </header>

        {/* Backdrop — always rendered, opacity driven by class */}
        <div
          className={`drawer-backdrop${sidebarOpen ? ' open' : ''}`}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Drawer panel — always rendered, slides via CSS transform */}
        <div className={`drawer-panel${sidebarOpen ? ' open' : ''}`}>

          {/* Profile header */}
          <div style={{ padding: '20px 16px 16px', borderBottom: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 }}>
              <div style={{
                width: 48, height: 48, borderRadius: '50%', overflow: 'hidden', flexShrink: 0,
                background: member?.color || 'var(--primary)',
                border: `2.5px solid ${member?.color || 'var(--primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22,
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{member?.emoji || '👤'}</span>
                }
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 900, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {member?.name || 'You'}
                </div>
                <div style={{ fontSize: 12, color: '#FBBF24', fontWeight: 800, marginTop: 1 }}>
                  ⭐ {stars} &nbsp;·&nbsp; Lv.{level} {title}
                </div>
              </div>
              {/* Close button — plain X text, no emoji */}
              <button
                onClick={() => setSidebarOpen(false)}
                style={{
                  width: 32, height: 32, borderRadius: 8, border: '1px solid rgba(255,255,255,0.12)',
                  background: 'rgba(255,255,255,0.06)', color: 'var(--text-secondary)',
                  fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontWeight: 700, flexShrink: 0, lineHeight: 1,
                }}
                aria-label="Close menu"
              >
                ✕
              </button>
            </div>

            {/* Level progress */}
            <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--text-muted)', marginBottom: 5, display: 'flex', justifyContent: 'space-between' }}>
              <span>{stars} stars</span><span>{next} to next level</span>
            </div>
            <div style={{ height: 5, borderRadius: 4, background: 'rgba(255,255,255,0.08)' }}>
              <div style={{ height: '100%', borderRadius: 4, width: `${levelPct}%`, background: 'var(--primary)', transition: 'width 0.6s ease' }} />
            </div>
            <div style={{ marginTop: 10, display: 'flex', gap: 6 }}>
              <span className="badge badge-primary" style={{ fontSize: 10 }}>
                {member?.role === 'parent' ? 'Parent' : 'Member'}
              </span>
              {streak >= 3 && (
                <span className="badge badge-warning" style={{ fontSize: 10 }}>
                  🔥 {streak}d streak
                </span>
              )}
            </div>
          </div>

          {/* Nav links */}
          <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
            <NavSection label="Main"   items={NAV_PRIMARY}   highlight={unread > 0 ? ['/chat'] : []} onNav={() => setSidebarOpen(false)} />
            <NavSection label="Family" items={NAV_SECONDARY} onNav={() => setSidebarOpen(false)} />
            <NavSection label="More"   items={NAV_ADVANCED}  onNav={() => setSidebarOpen(false)} />
          </nav>

          {/* Sign out */}
          <div style={{ padding: '12px 16px', borderTop: '1px solid rgba(255,255,255,0.07)', flexShrink: 0 }}>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              style={{
                width: '100%', padding: '10px', borderRadius: 10, cursor: 'pointer',
                background: 'transparent', border: '1.5px solid rgba(248,113,113,0.25)',
                color: 'var(--danger)', fontSize: 13, fontWeight: 800,
              }}
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Page content */}
        <main style={{ flex: 1, overflowY: 'auto', padding: '16px', paddingBottom: 90 }}>
          <Outlet />
        </main>

        {/* Bottom Nav Bar */}
        <nav style={{
          position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 50,
          background: 'rgba(10,10,20,0.97)',
          backdropFilter: 'blur(20px)',
          borderTop: '2px solid rgba(124,111,247,0.4)',
          display: 'flex',
          paddingBottom: 'env(safe-area-inset-bottom, 8px)',
          boxShadow: '0 -8px 32px rgba(0,0,0,0.7)',
        }}>
          {BOTTOM_NAV.map(({ path, icon, label: lbl }) => {
            const isActive  = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            const showBadge = lbl === 'Chat' && unread > 0;
            return (
              <NavLink
                key={path}
                to={path}
                style={{
                  flex: 1, display: 'flex', flexDirection: 'column',
                  alignItems: 'center', justifyContent: 'center',
                  padding: '10px 0 6px', textDecoration: 'none',
                  position: 'relative', gap: 3,
                }}
              >
                {isActive && (
                  <span style={{
                    position: 'absolute', top: 0, left: '15%', right: '15%',
                    height: 3, borderRadius: '0 0 6px 6px',
                    background: 'linear-gradient(90deg,#7C6FF7,#A78BFA)',
                    boxShadow: '0 0 12px #7C6FF7, 0 0 24px rgba(124,111,247,0.4)',
                  }} />
                )}
                <span style={{
                  fontSize: 24, display: 'block', lineHeight: 1,
                  transform: isActive ? 'scale(1.2) translateY(-1px)' : 'scale(1)',
                  transition: 'transform 0.2s ease',
                  filter: isActive ? 'drop-shadow(0 0 6px rgba(167,139,250,0.8))' : 'grayscale(0.15) opacity(0.7)',
                }}>
                  {icon}
                </span>
                <span style={{
                  fontSize: 10,
                  fontWeight: isActive ? 900 : 600,
                  color: isActive ? '#C4B5FD' : 'rgba(255,255,255,0.35)',
                  letterSpacing: isActive ? 0.5 : 0.2,
                  transition: 'color 0.2s ease',
                }}>
                  {lbl}
                </span>
                {showBadge && (
                  <span style={{
                    position: 'absolute', top: 6, right: '18%',
                    width: 9, height: 9, borderRadius: '50%',
                    background: '#F87171', boxShadow: '0 0 8px #F87171',
                    border: '1.5px solid rgba(10,10,20,0.97)',
                  }} />
                )}
              </NavLink>
            );
          })}
        </nav>

        <QuickActionFAB />
      </div>
    );
  }

  // ── DESKTOP LAYOUT ────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: 'var(--bg)' }}>
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>{sidebarOpen ? '←' : '→'}</button>
      <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

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