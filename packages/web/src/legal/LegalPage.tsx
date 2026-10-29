import { Link } from 'react-router-dom';
import { LEGAL } from './config';

export function LegalPage({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', padding: '32px 16px 64px' }}>
      <article style={{ maxWidth: 720, margin: '0 auto', lineHeight: 1.65, fontSize: 15 }}>
        <Link to="/" style={{ color: 'var(--primary)', fontWeight: 700, fontSize: 13 }}>← FamilyHub</Link>
        <h1 style={{ fontSize: 28, fontWeight: 800, margin: '16px 0 4px' }}>{title}</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: 13, marginTop: 0 }}>Last updated {LEGAL.lastUpdated} · Version {LEGAL.version}</p>
        <div className="legal-body">{children}</div>
        <style>{`.legal-body h2{font-size:18px;margin:28px 0 8px}.legal-body ul{padding-left:20px}.legal-body li{margin:4px 0}.legal-body a{color:var(--primary)}`}</style>
        <p style={{ marginTop: 32, fontSize: 13, color: 'var(--text-muted)' }}>
          <Link to="/privacy">Privacy Policy</Link> · <Link to="/terms">Terms of Service</Link> · Questions: <a href={`mailto:${LEGAL.privacyEmail}`}>{LEGAL.privacyEmail}</a>
        </p>
      </article>
    </div>
  );
}
