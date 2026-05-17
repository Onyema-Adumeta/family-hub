import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../store/auth';
import { useNotifications } from '../hooks/useApi';
import { useRealtime } from '../hooks/useRealtime';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3001';

function avatarSrc(url?: string | null): string | null {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE}${url}`;
}

const NAV = [
  { path: '/', icon: 'ðŸ ', label: 'Home' },
  { path: '/chores', icon: 'âœ…', label: 'Chores' },
  { path: '/meals', icon: 'ðŸ½ï¸', label: 'Meals' },
  { path: '/schedule', icon: 'ðŸ“…', label: 'Schedule' },
  { path: '/rewards', icon: 'â­', label: 'Rewards' },
  { path: '/chat', icon: 'ðŸ’¬', label: 'Chat' },
  { path: '/quests', icon: 'âš”ï¸', label: 'Quests' },
  { path: '/report', icon: 'ðŸ“Š', label: 'Report' },
  { path: '/grocery', label: 'Grocery', icon: '🛒' },
  { path: '/settings', icon: 'âš™ï¸', label: 'Settings' },
];

export default function Layout() {
  const { member, family, logout } = useAuthStore();
  const navigate = useNavigate();
  const location = useLocation();
  const { data: notifications = [] } = useNotifications();
  useRealtime();

  const [sidebarOpen, setSidebarOpen] = useState(false);

  const unread = (notifications as any[]).filter(n => !n.read).length;

  // Close sidebar whenever the route changes (mobile nav tap)
  useEffect(() => {
    setSidebarOpen(false);
  }, [location.pathname]);

  // Close on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setSidebarOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  // Lock body scroll when sidebar is open on mobile
  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  function handleLogout() {
    logout();
    navigate('/login');
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* â”€â”€ Mobile hamburger toggle â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <button
        className="sidebar-toggle"
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close menu' : 'Open menu'}
      >
        {sidebarOpen ? 'âœ•' : 'â˜°'}
      </button>

      {/* â”€â”€ Backdrop (mobile only) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div
        className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`}
        onClick={() => setSidebarOpen(false)}
      />

      {/* â”€â”€ Sidebar â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <aside
        className={`sidebar${sidebarOpen ? ' open' : ''}`}
        style={{
          width: 220,
          flexShrink: 0,
          background: 'rgba(15,15,19,0.98)',
          borderRight: '1.5px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          padding: '16px 0',
        }}
      >
        {/* Logo */}
        <div style={{ padding: '0 16px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{
            fontFamily: 'Fredoka One, cursive', fontSize: 24,
            background: 'linear-gradient(135deg,#F59E0B,#F472B6,#A78BFA)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>
            Family Hub
          </div>
          <div style={{ fontSize: 12, color: 'var(--text-muted)', fontWeight: 700, marginTop: 2 }}>
            {family?.name}
          </div>
        </div>

        {/* Member pill */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              width: 40, height: 40, borderRadius: '50%',
              background: member?.color || '#6366F1',
              border: `2px solid ${member?.color || '#6366F1'}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 20, overflow: 'hidden', flexShrink: 0,
            }}>
              {member?.avatarUrl
                ? <img src={avatarSrc(member.avatarUrl)!} alt={member.name}
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : member?.emoji}
            </div>

            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 800, fontSize: 14, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {member?.name}
              </div>
              <div style={{ fontSize: 12, color: 'var(--warning)', fontWeight: 700 }}>
                â­ {member?.stars} stars
              </div>
            </div>

            {unread > 0 && (
              <div style={{
                minWidth: 20, height: 20, borderRadius: 10,
                background: 'var(--danger)', color: '#fff',
                fontSize: 10, fontWeight: 900, padding: '0 4px',
                display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
              }}>
                {unread}
              </div>
            )}
          </div>
        </div>

        {/* Nav links */}
        <nav style={{ flex: 1, padding: '8px', overflowY: 'auto' }}>
          {NAV.map(({ path, icon, label }) => (
            <NavLink
              key={path}
              to={path}
              end={path === '/'}
              style={({ isActive }) => ({
                display: 'flex', alignItems: 'center', gap: 10,
                padding: '10px 12px', borderRadius: 10, marginBottom: 2,
                fontSize: 14, fontWeight: 800,
                color: isActive ? '#fff' : 'var(--text-secondary)',
                background: isActive ? 'var(--primary)' : 'transparent',
                transition: 'all 0.15s', textDecoration: 'none',
              })}
            >
              <span style={{ fontSize: 17, lineHeight: 1 }}>{icon}</span>
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Sign out */}
        <div style={{ padding: '8px 12px', borderTop: '1px solid var(--border)' }}>
          <button onClick={handleLogout} style={{
            width: '100%', padding: '9px', borderRadius: 10,
            background: 'transparent', border: '1.5px solid rgba(248,113,113,0.3)',
            color: 'var(--danger)', fontSize: 13, fontWeight: 800, cursor: 'pointer',
          }}>
            Sign out
          </button>
        </div>
      </aside>

      {/* â”€â”€ Main content â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <main style={{
        flex: 1,
        minWidth: 0,
        overflowY: 'auto',
        padding: '28px 32px',
      }}>
        <Outlet />
      </main>

    </div>
  );
}
