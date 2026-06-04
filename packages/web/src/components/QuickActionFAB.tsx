import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

export function QuickActionFAB() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('keydown', h);
    return () => document.removeEventListener('keydown', h);
  }, []);

  const actions = [
    { icon: 'broom', label: 'Add chore',     path: '/chores'   },
    { icon: 'calendar', label: 'Add event',  path: '/schedule' },
    { icon: 'speech-balloon', label: 'Chat', path: '/chat'     },
    { icon: 'shopping-cart', label: 'Grocery', path: '/grocery'},
    { icon: 'fork-and-knife', label: 'Plan meal', path: '/meals'},
    { icon: 'sparkles', label: 'AI suggest', path: '/chat'     },
  ];

  const emojis = ['🧹','📅','💬','🛒','🍽️','✨'];

  return (
    <>
      {open && <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, zIndex: 49 }} />}
      {open && (
        <div className="fab-menu">
          {actions.map((a, i) => (
            <div key={a.label} className="fab-item" style={{ animationDelay: `${i * 40}ms` }}>
              <span className="fab-label">{a.label}</span>
              <button className="fab-btn" onClick={() => { setOpen(false); navigate(a.path); }} title={a.label}>
                {emojis[i]}
              </button>
            </div>
          ))}
        </div>
      )}
      <button className="fab" onClick={() => setOpen(o => !o)} title="Quick actions"
        style={{ transform: open ? 'scale(1.08) rotate(45deg)' : undefined }}>
        +
      </button>
    </>
  );
}
