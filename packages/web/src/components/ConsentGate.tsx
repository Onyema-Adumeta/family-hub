import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

/**
 * Families created before the Terms/Privacy Policy existed (or before a new
 * version) must have a parent accept them. Parents see a blocking prompt;
 * kids see a note to ask a parent. New members cannot join until accepted.
 */
export default function ConsentGate() {
  const member = useAuthStore(s => s.member);
  const qc = useQueryClient();
  const { data: family } = useQuery({ queryKey: ['family-settings'], queryFn: () => api.get('/family').then(r => r.data) });
  const [terms, setTerms] = useState(false);
  const [kids, setKids] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  if (!family?.needsConsent) return null;

  if (member?.role !== 'parent') {
    return (
      <div style={{ margin: '8px 16px', padding: '10px 14px', borderRadius: 10, fontSize: 13, background: 'rgba(245,158,11,0.12)', border: '1px solid rgba(245,158,11,0.3)' }}>
        A parent needs to review FamilyHub's updated privacy policy. Ask them to open FamilyHub.
      </div>
    );
  }

  async function accept() {
    setSaving(true); setError('');
    try {
      await api.post('/family/consent', { acceptTerms: true, childDataConsent: true });
      qc.invalidateQueries({ queryKey: ['family-settings'] });
    } catch (e: any) { setError(e.response?.data?.error || 'Could not save'); }
    finally { setSaving(false); }
  }

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="consent-title" style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.75)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}>
      <div style={{ background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 16, padding: 20, boxShadow: '0 12px 40px rgba(0,0,0,0.5)', maxWidth: 440, width: '100%' }}>
        <h2 id="consent-title" style={{ margin: '0 0 8px', fontSize: 18 }}>Please review our privacy policy</h2>
        <p style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 0 }}>
          FamilyHub now has a <Link to="/privacy" target="_blank" style={{ color: 'var(--primary)' }}>Privacy Policy</Link> and{' '}
          <Link to="/terms" target="_blank" style={{ color: 'var(--primary)' }}>Terms of Service</Link>. Because your family includes children,
          we need a parent's agreement before continuing. New members can't join until a parent accepts.
        </p>
        <label style={{ display: 'flex', gap: 10, fontSize: 13, margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={terms} onChange={e => setTerms(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I agree to the Terms of Service and Privacy Policy.</span>
        </label>
        <label style={{ display: 'flex', gap: 10, fontSize: 13, margin: '12px 0', cursor: 'pointer' }}>
          <input type="checkbox" checked={kids} onChange={e => setKids(e.target.checked)} style={{ marginTop: 3 }} />
          <span>I am the parent or legal guardian of the children in this family, and I consent to FamilyHub collecting and using their information as described in the Privacy Policy.</span>
        </label>
        {error && <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 8 }}>{error}</div>}
        <button className="btn btn-primary" disabled={!terms || !kids || saving} onClick={accept} style={{ width: '100%', padding: 12, fontWeight: 800 }}>
          {saving ? 'Saving…' : 'Agree and continue'}
        </button>
      </div>
    </div>
  );
}
