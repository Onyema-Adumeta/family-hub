import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';

function Shell({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 380 }}>
        <div style={{ textAlign: 'center', marginBottom: 24 }}>
          <div style={{ fontSize: 44, marginBottom: 8 }}>{icon}</div>
          <h1 style={{ fontSize: 24, fontWeight: 800, margin: 0 }}>{title}</h1>
        </div>
        {children}
        <div style={{ textAlign: 'center', marginTop: 20, fontSize: 13 }}>
          <Link to="/login" style={{ color: 'var(--primary)', fontWeight: 800 }}>Back to sign in</Link>
        </div>
      </div>
    </div>
  );
}
const label: React.CSSProperties = { display: 'block', fontSize: 12, fontWeight: 800, color: 'var(--text-secondary)', marginBottom: 6 };
const note = (ok: boolean): React.CSSProperties => ({
  padding: '10px 14px', borderRadius: 8, fontSize: 13, fontWeight: 700,
  background: ok ? 'rgba(74,222,128,0.1)' : 'rgba(248,113,113,0.1)',
  border: `1.5px solid ${ok ? 'rgba(74,222,128,0.3)' : 'rgba(248,113,113,0.3)'}`,
  color: ok ? '#4ADE80' : 'var(--danger)',
});

export function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError(''); setLoading(true);
    try { await api.post('/auth/forgot-password', { email: email.trim() }); setSent(true); }
    catch (err: any) { setError(err.response?.data?.error || 'Something went wrong'); }
    finally { setLoading(false); }
  }
  return (
    <Shell icon="🔑" title="Forgot your password?">
      {sent ? (
        <div style={note(true)}>
          If that email belongs to a FamilyHub account with a confirmed email, we've sent a link to reset the password. It works for 1 hour.
          Check your spam folder too.
        </div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <p style={{ margin: 0, fontSize: 13, color: 'var(--text-muted)' }}>
            Enter the email on your account. Kids: ask a parent to reset your password in Settings.
          </p>
          <div>
            <label style={label}>Email</label>
            <input className="input" type="email" value={email} onChange={e => setEmail(e.target.value)} required autoFocus autoComplete="email" />
          </div>
          {error && <div style={note(false)}>{error}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: 14, fontWeight: 800 }}>
            {loading ? 'Sending…' : 'Send reset link'}
          </button>
        </form>
      )}
    </Shell>
  );
}

export function ResetPasswordPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setError('');
    if (password !== confirm) { setError('The two passwords do not match'); return; }
    setLoading(true);
    try { await api.post('/auth/reset-password', { token, password }); setDone(true); useAuthStore.getState().logout(); }
    catch (err: any) { setError(err.response?.data?.error || 'Could not reset password'); }
    finally { setLoading(false); }
  }
  if (!token) return <Shell icon="⚠️" title="Link is incomplete"><div style={note(false)}>Open the link from your email again, or ask for a new one.</div></Shell>;
  return (
    <Shell icon="🔒" title="Choose a new password">
      {done ? (
        <div style={note(true)}>Your password has been changed and you've been signed out on all devices. <Link to="/login">Sign in</Link> with your new password.</div>
      ) : (
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={label}>New password (4+ characters)</label>
            <input className="input" type="password" value={password} onChange={e => setPassword(e.target.value)} minLength={4} required autoFocus autoComplete="new-password" />
          </div>
          <div>
            <label style={label}>Type it again</label>
            <input className="input" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} minLength={4} required autoComplete="new-password" />
          </div>
          {error && <div style={note(false)}>{error} {/expired|invalid|used/i.test(error) && <Link to="/forgot-password">Get a new link</Link>}</div>}
          <button className="btn btn-primary" type="submit" disabled={loading} style={{ padding: 14, fontWeight: 800 }}>
            {loading ? 'Saving…' : 'Save new password'}
          </button>
        </form>
      )}
    </Shell>
  );
}

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') || '';
  const [state, setState] = useState<'working' | 'ok' | 'error'>('working');
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const once = useRef(false);
  useEffect(() => {
    if (once.current) return; // links are single-use; don't double-submit in dev StrictMode
    once.current = true;
    if (!token) { setState('error'); setError('This link is incomplete.'); return; }
    api.post('/auth/verify-email', { token })
      .then(() => {
        setState('ok');
        const { member, setMember } = useAuthStore.getState();
        if (member) setMember({ ...member, emailVerifiedAt: new Date().toISOString() } as any);
      })
      .catch(err => { setState('error'); setError(err.response?.data?.error || 'Could not confirm email'); });
  }, [token]);
  return (
    <Shell icon={state === 'ok' ? '✅' : state === 'error' ? '⚠️' : '✉️'} title={state === 'ok' ? 'Email confirmed' : state === 'error' ? 'Could not confirm' : 'Confirming…'}>
      {state === 'ok' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={note(true)}>Thanks! You can now sign in with your email and reset your password if you ever forget it.</div>
          <button className="btn btn-primary" onClick={() => navigate('/')} style={{ padding: 14, fontWeight: 800 }}>Open FamilyHub</button>
        </div>
      )}
      {state === 'error' && <div style={note(false)}>{error}</div>}
    </Shell>
  );
}
