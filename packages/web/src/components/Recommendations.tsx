import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

/** Parents: the next few useful things to do, worked out from the family's data. */
export default function Recommendations({ limit = 5, title = '💡 What to do next' }: { limit?: number; title?: string }) {
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const navigate = useNavigate();
  const { data = [] } = useQuery({ queryKey: ['recommendations'], queryFn: () => api.get('/insights/recommendations').then(r => r.data), enabled: isParent });
  if (!isParent || !(data as any[]).length) return null;
  return (
    <section aria-label="Recommendations" style={{ background: 'var(--bg-card)', border: '1px solid rgba(96,165,250,0.3)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 8px', fontSize: 16 }}>{title}</h2>
      {(data as any[]).slice(0, limit).map((r, i) => (
        <div key={i} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0', borderTop: i ? '1px solid var(--border)' : 'none' }}>
          <span style={{ fontSize: 22 }} aria-hidden="true">{r.icon}</span>
          <div style={{ flex: 1 }}><strong>{r.title}</strong><div className="calm-muted" style={{ fontSize: 12 }}>{r.detail}</div></div>
          {r.link && <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => r.link.startsWith('/#') ? (navigate('/'), setTimeout(() => document.querySelector(r.link.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 100)) : navigate(r.link)}>Go</button>}
        </div>
      ))}
    </section>
  );
}
