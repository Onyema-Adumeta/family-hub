import { useApprovals, useReviewChore } from '../hooks/useApi';
import { useAuthStore } from '../store/auth';
import { ask } from '../store/dialog';
import { mediaSrc } from '../lib/api';

/** Parents: chore photos waiting for a one-tap approve. */
export default function ApprovalQueue() {
  const isParent = useAuthStore(s => s.member?.role === 'parent');
  const { data = [] } = useApprovals(isParent);
  const review = useReviewChore();
  if (!isParent || !(data as any[]).length) return null;
  return (
    <section id="approvals" aria-label="Chores to check" style={{ background: 'var(--bg-card)', border: '1px solid rgba(251,191,36,0.35)', borderRadius: 14, padding: 16, marginBottom: 18 }}>
      <h2 style={{ margin: '0 0 10px', fontSize: 16 }}>📸 Chores to check ({(data as any[]).length})</h2>
      {(data as any[]).map(c => {
        const photo = c.photoUrl || c.proofUrl;
        return (
          <div key={c.id} style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap', padding: '10px 0', borderTop: '1px solid var(--border)' }}>
            {photo
              ? <a href={mediaSrc(photo)} target="_blank" rel="noreferrer"><img src={mediaSrc(photo)} alt={`Proof for ${c.title}`} style={{ width: 64, height: 64, objectFit: 'cover', borderRadius: 10 }} /></a>
              : <div style={{ width: 64, height: 64, borderRadius: 10, display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.06)', fontSize: 26 }}>{c.emoji}</div>}
            <div style={{ flex: '1 1 140px', minWidth: 0 }}>
              <strong>{c.title}</strong>
              <div className="calm-muted" style={{ fontSize: 12 }}>{c.submittedBy?.emoji} {c.submittedBy?.name || 'Someone'} · {c.stars}⭐</div>
            </div>
            <div style={{ display: 'flex', gap: 8, flex: '1 1 100%', justifyContent: 'flex-end' }}>
            <button className="btn btn-primary" disabled={review.isPending} onClick={() => review.mutate({ id: c.id, approve: true })} aria-label={`Approve ${c.title}`}>✓ Approve</button>
            <button className="btn btn-ghost" disabled={review.isPending} onClick={async () => {
              const note = await ask(`Send back “${c.title}”?`, { label: 'What needs fixing? (optional)', required: false, placeholder: 'Please make the bed too' }, { okLabel: 'Send back' });
              if (note === null) return;
              review.mutate({ id: c.id, approve: false, note: note || undefined });
            }}>Not yet</button>
            </div>
          </div>
        );
      })}
    </section>
  );
}
