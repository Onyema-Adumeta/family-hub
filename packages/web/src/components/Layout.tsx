import { useState, useEffect, useRef } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useNotifications, useMembers, useMarkRead, useMarkAllRead } from '../hooks/useApi';
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

// ── Relative time formatter for notification timestamps ──────────────
function timeAgo(iso?: string | null) {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (isNaN(then)) return '';
  const secs = Math.floor((Date.now() - then) / 1000);
  if (secs < 45)        return 'just now';
  if (secs < 90)        return '1 min ago';
  const mins = Math.floor(secs / 60);
  if (mins < 60)        return `${mins} min ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24)         return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 7)         return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// ── Notification bell + dropdown panel ───────────────────────────────
// Self-contained so it can sit in both the desktop sidebar and mobile topbar.
function NotificationBell({ variant = 'light' }: { variant?: 'light' | 'dark' }) {
  const { data: notifications = [] } = useNotifications();
  const markRead    = useMarkRead();
  const markAllRead = useMarkAllRead();
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  const list   = notifications as any[];
  const unread = list.filter((n: any) => !n.read).length;

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onEsc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onEsc);
    return () => { document.removeEventListener('mousedown', onClick); document.removeEventListener('keydown', onEsc); };
  }, [open]);

  const iconColor = variant === 'dark' ? 'var(--text-secondary)' : 'var(--text-secondary)';

  return (
    <div ref={wrapRef} style={{ position: 'relative', flexShrink: 0 }}>
      <button
        onClick={() => setOpen(o => !o)}
        aria-label="Notifications"
        style={{
          width: 38, height: 38, borderRadius: '50%', padding: 0, cursor: 'pointer',
          background: open ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.06)',
          border: '1.5px solid rgba(255,255,255,0.1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative',
        }}
      >
        <span style={{ fontSize: 18, lineHeight: 1, color: iconColor }}>🔔</span>
        {unread > 0 && (
          <span style={{
            position: 'absolute', top: -2, right: -2,
            minWidth: 18, height: 18, padding: '0 5px', borderRadius: 9,
            background: 'var(--accent, #EC4899)', color: '#fff',
            fontSize: 10, fontWeight: 900, lineHeight: '18px', textAlign: 'center',
            border: '2px solid #131c35', boxSizing: 'border-box',
          }}>{unread > 9 ? '9+' : unread}</span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 46, right: 0, zIndex: 300,
          width: 320, maxWidth: 'calc(100vw - 32px)',
          background: '#161527', border: '1.5px solid rgba(255,255,255,0.12)',
          borderRadius: 14, boxShadow: '0 16px 48px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontWeight: 900, fontSize: 14 }}>
              Notifications {unread > 0 && <span style={{ color: 'var(--accent, #EC4899)' }}>· {unread}</span>}
            </div>
            {unread > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                disabled={markAllRead.isPending}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  color: '#A78BFA', fontSize: 12, fontWeight: 800, padding: 0,
                  opacity: markAllRead.isPending ? 0.5 : 1,
                }}
              >Mark all read</button>
            )}
          </div>

          <div style={{ maxHeight: 380, overflowY: 'auto' }}>
            {list.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '36px 20px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: 30, marginBottom: 8 }}>🔕</div>
                <div style={{ fontSize: 13, fontWeight: 700 }}>You're all caught up</div>
                <div style={{ fontSize: 11, marginTop: 2 }}>No notifications yet</div>
              </div>
            ) : (
              list.map((n: any) => (
                <button
                  key={n.id}
                  onClick={() => { if (!n.read) markRead.mutate(n.id); }}
                  style={{
                    display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%',
                    textAlign: 'left', padding: '12px 14px', cursor: n.read ? 'default' : 'pointer',
                    background: n.read ? 'transparent' : 'rgba(124,111,247,0.08)',
                    border: 'none', borderBottom: '1px solid rgba(255,255,255,0.05)',
                  }}
                >
                  <span style={{
                    width: 8, height: 8, borderRadius: '50%', marginTop: 5, flexShrink: 0,
                    background: n.read ? 'transparent' : 'var(--accent, #EC4899)',
                  }} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {n.title && <div style={{ fontWeight: 800, fontSize: 13, color: 'var(--text)' }}>{n.title}</div>}
                    {n.body && <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 1, lineHeight: 1.35 }}>{n.body}</div>}
                    <div style={{ fontSize: 10, color: 'var(--text-muted)', marginTop: 4, fontWeight: 700 }}>{timeAgo(n.createdAt)}</div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
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
  { path:'/games',    icon:'🕹️', label:'Games'    },
  { path:'/wishlist', icon:'🎁', label:'Wishlist' },
  { path:'/settings', icon:'⚙️', label:'Settings'  },
];
const BOTTOM_NAV = [
  { path:'/',         icon:'🏠', label:'Home'     },
  { path:'/chores',   icon:'✅', label:'Chores'   },
  { path:'/chat',     icon:'💬', label:'Chat'     },
  { path:'/meals',    icon:'🍽️', label:'Meals'    },
  { path:'/schedule', icon:'📅', label:'Schedule' },
  { path:'/games',    icon:'🕹️', label:'Games'    },
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

  return (
    <>
      <style>{`
        /* ── CSS-driven responsive layout ── */

        .fh-root {
          display: flex;
          height: 100vh;
          background: var(--bg);
          overflow: hidden;
        }

        /* Desktop sidebar visible, mobile chrome hidden */
        .fh-sidebar   { display: flex; }
        .fh-topbar    { display: none; }
        .fh-bottomnav { display: none; }
        .fh-main      { padding: 28px 32px; }

        @media (max-width: 768px) {
          .fh-root { flex-direction: column; }
          .fh-sidebar   { display: none !important; }
          .fh-topbar    { display: flex; }
          .fh-bottomnav { display: flex; }
          .fh-main      { padding: 16px; }
        }

        /* Drawer */
        .drawer-backdrop {
          position: fixed; inset: 0; z-index: 200;
          background: rgba(0,0,0,0);
          pointer-events: none;
          transition: background 0.3s ease;
        }
        .drawer-backdrop.open {
          background: rgba(0,0,0,0.75);
          pointer-events: all;
        }
        .drawer-panel {
          position: fixed; top: 0; right: 0; bottom: 0;
          width: 280px; z-index: 201;
          background: linear-gradient(180deg, #0f1729 0%, #131c35 100%);
          border-left: 1.5px solid rgba(255,255,255,0.08);
          display: flex; flex-direction: column;
          transform: translateX(100%);
          transition: transform 0.3s cubic-bezier(0.32, 0.72, 0, 1);
          box-shadow: -20px 0 60px rgba(0,0,0,0.5);
          will-change: transform;
        }
        .drawer-panel.open { transform: translateX(0); }
      `}</style>

      <div className="fh-root">

        {/* ── DESKTOP SIDEBAR ── */}
        <aside className="fh-sidebar" style={{
          width: 220, flexDirection: 'column',
          background: 'linear-gradient(180deg, #0f1729 0%, #131c35 100%)', borderRight: '1.5px solid rgba(255,255,255,0.06)',
          height: '100vh', flexShrink: 0, overflowY: 'auto',
        }}>
          <div style={{ padding: '16px 14px 10px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 10, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Family Hub</div>
              <div style={{ fontWeight: 900, fontSize: 15, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{family?.name || 'My Family'}</div>
            </div>
            <NotificationBell />
          </div>
          <div style={{ padding: '14px', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
              <div className="avatar-ring" style={{
                width: 42, height: 42, borderRadius: '50%',
                background: member?.color || 'var(--primary)',
                border: `2.5px solid ${member?.color || 'var(--primary)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 20, overflow: 'hidden', flexShrink: 0,
              }}>
                {avatarUrl
                  ? <img src={avatarUrl} alt={member?.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : <span>{member?.emoji || '👤'}</span>}
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
            <button onClick={() => { logout(); navigate('/login'); }} style={{
              width: '100%', padding: '9px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1.5px solid rgba(248,113,113,0.25)',
              color: 'var(--danger)', fontSize: 13, fontWeight: 800,
            }}>Sign out</button>
          </div>
        </aside>

        {/* ── MOBILE TOP BAR ── */}
        <header className="fh-topbar" style={{
          alignItems: 'center', justifyContent: 'space-between',
          padding: '10px 16px', borderBottom: '1px solid var(--border)',
          background: 'linear-gradient(135deg, #0f1729 0%, #131c35 100%)', flexShrink: 0, zIndex: 10,
        }}>
          <div>
            <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Family Hub</div>
            <div style={{ fontWeight: 900, fontSize: 14 }}>{family?.name || 'My Family'}</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <NotificationBell />
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
                : <span>{member?.emoji || '👤'}</span>}
            </button>
          </div>
        </header>

        {/* ── MAIN CONTENT ── */}
        <main className="fh-main" style={{ flex: 1, minWidth: 0, overflowY: 'auto' }}>
          <Outlet />
        </main>

        {/* ── MOBILE BOTTOM NAV ── */}
        <nav className="fh-bottomnav" style={{
          borderTop: '1px solid var(--border)',
          background: 'linear-gradient(180deg, #0f1729 0%, #131c35 100%)', flexShrink: 0, zIndex: 50,
        }}>
          {BOTTOM_NAV.map(({ path, icon, label }) => {
            const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
            return (
              <NavLink key={path} to={path} style={{
                flex: 1, display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                padding: '8px 4px', textDecoration: 'none',
                color: isActive ? 'var(--primary)' : 'var(--text-muted)',
                fontSize: 10, fontWeight: 800, gap: 2, position: 'relative',
              }}>
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

        {/* ── DRAWER ── */}
        <div className={`drawer-backdrop${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />
        <div className={`drawer-panel${sidebarOpen ? ' open' : ''}`}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 16px', borderBottom: '1px solid var(--border)', flexShrink: 0,
          }}>
            <div>
              <div style={{ fontSize: 9, fontWeight: 900, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: 1 }}>Menu</div>
              <div style={{ fontWeight: 900, fontSize: 14 }}>{member?.name || 'You'}</div>
            </div>
            <button onClick={() => setSidebarOpen(false)} style={{
              width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: 'rgba(255,255,255,0.08)', color: 'var(--text-secondary)',
              fontSize: 18, cursor: 'pointer', display: 'flex',
              alignItems: 'center', justifyContent: 'center', lineHeight: 1,
            }}>×</button>
          </div>
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
                  : <span>{member?.emoji || '👤'}</span>}
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
          <div style={{ flex: 1, overflowY: 'auto', padding: '8px 10px' }}>
            <NavSection label="Main"   items={NAV_PRIMARY}   highlight={unread > 0 ? ['/chat'] : []} onNav={() => setSidebarOpen(false)} />
            <NavSection label="Family" items={NAV_SECONDARY} onNav={() => setSidebarOpen(false)} />
            <NavSection label="More"   items={NAV_ADVANCED}  onNav={() => setSidebarOpen(false)} />
          </div>
          <div style={{ padding: '10px 14px', borderTop: '1px solid var(--border)', flexShrink: 0 }}>
            <button onClick={() => { logout(); navigate('/login'); }} style={{
              width: '100%', padding: '9px', borderRadius: 10, cursor: 'pointer',
              background: 'transparent', border: '1.5px solid rgba(248,113,113,0.25)',
              color: 'var(--danger)', fontSize: 13, fontWeight: 800,
            }}>Sign out</button>
          </div>
        </div>

      </div>
    </>
  );
}