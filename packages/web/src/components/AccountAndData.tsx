import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import { LEGAL } from '../legal/config';

const card: React.CSSProperties = { background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 16, padding: 16, marginBottom: 16 };
const heading: React.CSSProperties = { fontWeight: 800, fontSize: 12, color: 'var(--text-muted)', marginBottom: 10, letterSpacing: '0.08em' };
const small: React.CSSProperties = { padding: '6px 12px', borderRadius: 8, fontSize: 12, fontWeight: 700, background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: 'var(--text)', cursor: 'pointer' };

/** Email, plan and support for everyone; data download and family deletion for parents. */
export default function AccountAndData() {
  const { member, family, setMember, logout } = useAuthStore();
  const navigate = useNavigate();
  const [busy, setBusy] = useState('');
  const isParent = member?.role === 'parent';
  const m: any = member;

  async function changeEmail() {
    const email = prompt(m?.email ? 'New email address' : 'Your email address');
    if (!email) return;
    const currentPassword = prompt('Your current password (to confirm it is you)');
    if (currentPassword === null) return;
    setBusy('email');
    try {
      const { data } = await api.put(`/members/${member!.id}/email`, { email, currentPassword });
      setMember(data.member);
      alert(data.emailSent ? `We sent a confirmation link to ${email}.` : 'Saved. Email sending is not set up yet, so the confirmation link could not be sent.');
    } catch (e: any) { alert(e.response?.data?.error || 'Could not change email'); }
    finally { setBusy(''); }
  }

  async function resend() {
    setBusy('resend');
    try { await api.post('/auth/resend-verification'); alert(`Sent! Check ${m?.email}.`); }
    catch (e: any) { alert(e.response?.data?.error || 'Could not send'); }
    finally { setBusy(''); }
  }

  async function downloadData() {
    const password = prompt('Enter your password to download all of your family\'s data');
    if (!password) return;
    setBusy('export');
    try {
      const { data } = await api.post('/family/export', { password });
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `familyhub-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e: any) { alert(e.response?.data?.error || 'Could not download data'); }
    finally { setBusy(''); }
  }

  async function deleteFamily() {
    const name = family?.name || '';
    if (!confirm(`Permanently delete "${name}" and ALL of its data — every member, chore, message, photo link and reward? This cannot be undone.\n\nTip: download your data first.`)) return;
    const confirmName = prompt(`Type the family name to confirm: ${name}`);
    if (confirmName === null) return;
    const password = prompt('Enter your password');
    if (!password) return;
    setBusy('delete');
    try {
      await api.post('/family/delete', { password, confirmName });
      alert('Your family and all its data have been deleted.');
      logout();
      navigate('/welcome');
    } catch (e: any) { alert(e.response?.data?.error || 'Could not delete'); }
    finally { setBusy(''); }
  }

  return (
    <>
      <div style={card}>
        <div style={heading}>✉️ MY EMAIL</div>
        {m?.email ? (
          <div style={{ fontSize: 13, marginBottom: 10 }}>
            {m.email}{' '}
            {m.emailVerifiedAt
              ? <span style={{ color: '#4ADE80', fontWeight: 700 }}>✓ confirmed</span>
              : <span style={{ color: '#F59E0B', fontWeight: 700 }}>not confirmed yet</span>}
          </div>
        ) : (
          <div style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 10 }}>
            {isParent ? 'Add your email so you can sign in with it and reset your password if you forget it.' : 'Optional. Kids can ask a parent to reset their password instead.'}
          </div>
        )}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <button style={small} onClick={changeEmail} disabled={!!busy}>{m?.email ? 'Change email' : 'Add email'}</button>
          {m?.email && !m.emailVerifiedAt && <button style={small} onClick={resend} disabled={!!busy}>{busy === 'resend' ? 'Sending…' : 'Resend confirmation'}</button>}
        </div>
      </div>

      <div style={card}>
        <div style={heading}>🎟️ PLAN & HELP</div>
        <div style={{ fontSize: 13, marginBottom: 6 }}><strong>Free beta</strong> — every feature included, no payment details needed.</div>
        <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
          Questions or problems? Email <a href={`mailto:${LEGAL.supportEmail}?subject=FamilyHub%20help`} style={{ color: 'var(--primary)' }}>{LEGAL.supportEmail}</a>
        </div>
        <div style={{ fontSize: 12, marginTop: 8 }}>
          <Link to="/privacy" style={{ color: 'var(--text-muted)' }}>Privacy Policy</Link> · <Link to="/terms" style={{ color: 'var(--text-muted)' }}>Terms of Service</Link>
        </div>
      </div>

      {isParent && (
        <div style={card}>
          <div style={heading}>📦 YOUR FAMILY'S DATA</div>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 10 }}>
            Download a copy of everything FamilyHub holds about your family, or delete your family completely.
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button style={small} onClick={downloadData} disabled={!!busy}>{busy === 'export' ? 'Preparing…' : '⬇️ Download all data'}</button>
            <button style={{ ...small, color: '#F87171', borderColor: 'rgba(239,68,68,0.4)' }} onClick={deleteFamily} disabled={!!busy}>{busy === 'delete' ? 'Deleting…' : '🗑️ Delete family'}</button>
          </div>
        </div>
      )}
    </>
  );
}
