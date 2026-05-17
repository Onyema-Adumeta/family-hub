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
const NAV_ADVANCED  = [{ path:'/report',   icon:'📊', label:'Insights' },{ path:'/quests',   icon:'⚔️', label:'Quests'   },{ path:'/settings', icon:'⚙️', label:'Settings'  }];

function NavSection({ label, items, highlight }: { label: string; items: typeof NAV_PRIMARY; highlight?: string[] }) {
  const location = useLocation();
  return (
    <div>
      <div className="nav-section">{label}</div>
      {items.map(({ path, icon, label: lbl }) => {
        const isActive = path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);
        return (
          <NavLink key={path} to={path} style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 12px', borderRadius:10, margin:'2px 0', fontWeight:800, fontSize:14, color: isActive ? '#fff' : 'var(--text-secondary)', background: isActive ? 'var(--primary)' : 'transparent', transition:'all 0.15s', textDecoration:'none', boxShadow: isActive ? '0 4px 12px rgba(124,111,247,0.3)' : 'none', position:'relative' }}>
            <span style={{ fontSize:17 }}>{icon}</span>
            <span style={{ flex:1 }}>{lbl}</span>
            {highlight?.includes(path) && !isActive && <span style={{ width:7, height:7, borderRadius:'50%', background:'var(--accent)', flexShrink:0 }} />}
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
  const stars = freshMember?.stars || 0;
  const streak = freshMember?.streakDays || 0;
  const { level, title, next } = getLevel(stars);
  const levelPct = Math.min(100, Math.round((stars / next) * 100));
  const unread = (notifications as any[]).filter((n: any) => !n.read).length;
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
    <div style={{ display:'flex', height:'100vh', overflow:'hidden', background:'var(--bg)' }}>
      <button className="sidebar-toggle" onClick={() => setSidebarOpen(o => !o)}>{sidebarOpen ? 'x' : '='}</button>
      <div className={`sidebar-backdrop${sidebarOpen ? ' open' : ''}`} onClick={() => setSidebarOpen(false)} />

      <aside className={`sidebar${sidebarOpen ? ' open' : ''}`} style={{ width:220, display:'flex', flexDirection:'column', background:'rgba(255,255,255,0.02)', borderRight:'1.5px solid var(--border)', height:'100vh', flexShrink:0, overflowY:'auto' }}>
        {/* Family header */}
        <div style={{ padding:'16px 14px 10px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ fontSize:10, fontWeight:900, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:1 }}>Family Hub</div>
          <div style={{ fontWeight:900, fontSize:15 }}>{family?.name || 'My Family'}</div>
        </div>

        {/* User card */}
        <div style={{ padding:'14px', borderBottom:'1px solid var(--border)' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
            <div className="avatar-ring" style={{ width:42, height:42, borderRadius:'50%', background: member?.color || 'var(--primary)', border:`2.5px solid ${member?.color || 'var(--primary)'}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:20, overflow:'hidden', flexShrink:0 }}>
              {avatarUrl ? <img src={avatarUrl} alt={member?.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} /> : member?.emoji || 'person'}
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:900, fontSize:14, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{member?.name || 'You'}</div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginTop:1 }}>
                <span style={{ fontSize:11, fontWeight:800, color:'#FBBF24' }}>stars {stars}</span>
                {streak > 0 && <span className="streak-flame" style={{ fontSize:11, fontWeight:800, color:'#FB923C' }}>fire{streak}</span>}
              </div>
            </div>
          </div>
          <div style={{ fontSize:10, fontWeight:800, color:'var(--text-muted)', marginBottom:4, display:'flex', justifyContent:'space-between' }}>
            <span>Lv.{level} {title}</span><span>{stars}/{next}</span>
          </div>
          <div className="progress-bar"><div className="progress-fill" style={{ width:`${levelPct}%` }} /></div>
          <div style={{ marginTop:8, display:'flex', gap:5 }}>
            <span className="badge badge-primary" style={{ fontSize:10 }}>{member?.role === 'parent' ? 'Parent' : 'Member'}</span>
            {streak >= 7 && <span className="badge badge-warning" style={{ fontSize:10 }}>On fire!</span>}
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex:1, padding:'8px 10px', display:'flex', flexDirection:'column', gap:2 }}>
          <NavSection label="Main" items={NAV_PRIMARY} highlight={unread > 0 ? ['/chat'] : []} />
          <NavSection label="Family" items={NAV_SECONDARY} />
          <NavSection label="More" items={NAV_ADVANCED} />
        </nav>

        <div style={{ padding:'10px 14px', borderTop:'1px solid var(--border)' }}>
          <button onClick={() => { logout(); navigate('/login'); }} style={{ width:'100%', padding:'9px', borderRadius:10, background:'transparent', border:'1.5px solid rgba(248,113,113,0.25)', color:'var(--danger)', fontSize:13, fontWeight:800, cursor:'pointer' }}>Sign out</button>
        </div>
      </aside>

      <main style={{ flex:1, minWidth:0, overflowY:'auto', padding:'28px 32px' }}><Outlet /></main>
      <QuickActionFAB />
    </div>
  );
}
