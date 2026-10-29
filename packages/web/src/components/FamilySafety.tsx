import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';

const card: React.CSSProperties = {
  background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: 16, padding: 16, marginBottom: 16,
};
const heading: React.CSSProperties = { fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em' };

function timeAgo(iso: string) {
  const s = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return new Date(iso).toLocaleDateString();
}

/** Parent-only: AI consent switch and the family activity log. */
export default function FamilySafety() {
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ['family-settings'], queryFn: () => api.get('/family').then(r => r.data) });
  const [showAll, setShowAll] = useState(false);
  const { data: log = [] } = useQuery({
    queryKey: ['audit', showAll],
    queryFn: () => api.get('/family/audit', { params: { limit: showAll ? 200 : 15 } }).then(r => r.data),
  });
  const [saving, setSaving] = useState(false);

  async function toggleAi() {
    const turningOn = !family?.aiEnabled;
    if (turningOn && !confirm(
      'Turn on AI features (trivia, assistant, meal and grocery ideas, weekly tips)?\n\n'
      + 'Family activity is sent to our AI provider (Anthropic) to generate these. '
      + 'Names are replaced with labels like "Child 1", and only broad age groups are shared — never birthdays or exact ages. '
      + 'Anything someone types into the assistant is sent as written.\n\nYou can turn this off at any time.',
    )) return;
    setSaving(true);
    try {
      await api.put('/family/ai-consent', { enabled: turningOn });
      qc.invalidateQueries({ queryKey: ['family-settings'] });
      qc.invalidateQueries({ queryKey: ['audit'] });
    } catch (e: any) { alert(e.response?.data?.error || 'Could not save'); }
    finally { setSaving(false); }
  }

  return (
    <>
      <div style={card}>
        <div style={heading}>🤖 AI FEATURES</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ flex: 1, fontSize: 13, color: 'var(--text-secondary)' }}>
            {family?.aiEnabled
              ? <>On since {new Date(family.aiConsentAt).toLocaleDateString()}. Names are never sent — kids appear as "Child 1", "Child 2".</>
              : <>Off. Trivia, the assistant, meal and grocery ideas and weekly AI tips stay off until a parent turns them on.</>}
            {family && !family.aiConfigured && <div style={{ marginTop: 4, color: 'var(--text-muted)' }}>(AI is not set up on the server yet.)</div>}
          </div>
          <button onClick={toggleAi} disabled={saving || !family} className="btn btn-primary" style={{ padding: '8px 14px', fontSize: 13, fontWeight: 800, flexShrink: 0 }}>
            {saving ? '…' : family?.aiEnabled ? 'Turn off' : 'Turn on'}
          </button>
        </div>
      </div>

      <div style={card}>
        <div style={heading}>🧾 RECENT ACTIVITY</div>
        {(log as any[]).length === 0 && <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Nothing yet.</div>}
        {(log as any[]).map(e => (
          <div key={e.id} style={{ display: 'flex', gap: 8, fontSize: 13, padding: '6px 0', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
            <div style={{ flex: 1 }}><strong>{e.actorName}</strong> {e.summary}</div>
            <div style={{ color: 'var(--text-muted)', fontSize: 11, flexShrink: 0 }}>{timeAgo(e.createdAt)}</div>
          </div>
        ))}
        {(log as any[]).length >= 15 && !showAll && (
          <button onClick={() => setShowAll(true)} style={{ marginTop: 8, background: 'transparent', border: 'none', color: 'var(--primary)', fontWeight: 700, cursor: 'pointer', fontSize: 12 }}>Show more</button>
        )}
      </div>
    </>
  );
}
