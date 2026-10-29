import { useNavigate } from 'react-router-dom';
import { useBriefing } from '../hooks/useApi';

/** "Good morning, Maya! 3 chores for you today, soccer at 16:00, tacos for dinner." */
export default function BriefingCard() {
  const { data } = useBriefing();
  const navigate = useNavigate();
  if (!data) return null;
  return (
    <section aria-label="Today's briefing" style={{
      background: 'linear-gradient(135deg, rgba(251,191,36,0.12), rgba(167,139,250,0.10))',
      border: '1px solid rgba(251,191,36,0.25)', borderRadius: 14, padding: '16px 18px', marginBottom: 18,
    }}>
      <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: '0.1em', color: '#FBBF24' }}>☀️ {data.dayName.toUpperCase()}</div>
      <p style={{ margin: '6px 0 0', fontSize: 16, lineHeight: 1.5, fontWeight: 600 }}>{data.summary}</p>
      {(data.waitingForApproval > 0 || data.pendingRewards > 0) && (
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          {data.waitingForApproval > 0 && <a href="#approvals" className="btn btn-ghost" style={{ fontSize: 13 }}>📸 Check {data.waitingForApproval} photo{data.waitingForApproval > 1 ? 's' : ''}</a>}
          {data.pendingRewards > 0 && <button className="btn btn-ghost" style={{ fontSize: 13 }} onClick={() => navigate('/rewards')}>🎁 {data.pendingRewards} reward request{data.pendingRewards > 1 ? 's' : ''}</button>}
        </div>
      )}
    </section>
  );
}
